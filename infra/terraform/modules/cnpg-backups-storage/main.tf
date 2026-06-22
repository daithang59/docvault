data "aws_caller_identity" "current" {}

locals {
  backup_bucket_name      = "docvault-cnpg-backups-${var.environment}-${data.aws_caller_identity.current.account_id}"
  service_account_name    = "metadata-postgres"
  service_account_ns      = "docvault"
  metadata_backup_prefix  = "metadata-postgres/*"
}

data "aws_iam_policy_document" "cnpg_backup_kms" {
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
    sid    = "AllowMetadataPostgresBackupsViaS3"
    effect = "Allow"

    principals {
      type        = "AWS"
      identifiers = [aws_iam_role.cnpg_backups.arn]
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
        aws_s3_bucket.cnpg_backups.arn,
        "${aws_s3_bucket.cnpg_backups.arn}/metadata-postgres/*",
      ]
    }
  }
}

resource "aws_kms_key" "cnpg_backups" {
  description             = "DocVault CloudNativePG backup encryption key"
  deletion_window_in_days = 30
  enable_key_rotation     = true
  policy                  = data.aws_iam_policy_document.cnpg_backup_kms.json

  tags = merge(var.tags, {
    Name = "docvault-cnpg-backups-${var.environment}"
  })
}

resource "aws_kms_alias" "cnpg_backups" {
  name          = "alias/docvault-cnpg-backups-${var.environment}"
  target_key_id = aws_kms_key.cnpg_backups.key_id
}

resource "aws_s3_bucket" "cnpg_backups" {
  #checkov:skip=CKV_AWS_144:Cross-region replication is intentionally disabled for the testing environment to control AWS cost.
  #checkov:skip=CKV_AWS_18:S3 server access logging is not enabled yet for this low-cost testing backup bucket; CloudTrail/S3 data events can be added later.
  bucket = local.backup_bucket_name

  tags = merge(var.tags, {
    Name = local.backup_bucket_name
  })
}

resource "aws_s3_bucket_public_access_block" "cnpg_backups" {
  bucket = aws_s3_bucket.cnpg_backups.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_versioning" "cnpg_backups" {
  bucket = aws_s3_bucket.cnpg_backups.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "cnpg_backups" {
  bucket = aws_s3_bucket.cnpg_backups.id

  rule {
    apply_server_side_encryption_by_default {
      kms_master_key_id = aws_kms_key.cnpg_backups.arn
      sse_algorithm     = "aws:kms"
    }

    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "cnpg_backups" {
  bucket = aws_s3_bucket.cnpg_backups.id

  rule {
    id     = "cnpg-backup-hygiene"
    status = "Enabled"

    filter {
      prefix = ""
    }

    abort_incomplete_multipart_upload {
      days_after_initiation = 7
    }

    noncurrent_version_expiration {
      noncurrent_days = 90
    }
  }
}

data "aws_iam_policy_document" "cnpg_backups_bucket" {
  statement {
    sid    = "DenyInsecureTransport"
    effect = "Deny"

    principals {
      type        = "*"
      identifiers = ["*"]
    }

    actions = ["s3:*"]

    resources = [
      aws_s3_bucket.cnpg_backups.arn,
      "${aws_s3_bucket.cnpg_backups.arn}/*",
    ]

    condition {
      test     = "Bool"
      variable = "aws:SecureTransport"
      values   = ["false"]
    }
  }
}

resource "aws_s3_bucket_policy" "cnpg_backups" {
  bucket = aws_s3_bucket.cnpg_backups.id
  policy = data.aws_iam_policy_document.cnpg_backups_bucket.json
}

data "aws_iam_policy_document" "cnpg_backups_assume_role" {
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
        "system:serviceaccount:${local.service_account_ns}:${local.service_account_name}",
      ]
    }
  }
}

resource "aws_iam_role" "cnpg_backups" {
  name               = "${var.name}-cnpg-backups"
  assume_role_policy = data.aws_iam_policy_document.cnpg_backups_assume_role.json
  tags               = var.tags
}

data "aws_iam_policy_document" "cnpg_backups" {
  statement {
    sid    = "ListMetadataPostgresBackups"
    effect = "Allow"

    actions = [
      "s3:ListBucket",
      "s3:ListBucketMultipartUploads",
    ]

    resources = [
      aws_s3_bucket.cnpg_backups.arn,
    ]

    condition {
      test     = "StringLike"
      variable = "s3:prefix"
      values = [
        "metadata-postgres",
        local.metadata_backup_prefix,
      ]
    }
  }

  statement {
    sid    = "ReadWriteMetadataPostgresBackupObjects"
    effect = "Allow"

    actions = [
      "s3:AbortMultipartUpload",
      "s3:DeleteObject",
      "s3:GetObject",
      "s3:ListMultipartUploadParts",
      "s3:PutObject",
    ]

    resources = [
      "${aws_s3_bucket.cnpg_backups.arn}/${local.metadata_backup_prefix}",
    ]
  }

  statement {
    sid    = "UseBackupKmsKeyViaS3"
    effect = "Allow"

    actions = [
      "kms:Decrypt",
      "kms:DescribeKey",
      "kms:Encrypt",
      "kms:GenerateDataKey",
    ]

    resources = [
      aws_kms_key.cnpg_backups.arn,
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
        aws_s3_bucket.cnpg_backups.arn,
        "${aws_s3_bucket.cnpg_backups.arn}/metadata-postgres/*",
      ]
    }
  }
}

resource "aws_iam_policy" "cnpg_backups" {
  name   = "${var.name}-cnpg-backups"
  policy = data.aws_iam_policy_document.cnpg_backups.json
  tags   = var.tags
}

resource "aws_iam_role_policy_attachment" "cnpg_backups" {
  role       = aws_iam_role.cnpg_backups.name
  policy_arn = aws_iam_policy.cnpg_backups.arn
}
