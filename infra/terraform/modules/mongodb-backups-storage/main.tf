data "aws_caller_identity" "current" {}

locals {
  backup_bucket_name    = "docvault-mongodb-backups-${var.environment}-${data.aws_caller_identity.current.account_id}"
  backup_prefix         = "audit-mongodb/*"
  service_account_ns    = "docvault"
  service_account_names = ["percona-psmdb-operator", "audit-mongodb"]
  kms_alias_name        = "alias/docvault-mongodb-backups-${var.environment}"
}

data "aws_iam_policy_document" "mongodb_backup_kms" {
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
    sid    = "AllowMongoBackupsViaS3"
    effect = "Allow"

    principals {
      type        = "AWS"
      identifiers = [aws_iam_role.mongodb_backups.arn]
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
        aws_s3_bucket.mongodb_backups.arn,
        "${aws_s3_bucket.mongodb_backups.arn}/audit-mongodb/*",
      ]
    }
  }
}

resource "aws_kms_key" "mongodb_backups" {
  description             = "DocVault Percona MongoDB backup encryption key"
  deletion_window_in_days = 30
  enable_key_rotation     = true
  policy                  = data.aws_iam_policy_document.mongodb_backup_kms.json

  tags = merge(var.tags, {
    Name = "docvault-mongodb-backups-${var.environment}"
  })
}

resource "aws_kms_alias" "mongodb_backups" {
  name          = local.kms_alias_name
  target_key_id = aws_kms_key.mongodb_backups.key_id
}

resource "aws_s3_bucket" "mongodb_backups" {
  #checkov:skip=CKV_AWS_144:Cross-region replication is intentionally disabled for the testing environment to control AWS cost.
  #checkov:skip=CKV_AWS_18:S3 server access logging is not enabled yet for this low-cost testing backup bucket; CloudTrail/S3 data events can be added later.
  bucket              = local.backup_bucket_name
  object_lock_enabled = true

  tags = merge(var.tags, {
    Name = local.backup_bucket_name
  })
}

resource "aws_s3_bucket_public_access_block" "mongodb_backups" {
  bucket = aws_s3_bucket.mongodb_backups.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_versioning" "mongodb_backups" {
  bucket = aws_s3_bucket.mongodb_backups.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "mongodb_backups" {
  bucket = aws_s3_bucket.mongodb_backups.id

  rule {
    apply_server_side_encryption_by_default {
      kms_master_key_id = aws_kms_key.mongodb_backups.arn
      sse_algorithm     = "aws:kms"
    }

    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_object_lock_configuration" "mongodb_backups" {
  bucket = aws_s3_bucket.mongodb_backups.id

  rule {
    default_retention {
      mode = "GOVERNANCE"
      days = 30
    }
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "mongodb_backups" {
  bucket = aws_s3_bucket.mongodb_backups.id

  rule {
    id     = "mongodb-backup-hygiene"
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

data "aws_iam_policy_document" "mongodb_backups_bucket" {
  statement {
    sid    = "DenyInsecureTransport"
    effect = "Deny"

    principals {
      type        = "*"
      identifiers = ["*"]
    }

    actions = ["s3:*"]

    resources = [
      aws_s3_bucket.mongodb_backups.arn,
      "${aws_s3_bucket.mongodb_backups.arn}/*",
    ]

    condition {
      test     = "Bool"
      variable = "aws:SecureTransport"
      values   = ["false"]
    }
  }
}

resource "aws_s3_bucket_policy" "mongodb_backups" {
  bucket = aws_s3_bucket.mongodb_backups.id
  policy = data.aws_iam_policy_document.mongodb_backups_bucket.json
}

data "aws_iam_policy_document" "mongodb_backups_assume_role" {
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
        for service_account_name in local.service_account_names :
        "system:serviceaccount:${local.service_account_ns}:${service_account_name}"
      ]
    }
  }
}

resource "aws_iam_role" "mongodb_backups" {
  name               = "${var.name}-mongodb-backups"
  assume_role_policy = data.aws_iam_policy_document.mongodb_backups_assume_role.json
  tags               = var.tags
}

data "aws_iam_policy_document" "mongodb_backups" {
  statement {
    sid    = "InspectBackupBucket"
    effect = "Allow"

    actions = [
      "s3:GetBucketLocation",
      "s3:ListBucket",
      "s3:ListBucketMultipartUploads",
    ]

    resources = [
      aws_s3_bucket.mongodb_backups.arn,
    ]

  }

  statement {
    sid    = "ReadWriteAuditMongoBackupObjects"
    effect = "Allow"

    actions = [
      "s3:AbortMultipartUpload",
      "s3:DeleteObject",
      "s3:GetObject",
      "s3:ListMultipartUploadParts",
      "s3:PutObject",
    ]

    resources = [
      "${aws_s3_bucket.mongodb_backups.arn}/${local.backup_prefix}",
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
      aws_kms_key.mongodb_backups.arn,
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
        aws_s3_bucket.mongodb_backups.arn,
        "${aws_s3_bucket.mongodb_backups.arn}/audit-mongodb/*",
      ]
    }
  }
}

resource "aws_iam_policy" "mongodb_backups" {
  name   = "${var.name}-mongodb-backups"
  policy = data.aws_iam_policy_document.mongodb_backups.json
  tags   = var.tags
}

resource "aws_iam_role_policy_attachment" "mongodb_backups" {
  role       = aws_iam_role.mongodb_backups.name
  policy_arn = aws_iam_policy.mongodb_backups.arn
}
