output "bucket_name" {
  description = "S3 bucket used for CloudNativePG backups."
  value       = aws_s3_bucket.cnpg_backups.bucket
}

output "kms_key_arn" {
  description = "KMS key ARN used for CloudNativePG backup bucket SSE-KMS."
  value       = aws_kms_key.cnpg_backups.arn
}

output "role_arn" {
  description = "IAM role ARN for CloudNativePG metadata PostgreSQL backup pods."
  value       = aws_iam_role.cnpg_backups.arn
}
