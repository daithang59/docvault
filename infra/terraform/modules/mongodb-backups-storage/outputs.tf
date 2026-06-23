output "bucket_name" {
  description = "S3 bucket used for Percona MongoDB backups."
  value       = aws_s3_bucket.mongodb_backups.bucket
}

output "kms_key_arn" {
  description = "KMS key ARN used for MongoDB backup bucket SSE-KMS."
  value       = aws_kms_key.mongodb_backups.arn
}

output "kms_alias_name" {
  description = "KMS alias name used by Percona backup server-side encryption settings."
  value       = aws_kms_alias.mongodb_backups.name
}

output "role_arn" {
  description = "IAM role ARN for Percona MongoDB operator and database service accounts."
  value       = aws_iam_role.mongodb_backups.arn
}
