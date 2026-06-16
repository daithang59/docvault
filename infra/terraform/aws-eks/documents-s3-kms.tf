locals {
  documents_bucket_name              = "docvault-documents-${var.environment}-${data.aws_caller_identity.current.account_id}"
  document_service_namespace         = "docvault"
  document_service_service_account   = "docvault-document-service"
  document_service_object_key_prefix = "doc/*"
}

resource "aws_kms_key" "documents_s3" {
  description             = "DocVault document object encryption key"
  deletion_window_in_days = 30
  enable_key_rotation     = true

  tags = merge(local.tags, {
    Name = "docvault-documents-s3-${var.environment}"
  })
}

resource "aws_kms_alias" "documents_s3" {
  name          = "alias/docvault-s3-documents-${var.environment}"
  target_key_id = aws_kms_key.documents_s3.key_id
}

resource "aws_s3_bucket" "documents" {
  bucket = local.documents_bucket_name

  tags = merge(local.tags, {
    Name = local.documents_bucket_name
  })
}

resource "aws_s3_bucket_public_access_block" "documents" {
  bucket = aws_s3_bucket.documents.id

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

resource "aws_s3_bucket_policy" "documents" {
  bucket = aws_s3_bucket.documents.id
  policy = data.aws_iam_policy_document.documents_bucket.json
}

data "aws_iam_policy_document" "document_service_assume_role" {
  statement {
    effect = "Allow"

    actions = [
      "sts:AssumeRoleWithWebIdentity",
    ]

    principals {
      type        = "Federated"
      identifiers = [module.eks.oidc_provider_arn]
    }

    condition {
      test     = "StringEquals"
      variable = "${module.eks.oidc_provider}:aud"
      values   = ["sts.amazonaws.com"]
    }

    condition {
      test     = "StringEquals"
      variable = "${module.eks.oidc_provider}:sub"
      values = [
        "system:serviceaccount:${local.document_service_namespace}:${local.document_service_service_account}",
      ]
    }
  }
}

resource "aws_iam_role" "document_service" {
  name               = "${local.name}-document-service-s3"
  assume_role_policy = data.aws_iam_policy_document.document_service_assume_role.json
  tags               = local.tags
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
  name   = "${local.name}-document-service-s3"
  policy = data.aws_iam_policy_document.document_service_s3.json
  tags   = local.tags
}

resource "aws_iam_role_policy_attachment" "document_service_s3" {
  role       = aws_iam_role.document_service.name
  policy_arn = aws_iam_policy.document_service_s3.arn
}

output "documents_bucket_name" {
  description = "S3 bucket used by document-service for document blobs."
  value       = aws_s3_bucket.documents.bucket
}

output "documents_kms_key_arn" {
  description = "KMS key ARN used for S3 SSE-KMS document encryption."
  value       = aws_kms_key.documents_s3.arn
}

output "document_service_role_arn" {
  description = "IAM role ARN for the document-service Kubernetes service account."
  value       = aws_iam_role.document_service.arn
}
