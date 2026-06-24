variable "aws_region" {
  description = "AWS region for IAM and KMS conditions."
  type        = string
}

variable "environment" {
  description = "Environment name used in bucket and KMS names."
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
  description = "Tags applied to MongoDB backup resources."
  type        = map(string)
  default     = {}
}
