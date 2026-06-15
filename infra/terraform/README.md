# `infra/terraform`

Thư mục này chứa cấu hình Terraform cho hạ tầng cloud. Hiện tại chỉ có một stack chính: `aws-eks`.

## Thư mục con

- `aws-eks/`
  - Tạo nền tảng AWS cho demo GitOps/EKS.
  - Bao gồm VPC, subnet, EKS cluster, managed node group, EBS CSI driver, IAM cho External Secrets và tùy chọn IAM Roles Anywhere cho Jenkins.
  - Xem chi tiết tại `aws-eks/README.md`.

## Vai trò trong pipeline DevSecOps

- Terraform tạo nền hạ tầng trước khi Argo CD triển khai workload.
- EKS là nơi chạy dependency và app Kubernetes.
- IAM role trong Terraform cấp quyền tối thiểu cho External Secrets và Jenkins đọc secret từ AWS Secrets Manager.
- StorageClass trong Kubernetes phụ thuộc AWS EBS CSI driver được bật từ Terraform.
