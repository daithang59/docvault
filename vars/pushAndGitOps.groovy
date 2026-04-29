def call(cfg, builtServicesCsv) {
    def tag = "v${env.BUILD_NUMBER}"
    def builtList = parseBuiltServices(builtServicesCsv)

    if (!builtList) {
        echo '>>> No built services to publish.'
        return
    }

    def targetBranch = cfg.gitOpsBranch
    echo ">>> GitOps target branch: ${targetBranch}"

    def imageDigests = pushImages(cfg, builtList, tag)
    updateGitOpsBranch(cfg, builtList, tag, imageDigests, targetBranch)
}

def parseBuiltServices(builtServicesCsv) {
    if (!builtServicesCsv?.trim()) {
        return []
    }

    return builtServicesCsv
        .split(',')
        .collect { it.trim() }
        .findAll { it }
        .unique()
}

def pushImages(cfg, builtList, tag) {
    echo '>>> Logging into Docker Hub...'

    def dockerConfigDir = sh(script: 'mktemp -d', returnStdout: true).trim()
    def imageDigests = [:]

    try {
        withEnv(["DOCKER_CONFIG=${dockerConfigDir}"]) {
            withCredentials([usernamePassword(credentialsId: 'dockerhub-credentials', passwordVariable: 'DOCKER_PASS', usernameVariable: 'DOCKER_USER')]) {
                sh 'echo "$DOCKER_PASS" | docker login -u "$DOCKER_USER" --password-stdin'

                builtList.each { service ->
                    def imageName = imageNameForService(cfg, service)
                    def repository = "${cfg.dockerOrg}/${imageName}"
                    def taggedImage = "${repository}:${tag}"

                    echo ">>> Pushing ${taggedImage} to Docker Hub..."
                    sh "docker push ${taggedImage}"
                    sh "docker push ${repository}:latest"

                    imageDigests[service] = resolveImageDigest(repository, tag)
                }

                sh 'docker logout || true'
            }
        }
    } finally {
        sh "rm -rf '${dockerConfigDir}'"
    }

    return imageDigests
}

def imageNameForService(cfg, service) {
    return service == cfg.webAppName ? cfg.webImageName : service
}

def valuesFileForService(cfg, service) {
    return service == cfg.webAppName ? 'web.yaml' : "${service}.yaml"
}

def resolveImageDigest(repository, tag) {
    def imageRef = "${repository}:${tag}"
    def digest = sh(
        script: """
            set +e
            digest=""
            if docker buildx version >/dev/null 2>&1; then
                digest=\$(docker buildx imagetools inspect '${imageRef}' 2>/dev/null | awk '/^Digest:/ {print \$2; exit}')
            fi
            if [ -z "\$digest" ] || [ "\$digest" = "null" ]; then
                digest=\$(docker inspect --format='{{index .RepoDigests 0}}' '${imageRef}' 2>/dev/null | sed 's/.*@//')
            fi
            [ "\$digest" = "null" ] && digest=""
            printf '%s' "\$digest"
        """,
        returnStdout: true
    ).trim()

    if (!digest) {
        echo ">>> WARNING: Could not resolve digest for ${imageRef}. Helm values will use tag only."
        return ''
    }

    echo ">>> Resolved ${imageRef} digest: ${digest}"
    return digest
}

def updateGitOpsBranch(cfg, builtList, tag, imageDigests, targetBranch) {
    echo '>>> Updating Helm values with new image references...'

    def askPassScript = '.git-askpass.sh'
    def gitOpsWorktree = sh(script: 'mktemp -d', returnStdout: true).trim()

    withCredentials([usernamePassword(credentialsId: 'github-credentials', passwordVariable: 'GIT_PASS', usernameVariable: 'GIT_USER')]) {
        try {
            sh """
                set -eu
                cat > '${askPassScript}' <<'EOF'
#!/bin/sh
case "\$1" in
    *Username*) printf '%s\\n' "\$GIT_USER" ;;
    *Password*) printf '%s\\n' "\$GIT_PASS" ;;
    *) printf '\\n' ;;
esac
EOF
                chmod 700 '${askPassScript}'
            """

            withEnv(["GIT_ASKPASS=${env.WORKSPACE}/${askPassScript}", 'GIT_TERMINAL_PROMPT=0']) {
                def branchExists = sh(
                    script: "git ls-remote --exit-code --heads ${cfg.gitOpsRepoUrl} ${targetBranch}",
                    returnStatus: true
                )
                if (branchExists != 0) {
                    error("GitOps branch '${targetBranch}' was not found on ${cfg.gitOpsRepoUrl}. Create the branch before running this pipeline.")
                }

                sh "git clone --single-branch --branch '${targetBranch}' '${cfg.gitOpsRepoUrl}' '${gitOpsWorktree}'"

                builtList.each { service ->
                    def fileName = valuesFileForService(cfg, service)
                    def valuesFile = "${gitOpsWorktree}/${cfg.helmValuesDir}/${fileName}"
                    def digest = imageDigests[service] ?: ''

                    sh """
                        set -eu
                        test -f '${valuesFile}'
                        sed -i -E 's/^([[:space:]]*)tag:.*/\\1tag: "${tag}"/' '${valuesFile}'
                        sed -i -E 's/^([[:space:]]*)digest:.*/\\1digest: "${digest}"/' '${valuesFile}'
                    """
                }

                def changed = sh(
                    script: "git -C '${gitOpsWorktree}' status --porcelain -- '${cfg.helmValuesDir}'",
                    returnStdout: true
                ).trim()
                if (!changed) {
                    echo '>>> No Helm value updates detected. Skipping GitOps commit/push.'
                    return
                }

                sh """
                    set -eu
                    git -C '${gitOpsWorktree}' config user.email "daithang59@users.noreply.github.com"
                    git -C '${gitOpsWorktree}' config user.name "daithang59"
                    git -C '${gitOpsWorktree}' add '${cfg.helmValuesDir}'/*.yaml
                    git -C '${gitOpsWorktree}' commit -m "chore(gitops): update image refs for ${builtList.join(',')} to ${tag} [skip ci]"
                """

                pushWithRetry(gitOpsWorktree, targetBranch)
            }
        } finally {
            sh "rm -f '${askPassScript}'"
            sh "rm -rf '${gitOpsWorktree}'"
        }
    }
}

def pushWithRetry(gitOpsWorktree, targetBranch) {
    def pushed = false

    for (int attempt = 1; attempt <= 3; attempt++) {
        def pushStatus = sh(
            script: "git -C '${gitOpsWorktree}' push origin HEAD:${targetBranch}",
            returnStatus: true
        )
        if (pushStatus == 0) {
            pushed = true
            echo ">>> GitOps push successful on attempt ${attempt}."
            break
        }

        if (attempt < 3) {
            echo ">>> GitOps push failed (attempt ${attempt}/3). Rebasing and retrying."
            sh """
                set -eu
                git -C '${gitOpsWorktree}' fetch origin '${targetBranch}'
                git -C '${gitOpsWorktree}' rebase 'origin/${targetBranch}'
            """
        }
    }

    if (!pushed) {
        error("Failed to push GitOps update to branch '${targetBranch}' after 3 attempts.")
    }
}
