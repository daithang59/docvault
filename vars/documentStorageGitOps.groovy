def call(Map cfg = [:]) {
    String terraformDir = cfg.terraformDir ?: 'infra/terraform/aws-eks'
    String valuesFile = cfg.documentStorageValuesFile ?: 'infra/k8s/values/document-service.yaml'
    String targetBranch = cfg.gitOpsBranch ?: 'gitops-testing'
    boolean applyTerraform = cfg.applyDocumentStorageTerraform != null &&
        cfg.applyDocumentStorageTerraform.toString().equalsIgnoreCase('true')
    boolean requireApproval = cfg.requireDocumentStorageApproval == null ||
        cfg.requireDocumentStorageApproval.toString().equalsIgnoreCase('true')
    String awsRegion = cfg.awsRegion ?: 'ap-southeast-1'

    echo ">>> Document storage GitOps target branch: ${targetBranch}"
    echo ">>> Terraform directory: ${terraformDir}"
    echo ">>> Values file: ${valuesFile}"
    echo ">>> APPLY_DOCUMENT_STORAGE_TERRAFORM=${applyTerraform}"
    echo ">>> DOCUMENT_STORAGE_REQUIRE_APPROVAL=${requireApproval}"

    assertCommand('terraform')
    assertCommand('yq')
    assertCommand('helm')
    assertCommand('git')

    withEnv(["AWS_REGION=${awsRegion}", "AWS_DEFAULT_REGION=${awsRegion}", 'TF_IN_AUTOMATION=true', 'TF_INPUT=false']) {
        sh """
            set -eu
            test -d '${terraformDir}'
            test -f '${valuesFile}'
            terraform -chdir='${terraformDir}' init -input=false
            terraform -chdir='${terraformDir}' fmt -check -recursive
            terraform -chdir='${terraformDir}' validate
            terraform -chdir='${terraformDir}' plan -input=false -out=tfplan
        """
    }

    if (!applyTerraform) {
        echo '>>> Terraform plan finished. Skipping apply and GitOps values update because APPLY_DOCUMENT_STORAGE_TERRAFORM=false.'
        return
    }

    if (requireApproval) {
        timeout(time: 10, unit: 'MINUTES') {
            input(
                message: "Apply Terraform document storage changes and update ${targetBranch}?",
                ok: 'Apply and update GitOps'
            )
        }
    }

    withEnv(["AWS_REGION=${awsRegion}", "AWS_DEFAULT_REGION=${awsRegion}", 'TF_IN_AUTOMATION=true', 'TF_INPUT=false']) {
        sh """
            set -eu
            terraform -chdir='${terraformDir}' apply -input=false tfplan
        """
    }

    def bucketName = terraformOutput(terraformDir, 'documents_bucket_name')
    def kmsKeyArn = terraformOutput(terraformDir, 'documents_kms_key_arn')
    def roleArn = terraformOutput(terraformDir, 'document_service_role_arn')

    updateGitOpsValues(cfg, targetBranch, valuesFile, bucketName, kmsKeyArn, roleArn)
}

void assertCommand(String commandName) {
    sh "command -v ${shellQuote(commandName)} >/dev/null 2>&1 || { echo 'Missing required command: ${commandName}'; exit 127; }"
}

String terraformOutput(String terraformDir, String outputName) {
    def value = sh(
        script: "terraform -chdir='${terraformDir}' output -raw '${outputName}'",
        returnStdout: true
    ).trim()

    if (!value) {
        error("Terraform output '${outputName}' is empty.")
    }

    return value
}

