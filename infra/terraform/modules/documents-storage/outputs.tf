output "bucket_name" {
  description = "S3 bucket used by document-service for document blobs."
  value       = aws_s3_bucket.documents.bucket
}

output "kms_key_arn" {
  description = "KMS key ARN used for S3 SSE-KMS document encryption."
  value       = aws_kms_key.documents_s3.arn
}

output "document_service_role_arn" {
  description = "IAM role ARN for the document-service Kubernetes service account."
  value       = aws_iam_role.document_service.arn
}
