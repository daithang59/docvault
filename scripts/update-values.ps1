param(
  [switch]$Apply,
  [switch]$SkipTerraform,
  [switch]$Commit,
  [switch]$Push,
  [switch]$AllowDirty,
  [string]$TargetBranch = "gitops-testing",
  [string]$UpdateBranch = "chore/docvault-s3-kms-values",
  [string]$ValuesFile = "infra/k8s/values/document-service.yaml"
)

$ErrorActionPreference = "Stop"

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$TerraformDir = Join-Path $RepoRoot "infra/terraform/aws-eks"
$ValuesPath = Join-Path $RepoRoot $ValuesFile
$PlanFile = Join-Path $TerraformDir "tfplan"

function Assert-Command {
  param([string]$Name)

  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "Missing required command: $Name"
  }
}

function Invoke-InDirectory {
  param(
    [string]$Path,
    [scriptblock]$Command
  )

  Push-Location $Path
  try {
    & $Command
  } finally {
    Pop-Location
  }
}

function Get-TerraformOutput {
  param([string]$Name)

  $value = Invoke-InDirectory $TerraformDir {
    terraform output -raw $Name
  }

  $value = "$value".Trim()
  if (-not $value) {
    throw "Terraform output '$Name' is empty."
  }

  return $value
}

function Set-YqString {
  param(
    [string]$Expression,
    [string]$EnvName,
    [string]$Value
  )

  Set-Item -Path "env:$EnvName" -Value $Value
  yq e $Expression -i $ValuesPath
}

Assert-Command terraform
Assert-Command yq
Assert-Command helm
Assert-Command git

if (-not (Test-Path $ValuesPath)) {
  throw "Values file not found: $ValuesPath"
}

if ($Push -and -not $Commit) {
  throw "-Push requires -Commit."
}

if (($Commit -or $Push) -and -not $AllowDirty) {
  $dirty = git -C $RepoRoot status --porcelain
  if ($dirty) {
    throw "Working tree is dirty. Commit/stash your changes or rerun with -AllowDirty."
  }
}

if ($Commit -or $Push) {
  $currentBranch = (git -C $RepoRoot branch --show-current).Trim()
  if ($currentBranch -ne $UpdateBranch) {
    git -C $RepoRoot show-ref --verify --quiet "refs/heads/$UpdateBranch"
    if ($LASTEXITCODE -eq 0) {
      git -C $RepoRoot switch $UpdateBranch
    } else {
      git -C $RepoRoot switch -c $UpdateBranch
    }
  }
}

if (-not $SkipTerraform) {
  Write-Host "1. Terraform init/fmt/validate/plan..." -ForegroundColor Cyan
  Invoke-InDirectory $TerraformDir {
    terraform init -input=false
    terraform fmt -check -recursive
    terraform validate
    terraform plan -input=false -out="$PlanFile"
  }

  if (-not $Apply) {
    Write-Host "Terraform plan created at $PlanFile. Rerun with -Apply to apply and update Helm values." -ForegroundColor Yellow
    exit 0
  }

  Write-Host "2. Terraform apply saved plan..." -ForegroundColor Cyan
  Invoke-InDirectory $TerraformDir {
    terraform apply -input=false "$PlanFile"
  }
} else {
  Write-Host "1. Skipping Terraform plan/apply; reading existing Terraform outputs." -ForegroundColor Cyan
}

Write-Host "3. Reading Terraform outputs..." -ForegroundColor Cyan
$BucketName = Get-TerraformOutput "documents_bucket_name"
$KmsKeyArn = Get-TerraformOutput "documents_kms_key_arn"
$RoleArn = Get-TerraformOutput "document_service_role_arn"
$Region = Get-TerraformOutput "region"

