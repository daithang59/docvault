output "role_arn" {
  description = "IAM role ARN for the External Secrets Operator service account."
  value       = aws_iam_role.external_secrets.arn
}
