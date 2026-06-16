output "trust_anchor_arn" {
  description = "IAM Roles Anywhere trust anchor ARN for Jenkins."
  value       = var.enable_jenkins_roles_anywhere ? aws_rolesanywhere_trust_anchor.jenkins[0].arn : null
}

output "profile_arn" {
  description = "IAM Roles Anywhere profile ARN for Jenkins."
  value       = var.enable_jenkins_roles_anywhere ? aws_rolesanywhere_profile.jenkins[0].arn : null
}

output "role_arn" {
  description = "IAM role ARN that Jenkins assumes through IAM Roles Anywhere."
  value       = var.enable_jenkins_roles_anywhere ? aws_iam_role.jenkins_rolesanywhere[0].arn : null
}
