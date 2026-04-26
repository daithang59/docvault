def call(cfg, builtServicesCsv) {
    def tag = "v${env.BUILD_NUMBER}"
    def builtList = builtServicesCsv
        .split(',')
        .collect { it.trim() }
        .findAll { it }

    if (!builtList) {
        echo '>>> No built services to publish.'
        return
    }

    def targetBranch = cfg.gitOpsBranch
    echo ">>> GitOps target branch: ${targetBranch}"

    pushImages(cfg, builtList, tag)
    updateGitOpsBranch(cfg, builtList, tag, targetBranch)
}

def pushImages(cfg, builtList, tag) {
    echo '>>> Logging into Docker Hub...'

    def dockerConfigDir = sh(script: 'mktemp -d', returnStdout: true).trim()

    try {
        withEnv(["DOCKER_CONFIG=${dockerConfigDir}"]) {
            withCredentials([usernamePassword(credentialsId: 'dockerhub-credentials', passwordVariable: 'DOCKER_PASS', usernameVariable: 'DOCKER_USER')]) {
                sh 'echo "$DOCKER_PASS" | docker login -u "$DOCKER_USER" --password-stdin'

                builtList.each { service ->
                    def imageName = (service == cfg.webAppName) ? cfg.webImageName : service
                    echo ">>> Pushing ${cfg.dockerOrg}/${imageName}:${tag} to Docker Hub..."
                    sh "docker push ${cfg.dockerOrg}/${imageName}:${tag}"
                    sh "docker push ${cfg.dockerOrg}/${imageName}:latest"
                }

                sh 'docker logout || true'
            }
        }
    } finally {
        sh "rm -rf '${dockerConfigDir}'"
    }
}

def updateGitOpsBranch(cfg, builtList, tag, targetBranch) {
    echo '>>> Updating Helm values with new image tags...'

    def askPassScript = '.git-askpass.sh'
    withCredentials([usernamePassword(credentialsId: 'github-credentials', passwordVariable: 'GIT_PASS', usernameVariable: 'GIT_USER')]) {
        try {
            sh """
                set -eu
                cat > ${askPassScript} <<'EOF'
#!/bin/sh
case "\$1" in
    *Username*) echo "\$GIT_USER" ;;
    *Password*) echo "\$GIT_PASS" ;;
    *) echo "" ;;
esac
EOF
                chmod 700 ${askPassScript}
            """

            withEnv(["GIT_ASKPASS=${env.WORKSPACE}/${askPassScript}", 'GIT_TERMINAL_PROMPT=0']) {
                def branchExists = sh(
                    script: "git ls-remote --exit-code --heads ${cfg.gitOpsRepoUrl} ${targetBranch}",
                    returnStatus: true
                )
                if (branchExists != 0) {
                    error("GitOps branch '${targetBranch}' was not found on ${cfg.gitOpsRepoUrl}. Create the branch before running this pipeline.")
                }

                sh "git remote remove gitops || true"
                sh "git remote add gitops ${cfg.gitOpsRepoUrl}"
                sh "git fetch gitops ${targetBranch}"
                sh "git checkout -B gitops-update FETCH_HEAD"

                builtList.each { service ->
                    def fileName = (service == cfg.webAppName) ? 'web.yaml' : "${service}.yaml"
                    sh "sed -i 's/tag: .*/tag: \\\"${tag}\\\"/' ${cfg.helmValuesDir}/${fileName}"
                }

                def changed = sh(script: "git status --porcelain ${cfg.helmValuesDir}", returnStdout: true).trim()
                if (!changed) {
                    echo '>>> No Helm value updates detected. Skipping GitOps commit/push.'
                    return
                }

                sh """
                    set -eu
                    git config user.email \"truongnguyenduyp6@gmail.com\"
                    git config user.name \"duyimew\"
                    git add ${cfg.helmValuesDir}/*.yaml
                    git commit -m \"chore(gitops): update tags for ${builtList.join(',')} to ${tag} [skip ci]\"
                """

                def pushed = false
                for (int attempt = 1; attempt <= 3; attempt++) {
                    def pushStatus = sh(script: "git push gitops HEAD:${targetBranch}", returnStatus: true)
                    if (pushStatus == 0) {
                        pushed = true
                        echo ">>> GitOps push successful on attempt ${attempt}."
                        break
                    }

                    if (attempt < 3) {
                        echo ">>> GitOps push failed (attempt ${attempt}/3). Fetching latest branch and rebasing before retry."
                        sh "git fetch gitops ${targetBranch}"
                        sh "git rebase FETCH_HEAD"
                    }
                }

                if (!pushed) {
                    error("Failed to push GitOps update to branch '${targetBranch}' after 3 attempts.")
                }
            }
        } finally {
            sh "rm -f ${askPassScript}"
            sh 'git remote remove gitops || true'
        }
    }
}

return this
