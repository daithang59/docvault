def call(Map cfg = [:]) {
    echo '>>> Detecting changed paths...'

    boolean forceBuildAll = shouldForceBuildAll()
    String diffRange = forceBuildAll ? '' : resolveDiffRange()
    List changedFiles = []
    boolean diffReliable = false

    if (!forceBuildAll && diffRange) {
        changedFiles = getChangedFiles(diffRange)
        diffReliable = true
        echo ">>> Change detection diff range: ${diffRange}"
        echo ">>> Changed paths detected: ${changedFiles.size()}"
        changedFiles.take(50).each { path ->
            echo ">>> changed: ${path}"
        }
        if (changedFiles.size() > 50) {
            echo ">>> changed: ... ${changedFiles.size() - 50} more path(s)"
        }
    }

    if (!forceBuildAll && !diffRange) {
        echo '>>> Could not determine a reliable diff range. Enabling full validation for safety.'
        forceBuildAll = true
    }

    boolean docsOnly = diffReliable && changedFiles && changedFiles.every { isDocsPath(it) }
    boolean appChanged = forceBuildAll || changedFiles.any { isAppPath(it, cfg) }
    boolean infraChanged = forceBuildAll || changedFiles.any { isInfraPath(it) }
    boolean gitOpsInfraChanged = forceBuildAll || changedFiles.any { it.startsWith('infra/k8s/') }
    boolean pipelineChanged = changedFiles.any { isPipelinePath(it) }
    boolean unknownChanged = changedFiles.any { !isKnownPath(it, cfg) }

    boolean runAppCi = forceBuildAll || appChanged || unknownChanged
    boolean runSecurityCi = forceBuildAll || appChanged || infraChanged || pipelineChanged || unknownChanged
    boolean runIacCi = forceBuildAll || infraChanged || unknownChanged
    boolean runImageBuild = forceBuildAll || appChanged

    echo ">>> FORCE_BUILD_ALL effective: ${forceBuildAll}"
    echo ">>> Docs-only change set: ${docsOnly}"
    echo ">>> App changes detected: ${appChanged}"
    echo ">>> Infra changes detected: ${infraChanged}"
    echo ">>> GitOps infra changes detected: ${gitOpsInfraChanged}"
    echo ">>> Pipeline changes detected: ${pipelineChanged}"
    echo ">>> Unknown path changes detected: ${unknownChanged}"
    echo ">>> RUN_APP_CI=${runAppCi}"
    echo ">>> RUN_SECURITY_CI=${runSecurityCi}"
    echo ">>> RUN_IAC_CI=${runIacCi}"
    echo ">>> RUN_IMAGE_BUILD=${runImageBuild}"

    return [
        diffRange: diffRange,
        diffReliable: diffReliable,
        changedFiles: changedFiles,
        forceBuildAll: forceBuildAll,
        docsOnly: docsOnly,
        appChanged: appChanged,
        infraChanged: infraChanged,
        gitOpsInfraChanged: gitOpsInfraChanged,
        pipelineChanged: pipelineChanged,
        unknownChanged: unknownChanged,
        runAppCi: runAppCi,
        runSecurityCi: runSecurityCi,
        runIacCi: runIacCi,
        runImageBuild: runImageBuild,
    ]
}

boolean shouldForceBuildAll() {
    if (env.FORCE_BUILD_ALL?.trim()) {
        return env.FORCE_BUILD_ALL.equalsIgnoreCase('true')
    }

    try {
        return params?.FORCE_BUILD_ALL?.toString()?.equalsIgnoreCase('true')
    } catch (ignored) {
        return false
    }
}

String resolveDiffRange() {
    if (env.CHANGE_TARGET?.trim()) {
        String target = env.CHANGE_TARGET.trim()
        String refspec = "+refs/heads/${target}:refs/remotes/origin/${target}"
        sh(script: "git fetch --no-tags origin ${shellQuote(refspec)} || true", returnStatus: true)

        String mergeBase = sh(
            script: "git merge-base HEAD ${shellQuote("origin/${target}")} || true",
            returnStdout: true
        ).trim()

        if (mergeBase) {
            return "${mergeBase}..HEAD"
        }
    }

    def candidates = [env.GIT_PREVIOUS_SUCCESSFUL_COMMIT, env.GIT_PREVIOUS_COMMIT]
    for (candidate in candidates) {
        if (candidate?.trim()) {
            String commitRef = "${candidate.trim()}^{commit}"
            int status = sh(script: "git cat-file -e ${shellQuote(commitRef)}", returnStatus: true)
            if (status == 0) {
                return "${candidate.trim()}..HEAD"
            }
        }
    }

    int hasHeadParent = sh(script: 'git rev-parse --verify HEAD~1 >/dev/null 2>&1', returnStatus: true)
    if (hasHeadParent == 0) {
        return 'HEAD~1..HEAD'
    }

    return null
}

List getChangedFiles(String diffRange) {
    String output = sh(script: "git diff --name-only ${shellQuote(diffRange)}", returnStdout: true).trim()
    if (!output) {
        return []
    }

    return output
        .split('\n')
        .collect { it.trim() }
        .findAll { it }
}

boolean isKnownPath(String path, Map cfg) {
    return isDocsPath(path) || isAppPath(path, cfg) || isInfraPath(path) || isPipelinePath(path)
}

boolean isDocsPath(String path) {
    return path.startsWith('docs/') ||
        path.equalsIgnoreCase('README.md') ||
        path.equalsIgnoreCase('AGENTS.md') ||
        path.endsWith('.md')
}

boolean isAppPath(String path, Map cfg) {
    return path.startsWith('apps/') ||
        path.startsWith('services/') ||
        path.startsWith('libs/') ||
        path == 'package.json' ||
        path == 'pnpm-lock.yaml' ||
        path == 'pnpm-workspace.yaml' ||
        path == 'turbo.json' ||
        path == 'Dockerfile.backend' ||
        path == (cfg.webDockerfile ?: 'apps/web/Dockerfile')
}

boolean isInfraPath(String path) {
    return path.startsWith('infra/') ||
        path.startsWith('charts/') ||
        path.startsWith('policies/')
}

boolean isPipelinePath(String path) {
    return path == 'Jenkinsfile' ||
        path.startsWith('vars/') ||
        path.startsWith('ci/') ||
        path == 'Dockerfile.jenkins'
}

String shellQuote(String value) {
    return "'${value.replace("'", "'\"'\"'")}'"
}
