def call(cfg = [:]) {
    echo '>>> Running SCA Scan...'
    echo '>>> Security gate policy: Dependency Check fails on CVSS >= 7 unless a written exception is created.'

    // Determine if we should attempt to use a credential
    def useNvdKey = cfg.useNvdKey ?: false
    def nvdKeyId = cfg.nvdApiKeyId ?: 'nvd-api-key'
    def noUpdate = (cfg.dependencyCheckNoUpdate != null) ? cfg.dependencyCheckNoUpdate : (cfg.noUpdate ?: false)
    def dataDir = cfg.dependencyCheckDataDir?.trim() ?: env.DEPENDENCY_CHECK_DATA_DIR?.trim()
    def dataVolume = cfg.dependencyCheckDataVolume?.trim()
        ?: env.DEPENDENCY_CHECK_DATA_VOLUME?.trim()
        ?: 'docvault-dependency-check-data'
    def dataMount = dataDir
        ? "${dataDir}:/usr/share/dependency-check/data"
        : "${dataVolume}:/usr/share/dependency-check/data"
    def cacheLabel = dataDir ? dataDir : "Docker volume ${dataVolume}"
    def cacheCheckScript = dataDir
        ? """test -s "${dataDir}/odc.mv.db" """
        : """docker run --rm -v "${dataVolume}:/data" --entrypoint /bin/sh owasp/dependency-check:latest -c 'test -s /data/odc.mv.db'"""

    echo ">>> Dependency Check data cache: ${cacheLabel}"

    if (dataDir) {
        sh """
        mkdir -p dependency-check-report
        mkdir -p "${dataDir}"
        if [ -s "${dataDir}/odc.mv.db" ]; then
            echo "Dependency Check cache is warm: ${dataDir}/odc.mv.db exists."
        else
            echo "Dependency Check cache is empty or cold: ${dataDir}/odc.mv.db is missing."
            echo "First update can take a long time. Set DEPENDENCY_CHECK_DATA_DIR to an existing cache if one is available."
        fi
        """
    } else {
        sh """
        mkdir -p dependency-check-report
        docker volume create "${dataVolume}" >/dev/null
        if docker run --rm -v "${dataVolume}:/data" --entrypoint /bin/sh owasp/dependency-check:latest -c 'test -s /data/odc.mv.db'; then
            echo "Dependency Check cache is warm: Docker volume ${dataVolume} contains odc.mv.db."
        else
            echo "Dependency Check cache is empty or cold: Docker volume ${dataVolume} does not contain odc.mv.db."
            echo "First update can take a long time. The populated DB will persist in this Docker volume."
        fi
        """
    }

    if (noUpdate) {
        def hasCachedDb = sh(
            script: cacheCheckScript,
            returnStatus: true
        ) == 0

        if (!hasCachedDb) {
            echo "WARNING: DEPENDENCY_CHECK_NO_UPDATE=true but the Dependency Check DB does not exist in ${cacheLabel}. Allowing update so the cache can be initialized."
            noUpdate = false
        }
    }

    def runScan = { useApiKey ->
        def updateFlag = noUpdate ? "--noupdate" : ""
        withEnv([
            "DEPENDENCY_CHECK_DATA_MOUNT=${dataMount}",
            "DEPENDENCY_CHECK_UPDATE_FLAG=${updateFlag}",
            "DEPENDENCY_CHECK_USE_NVD_KEY=${useApiKey ? 'true' : 'false'}"
        ]) {
            sh '''
            set -eu

            nvd_args=""
            if [ "$DEPENDENCY_CHECK_USE_NVD_KEY" = "true" ]; then
                nvd_args="--nvdApiKey $NVD_API_KEY"
            fi

            echo "Dependency Check is starting. The first NVD database update can be quiet and take several minutes."
            echo "Using Dependency Check data mount: $DEPENDENCY_CHECK_DATA_MOUNT"
            echo "Checking NVD API connectivity from inside the Dependency Check container..."

            docker run --rm \
                -e DEPENDENCY_CHECK_USE_NVD_KEY \
                -e NVD_API_KEY \
                --entrypoint /bin/sh \
                owasp/dependency-check:latest \
                -c '
                    set -eu
                    url="https://services.nvd.nist.gov/rest/json/cves/2.0?resultsPerPage=1"

                    if command -v curl >/dev/null 2>&1; then
                        if [ "$DEPENDENCY_CHECK_USE_NVD_KEY" = "true" ]; then
                            curl -fsS --connect-timeout 15 --max-time 60 -H "apiKey: $NVD_API_KEY" "$url" >/dev/null
                        else
                            curl -fsS --connect-timeout 15 --max-time 60 "$url" >/dev/null
                        fi
                    elif command -v wget >/dev/null 2>&1; then
                        if [ "$DEPENDENCY_CHECK_USE_NVD_KEY" = "true" ]; then
                            wget -q -T 60 --spider --header "apiKey: $NVD_API_KEY" "$url"
                        else
                            wget -q -T 60 --spider "$url"
                        fi
                    else
                        echo "No curl/wget in the Dependency Check image; skipping explicit NVD connectivity probe."
                        exit 0
                    fi

                    echo "NVD API connectivity check passed."
                '

            scan_status=0
            docker run --rm \
                -v "$WORKSPACE:/src" \
                -v "$WORKSPACE/dependency-check-report:/report" \
                -v "$DEPENDENCY_CHECK_DATA_MOUNT" \
                owasp/dependency-check:latest \
                --project "DocVault" \
                --scan /src \
                --exclude "**/.agent/**" \
                --exclude "**/.agents/**" \
                --exclude "**/generated/**" \
                --exclude "**/prisma/generated/**" \
                --exclude "**/node_modules/**" \
                --exclude "**/.pnpm-store/**" \
                --exclude "**/.trivy-scan-src/**" \
                --exclude "**/.turbo/**" \
                --exclude "**/.next/**" \
                --exclude "**/dist/**" \
                --exclude "**/coverage/**" \
                --exclude "**/.sonar-cache/**" \
                --exclude "**/.scannerwork/**" \
                --exclude "**/dependency-check-report/**" \
                --exclude "**/checkov-report/**" \
                --exclude "**/trivy-fs-report/**" \
                --exclude "**/zap-report/**" \
                --format "HTML" \
                --format "JSON" \
                --out /report \
                --log /report/dependency-check.log \
                --failOnCVSS 7 \
                --disableKnownExploited \
                $nvd_args \
                ${DEPENDENCY_CHECK_UPDATE_FLAG:-} || scan_status=$?

            if [ "$scan_status" -ne 0 ]; then
                echo "Dependency Check failed with exit code $scan_status."
                if [ -f "$WORKSPACE/dependency-check-report/dependency-check.log" ]; then
                    echo "Last 200 lines from dependency-check-report/dependency-check.log:"
                    tail -n 200 "$WORKSPACE/dependency-check-report/dependency-check.log"
                else
                    echo "dependency-check-report/dependency-check.log was not created."
                fi
                exit "$scan_status"
            fi
            '''
        }
    }

    if (useNvdKey) {
        echo ">>> Running scan with NVD API Key credential '${nvdKeyId}'..."
        withCredentials([string(credentialsId: nvdKeyId, variable: 'NVD_API_KEY')]) {
            runScan(true)
        }
    } else {
        echo ">>> Running scan without NVD API Key..."
        runScan(false)
    }
}
