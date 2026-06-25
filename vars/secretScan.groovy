def call() {
    echo '>>> Running Secret Scan (TruffleHog)...'

    writeFile(
        file: '.trufflehog-exclude',
        text: '''(^|/)\\.git(/|$)
(^|/)\\.pnpm-store(/|$)
(^|/)node_modules(/|$)
(^|/)\\.turbo(/|$)
(^|/)\\.next(/|$)
(^|/)\\.terraform(/|$)
\\.tfstate(\\..*)?$
\\.tfvars$
(^|/)tfplan$
\\.tfplan$
-secret\\.json$
\\.kubeconfig$
(^|/)secret-scan-report(/|$)
(^|/)dependency-check-report(/|$)
(^|/)trivy-fs-report(/|$)
(^|/)checkov-report(/|$)
(^|/)zap-report(/|$)
(^|/)report(/|$)
'''
    )

    def status = sh(
        script: """
            set -eu
            mkdir -p secret-scan-report
            report="secret-scan-report/trufflehog-report.txt"
            : > "\$report"

            echo ">>> Scanning repository for leaked secrets..."

            set +e
            docker run --rm \
                -v ${env.WORKSPACE}:/workspace:ro \
                trufflesecurity/trufflehog:latest \
                filesystem /workspace --fail \
                --exclude-paths /workspace/.trufflehog-exclude \
                > "\$report" 2>&1
            exit_code=\$?
            set -e

            rm -f .trufflehog-exclude

            {
                echo ""
                echo ">>> TruffleHog exit code: \${exit_code}"
                echo ">>> Report path: \${report}"
            } >> "\$report"

            if [ ! -s "\$report" ]; then
                echo "TruffleHog exited with code \${exit_code} but produced no output." > "\$report"
            fi

            cat "\$report"
            exit \$exit_code
        """,
        returnStatus: true
    )

    if (!fileExists('secret-scan-report/trufflehog-report.txt')) {
        writeFile(
            file: 'secret-scan-report/trufflehog-report.txt',
            text: "Secret scan failed before creating a TruffleHog report. Jenkins shell status: ${status}\n"
        )
    }

    archiveArtifacts artifacts: 'secret-scan-report/**', allowEmptyArchive: false

    if (status != 0) {
        error("Secret scan failed with TruffleHog exit code ${status}. Check secret-scan-report/trufflehog-report.txt.")
    } else {
        echo ">>> No secrets detected."
    }
}
