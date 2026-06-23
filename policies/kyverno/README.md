# DocVault Kyverno Policies

These policies are used by the Jenkins `Policy as Code` stage to fail the pipeline before GitOps changes are deployed.

## Baseline gates

- `require-limits.yaml`: every Pod container must declare CPU and memory requests and limits.
- `disallow-root-user.yaml`: Pods must run with `runAsNonRoot: true`.
- `disallow-privileged.yaml`: privileged containers are not allowed.
- `disallow-latest-tag.yaml`: mutable `latest` image tags are not allowed.

## DocVault application supply-chain gates

These rules match only workloads labelled `app.kubernetes.io/part-of: docvault-app`, which are rendered from the shared DocVault Helm chart. This keeps third-party dependencies such as Keycloak, Postgres, MongoDB, and MinIO out of the DocVault image-source policy.

- `require-docvault-harbor-digest.yaml`: DocVault Deployments and Jobs must use `harbor.docvault.id.vn/docvault-*/*:<tag>@sha256:<digest>`.
- `require-docvault-image-pull-secret.yaml`: DocVault Deployments and Jobs must reference a Harbor pull secret such as `harbor-docvault-dev-pull`.
- `require-docvault-restricted-containers.yaml`: DocVault Deployments and Jobs must use RuntimeDefault seccomp, no privilege escalation, read-only root filesystem, and drop all Linux capabilities.
- `disallow-secret-literals.yaml`: Kubernetes Secret manifests must not contain committed `data` or `stringData`; use External Secrets or another encrypted secret workflow.

## Jenkins rendering behavior

`vars/policyAsCode.groovy` renders each real service values file with `infra/k8s/values/common-harbor.yaml` before applying these policies. Files named `*.example.yaml` are skipped because they are override examples, not standalone Argo CD workloads.
