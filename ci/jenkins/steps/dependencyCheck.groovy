def call() {
    echo '>>> Running SCA Scan...'
    sh 'mkdir -p dependency-check-report'
    sh """
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
            --out /report \\
            --disableNodeAudit \\
            --disableKnownExploited \\
            --noupdate
    """
}

return this
