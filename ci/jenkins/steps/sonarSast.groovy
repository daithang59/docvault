def call(cfg) {
    echo '>>> Running SAST Scan (SonarQube)...'

    withSonarQubeEnv(cfg.sonarQubeInstallation) {
        withEnv([
            "SONAR_SCANNER_IMAGE=${cfg.sonarScannerImage}",
            "SONAR_PROJECT_KEY=${cfg.sonarProjectKey}",
            "SONAR_HOST_FALLBACK=${cfg.sonarHostUrl}"
        ]) {
            sh '''
            set -eu
            SONAR_HOST="${SONAR_HOST_URL:-$SONAR_HOST_FALLBACK}"
            docker run --rm \\
                --network host \\
                -v "$WORKSPACE:/usr/src" \\
                -w /usr/src \\
                -e SONAR_TOKEN="$SONAR_AUTH_TOKEN" \\
                "$SONAR_SCANNER_IMAGE" \\
                -Dsonar.projectKey="$SONAR_PROJECT_KEY" \\
                -Dsonar.sources=. \\
                -Dsonar.host.url=\"$SONAR_HOST\"
            '''
        }
    }
}

return this
