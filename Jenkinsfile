def cfg = [:]
def preventLoop
def systemCheck
def installStep
def dependencyCheck
def trivyFsScan
def unitTests
def sonarSast
def iacCheckov
def buildAndScan
def pushAndGitOps
def dastZap
def postCleanup

pipeline {
    agent { label 'docker-agent-alpine-ubuntu-vm' }

    options {
        disableConcurrentBuilds()
    }

    parameters {
        booleanParam(name: 'FORCE_BUILD_ALL', defaultValue: false, description: 'Rebuild and rescan all images regardless of detected file changes.')
        string(name: 'GITOPS_BRANCH', defaultValue: 'gitops-testing', description: 'GitOps branch used for Helm values tag updates (create this branch before enabling updates).')
    }

    environment {
        NODE_IMAGE = 'node:20-alpine'
        TRIVY_IMAGE = 'aquasec/trivy:0.50.1'
        SONAR_SCANNER_IMAGE = 'sonarsource/sonar-scanner-cli:latest'
        BUILT_SERVICES = ''
    }

    stages {
        stage('Checkout & Initialize Modules') {
            steps {
                echo '>>> Checking out source code...'
                checkout scm
                script {
                    cfg = load('ci/jenkins/config.groovy').call()

                    preventLoop = load('ci/jenkins/steps/preventLoop.groovy')
                    systemCheck = load('ci/jenkins/steps/systemCheck.groovy')
                    installStep = load('ci/jenkins/steps/install.groovy')
                    dependencyCheck = load('ci/jenkins/steps/dependencyCheck.groovy')
                    trivyFsScan = load('ci/jenkins/steps/trivyFsScan.groovy')
                    unitTests = load('ci/jenkins/steps/unitTests.groovy')
                    sonarSast = load('ci/jenkins/steps/sonarSast.groovy')
                    iacCheckov = load('ci/jenkins/steps/iacCheckov.groovy')
                    buildAndScan = load('ci/jenkins/steps/buildAndScan.groovy')
                    pushAndGitOps = load('ci/jenkins/steps/pushAndGitOps.groovy')
                    dastZap = load('ci/jenkins/steps/dastZap.groovy')
                    postCleanup = load('ci/jenkins/steps/postCleanup.groovy')
                }
            }
        }

        stage('Prevent Loop') {
            steps {
                script {
                    preventLoop.call()
                }
            }
        }

        stage('System Check') {
            steps {
                script {
                    systemCheck.call()
                }
            }
        }

        stage('Install') {
            steps {
                script {
                    installStep.call(cfg)
                }
            }
        }

        stage('Pre-build Security') {
            parallel {
                stage('SCA - Dependency Check') {
                    steps {
                        script {
                            dependencyCheck.call()
                        }
                    }
                }

                stage('Trivy FS Scan') {
                    steps {
                        script {
                            trivyFsScan.call(cfg)
                        }
                    }
                }

                stage('Unit Tests') {
                    steps {
                        script {
                            unitTests.call(cfg)
                        }
                    }
                }

                stage('SAST - SonarQube') {
                    steps {
                        script {
                            sonarSast.call(cfg)
                        }
                    }
                }

                stage('IaC - Checkov Scan') {
                    steps {
                        script {
                            iacCheckov.call(cfg)
                        }
                    }
                }
            }
        }

        stage('Build & Scan Services') {
            steps {
                script {
                    env.BUILT_SERVICES = buildAndScan.call(cfg)
                }
            }
        }

        stage('Push & GitOps') {
            when { expression { env.BUILT_SERVICES?.trim() } }
            steps {
                script {
                    pushAndGitOps.call(cfg, env.BUILT_SERVICES)
                }
            }
        }

        stage('DAST - OWASP ZAP') {
            steps {
                script {
                    dastZap.call(cfg)
                }
            }
        }
    }

    post {
        always {
            script {
                postCleanup.call()
            }
        }
    }
}
