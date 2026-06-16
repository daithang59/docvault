data "aws_caller_identity" "current" {}

locals {
  documents_bucket_name              = "docvault-documents-${var.environment}-${data.aws_caller_identity.current.account_id}"
  documents_access_logs_bucket_name  = "${local.documents_bucket_name}-access-logs"
  document_service_namespace         = "docvault"
  document_service_service_account   = "docvault-document-service"
  document_service_object_key_prefix = "doc/*"
}

data "aws_iam_policy_document" "documents_kms" {
  #checkov:skip=CKV_AWS_109:KMS key policies require Resource "*" because the policy is attached to one key; principals and kms:ViaService conditions scope usage.
  #checkov:skip=CKV_AWS_111:KMS key policies require Resource "*" because the policy is attached to one key; write actions are scoped by principals and conditions.
  #checkov:skip=CKV_AWS_356:KMS key policies require Resource "*" because the policy is attached to one key.
  statement {
    sid    = "AllowAccountKeyAdministration"
    effect = "Allow"

    principals {
      type        = "AWS"
      identifiers = ["arn:aws:iam::${data.aws_caller_identity.current.account_id}:root"]
    }

    actions   = ["kms:*"]
    resources = ["*"]
  }

  statement {
    sid    = "AllowDocumentServiceUseViaS3"
    effect = "Allow"

    principals {
      type        = "AWS"
      identifiers = [aws_iam_role.document_service.arn]
    }

    actions = [
      "kms:Decrypt",
      "kms:DescribeKey",
      "kms:Encrypt",
      "kms:GenerateDataKey",
    ]

    resources = ["*"]

    condition {
      test     = "StringEquals"
      variable = "kms:ViaService"
      values   = ["s3.${var.aws_region}.amazonaws.com"]
    }

    condition {
      test     = "StringLike"
      variable = "kms:EncryptionContext:aws:s3:arn"
      values = [
        aws_s3_bucket.documents.arn,
        "${aws_s3_bucket.documents.arn}/*",
      ]
    }
  }

}

resource "aws_kms_key" "documents_s3" {
  description             = "DocVault document object encryption key"
  deletion_window_in_days = 30
  enable_key_rotation     = true
  policy                  = data.aws_iam_policy_document.documents_kms.json

  tags = merge(var.tags, {
    Name = "docvault-documents-s3-${var.environment}"
  })
}

resource "aws_kms_alias" "documents_s3" {
  name          = "alias/docvault-s3-documents-${var.environment}"
  target_key_id = aws_kms_key.documents_s3.key_id
}

resource "aws_s3_bucket" "documents" {
  #checkov:skip=CKV_AWS_144:Cross-region replication is intentionally disabled for this production-like testing environment to control AWS cost.
  bucket = local.documents_bucket_name

  tags = merge(var.tags, {
    Name = local.documents_bucket_name
  })
}

resource "aws_s3_bucket" "documents_access_logs" {
  #checkov:skip=CKV_AWS_18:Access logging buckets should not recursively log themselves.
  #checkov:skip=CKV_AWS_144:Cross-region replication is intentionally disabled for production-like testing to control AWS cost.
  #checkov:skip=CKV_AWS_145:S3 server access log delivery supports SSE-S3 destination encryption; the document bucket itself uses SSE-KMS.
  #checkov:skip=CKV2_AWS_62:Access log buckets do not process application object events.
  bucket = local.documents_access_logs_bucket_name

  tags = merge(var.tags, {
    Name = local.documents_access_logs_bucket_name
  })
}

