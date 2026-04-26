def call() {
    echo '>>> Running SCA Scan...'
    sh 'mkdir -p dependency-check-report'
    sh """
        set -eu
        docker run --rm \\
            -v ${env.WORKSPACE}:/src \\
            -v ${env.WORKSPACE}/dependency-check-report:/report \\
            -v /home/abby/jenkins_workspace/dependency-check-data:/usr/share/dependency-check/data \\
            owasp/dependency-check:latest \\
            --project \"DocVault\" \\
            --scan /src \\
            --exclude \"**/node_modules/**\" \\
            --exclude \"**/.pnpm-store/**\" \\
            --format \"HTML\" \\
            --format \"JSON\" \\
            --out /report \\
            --failOnCVSS 7 \\
            --disableKnownExploited \\
            --noupdate
    """
}

return this
