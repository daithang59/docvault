def call(cfg) {
    echo '>>> Running SAST Scan (SonarQube)...'

    withSonarQubeEnv(cfg.sonarQubeInstallation) {
        sh """
            set -eu
            SONAR_HOST=\"\${SONAR_HOST_URL:-${cfg.sonarHostUrl}}\"
            docker run --rm \\
                --network host \\
                -v ${env.WORKSPACE}:/usr/src \\
                -w /usr/src \\
                -e SONAR_TOKEN=\"$SONAR_AUTH_TOKEN\" \\
                ${cfg.sonarScannerImage} \\
                -Dsonar.projectKey=${cfg.sonarProjectKey} \\
                -Dsonar.sources=. \\
                -Dsonar.host.url=\"$SONAR_HOST\"
        """
    }
}
