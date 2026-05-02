def call() {
    echo '>>> Running SCA Scan...'

    sh '''
        mkdir -p dependency-check-report
        mkdir -p /home/abby/jenkins_workspace/dependency-check-data
    '''

    catchError(buildResult: 'SUCCESS', stageResult: 'UNSTABLE') {
        sh '''
            set -eu
            docker run --rm \\
                -v "$WORKSPACE:/src" \\
                -v "$WORKSPACE/dependency-check-report:/report" \\
                -v /home/abby/jenkins_workspace/dependency-check-data:/usr/share/dependency-check/data \\
                owasp/dependency-check:latest \\
                --project "DocVault" \\
                --scan /src \\
                --exclude "**/.agent/**" \\
                --exclude "**/.agents/**" \\
                --exclude "**/generated/**" \\
                --exclude "**/prisma/generated/**" \\
                --exclude "**/node_modules/**" \\
                --exclude "**/.pnpm-store/**" \\
                --exclude "**/.turbo/**" \\
                --exclude "**/.next/**" \\
                --exclude "**/dist/**" \\
                --exclude "**/coverage/**" \\
                --exclude "**/.scannerwork/**" \\
                --exclude "**/dependency-check-report/**" \\
                --exclude "**/checkov-report/**" \\
                --exclude "**/zap-report/**" \\
                --format "HTML" \\
                --format "JSON" \\
                --out /report \\
                --failOnCVSS 7 \\
                --disableKnownExploited \\
                --noupdate
        '''
    }
}

return this
