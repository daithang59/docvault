variable "aws_region" {
  description = "AWS region for EKS."
  type        = string
  default     = "ap-southeast-1"
}

variable "cluster_name" {
  description = "EKS cluster name."
  type        = string
  default     = "docvault-eks"
}

variable "cluster_version" {
  description = "Kubernetes version for EKS."
  type        = string
  default     = "1.35"
}

variable "environment" {
  description = "Environment name used in tags."
  type        = string
  default     = "testing"
}

variable "cluster_endpoint_public_access_cidrs" {
  description = "CIDR blocks allowed to reach the public EKS API endpoint. Replace 0.0.0.0/0 with your workstation public IP CIDR for a stricter demo."
  type        = list(string)
  default     = ["0.0.0.0/0"]
}

variable "node_instance_types" {
  description = "EC2 instance types for the EKS managed node group."
  type        = list(string)
  default     = ["t3.large"]
}

variable "node_desired_size" {
  description = "Desired node count."
  type        = number
  default     = 2
}

variable "node_min_size" {
  description = "Minimum node count."
  type        = number
  default     = 1
}

variable "node_max_size" {
  description = "Maximum node count."
  type        = number
  default     = 3
}

variable "node_disk_size" {
  description = "Encrypted root volume size for each node in GiB."
  type        = number
  default     = 30
}

variable "enable_nat_gateway" {
  description = "Enable NAT Gateway and place nodes in private subnets. False keeps nodes in public subnets for lower-cost MVP demos."
  type        = bool
  default     = false
}

variable "nodeport_access_cidrs" {
  description = "CIDR blocks allowed to reach NodePort services (web, keycloak). Use 0.0.0.0/0 for open access."
  type        = list(string)
  default     = ["0.0.0.0/0"]
}

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
