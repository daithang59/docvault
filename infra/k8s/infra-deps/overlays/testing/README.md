# `infra/k8s/infra-deps/overlays/testing`

Overlay này cấu hình dependency hạ tầng cho môi trường `testing`.

## File trong thư mục

- `kustomization.yaml`
  - Kế thừa `../../base`.
  - Tạo ConfigMap `docvault-external-secrets-settings` với:
    - `awsRegion=ap-southeast-1`
    - `secretsEnvironment=testing`
  - Tạo ConfigMap `keycloak-realm-config` từ `realm-docvault.json`.
  - Dùng Kustomize `replacements` để:
    - thay region trong `SecretStore`.
    - thay segment environment trong path của tất cả `ExternalSecret`.

- `realm-docvault.json`
  - Realm Keycloak cho Kubernetes testing.
  - Tạo realm `docvault`.
  - Tạo client `docvault-gateway`.
  - Tạo role và user demo cơ bản.
  - Có redirect URI/web origin cho public URL `https://app.docvault.id.vn`.
  - Được mount vào Keycloak Deployment qua ConfigMap `keycloak-realm-config`.

## Secret path được tạo ra

Overlay này biến các path dạng:

```text
/docvault/__SECRETS_ENVIRONMENT__/<secret>
```

thành:

```text
/docvault/testing/<secret>
```

Ví dụ:

- `/docvault/testing/app`
- `/docvault/testing/postgres`
- `/docvault/testing/mongodb`
- `/docvault/testing/minio`
- `/docvault/testing/keycloak`
