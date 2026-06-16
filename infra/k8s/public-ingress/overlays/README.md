# `infra/k8s/public-ingress/overlays`

Thư mục này chứa các overlay Kustomize theo môi trường cho public ingress.

## Thư mục con

- `testing/`
  - Overlay public ingress cho môi trường testing.
  - Xem `testing/README.md`.

## Khi thêm môi trường mới

Tạo overlay mới và chỉnh:

- hostname public.
- TLS secret name.
- ClusterIssuer nếu môi trường dùng issuer khác.
- redirect URI/web origin Keycloak nếu domain thay đổi.
