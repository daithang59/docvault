def call(cfg) {
    echo '>>> Running Install...'
    def pnpmStoreVolume = cfg.pnpmStoreVolume ?: 'docvault-pnpm-store'
    def turboCacheVolume = cfg.turboCacheVolume ?: 'docvault-turbo-cache'

    sh """
        set -eu
        docker volume create '${pnpmStoreVolume}' >/dev/null
        docker volume create '${turboCacheVolume}' >/dev/null
        docker run --rm \\
            -v ${env.WORKSPACE}:/app \\
            -v ${pnpmStoreVolume}:/pnpm/store \\
            -v ${turboCacheVolume}:/app/.turbo \\
            -w /app \\
            ${cfg.nodeImage} \\
            sh -c \"corepack enable && pnpm config set store-dir /pnpm/store && pnpm install --frozen-lockfile && pnpm turbo run prisma:generate --continue\"
    """
}
