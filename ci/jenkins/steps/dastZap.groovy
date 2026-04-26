def call(cfg) {
    echo '>>> Running DAST Scan against Gateway API...'
    sh 'mkdir -p zap-report'
    sh """
        set -eu
        docker run --rm \\
            -v \$(pwd)/zap-report:/zap/wrk:rw \\
            ghcr.io/zaproxy/zaproxy:stable zap-baseline.py \\
            -t ${cfg.zapTarget} \\
            -r zap_report.html \\
            -J zap_report.json
    """
}

return this
