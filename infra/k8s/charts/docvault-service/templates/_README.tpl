{{/*

# `infra/k8s/charts/docvault-service/templates`

Thư mục này chứa template Helm được render thành Kubernetes manifest cho mỗi service.

## File trong thư mục

- `deployment.yaml`
  - Tạo `Deployment` cho service.
  - Hỗ trợ image dạng `repository:tag@sha256:digest`.
  - Thêm liveness/readiness probe theo `healthPath`.
  - Hardening bảo mật:
    - `automountServiceAccountToken: false`
    - chạy non-root user/group `10001`
    - `seccompProfile: RuntimeDefault`
    - `allowPrivilegeEscalation: false`
    - `readOnlyRootFilesystem: true`
    - drop toàn bộ Linux capabilities
  - Mount `/tmp` bằng `emptyDir` vì root filesystem read-only.

- `service.yaml`
  - Tạo Kubernetes `Service`.
  - Mặc định dùng `ClusterIP`.
  - Có thể gắn `nodePort` nếu values khai báo.

- `migration-job.yaml`
  - Tạo `Job` khi `migration.enabled=true`.
  - Dùng cho Prisma migration, hiện được bật ở `metadata-service.yaml`.

- `seed-job.yaml`
  - Tạo `Job` khi `seed.enabled=true`.
  - Dùng để seed dữ liệu khi cần.
  - Hiện mặc định đang tắt trong values service.

- `networkpolicy.yaml`
  - Tạo `NetworkPolicy` cho release.
  - Cho pod trong namespace gọi tới port service.
  - Egress hiện đang mở rộng; đây là điểm có thể siết thêm khi hardening production.
*/}}
