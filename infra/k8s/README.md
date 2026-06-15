# `infra/k8s`

Thư mục này chứa toàn bộ cấu hình Kubernetes/GitOps dùng sau khi đã có cluster EKS. Đây là phần mô tả workload chạy trong cluster: dependency, service ứng dụng, ingress, TLS, registry, CI integration và quan sát hệ thống.

## Thư mục con

- `charts/`
  - Helm chart dùng chung cho các service DocVault.
  - Xem `charts/README.md`.

- `values/`
  - Helm values riêng cho gateway, web và từng backend service.
  - Xem `values/README.md`.

- `infra-deps/`
  - Kustomize manifest cho dependency trong cluster: Postgres, MongoDB, MinIO, Keycloak, External Secrets, StorageClass.
  - Xem `infra-deps/README.md`.

- `public-ingress/`
  - Kustomize overlay mở endpoint public cho web và Keycloak.
  - Xem `public-ingress/README.md`.

- `ingress-nginx/`
  - Values và hướng dẫn cài ingress-nginx trên EKS.
  - Xem `ingress-nginx/README.md`.

- `cert-manager/`
  - ClusterIssuer dùng Let's Encrypt và Cloudflare DNS-01.
  - Xem `cert-manager/README.md`.

- `cloudflare-tunnel/`
  - Manifest cho cloudflared tunnel.
  - Xem `cloudflare-tunnel/README.md`.

- `harbor/`
  - Helm values cho Harbor registry.
  - Xem `harbor/README.md`.

- `ci/`
  - RBAC cho Jenkins đọc trạng thái Argo CD.
  - Xem `ci/README.md`.

## Vai trò trong pipeline

- `infra-deps` chạy trước để app có database, object storage, identity provider và secret.
- `charts` + `values` triển khai application service.
- `public-ingress`, `ingress-nginx`, `cert-manager` mở traffic HTTPS ra ngoài.
- `harbor` là registry/scanner image cho chuỗi CI/CD.
- `ci` là điểm nối tối thiểu để Jenkins đọc trạng thái GitOps.
- `cloudflare-tunnel` là phương án expose riêng qua Cloudflare Tunnel nếu không dùng trực tiếp NLB/Ingress.
