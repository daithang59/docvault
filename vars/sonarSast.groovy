import groovy.json.JsonSlurperClassic

def call(Map cfg = [:]) {
    echo '>>> Running SAST Scan (SonarQube)...'

    String installationName = cfg.sonarQubeInstallation ?: 'sqdocvault'
    String scannerImage     = cfg.sonarScannerImage ?: 'sonarsource/sonar-scanner-cli:latest'
    String projectKey       = cfg.sonarProjectKey ?: 'docvault'
    String projectName      = cfg.sonarProjectName ?: 'DocVault'
    String projectVersion   = cfg.sonarProjectVersion ?: (env.BUILD_NUMBER ?: 'local')
    String sources          = cfg.sonarSources ?: 'apps,services,libs'
    String exclusions       = cfg.sonarExclusions ?: '**/node_modules/**,**/.pnpm-store/**,**/dist/**,**/.next/**,**/coverage/**,infra/**,charts/**,checkov-report/**,dependency-check-report/**,Dockerfile.jenkins,**/.scannerwork/**'
    String hostOverride     = cfg.sonarHostUrl ?: 'http://sonarqube:9000'
    String hostCandidates   = sonarHostCandidates(cfg, hostOverride).join(' ')
    String dockerRunArgs    = cfg.sonarDockerRunArgs ?: '--network host --add-host=host.docker.internal:host-gateway'
    String extraArgs        = cfg.extraArgs ?: ''
    boolean enforceQG       = cfg.containsKey('enforceQualityGate') ? cfg.enforceQualityGate : false
    int qgTimeoutMinutes    = (cfg.qualityGateTimeoutMinutes ?: 10) as int

    withSonarQubeEnv(installationName) {
        sh """
            set -eu

            rm -rf .scannerwork
            mkdir -p .sonar-cache .scannerwork
            chmod 777 .sonar-cache .scannerwork

            CONFIGURED_SONAR_HOST="${hostOverride}"
            SONAR_HOST=""

            echo ">>> SonarQube installation : ${installationName}"
            echo ">>> Sonar host configured  : \${CONFIGURED_SONAR_HOST}"
            echo ">>> Sonar project key      : ${projectKey}"
            echo ">>> Sonar project name     : ${projectName}"
            echo ">>> Sonar sources          : ${sources}"
            echo ">>> Sonar docker args      : ${dockerRunArgs}"

            for candidate in "\${SONAR_HOST_URL:-}" "\${CONFIGURED_SONAR_HOST}" ${hostCandidates}; do
                if [ -z "\${candidate}" ]; then
                    continue
                fi

                candidate="\${candidate%/}"
                echo ">>> Checking SonarQube reachability: \${candidate}"

                if docker run --rm \\
                    ${dockerRunArgs} \\
                    ${scannerImage} \\
                    sh -c "curl -fsS --connect-timeout 3 --max-time 8 '\${candidate}/api/system/status' >/dev/null"
                then
                    SONAR_HOST="\${candidate}"
                    break
                fi
            done

            if [ -z "\${SONAR_HOST}" ]; then
                echo ">>> ERROR: SonarQube is not reachable from the scanner container."
                echo ">>> Checked candidates: \${SONAR_HOST_URL:-} \${CONFIGURED_SONAR_HOST} ${hostCandidates}"
                echo ">>> Docker containers matching sonar:"
                docker ps --format 'table {{.Names}}\\t{{.Ports}}\\t{{.Status}}' | grep -i sonar || true
                exit 1
            fi

            echo ">>> Sonar host selected    : \${SONAR_HOST}"

            docker run --rm \\
                ${dockerRunArgs} \\
                -v "${env.WORKSPACE}:/usr/src" \\
                -v "${env.WORKSPACE}/.sonar-cache:/opt/sonar-scanner/.sonar/cache" \\
                -w /usr/src \\
                -e SONAR_HOST_URL="\${SONAR_HOST}" \\
                -e SONAR_TOKEN="${env.SONAR_AUTH_TOKEN}" \\
                ${scannerImage} \\
                -Dsonar.projectKey="${projectKey}" \\
                -Dsonar.projectName="${projectName}" \\
                -Dsonar.projectVersion="${projectVersion}" \\
                -Dsonar.sources="${sources}" \\
                -Dsonar.exclusions="${exclusions}" \\
                -Dsonar.host.url="\${SONAR_HOST}" \\
                -Dsonar.scanner.metadataFilePath="/usr/src/.scannerwork/report-task.txt" \\
                -Dsonar.scanner.skipJreProvisioning=true \\
                ${extraArgs}

            echo ">>> Sonar scanner metadata files:"
            find . -path '*/report-task.txt' -print || true
        """
        if (enforceQG) {
            pollQualityGateFromReport(qgTimeoutMinutes)
        }
    }
}

