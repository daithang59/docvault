def call() {
    echo '>>> Archiving Security Reports...'
    archiveArtifacts artifacts: 'dependency-check-report/*.html', allowEmptyArchive: true
    archiveArtifacts artifacts: 'zap-report/*.html', allowEmptyArchive: true

    echo '>>> Cleaning up workspace (Force-handling root files)...'
    sh 'docker run --rm -v ${WORKSPACE}:/mnt alpine sh -c "find /mnt -mindepth 1 -delete"'
    cleanWs()
}

return this
