# `infra/k8s/infra-deps/base`

Thư mục này chứa Kustomize base dùng chung cho dependency hạ tầng của DocVault trong Kubernetes.

## File trong thư mục

- `kustomization.yaml`
  - Gom các resource base:
    - `app-secrets.yaml`
    - `docvault-ns.yaml`
    - `keycloak.yaml`
    - `minio-init-job.yaml`
    - `minio.yaml`
    - `mongodb.yaml`
    - `monitoring-ns.yaml`
    - `postgres.yaml`
    - `secretstore.yaml`
    - `storageclass.yaml`

- `docvault-ns.yaml`
  - Tạo namespace `docvault`.
  - Có sync wave `-3` để tạo sớm nhất.

- `monitoring-ns.yaml`
  - Tạo namespace `monitoring` cho Prometheus/Grafana/Loki.

- `storageclass.yaml`
  - Tạo StorageClass `docvault-gp3`.
  - Dùng AWS EBS CSI driver.
  - Volume type `gp3`, encrypted.
  - `reclaimPolicy: Retain` để giữ volume khi PVC bị xóa.
  - `volumeBindingMode: WaitForFirstConsumer` để volume được tạo theo node/AZ phù hợp.

- `secretstore.yaml`
  - Tạo External Secrets `SecretStore` tên `aws-secrets-manager`.
  - Region là placeholder `__AWS_REGION__`.
  - Overlay sẽ thay placeholder này bằng region thật.

- `app-secrets.yaml`
  - Tạo `ExternalSecret` tên `docvault-app-secrets`.
  - Kéo secret từ AWS Secrets Manager path `/docvault/<environment>/app`.
  - Target Kubernetes secret cũng tên `docvault-app-secrets`.

- `postgres.yaml`
  - Tạo `ExternalSecret` `postgres-secret`.
  - Tạo ConfigMap `postgres-init-sql`.
  - Tạo StatefulSet `db` chạy `postgres:16-alpine`.
  - Tạo Service `db:5432`.
  - Dùng PVC 10Gi trên StorageClass `docvault-gp3`.
  - Có hardening: non-root, seccomp, drop capabilities, read-only root filesystem, volume riêng cho `/tmp` và `/var/run/postgresql`.

- `mongodb.yaml`
  - Tạo `ExternalSecret` `mongodb-secret`.
  - Tạo StatefulSet `mongo` chạy `mongo:7`.
  - Tạo Service `mongo:27017`.
  - Dùng PVC 10Gi trên `docvault-gp3`.
  - Có hardening container tương tự.

- `minio.yaml`
  - Tạo `ExternalSecret` `minio-secret`.
  - Tạo StatefulSet `minio`.
  - Tạo Service `minio` expose port API `9000` và console `9001`.
  - Dùng PVC 20Gi trên `docvault-gp3`.

- `minio-init-job.yaml`
  - Tạo Argo CD PostSync `Job` tên `minio-init`.
  - Đợi MinIO ready.
  - Tạo bucket từ `MINIO_BUCKET`.
  - Bật SSE-S3 mặc định cho bucket.

- `keycloak.yaml`
  - Tạo `ExternalSecret` `keycloak-secret`.
  - Tạo Deployment `keycloak` dùng image `quay.io/keycloak/keycloak:26.0`.
  - Import realm từ ConfigMap `keycloak-realm-config`.
  - Tạo Service `keycloak:8080`.
  - Cấu hình hostname public `https://auth.docvault.id.vn`.

## Nguyên tắc chỉnh sửa

- File trong `base` nên giữ cấu hình dùng chung.
- Giá trị phụ thuộc môi trường như AWS region, secret path hoặc realm import nên đặt ở overlay.