def updateGitOpsValues(cfg, String targetBranch, String valuesFile, String bucketName, String kmsKeyArn, String roleArn) {
    def gitOpsWorktree = sh(script: 'mktemp -d', returnStdout: true).trim()
    def askPassScript = '.git-askpass-document-storage.sh'

    withCredentials([usernamePassword(credentialsId: 'github-credentials', passwordVariable: 'GIT_PASS', usernameVariable: 'GIT_USER')]) {
        try {
            sh """
                set -eu
                cat > '${askPassScript}' <<'EOF'
#!/bin/sh
case "\$1" in
    *Username*) printf '%s\\n' "\$GIT_USER" ;;
    *Password*) printf '%s\\n' "\$GIT_PASS" ;;
    *) printf '\\n' ;;
esac
EOF
                chmod 700 '${askPassScript}'
            """

            withEnv([
                "GIT_ASKPASS=${env.WORKSPACE}/${askPassScript}",
                'GIT_TERMINAL_PROMPT=0',
                "DOCVAULT_S3_BUCKET=${bucketName}",
                "DOCVAULT_S3_KMS_KEY_ARN=${kmsKeyArn}",
                "DOCVAULT_DOCUMENT_SERVICE_ROLE_ARN=${roleArn}"
            ]) {
                def branchExists = sh(
                    script: "git ls-remote --exit-code --heads ${cfg.gitOpsRepoUrl} ${shellQuote(targetBranch)}",
                    returnStatus: true
                )
                if (branchExists != 0) {
                    error("GitOps branch '${targetBranch}' was not found on ${cfg.gitOpsRepoUrl}.")
                }

                sh "git clone --single-branch --branch ${shellQuote(targetBranch)} ${shellQuote(cfg.gitOpsRepoUrl)} ${shellQuote(gitOpsWorktree)}"

                def gitOpsValuesFile = "${gitOpsWorktree}/${valuesFile}"
                sh """
                    set -eu
                    test -f '${gitOpsValuesFile}'
                    yq e '.env.S3_BUCKET = strenv(DOCVAULT_S3_BUCKET)' -i '${gitOpsValuesFile}'
                    yq e '.env.S3_KMS_KEY_ID = strenv(DOCVAULT_S3_KMS_KEY_ARN)' -i '${gitOpsValuesFile}'
                    yq e '.env.S3_SERVER_SIDE_ENCRYPTION = "aws:kms"' -i '${gitOpsValuesFile}'
                    yq e '.env.S3_BUCKET_KEY_ENABLED = "true"' -i '${gitOpsValuesFile}'
                    yq e '.env.S3_USE_STATIC_CREDENTIALS = "false"' -i '${gitOpsValuesFile}'
                    yq e '.env.S3_ENDPOINT = ""' -i '${gitOpsValuesFile}'
                    yq e '.env.S3_FORCE_PATH_STYLE = "false"' -i '${gitOpsValuesFile}'
                    yq e '.serviceAccount.create = true' -i '${gitOpsValuesFile}'
                    yq e '.serviceAccount.name = "docvault-document-service"' -i '${gitOpsValuesFile}'
                    yq e '.serviceAccount.automountToken = true' -i '${gitOpsValuesFile}'
                    yq e '.serviceAccount.annotations."eks.amazonaws.com/role-arn" = strenv(DOCVAULT_DOCUMENT_SERVICE_ROLE_ARN)' -i '${gitOpsValuesFile}'
                    yq e 'del(.envValueFrom[]? | select(.name == "S3_ACCESS_KEY" or .name == "S3_SECRET_KEY"))' -i '${gitOpsValuesFile}'
                    yq e 'if (.envValueFrom == []) then del(.envValueFrom) else . end' -i '${gitOpsValuesFile}'

                    helm lint '${gitOpsWorktree}/infra/k8s/charts/docvault-service' \\
                      -f '${gitOpsWorktree}/infra/k8s/values/common-harbor.yaml' \\
                      -f '${gitOpsValuesFile}'

                    helm template docvault-document-service '${gitOpsWorktree}/infra/k8s/charts/docvault-service' \\
                      -f '${gitOpsWorktree}/infra/k8s/values/common-harbor.yaml' \\
                      -f '${gitOpsValuesFile}' >/dev/null
                """

                def changed = sh(
                    script: "git -C ${shellQuote(gitOpsWorktree)} status --porcelain",
                    returnStdout: true
                ).trim()
                if (!changed) {
                    echo '>>> Document storage values already match Terraform outputs. No GitOps commit needed.'
                    return
                }

                def commitMessage = '''Feed document-service from Terraform-owned S3/KMS outputs [skip ci]

Constraint: Values are generated from Terraform outputs after a validated Jenkins apply.
Confidence: medium
Scope-risk: moderate
Directive: Keep document-service GitOps values aligned with Terraform state outputs.
Tested: terraform validate; terraform plan; terraform apply; helm lint; helm template
Not-tested: Argo CD live sync and document upload smoke test
'''

                writeFile file: '.document-storage-gitops-commit-message.txt', text: commitMessage

                sh """
                    set -eu
                    git -C '${gitOpsWorktree}' config user.email "daithang59@users.noreply.github.com"
                    git -C '${gitOpsWorktree}' config user.name "daithang59"
                    git -C '${gitOpsWorktree}' add '${valuesFile}'
                    git -C '${gitOpsWorktree}' commit -F '${env.WORKSPACE}/.document-storage-gitops-commit-message.txt'
                """

                pushWithRetry(gitOpsWorktree, targetBranch)
            }
        } finally {
            sh "rm -f '${askPassScript}' '.document-storage-gitops-commit-message.txt'"
            sh "rm -rf '${gitOpsWorktree}'"
        }
    }
}

def pushWithRetry(String gitOpsWorktree, String targetBranch) {
    boolean pushed = false

    for (int attempt = 1; attempt <= 3; attempt++) {
        def pushStatus = sh(
            script: "git -C ${shellQuote(gitOpsWorktree)} push origin HEAD:${shellQuote(targetBranch)}",
            returnStatus: true
        )
        if (pushStatus == 0) {
            pushed = true
            echo ">>> GitOps push successful on attempt ${attempt}."
            break
        }

        if (attempt < 3) {
            echo ">>> GitOps push failed (attempt ${attempt}/3). Rebasing and retrying."
            sh """
                set -eu
                git -C '${gitOpsWorktree}' fetch origin '${targetBranch}'
                git -C '${gitOpsWorktree}' rebase 'origin/${targetBranch}'
            """
        }
    }

    if (!pushed) {
        error("Failed to push GitOps update to branch '${targetBranch}' after 3 attempts.")
    }
}

String shellQuote(String value) {
    return "'${value.replace("'", "'\"'\"'")}'"
}