def pollQualityGateFromReport(int qgTimeoutMinutes) {
    echo '>>> Waiting for SonarQube Quality Gate...'

    def reportTaskPath = findReportTaskPath()
    if (!reportTaskPath) {
        sh "find . -maxdepth 4 -type f | sort | sed -n '1,200p'"
        error('SonarQube report-task.txt was not found. The scanner did not publish task metadata for quality gate polling.')
    }

    echo ">>> SonarQube report task metadata: ${reportTaskPath}"
    def taskProps = readSonarReportTask(reportTaskPath)
    def ceTaskId = taskProps.ceTaskId
    def serverUrl = taskProps.serverUrl?.replaceAll('/+$', '')

    if (!ceTaskId || !serverUrl) {
        error('SonarQube report-task.txt is missing ceTaskId or serverUrl.')
    }

    timeout(time: qgTimeoutMinutes, unit: 'MINUTES') {
        waitUntil {
            def taskJson = sonarApiGet("${serverUrl}/api/ce/task?id=${ceTaskId}")
            def task = new JsonSlurperClassic().parseText(taskJson).task
            def status = task.status

            if (status in ['PENDING', 'IN_PROGRESS']) {
                echo ">>> SonarQube analysis task status: ${status}"
                sleep time: 10, unit: 'SECONDS'
                return false
            }

            if (status != 'SUCCESS') {
                error("SonarQube analysis task ended with status ${status}.")
            }

            def analysisId = task.analysisId
            if (!analysisId) {
                error('SonarQube analysis task succeeded but did not return analysisId.')
            }

            def qualityGateJson = sonarApiGet("${serverUrl}/api/qualitygates/project_status?analysisId=${analysisId}")
            def qualityGate = new JsonSlurperClassic().parseText(qualityGateJson).projectStatus
            def qualityGateStatus = qualityGate.status

            echo ">>> SonarQube Quality Gate status: ${qualityGateStatus}"
            if (qualityGateStatus != 'OK') {
                error("SonarQube Quality Gate failed with status ${qualityGateStatus}.")
            }

            return true
        }
    }
}

String findReportTaskPath() {
    def reportTaskPath = sh(
        script: "find . -path '*/report-task.txt' -print -quit",
        returnStdout: true
    ).trim()

    return reportTaskPath
}

Map readSonarReportTask(String reportPath) {
    def props = [:]

    readFile(reportPath).split('\n').each { line ->
        def trimmed = line.trim()
        if (!trimmed || trimmed.startsWith('#') || !trimmed.contains('=')) {
            return
        }

        def index = trimmed.indexOf('=')
        props[trimmed.substring(0, index)] = trimmed.substring(index + 1)
    }

    return props
}

String sonarApiGet(String url) {
    return sh(
        script: """
            set +x
            curl -fsS -u "\${SONAR_AUTH_TOKEN}:" '${url}'
        """,
        returnStdout: true
    ).trim()
}

List sonarHostCandidates(Map cfg, String hostOverride) {
    def candidates = []

    if (cfg.sonarHostCandidates instanceof Collection) {
        candidates.addAll(cfg.sonarHostCandidates.collect { it?.toString()?.trim() }.findAll { it })
    }

    if (hostOverride?.trim()) {
        candidates << hostOverride.trim()
        candidates << hostOverride.trim().replace('host.docker.internal', 'localhost')
        candidates << hostOverride.trim().replace('host.docker.internal', '127.0.0.1')
        candidates << hostOverride.trim().replace('host.docker.internal', '172.17.0.1')
    }

    return candidates.findAll { it }.unique()
}
