variable "aws_region" {
  description = "AWS region for the DevOps EC2 server."
  type        = string
  default     = "ap-southeast-1"
}

variable "name_prefix" {
  description = "Name prefix for DevOps EC2 resources."
  type        = string
  default     = "docvault-devops"
}

variable "environment" {
  description = "Environment name used in tags."
  type        = string
  default     = "testing"
}

variable "admin_cidr_blocks" {
  description = "CIDR blocks allowed to access SSH, Jenkins, and SonarQube. Use your workstation public IP CIDR, for example 203.0.113.10/32."
  type        = list(string)
  default     = ["203.0.113.10/32"]

  validation {
    condition     = length(var.admin_cidr_blocks) > 0 && alltrue([for cidr in var.admin_cidr_blocks : can(cidrhost(cidr, 0))])
    error_message = "admin_cidr_blocks must contain at least one valid CIDR block."
  }
}

variable "vpc_cidr" {
  description = "CIDR block for the DevOps VPC."
  type        = string
  default     = "10.30.0.0/16"
}

variable "public_subnet_cidr" {
  description = "CIDR block for the public subnet that hosts the DevOps EC2 server."
  type        = string
  default     = "10.30.1.0/24"
}

variable "instance_type" {
  description = "EC2 instance type for Jenkins and SonarQube."
  type        = string
  default     = "t3.large"
}

variable "root_volume_size" {
  description = "Encrypted gp3 root volume size in GiB."
  type        = number
  default     = 80

  validation {
    condition     = var.root_volume_size >= 80
    error_message = "root_volume_size must be at least 80 GiB for Jenkins, SonarQube, Docker cache, and scan cache."
  }
}

variable "ubuntu_version" {
  description = "Ubuntu LTS version for the EC2 AMI."
  type        = string
  default     = "24.04"

  validation {
    condition     = contains(["22.04", "24.04"], var.ubuntu_version)
    error_message = "ubuntu_version must be either 22.04 or 24.04."
  }
}

variable "existing_key_name" {
  description = "Existing AWS EC2 key pair name for SSH access. Leave empty when ssh_public_key is set."
  type        = string
  default     = ""
}

variable "ssh_public_key" {
  description = "Public SSH key material. When set, Terraform creates an EC2 key pair for the DevOps server."
  type        = string
  default     = ""
}

variable "repo_url" {
  description = "Git repository URL cloned onto the EC2 server."
  type        = string
  default     = "https://github.com/daithang59/docvault.git"
}

variable "repo_branch" {
  description = "Git branch checked out on the EC2 server."
  type        = string
  default     = "devsecops-pipeline"
}

variable "swap_size_gb" {
  description = "Swap file size in GiB. Set to 0 to disable swap creation."
  type        = number
  default     = 6

  validation {
    condition     = var.swap_size_gb >= 0 && var.swap_size_gb <= 16
    error_message = "swap_size_gb must be between 0 and 16."
  }
}

variable "compose_project_name" {
  description = "Docker Compose project name for Jenkins, SonarQube, and supporting containers."
  type        = string
  default     = "docvault-devops"
}

variable "jenkins_java_opts" {
  description = "JAVA_OPTS value for the Jenkins container."
  type        = string
  default     = "-Xms512m -Xmx1536m"
}
