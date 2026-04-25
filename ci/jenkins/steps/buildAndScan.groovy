def call(cfg) {
    def tag = "v${env.BUILD_NUMBER}"
    def builtList = []
    def manualTrigger = (env.BUILD_CAUSE == 'MANUALTRIGGER')

    cfg.services.each { service ->
        def changed = sh(
            script: "git diff --name-only HEAD~1 HEAD | grep -E '^services/${service}/|^libs/' || true",
            returnStdout: true
        ).trim()

        if (changed || manualTrigger) {
            echo ">>> Changes detected for ${service}. Building ${tag}..."
            sh "docker build -t ${cfg.dockerOrg}/${service}:${tag} -t ${cfg.dockerOrg}/${service}:latest --build-arg SERVICE_NAME=${service} -f ${cfg.backendDockerfile} ."

            echo ">>> Scanning Image ${cfg.dockerOrg}/${service}:${tag}..."
            sh """
                docker run --rm \\
                    -v /var/run/docker.sock:/var/run/docker.sock \\
                    ${cfg.trivyImage} \\
                    image --severity HIGH,CRITICAL ${cfg.dockerOrg}/${service}:${tag}
            """
            builtList.add(service)
        } else {
            echo ">>> No changes in services/${service}/ or libs/. Skipping build for ${service}."
        }
    }

    def webChanged = sh(script: "git diff --name-only HEAD~1 HEAD | grep '^apps/web/' || true", returnStdout: true).trim()
    if (webChanged || manualTrigger) {
        echo '>>> Changes detected for web app. Building...'
        sh "docker build -t ${cfg.dockerOrg}/${cfg.webImageName}:${tag} -t ${cfg.dockerOrg}/${cfg.webImageName}:latest -f ${cfg.webDockerfile} ."
        builtList.add(cfg.webAppName)
    }

    return builtList.join(',')
}

return this
