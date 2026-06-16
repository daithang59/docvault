# `infra/db`

Thư mục này chứa script khởi tạo Postgres cho môi trường local. File ở đây được Docker Compose mount vào container Postgres khi database được tạo lần đầu.

## File trong thư mục

- `README.md`
  - Tài liệu giải thích thư mục này.

- `init-postgres.sql`
  - Bật extension `uuid-ossp`.
  - Tạo database `docvault_audit` nếu chưa có.
  - Kết nối lại vào `docvault_metadata`.
  - Đảm bảo `docvault_metadata` có extension `uuid-ossp`.
  - Tạo bảng `_bootstrap` để xác nhận bootstrap database đã chạy.

## Vai trò trong pipeline

- Dùng cho local development, không phải schema nghiệp vụ chính.
- Schema nghiệp vụ của metadata service được quản lý bằng Prisma migration trong service tương ứng.
- Trong Kubernetes/EKS, logic tương tự được mô tả lại ở `infra/k8s/infra-deps/base/postgres.yaml`.
