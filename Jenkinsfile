pipeline {
    agent { label 'docker-agent-alpine-ubuntu-vm' } 

    environment {
        NODE_IMAGE = 'node:20-alpine'
        TRIVY_IMAGE = 'aquasec/trivy:0.50.1' 
        SONAR_SCANNER_IMAGE = 'sonarsource/sonar-scanner-cli:latest'
        // Track which services were built to update them in GitOps stage
        BUILT_SERVICES = ""
    }

    stages {
        stage('Prevent Loop') {
            steps {
                script {
                    // Check the latest commit message for [skip ci]
                    def commitMsg = sh(script: 'git log -1 --pretty=%B', returnStdout: true).trim()
                    if (commitMsg.contains('[skip ci]')) {
                        echo ">>> Detected [skip ci] in commit message: ${commitMsg}"
                        echo ">>> Skipping this build to prevent infinite loops from GitOps updates."
                        currentBuild.result = 'ABORTED'
                        error('Stopping build per [skip ci] instruction.')
                    }
                }
            }
        }

        stage('System Check') {
            steps {
                script {
                    echo '>>> Checking Agent Environment...'
                    sh 'docker --version'
                }
            }
        }

        stage('Checkout & Install') {
            steps {
                echo '>>> Checking out source code...'
                checkout scm

                echo '>>> Running Install...'
                sh """
                    docker run --rm \
                        -v ${env.WORKSPACE}:/app \
                        -w /app \
                        ${env.NODE_IMAGE} \
                        sh -c "corepack enable && pnpm install --frozen-lockfile && pnpm turbo run prisma:generate --continue"
                """
            }
        }

        stage('Pre-build Security') {
            parallel {
                stage('SCA - Dependency Check') {
                    steps {
                        script {
                            echo '>>> Running SCA Scan...'
                            sh 'mkdir -p dependency-check-report'
                            // Added --noupdate to avoid 429 errors and save time
                            sh """
                                docker run --rm \
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
                                    --disableKnownExploited \
                                    --noupdate
                            """
                        }
                    }
                }

                stage('Trivy FS Scan') {
                    steps {
                        script {
                            echo '>>> Running Trivy Filesystem Scan...'
                            sh """
                                docker run --rm \
                                    -v ${env.WORKSPACE}:/src \
                                    ${env.TRIVY_IMAGE} \
                                    fs /src --scanners vuln,secret,misconfig --severity HIGH,CRITICAL --skip-dirs .pnpm-store,node_modules
                            """
                        }
                    }
                }
            }
        }

        stage('Build & Scan Services') {
            steps {
                script {
                    def tag = "v${env.BUILD_NUMBER}"
                    def services = ['gateway', 'metadata-service', 'document-service', 'notification-service', 'workflow-service', 'audit-service']
                    def builtList = []

                    services.each { service ->
                        // Check if service or libs changed
                        def changed = sh(script: "git diff --name-only HEAD~1 HEAD | grep -E '^services/${service}/|^libs/' || true", returnStdout: true).trim()
                        
                        if (changed || env.BUILD_CAUSE == 'MANUALTRIGGER') {
                            echo ">>> Changes detected for ${service}. Building ${tag}..."
                            sh "docker build -t duyimew/${service}:${tag} -t duyimew/${service}:latest --build-arg SERVICE_NAME=${service} -f Dockerfile.backend ."
                            
                            echo ">>> Scanning Image duyimew/${service}:${tag}..."
                            sh """
                                docker run --rm \
                                    -v /var/run/docker.sock:/var/run/docker.sock \
                                    ${env.TRIVY_IMAGE} \
                                    image --severity HIGH,CRITICAL duyimew/${service}:${tag}
                            """
                            builtList.add(service)
                        } else {
                            echo ">>> No changes in services/${service}/ or libs/. Skipping build for ${service}."
                        }
                    }
                    
                    // Web App check
                    def webChanged = sh(script: "git diff --name-only HEAD~1 HEAD | grep '^apps/web/' || true", returnStdout: true).trim()
                    if (webChanged || env.BUILD_CAUSE == 'MANUALTRIGGER') {
                        echo ">>> Changes detected for web app. Building..."
                        sh "docker build -t duyimew/docvault:${tag} -t duyimew/docvault:latest -f apps/web/Dockerfile ."
                        builtList.add("web")
                    }
                    
                    env.BUILT_SERVICES = builtList.join(",")
                }
            }
        }

        stage('Push & GitOps') {
            when { expression { env.BUILT_SERVICES != "" } }
            steps {
                script {
                    def tag = "v${env.BUILD_NUMBER}"
                    def builtList = env.BUILT_SERVICES.split(",")
                    
                    echo '>>> Logging into Docker Hub...'
                    withCredentials([usernamePassword(credentialsId: 'dockerhub-credentials', passwordVariable: 'DOCKER_PASS', usernameVariable: 'DOCKER_USER')]) {
                        sh "echo \$DOCKER_PASS | docker login -u \$DOCKER_USER --password-stdin"
                        
                        builtList.each { service ->
                            def imageName = (service == "web") ? "docvault" : service
                            echo ">>> Pushing duyimew/${imageName}:${tag} to Docker Hub..."
                            sh "docker push duyimew/${imageName}:${tag}"
                            sh "docker push duyimew/${imageName}:latest"
                        }
                    }

                    echo '>>> Updating Helm values with new image tags...'
                    builtList.each { service ->
                        def fileName = (service == "web") ? "web.yaml" : "${service}.yaml"
                        sh "sed -i 's/tag: .*/tag: \"${tag}\"/' infra/k8s/values/${fileName}"
                    }
                    
                    withCredentials([usernamePassword(credentialsId: 'github-credentials', passwordVariable: 'GIT_PASS', usernameVariable: 'GIT_USER')]) {
                        sh """
                            git config user.email "truongnguyenduyp6@gmail.com"
                            git config user.name "duyimew"
                            git add infra/k8s/values/*.yaml
                            git commit -m "chore(gitops): update tags for ${env.BUILT_SERVICES} to ${tag} [skip ci]"
                            git push https://${GIT_USER}:${GIT_PASS}@github.com/duyimew/docvault.git HEAD:testing
                        """
                    }
                }
            }
        }

        stage('DAST - OWASP ZAP') {
            steps {
                script {
                    echo '>>> Running DAST Scan against Gateway API...'
                    sh 'mkdir -p zap-report'
                    // Scan the public NodePort address
                    sh """
                        docker run --rm \
                            -v \$(pwd)/zap-report:/zap/wrk:rw \
                            ghcr.io/zaproxy/zaproxy:stable zap-baseline.py \
                            -t http://10.0.3.138:30000/api \
                            -r zap_report.html \
                            -I || echo "ZAP found issues, continuing..."
                    """
                }
            }
        }
    }

    post {
        always {
            echo '>>> Archiving Security Reports...'
            archiveArtifacts artifacts: 'dependency-check-report/*.html', allowEmptyArchive: true
            archiveArtifacts artifacts: 'zap-report/*.html', allowEmptyArchive: true
            
            echo '>>> Cleaning up workspace (Force-handling root files)...'
            // Use docker to delete root-owned files created during build
            sh 'docker run --rm -v ${WORKSPACE}:/mnt alpine sh -c "find /mnt -mindepth 1 -delete"'
            cleanWs()
        }
    }
}
