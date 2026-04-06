pipeline {
    agent { label 'docker-agent-alpine-ubuntu-vm' } 

    environment {
        NODE_IMAGE = 'node:20-alpine'
        TRIVY_IMAGE = 'aquasec/trivy:latest'
        SONAR_SCANNER_IMAGE = 'sonarsource/sonar-scanner-cli:latest'
    }

    stages {
        stage('System Check') {
            steps {
                script {
                    echo '>>> Checking Agent Environment...'
		    sh 'pwd'
		    sh 'ls -la ${WORKSPACE}'
                    sh 'id'
                    sh 'which docker || echo "Docker CLI not found in PATH"'
                    sh 'docker --version || echo "Docker command failed"'
                    sh 'ls -l /var/run/docker.sock || echo "Docker socket NOT found"'
                }
            }
        }

        stage('Checkout & Install') {
            steps {
                echo '>>> Checking out source code...'
                checkout scm

                echo '>>> Running Install inside a temporary Node container...'
                sh """
                    docker run --rm \
                        --network host \
                        -v ${env.WORKSPACE}:/app \
                        -w /app \
                        ${env.NODE_IMAGE} \
                        sh -c "corepack enable && pnpm install --frozen-lockfile && pnpm turbo run prisma:generate --continue"
                """
            }
        }

        stage('Pre-build Security & Quality Gates') {
            parallel {
                stage('Unit Tests') {
                    steps {
                        echo '>>> Running Unit Tests...'
                        sh """
                            docker run --rm \
                                --network host \
                                -v ${env.WORKSPACE}:/app \
                                -w /app \
                                ${env.NODE_IMAGE} \
                                sh -c "corepack enable && pnpm turbo run test"
                        """
                    }
                }

                stage('SCA - OWASP Dependency-Check') {
                    steps {
                        script {
                            echo '>>> Running SCA Scan (OWASP Dependency-Check)...'
                            sh 'mkdir -p dependency-check-report'
                            // Create a directory for the database cache on the host
                            sh 'mkdir -p dependency-check-data'
                            
                            sh """
                                docker run --rm \
                                    --network host \
                                    -v ${env.WORKSPACE}:/src \
                                    -v ${env.WORKSPACE}/dependency-check-report:/report \
                                    -v ${env.WORKSPACE}/dependency-check-data:/usr/share/dependency-check/data \
                                    owasp/dependency-check:latest \
                                    --project "DocVault" \
                                    --scan /src \
                                    --format "HTML" \
                                    --out /report \
                                    --disableNodeAudit \
				    --disableKev
                            """
                        }
                    }
                }

                stage('SAST - SonarQube') {
                    steps {
                        script {
                            echo '>>> Running SAST Scan (SonarQube)...'
                            withSonarQubeEnv('sqdocvault') {
                                sh """
                                    docker run --rm \
                                        --network host \
                                        -v ${env.WORKSPACE}:/usr/src \
                                        -e SONAR_TOKEN=${SONAR_AUTH_TOKEN} \
                                        ${env.SONAR_SCANNER_IMAGE} \
                                        -Dsonar.projectKey=docvault \
                                        -Dsonar.sources=. \
                                        -Dsonar.host.url=http://10.0.3.137:9005
                                """
                            }
                        }
                    }
                }
            }
        }

        stage('Build & Container Security') {
            steps {
                script {
                    def services = [
                        'gateway', 
                        'metadata-service', 
                        'document-service', 
                        'notification-service', 
                        'workflow-service', 
                        'audit-service'
                    ]
                    
                    services.each { service ->
                        echo ">>> Building Docker Image for ${service}..."
                        sh "docker build -t docvault/${service}:latest --build-arg SERVICE_NAME=${service} -f Dockerfile.backend ."
                        
                        echo ">>> Scanning Image docvault/${service}:latest with Trivy..."
                        sh """
                            docker run --rm \
                                -v /var/run/docker.sock:/var/run/docker.sock \
                                -v ${env.WORKSPACE}/trivy-cache:/root/.cache/ \
                                ${env.TRIVY_IMAGE} \
                                image --severity HIGH,CRITICAL docvault/${service}:latest
                        """
                    }
                    
                    echo ">>> Building Docker Image for web..."
                    sh "docker build -t docvault/web:latest -f apps/web/Dockerfile ."
                    
                    echo ">>> Scanning Image docvault/web:latest with Trivy..."
                    sh """
                        docker run --rm \
                            -v /var/run/docker.sock:/var/run/docker.sock \
                            -v ${env.WORKSPACE}/trivy-cache:/root/.cache/ \
                            ${env.TRIVY_IMAGE} \
                            image --severity HIGH,CRITICAL docvault/web:latest
                    """
                }
            }
        }

        stage('Push to Registry') {
            steps {
                script {
                    echo '>>> Pushing images to registry...'
                    echo 'NOTE: this is still a placeholder'
                }
            }
        }

        stage('GitOps - ArgoCD Sync') {
            steps {
                script {
                    echo '>>> Triggering ArgoCD Sync / Updating Manifests...'
                    echo 'NOTE: This stage still a placeholder'
                }
            }
        }
    }

    post {
        always {
            echo '>>> Archiving Security Reports...'
            archiveArtifacts artifacts: 'dependency-check-report/*.html', allowEmptyArchive: true
            
            echo '>>> Cleaning up workspace...'
            cleanWs()
        }
    }
}
