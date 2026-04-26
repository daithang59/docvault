def call(cfg) {
    echo '>>> Running Unit Tests...'
    sh """
        set -eu
        docker run --rm \\
            --network host \\
            -v ${env.WORKSPACE}:/app \\
            -w /app \\
            ${cfg.nodeImage} \\
            sh -c \"corepack enable && pnpm turbo run test\"
    """
}
