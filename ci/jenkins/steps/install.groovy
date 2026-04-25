def call(cfg) {
    echo '>>> Running Install...'
    sh """
        docker run --rm \\
            -v ${env.WORKSPACE}:/app \\
            -w /app \\
            ${cfg.nodeImage} \\
            sh -c \"corepack enable && pnpm install --frozen-lockfile && pnpm turbo run prisma:generate --continue\"
    """
}

return this
