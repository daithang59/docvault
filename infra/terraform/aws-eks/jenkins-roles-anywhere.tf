variable "enable_jenkins_roles_anywhere" {
  description = "Create IAM Roles Anywhere resources for the local Jenkins controller VM."
  type        = bool
  default     = false
}

variable "jenkins_rolesanywhere_trust_anchor_name" {
  description = "IAM Roles Anywhere trust anchor name for the Jenkins CA certificate."
  type        = string
  default     = "docvault-jenkins-local-ca"
}

variable "jenkins_rolesanywhere_profile_name" {
  description = "IAM Roles Anywhere profile name for Jenkins."
  type        = string
  default     = "docvault-jenkins-profile"
}

variable "jenkins_rolesanywhere_role_name" {
  description = "IAM role name that Jenkins assumes through IAM Roles Anywhere."
  type        = string
  default     = "docvault-jenkins-secretsmanager-read"
}

variable "jenkins_secretsmanager_policy_name" {
  description = "Inline IAM policy name for Jenkins Secrets Manager read access."
  type        = string
  default     = "docvault-jenkins-secretsmanager-read"
}

variable "jenkins_rolesanywhere_ca_certificate_path" {
  description = "Local path to the public CA certificate PEM used as the IAM Roles Anywhere trust anchor. Do not point this at a private key."
  type        = string
  default     = ""
}

variable "jenkins_rolesanywhere_certificate_common_name" {
  description = "Expected X.509 subject CN for the Jenkins controller client certificate."
  type        = string
  default     = "jenkins-controller"
}

variable "jenkins_rolesanywhere_session_duration_seconds" {
  description = "Duration, in seconds, for IAM Roles Anywhere temporary credentials issued to Jenkins."
  type        = number
  default     = 3600
}

variable "jenkins_secretsmanager_secret_names" {
  description = "Secrets Manager secret names Jenkins may read through the AWS Secrets Manager Credentials Provider plugin."
  type        = list(string)
  default = [
    "harbor-docvault-dev-robot-token",
  ]
}

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

  tags = local.tags
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
  tags                 = local.tags
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

  tags = local.tags
}

output "jenkins_rolesanywhere_trust_anchor_arn" {
  description = "IAM Roles Anywhere trust anchor ARN for Jenkins."
  value       = var.enable_jenkins_roles_anywhere ? aws_rolesanywhere_trust_anchor.jenkins[0].arn : null
}

output "jenkins_rolesanywhere_profile_arn" {
  description = "IAM Roles Anywhere profile ARN for Jenkins."
  value       = var.enable_jenkins_roles_anywhere ? aws_rolesanywhere_profile.jenkins[0].arn : null
}

output "jenkins_rolesanywhere_role_arn" {
  description = "IAM role ARN that Jenkins assumes through IAM Roles Anywhere."
  value       = var.enable_jenkins_roles_anywhere ? aws_iam_role.jenkins_rolesanywhere[0].arn : null
}
