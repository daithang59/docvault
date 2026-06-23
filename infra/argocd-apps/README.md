# `infra/argocd-apps`

Thư mục này chứa các Argo CD child `Application`. Root app trong `infra/argocd-bootstrap/docvault-root.yaml` sẽ đọc thư mục này và dùng các file ở đây để triển khai hạ tầng, ứng dụng, ingress, monitoring và logging.

## Ý nghĩa trong pipeline DevSecOps

- Git là nguồn sự thật cho trạng thái triển khai.
- Argo CD đọc manifest từ branch `gitops-testing`.
- `sync-wave` quy định thứ tự triển khai để dependency có trước app.
- `selfHeal` giúp tự sửa drift nếu tài nguyên trên cluster bị chỉnh tay.

## File trong thư mục

- `README.md`
  - Tài liệu giải thích thư mục này.

- `docvault-infra.yaml`
  - Tạo Argo CD app `docvault-infra-deps`.
  - Sync wave `0`.
  - Trỏ tới `infra/k8s/infra-deps/overlays/testing`.
  - Triển khai dependency trong namespace `docvault`: namespace, StorageClass, SecretStore, ExternalSecret, Postgres, MongoDB, MinIO, Keycloak.
  - Chạy trước các service ứng dụng.

- `docvault-apps.yaml`
  - Chứa nhiều Argo CD app cho từng workload DocVault:
    - `docvault-gateway`
    - `docvault-metadata`
    - `docvault-audit-service`
    - `docvault-notification-service`
    - `docvault-workflow-service`
    - `docvault-document-service`
    - `docvault-web`
  - Tất cả dùng Helm chart chung `infra/k8s/charts/docvault-service`.
  - Mỗi app nạp `../../values/common-harbor.yaml` và file values riêng trong `infra/k8s/values`.
  - Sync wave `1`, tức là sau hạ tầng dependency.
  - `ignoreDifferences` bỏ qua drift phần `env` của container đầu tiên để tránh Argo CD báo lệch vì biến môi trường có thể được thay đổi/chen bởi runtime.

- `docvault-public-ingress.yaml`
  - Tạo Argo CD app `docvault-public-ingress`.
  - Sync wave `2`.
  - Trỏ tới `infra/k8s/public-ingress/overlays/testing`.
  - Mở public endpoint cho web và Keycloak qua ingress-nginx/cert-manager.

- `monitoring.yaml`
  - Cài Helm chart `kube-prometheus-stack`.
  - Tạo monitoring stack trong namespace `monitoring`.
  - Bật Grafana/Prometheus và thêm datasource Loki cho Grafana.
  - Tắt `nodeExporter`/`prometheus-node-exporter` trong môi trường testing để giảm pod pressure trên từng node.
  - Sync wave `2`.

- `loki.yaml`
  - Cài Helm chart `loki-stack`.
  - Bật Loki; tắt Promtail trong môi trường testing để giảm pod pressure trên từng node.
  - Tắt Grafana/Prometheus trong chart này vì đã có `monitoring.yaml`.
  - Sync wave `2`.

## Thứ tự sync

1. `docvault-infra.yaml`
2. `docvault-apps.yaml`
3. `docvault-public-ingress.yaml`, `monitoring.yaml`, `loki.yaml`
