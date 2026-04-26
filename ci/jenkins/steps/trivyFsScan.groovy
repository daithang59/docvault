def call(cfg) {
    echo '>>> Running Trivy Filesystem Scan...'
    sh """
        set -eu
        docker run --rm \\
            -v ${env.WORKSPACE}:/src \\
            ${cfg.trivyImage} \\
            fs /src --scanners vuln,secret,misconfig --severity HIGH,CRITICAL --exit-code 1 --no-progress --skip-dirs .pnpm-store,node_modules
    """
}

return this
