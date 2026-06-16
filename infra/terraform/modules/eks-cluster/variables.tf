variable "name" {
  description = "EKS cluster name."
  type        = string
}

variable "cluster_version" {
  description = "Kubernetes version for EKS."
  type        = string
}

variable "cluster_endpoint_public_access_cidrs" {
  description = "CIDR blocks allowed to reach the public EKS API endpoint."
  type        = list(string)
}

variable "enable_nat_gateway" {
  description = "Whether node groups should use private subnets created with NAT Gateway."
  type        = bool
}

variable "node_instance_types" {
  description = "EC2 instance types for the EKS managed node group."
  type        = list(string)
}

variable "node_desired_size" {
  description = "Desired node count."
  type        = number
}

variable "node_min_size" {
  description = "Minimum node count."
  type        = number
}

variable "node_max_size" {
  description = "Maximum node count."
  type        = number
}

variable "node_disk_size" {
  description = "Encrypted root volume size for each node in GiB."
  type        = number
}

variable "nodeport_access_cidrs" {
  description = "CIDR blocks allowed to reach NodePort services."
  type        = list(string)
}

variable "private_subnet_ids" {
  description = "Private subnet IDs for EKS."
  type        = list(string)
}

variable "public_subnet_ids" {
  description = "Public subnet IDs for EKS."
  type        = list(string)
}

variable "tags" {
  description = "Tags applied to EKS resources."
  type        = map(string)
  default     = {}
}

variable "vpc_id" {
  description = "VPC ID for EKS."
  type        = string
}
