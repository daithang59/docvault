def call(cfg, builtServicesCsv) {
    def tag = "v${env.BUILD_NUMBER}"
    def builtList = builtServicesCsv.split(',')

    echo '>>> Logging into Docker Hub...'
    withCredentials([usernamePassword(credentialsId: 'dockerhub-credentials', passwordVariable: 'DOCKER_PASS', usernameVariable: 'DOCKER_USER')]) {
        sh 'echo $DOCKER_PASS | docker login -u $DOCKER_USER --password-stdin'

        builtList.each { service ->
            def imageName = (service == cfg.webAppName) ? cfg.webImageName : service
            echo ">>> Pushing ${cfg.dockerOrg}/${imageName}:${tag} to Docker Hub..."
            sh "docker push ${cfg.dockerOrg}/${imageName}:${tag}"
            sh "docker push ${cfg.dockerOrg}/${imageName}:latest"
        }
    }

    echo '>>> Updating Helm values with new image tags...'
    builtList.each { service ->
        def fileName = (service == cfg.webAppName) ? 'web.yaml' : "${service}.yaml"
        sh "sed -i 's/tag: .*/tag: \"${tag}\"/' ${cfg.helmValuesDir}/${fileName}"
    }

    withCredentials([usernamePassword(credentialsId: 'github-credentials', passwordVariable: 'GIT_PASS', usernameVariable: 'GIT_USER')]) {
        sh """
            git config user.email \"truongnguyenduyp6@gmail.com\"
            git config user.name \"duyimew\"
            git add ${cfg.helmValuesDir}/*.yaml
            git commit -m \"chore(gitops): update tags for ${builtServicesCsv} to ${tag} [skip ci]\"
            git push https://${GIT_USER}:${GIT_PASS}@github.com/duyimew/docvault.git HEAD:${cfg.gitOpsBranch}
        """
    }
}

return this
