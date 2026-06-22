# `infra/k8s/public-ingress/overlays/testing`

Overlay này mở endpoint public cho môi trường testing.

## File trong thư mục

- `kustomization.yaml`
  - Gom ba resource:
    - `ingress.yaml`
    - `networkpolicy.yaml`
    - `keycloak-client-public-url-job.yaml`

- `ingress.yaml`
  - Tạo Ingress `docvault-web` cho `https://app.docvault.id.vn`.
  - Route traffic tới service `docvault-web:3006`.
  - Tạo Ingress `docvault-keycloak` cho `https://auth.docvault.id.vn`.
  - Chỉ expose các path Keycloak cần cho OIDC/login:
    - `/.well-known`
    - `/realms`
    - `/resources`
  - Dùng `cert-manager.io/cluster-issuer: letsencrypt-cloudflare`.
  - Cấu hình nginx timeout, buffer và upload size.

- `networkpolicy.yaml`
  - Cho ingress-nginx controller truy cập pod `docvault-web` và `keycloak`.
  - Giới hạn ingress vào port `3006` và `8080`.

- `keycloak-client-public-url-job.yaml`
  - Argo CD PostSync `Job`.
  - Dùng `kcadm.sh` để cập nhật client secret, redirect URI và web origin của client `docvault-gateway`.
  - Đọc admin credential từ secret `keycloak-secret` và client secret từ `docvault-app-secrets`.
  - Cần thiết để Keycloak chấp nhận callback từ `https://app.docvault.id.vn`.

## Vai trò trong pipeline

Overlay này chạy sau khi app và Keycloak đã có, vì nó cần route traffic tới service đã tồn tại và cập nhật public URL cho Keycloak client.
