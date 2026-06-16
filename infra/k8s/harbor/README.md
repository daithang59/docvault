# `infra/k8s/harbor`

Thư mục này chứa Helm values để cài Harbor registry trên EKS. Harbor là registry private cho image DocVault và có thể scan image bằng Trivy.

## File trong thư mục

- `values-eks.yaml`
  - Expose Harbor trực tiếp bằng AWS LoadBalancer/NLB.
  - TLS dùng secret `harbor-tls`.
  - `externalURL` đang là placeholder `https://harbor.example.com`.
  - Persistent volume dùng StorageClass `docvault-gp3`.
  - Bật Trivy scanner.
  - Đọc admin password/secret key từ secret `harbor-bootstrap-secrets`.

- `values-eks-nginx-ingress.yaml`
  - Expose Harbor qua nginx Ingress host `harbor.docvault.id.vn`.
  - Dùng cert-manager issuer `letsencrypt-cloudflare`.
  - Tắt request buffering và tăng timeout để phù hợp Docker push/pull.
  - Persistent volume dùng `docvault-gp3`.
  - Bật Trivy scanner.

- `values-eks-cloudflare-tunnel.yaml`
  - Expose Harbor bằng ClusterIP để Cloudflare Tunnel publish ra ngoài.
  - Tắt TLS trong chart vì TLS có thể xử lý ở Cloudflare edge/public route.
  - Persistent volume dùng `docvault-gp3`.
  - Bật Trivy scanner.

## Vai trò trong pipeline

- CI build image rồi push vào Harbor.
- Kubernetes pull image bằng secret `harbor-docvault-dev-pull` trong `infra/k8s/values/common-harbor.yaml`.
- Trivy trong Harbor hỗ trợ scan vulnerability của image.
