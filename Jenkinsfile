pipeline {
    agent any 

    environment {
        NODE_IMAGE = 'node:20-alpine'
    }

    stages {
        stage('System Check') {
            steps {
                script {
                    echo '>>> Checking Agent Environment...'
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
                        -v ${WORKSPACE}:/app \
                        -w /app \
                        ${NODE_IMAGE} \
                        sh -c "corepack enable && pnpm install --frozen-lockfile && pnpm turbo run prisma:generate --continue"
                """
            }
        }

        stage('Unit Tests') {
            steps {
                echo '>>> Running Tests inside a temporary Node container...'
                sh """
                    docker run --rm \
			--network host \
                        -v ${WORKSPACE}:/app \
                        -w /app \
                        ${NODE_IMAGE} \
			sh -c "corepack enable && pnpm turbo run test"
                   """
            }
        }
    }

    post {
        always {
            echo '>>> Cleaning up workspace...'
            cleanWs()
        }
    }
}
