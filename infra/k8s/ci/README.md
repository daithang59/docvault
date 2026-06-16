# `infra/k8s/ci`

Thư mục này chứa manifest phục vụ tích hợp CI với Kubernetes/Argo CD.

## File trong thư mục

- `jenkins-argocd-reader.yaml`
  - Tạo ServiceAccount `jenkins-argocd-reader` trong namespace `argocd`.
  - Tạo token secret cho service account.
  - Tạo Role cho phép `get`, `list`, `watch` tài nguyên Argo CD `applications`.
  - Tạo RoleBinding gán Role cho ServiceAccount.

## Vai trò trong pipeline

Jenkins có thể đọc trạng thái Argo CD Application để biết deployment đã sync/healthy hay chưa, nhưng không có quyền sửa/xóa Application. Đây là phân quyền đọc tối thiểu cho bước kiểm tra sau deploy.
