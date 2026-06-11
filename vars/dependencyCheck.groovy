def call(cfg = [:]) {
    echo '>>> Running SCA Scan...'
    echo '>>> Security gate policy: Dependency Check fails on CVSS >= 7 unless a written exception is created.'

    // Determine if we should attempt to use a credential
    def useNvdKey = cfg.useNvdKey ?: false
    def nvdKeyId = cfg.nvdApiKeyId ?: 'nvd-api-key'
    def noUpdate = (cfg.dependencyCheckNoUpdate != null) ? cfg.dependencyCheckNoUpdate : (cfg.noUpdate ?: false)
    def defaultCacheRoot = env.HOME?.trim() ?: "${env.WORKSPACE}/.."
    def dataDir = cfg.dependencyCheckDataDir?.trim()
        ?: env.DEPENDENCY_CHECK_DATA_DIR?.trim()
        ?: "${defaultCacheRoot}/jenkins_cache/dependency-check-data"

    echo ">>> Dependency Check data cache: ${dataDir}"

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

    if (noUpdate) {
        def hasCachedDb = sh(
            script: """test -s "${dataDir}/odc.mv.db" """,
            returnStatus: true
        ) == 0

        if (!hasCachedDb) {
            echo "WARNING: DEPENDENCY_CHECK_NO_UPDATE=true but the Dependency Check DB does not exist at ${dataDir}. Allowing update so the cache can be initialized."
            noUpdate = false
        }
    }

    def runScan = { useApiKey ->
        def updateFlag = noUpdate ? "--noupdate" : ""
        withEnv([
            "DEPENDENCY_CHECK_DATA_DIR_RESOLVED=${dataDir}",
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
            echo "Using Dependency Check data cache: $DEPENDENCY_CHECK_DATA_DIR_RESOLVED"
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

            docker run --rm \
                -v "$WORKSPACE:/src" \
                -v "$WORKSPACE/dependency-check-report:/report" \
                -v "$DEPENDENCY_CHECK_DATA_DIR_RESOLVED:/usr/share/dependency-check/data" \
                owasp/dependency-check:latest \
                --project "DocVault" \
                --scan /src \
                --exclude "**/.agent/**" \
                --exclude "**/.agents/**" \
                --exclude "**/generated/**" \
                --exclude "**/prisma/generated/**" \
                --exclude "**/node_modules/**" \
                --exclude "**/.pnpm-store/**" \
                --exclude "**/.turbo/**" \
                --exclude "**/.next/**" \
                --exclude "**/dist/**" \
                --exclude "**/coverage/**" \
                --exclude "**/.scannerwork/**" \
                --exclude "**/dependency-check-report/**" \
                --exclude "**/checkov-report/**" \
                --exclude "**/zap-report/**" \
                --format "HTML" \
                --format "JSON" \
                --out /report \
                --log /report/dependency-check.log \
                --failOnCVSS 7 \
                --disableKnownExploited \
                $nvd_args \
                ${DEPENDENCY_CHECK_UPDATE_FLAG:-}
            '''
        }
    }

    if (useNvdKey) {
        try {
            withCredentials([string(credentialsId: nvdKeyId, variable: 'NVD_API_KEY')]) {
                runScan(true)
            }
        } catch (Exception e) {
            echo "WARNING: Credential '${nvdKeyId}' not found or error accessing it. Running scan without API key (rate limits may apply)."
            runScan(false)
        }
    } else {
        echo ">>> Running scan without NVD API Key..."
        runScan(false)
    }
}
