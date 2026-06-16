# `infra/k8s/charts`

Thư mục này chứa Helm chart nội bộ của DocVault.

## Thư mục con

- `docvault-service/`
  - Helm chart dùng chung để triển khai gateway, web và các backend service.
  - Mỗi service dùng cùng template nhưng khác file values trong `infra/k8s/values`.
  - Xem `docvault-service/README.md`.

## Vai trò trong pipeline

Jenkins/CI build image, cập nhật tag/digest trong `infra/k8s/values/*.yaml`, sau đó Argo CD render chart này để triển khai đúng artifact đã build.
