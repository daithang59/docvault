def call() {
    def gitOpsBranch = env.GITOPS_BRANCH?.trim() ? env.GITOPS_BRANCH.trim() : 'main'
    def releaseBranch = env.RELEASE_BRANCH?.trim() ? env.RELEASE_BRANCH.trim() : 'main'
    def sonarHostUrl = env.SONAR_HOST_URL?.trim() ? env.SONAR_HOST_URL.trim() : 'https://sonarqube.docvault.id.vn'
    def deployTargetUrl = env.DEPLOY_TARGET_URL?.trim() ? env.DEPLOY_TARGET_URL.trim() : ''
    def zapTarget = env.ZAP_TARGET?.trim() ? env.ZAP_TARGET.trim() : ''
    def registryHost = env.REGISTRY_HOST?.trim() ? env.REGISTRY_HOST.trim() : 'harbor.docvault.id.vn'
    def registryNamespace = env.REGISTRY_NAMESPACE?.trim()
        ? env.REGISTRY_NAMESPACE.trim()
        : 'docvault-dev'
    def registryCredentialId = env.REGISTRY_CREDENTIAL_ID?.trim()
        ? env.REGISTRY_CREDENTIAL_ID.trim()
        : 'harbor-docvault-dev-robot-token'
    def registryCredentialType = env.REGISTRY_CREDENTIAL_TYPE?.trim()
        ? env.REGISTRY_CREDENTIAL_TYPE.trim()
        : 'secretText'
    def registryUsername = env.REGISTRY_USERNAME?.trim()
        ? env.REGISTRY_USERNAME.trim()
        : 'robot$docvault-dev+jenkins-push'
    def pushLatest = env.PUSH_LATEST?.trim()
        ? env.PUSH_LATEST.equalsIgnoreCase('true')
        : false
    def signImages = env.SIGN_IMAGES?.trim()
        ? env.SIGN_IMAGES.equalsIgnoreCase('true')
        : false
    def cosignKeyCredentialId = env.COSIGN_KEY_CREDENTIAL_ID?.trim() ?: 'cosign-private-key'
    def cosignPasswordCredentialId = env.COSIGN_PASSWORD_CREDENTIAL_ID?.trim() ?: 'cosign-password'
    def cosignPublicKeyCredentialId = env.COSIGN_PUBLIC_KEY_CREDENTIAL_ID?.trim() ?: ''
    def cosignTlogUpload = env.COSIGN_TLOG_UPLOAD?.trim()
        ? env.COSIGN_TLOG_UPLOAD.equalsIgnoreCase('true')
        : false
    def dependencyCheckNoUpdate = env.DEPENDENCY_CHECK_NO_UPDATE?.trim()
        ? env.DEPENDENCY_CHECK_NO_UPDATE.equalsIgnoreCase('true')
        : true
    def dependencyCheckDataDir = env.DEPENDENCY_CHECK_DATA_DIR?.trim() ?: '/var/jenkins_home/caches/dependency-check'
    def alpineSecurityRefresh = env.ALPINE_SECURITY_REFRESH?.trim() ?: 'manual'
    def awsRegion = env.AWS_REGION?.trim() ?: 'ap-southeast-1'
    def createGitOpsPr = env.CREATE_GITOPS_PR?.trim()
        ? env.CREATE_GITOPS_PR.equalsIgnoreCase('true')
        : true

    return [
        agentLabel: 'docker-agent-alpine-ubuntu-vm',
        awsRegion: awsRegion,
        registryHost: registryHost,
        registryNamespace: registryNamespace,
        registryCredentialId: registryCredentialId,
        registryCredentialType: registryCredentialType,
        registryUsername: registryUsername,
        pushLatest: pushLatest,
        signImages: signImages,
        cosignImage: 'ghcr.io/sigstore/cosign/cosign:v2.4.1',
        cosignKeyCredentialId: cosignKeyCredentialId,
        cosignPasswordCredentialId: cosignPasswordCredentialId,
        cosignPublicKeyCredentialId: cosignPublicKeyCredentialId,
        cosignTlogUpload: cosignTlogUpload,
        createGitOpsPr: createGitOpsPr,
        dependencyCheckNoUpdate: dependencyCheckNoUpdate,
        dependencyCheckDataDir: dependencyCheckDataDir,
        alpineSecurityRefresh: alpineSecurityRefresh,
        nodeImage: 'node:20-alpine',
        trivyImage: 'aquasec/trivy:0.70.0',
        kyvernoImage: 'ghcr.io/kyverno/kyverno-cli:v1.12.0',
        helmImage: 'alpine/helm:3.16.4',
        sonarScannerImage: 'sonarsource/sonar-scanner-cli:latest',
        sonarQubeInstallation: 'sqdocvault',
        sonarProjectKey: 'docvault',
        sonarHostUrl: sonarHostUrl,
        sonarHostCandidates: [sonarHostUrl, 'http://host.docker.internal:9000', 'http://localhost:9000', 'http://127.0.0.1:9000', 'http://172.17.0.1:9000'],
        sonarDockerRunArgs: '--network host --add-host=host.docker.internal:host-gateway',
        checkovImage: 'bridgecrew/checkov:latest',
        terraformImage: 'hashicorp/terraform:1.8.5',
        terraformDir: 'infra/terraform/aws-eks',
        skipChecks: 'CKV_K8S_43',
        skipPaths: 'infra/k8s/infra-deps',
        dockerOrg: 'daithang59',
        buildParallelism: 3,
        pushParallelism: 3,
        pnpmStoreVolume: 'docvault-pnpm-store',
        turboCacheVolume: 'docvault-turbo-cache',
        services: ['gateway', 'metadata-service', 'document-service', 'notification-service', 'workflow-service', 'audit-service'],
        webAppName: 'web',
        webImageName: 'docvault',
        webDockerfile: 'apps/web/Dockerfile',
        backendDockerfile: 'Dockerfile.backend',
        helmValuesDir: 'infra/k8s/values',
        gitOpsBranch: gitOpsBranch,
        releaseBranch: releaseBranch,
        gitOpsRepoUrl: 'https://github.com/daithang59/docvault.git',
        deployTargetUrl: deployTargetUrl,
        argocdNamespace: 'argocd',
        argocdApps: [
            'docvault-gateway',
            'docvault-metadata',
            'docvault-document-service',
            'docvault-workflow-service',
            'docvault-audit-service',
            'docvault-notification-service',
            'docvault-web'
        ],
        argocdTimeoutSeconds: '300',
        kubeconfigCredentialId: '',
        zapTarget: zapTarget
    ]
}
