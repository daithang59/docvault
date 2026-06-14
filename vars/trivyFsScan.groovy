def call(cfg) {
    echo '>>> Running Trivy Filesystem Scan...'
    echo '>>> Security gate policy: Trivy FS fails on HIGH/CRITICAL findings.'
    sh """
        set -eu

        mkdir -p trivy-fs-report
        scan_dir="${env.WORKSPACE}/.trivy-scan-src"
        archive_path="${env.WORKSPACE}/trivy-fs-report/source.tar"
        cleanup() {
            rm -rf "\$scan_dir"
            rm -f "\$archive_path"
        }
        trap cleanup EXIT

        rm -rf "\$scan_dir"
        mkdir -p "\$scan_dir"

        tar \\
            --exclude='.git' \\
            --exclude='*/.git' \\
            --exclude='.trivy-scan-src' \\
            --exclude='node_modules' \\
            --exclude='*/node_modules' \\
            --exclude='*/node_modules/*' \\
            --exclude='.pnpm-store' \\
            --exclude='*/.pnpm-store' \\
            --exclude='*/.pnpm-store/*' \\
            --exclude='.turbo' \\
            --exclude='*/.turbo' \\
            --exclude='.next' \\
            --exclude='*/.next' \\
            --exclude='dist' \\
            --exclude='*/dist' \\
            --exclude='coverage' \\
            --exclude='*/coverage' \\
            --exclude='.sonar-cache' \\
            --exclude='*/.sonar-cache' \\
            --exclude='*/.sonar-cache/*' \\
            --exclude='.scannerwork' \\
            --exclude='*/.scannerwork' \\
            --exclude='*/.scannerwork/*' \\
            --exclude='dependency-check-report' \\
            --exclude='trivy-fs-report' \\
            --exclude='checkov-report' \\
            --exclude='zap-report' \\
            --exclude='*/.terraform' \\
            --exclude='*/.terraform/*' \\
            -cf "\$archive_path" -C '${env.WORKSPACE}' .

        tar -xf "\$archive_path" -C "\$scan_dir"
        rm -f "\$archive_path"

        if [ ! -f "\$scan_dir/package.json" ] || [ ! -f "\$scan_dir/pnpm-lock.yaml" ]; then
            echo ">>> ERROR: Trivy FS snapshot does not contain expected repository files."
            echo ">>> Snapshot path: \$scan_dir"
            echo ">>> First files found in snapshot:"
            find "\$scan_dir" -maxdepth 3 -type f | sort | sed -n '1,80p'
            exit 1
        fi

        file_count="\$(find "\$scan_dir" -type f | wc -l | tr -d ' ')"
        echo ">>> Trivy FS snapshot contains \$file_count files."

        ignore_args=""
        if [ -f "\$scan_dir/.trivyignore.yaml" ]; then
            ignore_args="--ignorefile /src/.trivyignore.yaml"
            echo ">>> Trivy FS using ignore file: .trivyignore.yaml"
        fi

        docker run --rm \\
            -v "\$scan_dir:/src:ro" \\
            -v "${env.WORKSPACE}/trivy-fs-report:/report" \\
            ${cfg.trivyImage} \\
            fs /src \$ignore_args --show-suppressed --scanners vuln,secret,misconfig --misconfig-scanners dockerfile,kubernetes,helm --severity HIGH,CRITICAL --format json --output /report/trivy-fs-report.json --exit-code 0 --no-progress

        docker run --rm \\
            -v "\$scan_dir:/src:ro" \\
            ${cfg.trivyImage} \\
            fs /src \$ignore_args --scanners vuln,secret,misconfig --misconfig-scanners dockerfile,kubernetes,helm --severity HIGH,CRITICAL --exit-code 1 --no-progress
    """
}