Write-Host "4. Updating Helm values with yq..." -ForegroundColor Cyan
Set-YqString '.env.S3_BUCKET = strenv(DOCVAULT_S3_BUCKET)' "DOCVAULT_S3_BUCKET" $BucketName
Set-YqString '.env.S3_REGION = strenv(DOCVAULT_S3_REGION)' "DOCVAULT_S3_REGION" $Region
Set-YqString '.env.S3_KMS_KEY_ID = strenv(DOCVAULT_S3_KMS_KEY_ARN)' "DOCVAULT_S3_KMS_KEY_ARN" $KmsKeyArn
Set-YqString '.serviceAccount.annotations."eks.amazonaws.com/role-arn" = strenv(DOCVAULT_DOCUMENT_SERVICE_ROLE_ARN)' "DOCVAULT_DOCUMENT_SERVICE_ROLE_ARN" $RoleArn

yq e '.env.S3_SERVER_SIDE_ENCRYPTION = "aws:kms"' -i $ValuesPath
yq e '.env.S3_BUCKET_KEY_ENABLED = "true"' -i $ValuesPath
yq e '.env.S3_USE_STATIC_CREDENTIALS = "false"' -i $ValuesPath
yq e '.env.S3_ENDPOINT = ""' -i $ValuesPath
yq e '.env.S3_FORCE_PATH_STYLE = "false"' -i $ValuesPath
yq e '.serviceAccount.create = true' -i $ValuesPath
yq e '.serviceAccount.name = "docvault-document-service"' -i $ValuesPath
yq e '.serviceAccount.automountToken = true' -i $ValuesPath
yq e 'del(.envValueFrom[]? | select(.name == "S3_ACCESS_KEY" or .name == "S3_SECRET_KEY"))' -i $ValuesPath
yq e 'if (.envValueFrom == []) then del(.envValueFrom) else . end' -i $ValuesPath

Write-Host "5. Validating Helm render..." -ForegroundColor Cyan
helm lint (Join-Path $RepoRoot "infra/k8s/charts/docvault-service") `
  -f (Join-Path $RepoRoot "infra/k8s/values/common-harbor.yaml") `
  -f $ValuesPath

helm template docvault-document-service (Join-Path $RepoRoot "infra/k8s/charts/docvault-service") `
  -f (Join-Path $RepoRoot "infra/k8s/values/common-harbor.yaml") `
  -f $ValuesPath | Out-Null

if (-not $Commit) {
  Write-Host "Values updated locally: $ValuesFile" -ForegroundColor Green
  Write-Host "Review the diff, then commit or rerun with -Commit." -ForegroundColor Yellow
  exit 0
}

Write-Host "6. Creating GitOps commit..." -ForegroundColor Cyan
git -C $RepoRoot add $ValuesPath

$pending = git -C $RepoRoot diff --cached --name-only
if (-not $pending) {
  Write-Host "No values changes to commit." -ForegroundColor Yellow
  exit 0
}

$CommitMessage = @"
Feed document-service from Terraform-owned S3/KMS outputs

Constraint: Values are generated from Terraform outputs after a validated apply.
Confidence: medium
Scope-risk: moderate
Directive: Keep document-service GitOps values aligned with Terraform state outputs.
Tested: terraform validate; helm lint; helm template
Not-tested: Argo CD live sync and document upload smoke test
"@

$CommitMessagePath = Join-Path ([System.IO.Path]::GetTempPath()) "docvault-s3-kms-commit-message.txt"
Set-Content -LiteralPath $CommitMessagePath -Value $CommitMessage -Encoding UTF8
git -C $RepoRoot commit -F $CommitMessagePath

if ($Push) {
  Write-Host "7. Pushing branch $UpdateBranch for PR into $TargetBranch..." -ForegroundColor Cyan
  git -C $RepoRoot push -u origin $UpdateBranch
  Write-Host "Open a PR from '$UpdateBranch' into '$TargetBranch'. Argo CD tracks '$TargetBranch'." -ForegroundColor Green
} else {
  Write-Host "Commit created on local branch. Push and open a PR into '$TargetBranch'." -ForegroundColor Green
}
