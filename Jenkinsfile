pipeline {
    agent { label 'docker-agent-alpine-ubuntu-vm' } 

    environment {
        NODE_IMAGE = 'node:20-alpine'
        TRIVY_IMAGE = 'aquasec/trivy:0.50.1' 
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
                            // Cache outside workspace to survive cleanWs()
                            sh 'mkdir -p /home/abby/jenkins_workspace/dependency-check-data'
                            
                            sh """
                                docker run --rm \
                                    --network host \
                                    -v ${env.WORKSPACE}:/src \
                                    -v ${env.WORKSPACE}/dependency-check-report:/report \
                                    -v /home/abby/jenkins_workspace/dependency-check-data:/usr/share/dependency-check/data \
                                    owasp/dependency-check:latest \
                                    --project "DocVault" \
                                    --scan /src \
				    --exclude "**/node_modules/**" \
  				    --exclude "**/.pnpm-store/**" \
                                    --format "HTML" \
                                    --out /report \
                                    --disableNodeAudit \
                                    --disableKnownExploited
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

                stage('Trivy FS Scan') {
                    steps {
                        script {
                            echo '>>> Running Trivy Filesystem Scan...'
                            // Cache outside workspace
                            sh 'mkdir -p /home/abby/jenkins_workspace/trivy-cache'
                            sh """
                                docker run --rm \
                                    -v ${env.WORKSPACE}:/src \
                                    -v /home/abby/jenkins_workspace/trivy-cache:/root/.cache/ \
                                    ${env.TRIVY_IMAGE} \
                                    fs /src --scanners vuln,secret,misconfig --severity HIGH,CRITICAL --timeout 15m --skip-dirs .pnpm-store,node_modules
                            """
                        }
                    }
                }

                stage('IaC - Checkov Scan') {
                    steps {
                        script {
                            echo '>>> Running Checkov IaC Scan (Docker & Helm)...'
                            sh """
                                docker run --rm \
                                    -v ${env.WORKSPACE}:/tf \
                                    bridgecrew/checkov:latest \
                                    --directory /tf \
                                    --soft-fail \
                                    --framework dockerfile,helm \
                                    --output cli
                            """
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
                        sh "docker build -t duyimew/${service}:latest --build-arg SERVICE_NAME=${service} -f Dockerfile.backend ."
                        
                        echo ">>> Scanning Image duyimew/${service}:latest with Trivy..."
                        sh """
                            docker run --rm \
                                -v /var/run/docker.sock:/var/run/docker.sock \
                                -v /home/abby/jenkins_workspace/trivy-cache:/root/.cache/ \
                                ${env.TRIVY_IMAGE} \
                                image --severity HIGH,CRITICAL duyimew/${service}:latest
                        """
                    }
                    
                    echo ">>> Building Docker Image for web..."
                    sh "docker build -t duyimew/docvault:latest -f apps/web/Dockerfile ."
                    
                    echo ">>> Scanning Image duyimew/docvault:latest with Trivy..."
                    sh """
                        docker run --rm \
                            -v /var/run/docker.sock:/var/run/docker.sock \
                            -v /home/abby/jenkins_workspace/trivy-cache:/root/.cache/ \
                            ${env.TRIVY_IMAGE} \
                            image --severity HIGH,CRITICAL duyimew/docvault:latest
                    """
                }
            }
        }

        stage('Push to Registry') {
            steps {
                script {
                    echo '>>> Logging into Docker Hub...'
                    withCredentials([usernamePassword(credentialsId: 'dockerhub-credentials', passwordVariable: 'DOCKER_PASS', usernameVariable: 'DOCKER_USER')]) {
                        sh "echo \$DOCKER_PASS | docker login -u \$DOCKER_USER --password-stdin"
                        
                        def services = [
                            'gateway', 
                            'metadata-service', 
                            'document-service', 
                            'notification-service', 
                            'workflow-service', 
                            'audit-service'
                        ]
                        
                        services.each { service ->
                            echo ">>> Pushing duyimew/${service}:latest to Docker Hub..."
                            sh "docker push duyimew/${service}:latest"
                        }

                        echo ">>> Pushing duyimew/docvault:latest to Docker Hub..."
                        sh "docker push duyimew/docvault:latest"
                    }
                }
            }
        }

        stage('GitOps - Update K8s Manifests') {
            steps {
                script {
                    echo '>>> Updating Helm values with new image tags...'
                    def tag = "v${env.BUILD_NUMBER}"
                    def services = [
                        'gateway', 
                        'metadata-service', 
                        'document-service', 
                        'notification-service', 
                        'workflow-service', 
                        'audit-service'
                    ]
                    
                    // 1. Update each service's values file
                    services.each { service ->
                        sh "sed -i 's/tag: .*/tag: \"${tag}\"/' infra/k8s/values/${service}.yaml"
                    }
                    
                    // Update web (docvault) values too
                    sh "sed -i 's/tag: .*/tag: \"${tag}\"/' infra/k8s/values/web.yaml || echo 'web.yaml not yet created'"

                    // 2. Commit and Push back to this repo
                    // Note: Use [skip ci] to prevent infinite build loops!
                    withCredentials([usernamePassword(credentialsId: 'github-credentials', passwordVariable: 'GIT_PASS', usernameVariable: 'GIT_USER')]) {
                        sh """
                            git config user.email "truongnguyenduyp6@gmail.com"
                            git config user.name "duyimew"
                            git add infra/k8s/values/*.yaml
                            git commit -m "chore(gitops): update image tags to ${tag} [skip ci]"
                            git push https://${GIT_USER}:${GIT_PASS}@github.com/duyimew/docvault.git HEAD:testing
                        """
                    }
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
