# `infra/k8s/infra-deps`

Thư mục này chứa Kustomize manifest để triển khai dependency hạ tầng vào cluster Kubernetes. Trong demo EKS/GitOps, các dependency này chạy ngay trong namespace `docvault` để ứng dụng có thể boot nhanh.

## Thư mục và file

- `README.md`
  - Tài liệu giải thích thư mục này.

- `base/`
  - Manifest dùng chung cho namespace, StorageClass, SecretStore, Postgres, MongoDB, MinIO, Keycloak và app secrets.
  - Xem `base/README.md`.

- `overlays/`
  - Overlay theo môi trường.
  - Hiện có overlay `testing`.
  - Xem `overlays/README.md`.

- `harbor-values.yaml`
  - File cũ/deprecated cho Harbor demo.
  - Được giữ để các ghi chú cũ không bị gãy.
  - Nên dùng `infra/k8s/harbor/values-eks.yaml` hoặc các values Harbor mới hơn.
  - Không đặt password/secret thật vào file này.

## Vai trò trong GitOps

Argo CD child app `infra/argocd-apps/docvault-infra.yaml` trỏ tới:

```text
infra/k8s/infra-deps/overlays/testing
```

Tức là khi sync, Argo CD sẽ render overlay `testing`, sau đó triển khai dependency trước các service ứng dụng.

## Stateful data

Các dependency stateful dùng StorageClass `docvault-gp3`, backed by AWS EBS CSI driver:

- PostgreSQL: PVC `postgres-data-db-0`, 10Gi.
- MongoDB: PVC `mongo-data-mongo-0`, 10Gi.
- MinIO: PVC `minio-data-minio-0`, 20Gi.

StorageClass dùng encrypted gp3 EBS volume, `WaitForFirstConsumer` và `Retain` reclaim policy để giảm rủi ro mất dữ liệu demo khi pod/PVC bị thay đổi ngoài ý muốn.

## Lưu ý production

- Dependency trong cluster phù hợp demo/testing; production nên cân nhắc managed database/object storage.
- Plain Kubernetes Secret không được hardcode trong Git; manifest dùng External Secrets để kéo secret từ AWS Secrets Manager.
- Khi thêm môi trường mới, tạo overlay mới dưới `overlays/<environment>` thay vì sửa trực tiếp base.
