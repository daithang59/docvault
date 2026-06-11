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

    def runScan = { apiKey ->
        def nvdFlag = apiKey ? "--nvdApiKey \"${apiKey}\"" : ""
        def updateFlag = noUpdate ? "--noupdate" : ""
        sh """
            set -eu

            docker run --rm \\
                -v "\$WORKSPACE:/src" \\
                -v "\$WORKSPACE/dependency-check-report:/report" \\
                -v "${dataDir}:/usr/share/dependency-check/data" \\
                owasp/dependency-check:latest \\
                --project "DocVault" \\
                --scan /src \\
                --exclude "**/.agent/**" \\
                --exclude "**/.agents/**" \\
                --exclude "**/generated/**" \\
                --exclude "**/prisma/generated/**" \\
                --exclude "**/node_modules/**" \\
                --exclude "**/.pnpm-store/**" \\
                --exclude "**/.turbo/**" \\
                --exclude "**/.next/**" \\
                --exclude "**/dist/**" \\
                --exclude "**/coverage/**" \\
                --exclude "**/.scannerwork/**" \\
                --exclude "**/dependency-check-report/**" \\
                --exclude "**/checkov-report/**" \\
                --exclude "**/zap-report/**" \\
                --format "HTML" \\
                --format "JSON" \\
                --out /report \\
                --failOnCVSS 7 \\
                --disableKnownExploited \\
                ${nvdFlag} \\
                ${updateFlag}
        """
    }

    if (useNvdKey) {
        try {
            withCredentials([string(credentialsId: nvdKeyId, variable: 'NVD_API_KEY')]) {
                runScan(NVD_API_KEY)
            }
        } catch (Exception e) {
            echo "WARNING: Credential '${nvdKeyId}' not found or error accessing it. Running scan without API key (rate limits may apply)."
            runScan(null)
        }
    } else {
        echo ">>> Running scan without NVD API Key..."
        runScan(null)
    }
}
