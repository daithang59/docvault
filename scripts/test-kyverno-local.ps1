param(
  [string]$KyvernoImage = "ghcr.io/kyverno/kyverno-cli:v1.12.0",
  [switch]$SkipInfraResources
)

$ErrorActionPreference = "Stop"

function Convert-ToWorkspacePath {
  param([string]$Path)

  $relativePath = Resolve-Path -Relative -Path $Path
  $normalized = $relativePath -replace '^\.\\', ''
  $normalized = $normalized -replace '\\', '/'
  return "/workspace/$normalized"
}

function Assert-Command {
  param([string]$Name)

  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "Required command '$Name' was not found on PATH."
  }
}

Assert-Command helm
Assert-Command docker

$repoRoot = (Resolve-Path ".").Path
$policyDir = Join-Path $repoRoot "policies\kyverno"
$renderedDir = Join-Path $repoRoot "policy-rendered"
$reportDir = Join-Path $repoRoot "policy-report"

if (-not (Test-Path $policyDir)) {
  throw "Kyverno policy directory not found: $policyDir"
}

Remove-Item -Recurse -Force -ErrorAction SilentlyContinue $renderedDir, $reportDir
New-Item -ItemType Directory -Force -Path $renderedDir, $reportDir | Out-Null

$commonValues = Join-Path $repoRoot "infra\k8s\values\common-harbor.yaml"
$serviceValues = Get-ChildItem -Path (Join-Path $repoRoot "infra\k8s\values") -Filter "*.yaml" |
  Where-Object { $_.BaseName -ne "common-harbor" -and $_.Name -notlike "*.example.yaml" }

foreach ($valuesFile in $serviceValues) {
  $releaseName = "docvault-$($valuesFile.BaseName)"
  $outFile = Join-Path $renderedDir "$($valuesFile.BaseName).yaml"
  $args = @(
    "template", $releaseName,
    "infra\k8s\charts\docvault-service",
    "-n", "docvault"
  )

  if (Test-Path $commonValues) {
    $args += @("-f", $commonValues)
  }

  $args += @("-f", $valuesFile.FullName)

  Write-Host "Rendering $($valuesFile.Name)"
  & helm @args | Set-Content -Path $outFile -Encoding UTF8
}

$resourceArgs = @()

if (-not $SkipInfraResources) {
  $infraRoots = @("infra\k8s", "infra\argocd-apps", "infra\argocd-bootstrap") |
    Where-Object { Test-Path $_ }

  $infraResources = Get-ChildItem -Path $infraRoots -Recurse -Include "*.yaml", "*.yml" |
    Where-Object {
      $_.FullName -notmatch '\\infra\\k8s\\charts\\' -and
      $_.FullName -notmatch '\\infra\\k8s\\values\\' -and
      $_.FullName -notmatch '\\infra\\k8s\\harbor\\'
    } |
    Where-Object { Select-String -Path $_.FullName -Pattern 'kind:' -Quiet }

  foreach ($resource in $infraResources) {
    $resourceArgs += @("--resource", (Convert-ToWorkspacePath $resource.FullName))
  }
}

foreach ($resource in Get-ChildItem -Path $renderedDir -Filter "*.yaml") {
  $resourceArgs += @("--resource", (Convert-ToWorkspacePath $resource.FullName))
}

if ($resourceArgs.Count -eq 0) {
  throw "No Kubernetes resources were found for Kyverno."
}

Write-Host "Running Kyverno against $($resourceArgs.Count / 2) resource file(s)"

$reportPath = Join-Path $reportDir "kyverno-report.txt"
$dockerArgs = @(
  "run", "--rm",
  "-v", "${repoRoot}:/workspace",
  "-w", "/workspace",
  $KyvernoImage,
  "apply", "/workspace/policies/kyverno"
) + $resourceArgs + @("--detailed-results")

& docker @dockerArgs 2>&1 | Tee-Object -FilePath $reportPath

if ($LASTEXITCODE -ne 0) {
  throw "Kyverno policy check failed. See $reportPath"
}

Write-Host "Kyverno policy check passed. Report: $reportPath"
