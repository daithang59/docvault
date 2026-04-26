
@Library('docvault@testng') _

def cfg = [:]

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
        stage('Checkout & Initialize Config') {
            steps {
                echo '>>> Checking out source code...'
                checkout scm
                script {
                    cfg = docvaultConfig()
                }
            }
        }

        stage('Prevent Loop') {
            steps {
                script {
                    preventLoop()
                }
            }
        }

        stage('System Check') {
            steps {
                script {
                    systemCheck()
                }
            }
        }

        stage('Install') {
            steps {
                script {
                    installStep(cfg)
                }
            }
        }

        stage('Pre-build Security') {
            parallel {
                stage('SCA - Dependency Check') {
                    steps {
                        script {
                            dependencyCheck()
                        }
                    }
                }

                stage('Trivy FS Scan') {
                    steps {
                        script {
                            trivyFsScan(cfg)
                        }
                    }
                }

                stage('Unit Tests') {
                    steps {
                        script {
                            unitTests(cfg)
                        }
                    }
                }

                stage('SAST - SonarQube') {
                    steps {
                        script {
                            sonarSast(cfg)
                        }
                    }
                }

                stage('IaC - Checkov Scan') {
                    steps {
                        script {
                            iacCheckov(cfg)
                        }
                    }
                }
            }
        }

        stage('Build & Scan Services') {
            steps {
                script {
                    env.BUILT_SERVICES = buildAndScan(cfg)
                }
            }
        }

        stage('Push & GitOps') {
            when { expression { env.BUILT_SERVICES?.trim() } }
            steps {
                script {
                    pushAndGitOps(cfg, env.BUILT_SERVICES)
                }
            }
        }

        stage('DAST - OWASP ZAP') {
            steps {
                script {
                    dastZap(cfg)
                }
            }
        }
    }

    post {
        always {
            script {
                postCleanup()
            }
        }
    }
}
