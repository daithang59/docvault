variable "aws_region" {
  description = "AWS region for Secrets Manager ARNs."
  type        = string
}

variable "enable_jenkins_roles_anywhere" {
  description = "Create IAM Roles Anywhere resources for the local Jenkins controller VM."
  type        = bool
}

variable "jenkins_rolesanywhere_trust_anchor_name" {
  description = "IAM Roles Anywhere trust anchor name for the Jenkins CA certificate."
  type        = string
}

variable "jenkins_rolesanywhere_profile_name" {
  description = "IAM Roles Anywhere profile name for Jenkins."
  type        = string
}

variable "jenkins_rolesanywhere_role_name" {
  description = "IAM role name that Jenkins assumes through IAM Roles Anywhere."
  type        = string
}

variable "jenkins_secretsmanager_policy_name" {
  description = "Inline IAM policy name for Jenkins Secrets Manager read access."
  type        = string
}

variable "jenkins_rolesanywhere_ca_certificate_path" {
  description = "Local path to the public CA certificate PEM used as the IAM Roles Anywhere trust anchor. Do not point this at a private key."
  type        = string
}

variable "jenkins_rolesanywhere_certificate_common_name" {
  description = "Expected X.509 subject CN for the Jenkins controller client certificate."
  type        = string
}

variable "jenkins_rolesanywhere_session_duration_seconds" {
  description = "Duration, in seconds, for IAM Roles Anywhere temporary credentials issued to Jenkins."
  type        = number
}

variable "jenkins_secretsmanager_secret_names" {
  description = "Secrets Manager secret names Jenkins may read through the AWS Secrets Manager Credentials Provider plugin."
  type        = list(string)
}

variable "tags" {
  description = "Tags applied to Jenkins IAM Roles Anywhere resources."
  type        = map(string)
  default     = {}
}
