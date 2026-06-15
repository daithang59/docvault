# `infra/k8s/infra-deps/overlays`

Thư mục này chứa các Kustomize overlay theo môi trường cho dependency hạ tầng.

## Thư mục con

- `testing/`
  - Overlay đang được Argo CD dùng trong `infra/argocd-apps/docvault-infra.yaml`.
  - Xem `testing/README.md`.

## Khi thêm môi trường mới

Tạo folder mới, ví dụ:

```text
infra/k8s/infra-deps/overlays/staging
infra/k8s/infra-deps/overlays/production
```

Sau đó cấu hình:

- `awsRegion`
- `secretsEnvironment`
- realm Keycloak riêng nếu cần

Cuối cùng trỏ Argo CD Application tương ứng tới overlay mới.
