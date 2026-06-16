data "aws_caller_identity" "current" {}

resource "aws_rolesanywhere_trust_anchor" "jenkins" {
  count = var.enable_jenkins_roles_anywhere ? 1 : 0

  name    = var.jenkins_rolesanywhere_trust_anchor_name
  enabled = true

  source {
    source_type = "CERTIFICATE_BUNDLE"

    source_data {
      x509_certificate_data = replace(trimspace(file(var.jenkins_rolesanywhere_ca_certificate_path)), "\r\n", "\n")
    }
  }

  tags = var.tags
}

data "aws_iam_policy_document" "jenkins_rolesanywhere_assume_role" {
  count = var.enable_jenkins_roles_anywhere ? 1 : 0

  statement {
    effect = "Allow"

    actions = [
      "sts:AssumeRole",
      "sts:SetSourceIdentity",
      "sts:TagSession",
    ]

    principals {
      type        = "Service"
      identifiers = ["rolesanywhere.amazonaws.com"]
    }

    condition {
      test     = "ArnEquals"
      variable = "aws:SourceArn"
      values   = [aws_rolesanywhere_trust_anchor.jenkins[0].arn]
    }

    condition {
      test     = "StringEquals"
      variable = "aws:SourceAccount"
      values   = [data.aws_caller_identity.current.account_id]
    }

    condition {
      test     = "StringEquals"
      variable = "aws:PrincipalTag/x509Subject/CN"
      values   = [var.jenkins_rolesanywhere_certificate_common_name]
    }
  }
}

resource "aws_iam_role" "jenkins_rolesanywhere" {
  count = var.enable_jenkins_roles_anywhere ? 1 : 0

  name                 = var.jenkins_rolesanywhere_role_name
  assume_role_policy   = data.aws_iam_policy_document.jenkins_rolesanywhere_assume_role[0].json
  max_session_duration = var.jenkins_rolesanywhere_session_duration_seconds
  tags                 = var.tags
}

data "aws_iam_policy_document" "jenkins_secretsmanager_read" {
  count = var.enable_jenkins_roles_anywhere ? 1 : 0

  statement {
    sid    = "ListSecretsForJenkinsPlugin"
    effect = "Allow"

    actions = [
      "secretsmanager:ListSecrets",
    ]

    resources = ["*"]
  }

  statement {
    sid    = "ReadConfiguredJenkinsSecrets"
    effect = "Allow"

    actions = [
      "secretsmanager:DescribeSecret",
      "secretsmanager:GetSecretValue",
      "secretsmanager:ListSecretVersionIds",
    ]

    resources = [
      for secret_name in var.jenkins_secretsmanager_secret_names :
      "arn:aws:secretsmanager:${var.aws_region}:${data.aws_caller_identity.current.account_id}:secret:${secret_name}-*"
    ]
  }
}

resource "aws_iam_role_policy" "jenkins_secretsmanager_read" {
  count = var.enable_jenkins_roles_anywhere ? 1 : 0

  name   = var.jenkins_secretsmanager_policy_name
  role   = aws_iam_role.jenkins_rolesanywhere[0].id
  policy = data.aws_iam_policy_document.jenkins_secretsmanager_read[0].json
}

resource "aws_rolesanywhere_profile" "jenkins" {
  count = var.enable_jenkins_roles_anywhere ? 1 : 0

  name             = var.jenkins_rolesanywhere_profile_name
  enabled          = true
  duration_seconds = var.jenkins_rolesanywhere_session_duration_seconds
  role_arns        = [aws_iam_role.jenkins_rolesanywhere[0].arn]

  tags = var.tags
}
