variable "aws_region" {
  description = "AWS region for Secrets Manager ARNs."
  type        = string
}

variable "environment" {
  description = "Environment name used in secret prefixes."
  type        = string
}

variable "name" {
  description = "Base name for IAM resources."
  type        = string
}

variable "oidc_provider" {
  description = "EKS OIDC provider without https:// prefix."
  type        = string
}

variable "oidc_provider_arn" {
  description = "EKS OIDC provider ARN."
  type        = string
}

variable "tags" {
  description = "Tags applied to IAM resources."
  type        = map(string)
  default     = {}
}
