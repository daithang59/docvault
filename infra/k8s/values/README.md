# `infra/k8s/values`

Thư mục này chứa Helm values riêng cho từng service/app. Đây là nơi GitOps biết image nào sẽ chạy, service mở port nào, biến môi trường nào được truyền vào pod và secret nào được nạp.

## File trong thư mục

- `common-harbor.yaml`
  - Values dùng chung cho tất cả service.
  - Khai báo `imagePullSecrets` là `harbor-docvault-dev-pull`.
  - Cho phép Kubernetes pull image từ Harbor/private registry.

- `gateway.yaml`
  - Values cho API gateway.
  - Image `daithang59/gateway`, tag `v33`, có digest pin.
  - Port service `3000`, health path `/api/health`.
  - Khai báo URL tới Keycloak, frontend và các backend service.
  - Nạp secret chung từ `docvault-app-secrets`.

- `metadata-service.yaml`
  - Values cho metadata service.
  - Port service `3001`.
  - Bật Prisma migration bằng `migration.enabled=true`.
  - Nạp secret chung từ `docvault-app-secrets`.

- `document-service.yaml`
  - Values cho document service.
  - Port service `3002`.
  - Khai báo MinIO/S3 endpoint, bucket, region và path-style.
  - Lấy `S3_ACCESS_KEY` và `S3_SECRET_KEY` từ secret `minio-secret`.
  - Nạp secret chung từ `docvault-app-secrets`.

- `workflow-service.yaml`
  - Values cho workflow service.
  - Port service `3003`.
  - Kết nối metadata, audit và notification service.

- `audit-service.yaml`
  - Values cho audit service.
  - Port service `3004`.
  - Nạp identity config và secret chung.

- `notification-service.yaml`
  - Values cho notification service.
  - Port service `3005`.
  - Kết nối audit service.

- `web.yaml`
  - Values cho Next.js web app.
  - Port service `3006`, health path `/api/health`.
  - Khai báo browser URL, internal gateway URL và Keycloak public/internal URL.

## Vai trò trong CI/CD

Khi pipeline build image mới, phần thường được cập nhật là `image.tag` và `image.digest` trong các file values này. Argo CD sync lại để triển khai đúng image đã được build và scan.
