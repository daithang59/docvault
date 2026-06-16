# `infra/k8s/charts/docvault-service`

Đây là Helm chart dùng chung cho các workload DocVault. Chart này tránh lặp lại manifest Deployment/Service/Job/NetworkPolicy cho từng service.

## File trong thư mục

- `Chart.yaml`
  - Metadata của Helm chart.
  - Tên chart: `docvault-service`.
  - Loại chart: `application`.

- `values.yaml`
  - Giá trị mặc định cho chart.
  - Khai báo image, service port, health path, resource request/limit, biến môi trường, migration và seed job.
  - Khi triển khai thật, file này được override bởi `infra/k8s/values/common-harbor.yaml` và values riêng từng service.

- `templates/`
  - Chứa các template Kubernetes mà Helm render ra.
  - Xem `templates/README.md`.

## Cách chart được dùng

Các Argo CD app trong `infra/argocd-apps/docvault-apps.yaml` đều trỏ tới chart này, ví dụ:

```text
path: infra/k8s/charts/docvault-service
helm:
  valueFiles:
    - ../../values/common-harbor.yaml
    - ../../values/gateway.yaml
```

Nhờ vậy mỗi service chỉ cần một file values riêng để đổi image, port, env và dependency URL.