resource "aws_s3_bucket_public_access_block" "documents" {
  bucket = aws_s3_bucket.documents.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_public_access_block" "documents_access_logs" {
  bucket = aws_s3_bucket.documents_access_logs.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_versioning" "documents" {
  bucket = aws_s3_bucket.documents.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_versioning" "documents_access_logs" {
  bucket = aws_s3_bucket.documents_access_logs.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "documents" {
  bucket = aws_s3_bucket.documents.id

  rule {
    apply_server_side_encryption_by_default {
      kms_master_key_id = aws_kms_key.documents_s3.arn
      sse_algorithm     = "aws:kms"
    }

    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "documents_access_logs" {
  bucket = aws_s3_bucket.documents_access_logs.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "documents" {
  bucket = aws_s3_bucket.documents.id

  rule {
    id     = "document-storage-hygiene"
    status = "Enabled"

    filter {
      prefix = ""
    }

    abort_incomplete_multipart_upload {
      days_after_initiation = 7
    }

    noncurrent_version_expiration {
      noncurrent_days = 365
    }
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "documents_access_logs" {
  bucket = aws_s3_bucket.documents_access_logs.id

  rule {
    id     = "access-log-retention"
    status = "Enabled"

    filter {
      prefix = ""
    }

    abort_incomplete_multipart_upload {
      days_after_initiation = 7
    }

    expiration {
      days = 365
    }

    noncurrent_version_expiration {
      noncurrent_days = 30
    }
  }
}

resource "aws_s3_bucket_logging" "documents" {
  bucket = aws_s3_bucket.documents.id

  target_bucket = aws_s3_bucket.documents_access_logs.id
  target_prefix = "s3-access-logs/${aws_s3_bucket.documents.id}/"
}

resource "aws_s3_bucket_notification" "documents" {
  bucket      = aws_s3_bucket.documents.id
  eventbridge = true
}

data "aws_iam_policy_document" "documents_bucket" {
  statement {
    sid    = "DenyInsecureTransport"
    effect = "Deny"

    principals {
      type        = "*"
      identifiers = ["*"]
    }

    actions = ["s3:*"]

    resources = [
      aws_s3_bucket.documents.arn,
      "${aws_s3_bucket.documents.arn}/*",
    ]

    condition {
      test     = "Bool"
      variable = "aws:SecureTransport"
      values   = ["false"]
    }
  }

  statement {
    sid    = "DenyUploadsWithoutSseKms"
    effect = "Deny"

    principals {
      type        = "*"
      identifiers = ["*"]
    }

    actions   = ["s3:PutObject"]
    resources = ["${aws_s3_bucket.documents.arn}/*"]

    condition {
      test     = "StringNotEquals"
      variable = "s3:x-amz-server-side-encryption"
      values   = ["aws:kms"]
    }
  }

  statement {
    sid    = "DenyUploadsWithWrongKmsKey"
    effect = "Deny"

    principals {
      type        = "*"
      identifiers = ["*"]
    }

    actions   = ["s3:PutObject"]
    resources = ["${aws_s3_bucket.documents.arn}/*"]

    condition {
      test     = "StringNotEquals"
      variable = "s3:x-amz-server-side-encryption-aws-kms-key-id"
      values   = [aws_kms_key.documents_s3.arn]
    }
  }
}

data "aws_iam_policy_document" "documents_access_logs_bucket" {
  statement {
    sid    = "DenyInsecureTransport"
    effect = "Deny"

    principals {
      type        = "*"
      identifiers = ["*"]
    }

    actions = ["s3:*"]

    resources = [
      aws_s3_bucket.documents_access_logs.arn,
      "${aws_s3_bucket.documents_access_logs.arn}/*",
    ]

    condition {
      test     = "Bool"
      variable = "aws:SecureTransport"
      values   = ["false"]
    }
  }

  statement {
    sid    = "AllowS3ServerAccessLogs"
    effect = "Allow"

    principals {
      type        = "Service"
      identifiers = ["logging.s3.amazonaws.com"]
    }

    actions = ["s3:PutObject"]

    resources = [
      "${aws_s3_bucket.documents_access_logs.arn}/s3-access-logs/${aws_s3_bucket.documents.id}/*",
    ]

    condition {
      test     = "ArnLike"
      variable = "aws:SourceArn"
      values   = [aws_s3_bucket.documents.arn]
    }

    condition {
      test     = "StringEquals"
      variable = "aws:SourceAccount"
      values   = [data.aws_caller_identity.current.account_id]
    }
  }
}

resource "aws_s3_bucket_policy" "documents" {
  bucket = aws_s3_bucket.documents.id
  policy = data.aws_iam_policy_document.documents_bucket.json
}

resource "aws_s3_bucket_policy" "documents_access_logs" {
  bucket = aws_s3_bucket.documents_access_logs.id
  policy = data.aws_iam_policy_document.documents_access_logs_bucket.json
}

data "aws_iam_policy_document" "document_service_assume_role" {
  statement {
    effect = "Allow"

    actions = [
      "sts:AssumeRoleWithWebIdentity",
    ]

    principals {
      type        = "Federated"
      identifiers = [var.oidc_provider_arn]
    }

    condition {
      test     = "StringEquals"
      variable = "${var.oidc_provider}:aud"
      values   = ["sts.amazonaws.com"]
    }

    condition {
      test     = "StringEquals"
      variable = "${var.oidc_provider}:sub"
      values = [
        "system:serviceaccount:${local.document_service_namespace}:${local.document_service_service_account}",
      ]
    }
  }
}

resource "aws_iam_role" "document_service" {
  name               = "${var.name}-document-service-s3"
  assume_role_policy = data.aws_iam_policy_document.document_service_assume_role.json
  tags               = var.tags
}

data "aws_iam_policy_document" "document_service_s3" {
  statement {
    sid    = "ListDocumentBucket"
    effect = "Allow"

    actions = [
      "s3:ListBucket",
      "s3:ListBucketMultipartUploads",
    ]

    resources = [
      aws_s3_bucket.documents.arn,
    ]

    condition {
      test     = "StringLike"
      variable = "s3:prefix"
      values   = [local.document_service_object_key_prefix]
    }
  }

  statement {
    sid    = "ReadWriteDocumentObjects"
    effect = "Allow"

    actions = [
      "s3:AbortMultipartUpload",
      "s3:DeleteObject",
      "s3:GetObject",
      "s3:ListMultipartUploadParts",
      "s3:PutObject",
    ]

    resources = [
      "${aws_s3_bucket.documents.arn}/${local.document_service_object_key_prefix}",
    ]
  }

  statement {
    sid    = "UseDocumentKmsKeyViaS3"
    effect = "Allow"

    actions = [
      "kms:Decrypt",
      "kms:DescribeKey",
      "kms:Encrypt",
      "kms:GenerateDataKey",
    ]

    resources = [
      aws_kms_key.documents_s3.arn,
    ]

    condition {
      test     = "StringEquals"
      variable = "kms:ViaService"
      values   = ["s3.${var.aws_region}.amazonaws.com"]
    }

    condition {
      test     = "StringLike"
      variable = "kms:EncryptionContext:aws:s3:arn"
      values = [
        aws_s3_bucket.documents.arn,
        "${aws_s3_bucket.documents.arn}/*",
      ]
    }
  }
}

resource "aws_iam_policy" "document_service_s3" {
  name   = "${var.name}-document-service-s3"
  policy = data.aws_iam_policy_document.document_service_s3.json
  tags   = var.tags
}

resource "aws_iam_role_policy_attachment" "document_service_s3" {
  role       = aws_iam_role.document_service.name
  policy_arn = aws_iam_policy.document_service_s3.arn
}
