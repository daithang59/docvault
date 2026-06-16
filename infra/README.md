# Hạ tầng DocVault (`infra`)

Thư mục `infra` chứa cấu hình hạ tầng, GitOps và các thành phần vận hành cho dự án DocVault. Đây là nơi mô tả cách dựng môi trường local, cách triển khai lên Kubernetes/EKS, cách lấy secret, mở ingress, quan sát log/metric và tích hợp CI/CD.

## Luồng DevSecOps tổng quan

1. Developer chạy dependency local bằng `docker-compose.dev.yml`.
2. Terraform trong `terraform/aws-eks` tạo VPC, EKS, node group, storage và IAM.
3. Argo CD được bootstrap bằng `argocd-bootstrap/docvault-root.yaml`.
4. Root app đọc các child app trong `argocd-apps`.
5. Child app hạ tầng triển khai namespace, SecretStore, Postgres, MongoDB, MinIO, Keycloak.
6. Child app ứng dụng triển khai gateway, các service backend và web bằng Helm chart dùng chung.
7. Ingress, TLS, monitoring và logging được sync sau cùng.
8. Jenkins/CI cập nhật image tag/digest, đọc trạng thái Argo CD và dùng Harbor/Secrets Manager cho chuỗi build-deploy.

## Các file ở cấp `infra`

- `.env.example`: biến môi trường mẫu cho Docker Compose local.
- `docker-compose.dev.yml`: chạy dependency local gồm Postgres, MongoDB, MinIO, Keycloak, ClamAV và mongo-express.
- `README.md`: bản đồ tổng quan của thư mục này.

## Đọc theo từng thư mục

- `argocd-bootstrap/`: bootstrap Argo CD app-of-apps. Xem `argocd-bootstrap/README.md`.
- `argocd-apps/`: các Argo CD child Application. Xem `argocd-apps/README.md`.
- `db/`: script khởi tạo Postgres local. Xem `db/README.md`.
- `keycloak/`: realm, user, role và seed script cho Keycloak local. Xem `keycloak/README.md`.
- `minio/`: script tạo bucket MinIO local. Xem `minio/README.md`.
- `k8s/`: manifest Kubernetes, Helm chart, Kustomize overlay, ingress, Harbor, CI, cert-manager. Xem `k8s/README.md`.
- `terraform/`: hạ tầng AWS/EKS bằng Terraform. Xem `terraform/README.md`.

## Thứ tự triển khai GitOps

- Bootstrap một lần: `argocd-bootstrap/docvault-root.yaml`.
- Sync wave `0`: dependency hạ tầng qua `argocd-apps/docvault-infra.yaml`.
- Sync wave `1`: các service/app qua `argocd-apps/docvault-apps.yaml`.
- Sync wave `2`: public ingress, monitoring và logging qua `argocd-apps/docvault-public-ingress.yaml`, `monitoring.yaml`, `loki.yaml`.

## Lệnh nhanh

Chạy dependency local:

```bash
docker compose -f infra/docker-compose.dev.yml --env-file infra/.env.example up -d
```

Bootstrap Argo CD app-of-apps:

```bash
kubectl apply -f infra/argocd-bootstrap/docvault-root.yaml
```

Render thử Helm chart cho gateway:

```bash
helm template docvault-gateway infra/k8s/charts/docvault-service -f infra/k8s/values/common-harbor.yaml -f infra/k8s/values/gateway.yaml
```

Validate Terraform EKS:

```bash
cd infra/terraform/aws-eks
terraform fmt -recursive
terraform validate
terraform plan -out tfplan
```
