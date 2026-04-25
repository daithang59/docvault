def call() {
    return [
        agentLabel: 'docker-agent-alpine-ubuntu-vm',
        nodeImage: 'node:20-alpine',
        trivyImage: 'aquasec/trivy:0.50.1',
        sonarScannerImage: 'sonarsource/sonar-scanner-cli:latest',
        dockerOrg: 'duyimew',
        services: ['gateway', 'metadata-service', 'document-service', 'notification-service', 'workflow-service', 'audit-service'],
        webAppName: 'web',
        webImageName: 'docvault',
        webDockerfile: 'apps/web/Dockerfile',
        backendDockerfile: 'Dockerfile.backend',
        helmValuesDir: 'infra/k8s/values',
        gitOpsBranch: 'testing',
        zapTarget: 'http://10.0.3.138:30000/api'
    ]
}

return this
