# `infra/terraform/aws-eks`

Thư mục này chứa Terraform stack tạo nền tảng AWS EKS cho DocVault GitOps demo.

## Stack này tạo gì?

- VPC với public/private subnet trên 2 Availability Zone.
- EKS cluster.
- EKS managed node group.
- EKS add-ons: CoreDNS, kube-proxy, VPC CNI, AWS EBS CSI driver.
- Control plane logs: `api`, `audit`, `authenticator`, `controllerManager`, `scheduler`.
- Node group dùng IMDSv2 bắt buộc và encrypted gp3 root volume.
- IAM role cho External Secrets Operator đọc AWS Secrets Manager.
- Tùy chọn IAM Roles Anywhere cho Jenkins local/controller VM.

## File trong thư mục

- `README.md`
  - Tài liệu giải thích Terraform stack này.

- `versions.tf`
  - Yêu cầu Terraform `>= 1.6.0`.
  - Pin AWS provider `~> 5.0`.
  - Có cấu hình S3 backend/DynamoDB locking đang comment. MVP hiện dùng local state; production nên chuyển sang remote backend.

- `providers.tf`
  - Cấu hình AWS provider dùng `var.aws_region`.

- `variables.tf`
  - Khai báo biến chính cho region, cluster name/version, environment.
  - Cấu hình CIDR được truy cập public EKS API endpoint.
  - Cấu hình node instance type, số lượng node, disk size.
  - `enable_nat_gateway` quyết định node chạy private subnet có NAT hay public subnet để giảm chi phí demo.

- `terraform.tfvars.example`
  - File mẫu để copy thành `terraform.tfvars`.
  - Chứa giá trị demo cho môi trường `testing`.
  - Có block comment cho Jenkins IAM Roles Anywhere.
  - Không commit `terraform.tfvars` thật vì có thể chứa cấu hình riêng hoặc đường dẫn certificate.

- `main.tf`
  - Dùng module `terraform-aws-vpc` để tạo VPC/subnet.
  - Dùng module `terraform-aws-eks` để tạo EKS.
  - Bật add-ons cần thiết cho cluster.
  - Tạo managed node group `docvault`.
  - Gán policy EBS CSI cho node role.
  - Cấu hình IMDSv2, encrypted gp3 root volume.
  - Thêm security group rule NodePort cho web `30006` và Keycloak `30080`.

- `external-secrets-irsa.tf`
  - Tạo IAM role cho External Secrets Operator bằng OIDC/IRSA.
  - Chỉ cho service account `external-secrets/external-secrets` assume role.
  - Cấp quyền đọc secret dưới prefix `/docvault/${var.environment}/*` trong AWS Secrets Manager.
  - Đây là cầu nối bảo mật giữa Kubernetes `ExternalSecret` và AWS Secrets Manager.

- `jenkins-roles-anywhere.tf`
  - Tùy chọn tạo IAM Roles Anywhere cho Jenkins.
  - Khi bật `enable_jenkins_roles_anywhere=true`, Terraform tạo trust anchor, profile, IAM role và policy đọc secret.
  - Giúp Jenkins lấy temporary credentials bằng certificate thay vì hardcode AWS access key dài hạn.

- `outputs.tf`
  - Xuất cluster name, endpoint, security group, VPC/subnet IDs.
  - Xuất lệnh `aws eks update-kubeconfig`.
  - Xuất node group info.
  - Xuất External Secrets role ARN.
  - Xuất Jenkins Roles Anywhere ARN nếu tính năng được bật.

## Cách chạy

```bash
cd infra/terraform/aws-eks
cp terraform.tfvars.example terraform.tfvars
terraform init
terraform fmt -recursive
terraform validate
terraform plan -out tfplan
terraform apply tfplan
```

Quét cấu hình bằng Checkov nếu có cài:

```bash
checkov -d infra/terraform/aws-eks
```

Cấu hình `kubectl` sau khi apply:

```bash
aws eks update-kubeconfig --region ap-southeast-1 --name docvault-eks
kubectl get nodes
```

## Lưu ý bảo mật

- Không commit `terraform.tfvars`, state file hoặc plan file.
- Nên thu hẹp `cluster_endpoint_public_access_cidrs` thay vì để `0.0.0.0/0`.
- Production nên dùng S3 backend có DynamoDB locking.
- Không trỏ `jenkins_rolesanywhere_ca_certificate_path` tới private key; biến này chỉ nhận public CA certificate.
