output "cluster_name" {
  description = "EKS cluster name."
  value       = module.eks.cluster_name
}

output "cluster_endpoint" {
  description = "EKS cluster API endpoint."
  value       = module.eks.cluster_endpoint
}

output "cluster_security_group_id" {
  description = "EKS cluster security group ID."
  value       = module.eks.cluster_security_group_id
}

output "node_group_name" {
  description = "Actual EKS managed node group name. The EKS module may append a generated suffix."
  value       = split(":", module.eks.eks_managed_node_groups["docvault"].node_group_id)[1]
}

output "node_group_autoscaling_group_names" {
  description = "Underlying Auto Scaling Group names for the managed node group."
  value       = module.eks.eks_managed_node_groups["docvault"].node_group_autoscaling_group_names
}

output "oidc_provider" {
  description = "EKS OIDC provider without https:// prefix."
  value       = module.eks.oidc_provider
}

output "oidc_provider_arn" {
  description = "EKS OIDC provider ARN."
  value       = module.eks.oidc_provider_arn
}
