def call(cfg) {
    echo '>>> Running Checkov IaC Scan (Docker & Helm)...'
    sh """
        set -eu
        mkdir -p checkov-report
        status_file=$(mktemp)
        (
            docker run --rm \\
                -v ${env.WORKSPACE}:/tf \\
                -w /tf \\
                ${cfg.checkovImage} \\
                --directory /tf \\
                --framework dockerfile,helm \\
                --output cli
            echo $? > "$status_file"
        ) | tee checkov-report/checkov-report.txt

        status=$(cat "$status_file")
        rm -f "$status_file"
        test "$status" -eq 0
    """
}

return this
