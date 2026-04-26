def call(cfg) {
    echo '>>> Running Checkov IaC Scan (Docker & Helm)...'

    withEnv(["CHECKOV_IMAGE=${cfg.checkovImage}"]) {
        sh '''
            set -eu
            mkdir -p checkov-report
            status_file=$(mktemp)
            (
                docker run --rm \
                    -v "$WORKSPACE:/tf" \
                    -w /tf \
                    "$CHECKOV_IMAGE" \
                    --directory /tf \
                    --framework dockerfile,helm \
                    --output cli
                echo $? > "$status_file"
            ) | tee checkov-report/checkov-report.txt

            status=$(cat "$status_file")
            rm -f "$status_file"
            test "$status" -eq 0
        '''
    }
}
