def call(cfg) {
    echo '>>> Running Checkov IaC Scan (Terraform/K8s/Helm only)...'

    withEnv(["CHECKOV_IMAGE=${cfg.checkovImage}"]) {
        sh '''
            set -eu
            mkdir -p checkov-report

            TARGET_ARGS=""
            [ -d "$WORKSPACE/infra/k8s" ] && TARGET_ARGS="$TARGET_ARGS --directory /repo/infra/k8s"
            [ -d "$WORKSPACE/infra/argocd" ] && TARGET_ARGS="$TARGET_ARGS --directory /repo/infra/argocd"
            [ -d "$WORKSPACE/infra/terraform" ] && TARGET_ARGS="$TARGET_ARGS --directory /repo/infra/terraform"

            if [ -z "$TARGET_ARGS" ]; then
              echo "No IaC directories found. Skipping Checkov."
              exit 0
            fi

            status=0
            if docker run --rm \
                -v "$WORKSPACE:/repo" \
                -w /repo \
                "$CHECKOV_IMAGE" \
                $TARGET_ARGS \
                --framework terraform,kubernetes,helm \
                --output cli \
                > checkov-report/checkov-report.txt 2>&1
            then
                status=0
            else
                status=$?
            fi

            cat checkov-report/checkov-report.txt
            [ "$status" -eq 0 ] || exit "$status"
        '''
    }
}