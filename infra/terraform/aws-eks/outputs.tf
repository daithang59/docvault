output "cluster_name" {
  description = "EKS cluster name."
  value       = module.eks_cluster.cluster_name
}

output "cluster_endpoint" {
  description = "EKS cluster API endpoint."
  value       = module.eks_cluster.cluster_endpoint
}

output "cluster_security_group_id" {
  description = "EKS cluster security group ID."
  value       = module.eks_cluster.cluster_security_group_id
}

output "region" {
  description = "AWS region."
  value       = var.aws_region
}

output "vpc_id" {
  description = "VPC ID."
  value       = module.network.vpc_id
}

output "public_subnet_ids" {
  description = "Public subnet IDs."
  value       = module.network.public_subnets
}

output "private_subnet_ids" {
  description = "Private subnet IDs."
  value       = module.network.private_subnets
}

output "configure_kubectl" {
  description = "Command to configure kubectl for this cluster."
  value       = "aws eks update-kubeconfig --region ${var.aws_region} --name ${module.eks_cluster.cluster_name}"
}

output "node_group_name" {
  description = "Actual EKS managed node group name. The EKS module may append a generated suffix."
  value       = module.eks_cluster.node_group_name
}

output "node_group_autoscaling_group_names" {
  description = "Underlying Auto Scaling Group names for the managed node group."
  value       = module.eks_cluster.node_group_autoscaling_group_names
}

output "external_secrets_role_arn" {
  description = "IAM role ARN for the External Secrets Operator service account."
  value       = module.external_secrets_irsa.role_arn
}

output "documents_bucket_name" {
  description = "S3 bucket used by document-service for document blobs."
  value       = module.documents_storage.bucket_name
}

output "documents_kms_key_arn" {
  description = "KMS key ARN used for S3 SSE-KMS document encryption."
  value       = module.documents_storage.kms_key_arn
}

output "document_service_role_arn" {
  description = "IAM role ARN for the document-service Kubernetes service account."
  value       = module.documents_storage.document_service_role_arn
}

output "cnpg_backups_bucket_name" {
  description = "S3 bucket used for CloudNativePG database backups."
  value       = module.cnpg_backups_storage.bucket_name
}

output "cnpg_backups_kms_key_arn" {
  description = "KMS key ARN used for CloudNativePG backup bucket SSE-KMS."
  value       = module.cnpg_backups_storage.kms_key_arn
}

output "cnpg_backups_role_arn" {
  description = "IAM role ARN used by CloudNativePG metadata PostgreSQL pods for S3 backup access."
  value       = module.cnpg_backups_storage.role_arn
}

output "mongodb_backups_bucket_name" {
  description = "S3 bucket used for Percona MongoDB backups."
  value       = module.mongodb_backups_storage.bucket_name
}

output "mongodb_backups_kms_key_arn" {
  description = "KMS key ARN used for MongoDB backup bucket SSE-KMS."
  value       = module.mongodb_backups_storage.kms_key_arn
}

output "mongodb_backups_kms_alias_name" {
  description = "KMS alias name used by Percona backup server-side encryption settings."
  value       = module.mongodb_backups_storage.kms_alias_name
}

output "mongodb_backups_role_arn" {
  description = "IAM role ARN used by Percona MongoDB operator and database service accounts for S3 backup access."
  value       = module.mongodb_backups_storage.role_arn
}

output "jenkins_rolesanywhere_trust_anchor_arn" {
  description = "IAM Roles Anywhere trust anchor ARN for Jenkins."
  value       = module.jenkins_roles_anywhere.trust_anchor_arn
}

output "jenkins_rolesanywhere_profile_arn" {
  description = "IAM Roles Anywhere profile ARN for Jenkins."
  value       = module.jenkins_roles_anywhere.profile_arn
}

output "jenkins_rolesanywhere_role_arn" {
  description = "IAM role ARN that Jenkins assumes through IAM Roles Anywhere."
  value       = module.jenkins_roles_anywhere.role_arn
}
