# `infra/minio`

Thư mục này chứa script khởi tạo MinIO cho môi trường local. MinIO được dùng như S3-compatible object storage để document service lưu file.

## File trong thư mục

- `README.md`
  - Tài liệu giải thích thư mục này.

- `init.sh`
  - Được service `minio-init` trong `docker-compose.dev.yml` chạy sau khi MinIO healthy.
  - Tạo alias `mc` tên `local` trỏ tới `http://minio:9000`.
  - Tạo bucket theo biến môi trường `MINIO_BUCKET`.
  - Bật SSE-S3 mặc định cho bucket để mô phỏng encryption at rest.

## Vai trò trong pipeline

- Local: script này bootstrap bucket cho Docker Compose.
- Kubernetes/EKS: logic tương tự nằm trong `infra/k8s/infra-deps/base/minio-init-job.yaml` và chạy bằng Argo CD PostSync hook.
