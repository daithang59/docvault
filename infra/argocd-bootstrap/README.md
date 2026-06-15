# `infra/argocd-bootstrap`

Thư mục này chứa manifest bootstrap đầu tiên cho Argo CD. Đây là bước khởi động mô hình app-of-apps: apply root app một lần, sau đó Argo CD tự đọc và quản lý các child app trong `infra/argocd-apps`.

## File trong thư mục

- `docvault-root.yaml`
  - Tạo Argo CD `Application` tên `docvault-root` trong namespace `argocd`.
  - Trỏ tới repo `https://github.com/daithang59/docvault.git`, branch `gitops-testing`.
  - Trỏ path `infra/argocd-apps`, tức là nơi chứa các child Application.
  - Bật `selfHeal: true` để Argo CD tự sửa drift khi trạng thái cluster lệch khỏi Git.
  - Đặt `prune: false` để tránh xóa child Application ngoài ý muốn trong giai đoạn bootstrap.
  - Dùng `CreateNamespace=true` để Argo CD có thể tạo namespace nếu cần.

## Cách dùng

```bash
kubectl apply -f infra/argocd-bootstrap/docvault-root.yaml
```

Sau khi apply, thay đổi ở `infra/argocd-apps` sẽ được root app phát hiện và sync theo cấu hình Argo CD.
