def call(cfg) {
    echo '>>> Running Policy as Code Scan (Kyverno CLI)...'

    def status = sh(
        script: """
        set -eu
        rm -rf policy-report policy-rendered
        mkdir -p policy-report
        mkdir -p policy-rendered

        echo ">>> Rendering DocVault Helm values for policy checks..."
        common_values="infra/k8s/values/common-harbor.yaml"
        for f in infra/k8s/values/*.yaml; do
            name="\$(basename "\$f" .yaml)"
            if [ "\$name" = "common-harbor" ]; then
                continue
            fi
            case "\$f" in
                *.example.yaml) continue ;;
            esac

            value_args="-f \$f"
            if [ -f "\$common_values" ]; then
                value_args="-f \$common_values -f \$f"
            fi

            docker run --rm \\
                -v ${env.WORKSPACE}:/workspace \\
                -w /workspace \\
                ${cfg.helmImage ?: 'alpine/helm:3.16.4'} \\
                template "docvault-\$name" infra/k8s/charts/docvault-service \\
                -n docvault \\
                \$value_args \\
                > "policy-rendered/\$name.yaml"
        done

        echo ">>> Scanning infra/k8s manifests and rendered Helm output against Kyverno policies..."

        RESOURCES=""
        for f in \$(find infra/k8s infra/argocd-apps infra/argocd-bootstrap \\
            -path 'infra/k8s/charts' -prune -o \\
            -path 'infra/k8s/values' -prune -o \\
            -path 'infra/k8s/harbor' -prune -o \\
            -type f \\( -name '*.yaml' -o -name '*.yml' \\) -print); do
            if grep -q "kind:" "\$f"; then
                RESOURCES="\$RESOURCES --resource /workspace/\$f"
            fi
        done

        for f in policy-rendered/*.yaml; do
            if grep -q "kind:" "\$f"; then
                RESOURCES="\$RESOURCES --resource /workspace/\$f"
            fi
        done

        if [ -z "\$RESOURCES" ]; then
            echo "No valid Kubernetes manifests found. Skipping scan."
            exit 0
        fi

        set +e
        docker run --rm \\
            -v ${env.WORKSPACE}:/workspace \
            -w /workspace \
            ${cfg.kyvernoImage ?: 'ghcr.io/kyverno/kyverno-cli:v1.12.0'} \
            apply /workspace/policies/kyverno \
            \$RESOURCES \
            --detailed-results \
            > policy-report/kyverno-report.txt 2>&1
        status=\$?
        set -e

        cat policy-report/kyverno-report.txt
        exit "\$status"
        """,
        returnStatus: true
    )

    archiveArtifacts artifacts: 'policy-report/kyverno-report.txt,policy-rendered/*.yaml', allowEmptyArchive: true

    if (status != 0) {
        error("Policy as Code violations detected.")
    } else {
        echo ">>> Policy as Code scan passed."
    }
}
