variable "name" {
  description = "Base name used for network resources."
  type        = string
}

variable "enable_nat_gateway" {
  description = "Enable NAT Gateway and place nodes in private subnets."
  type        = bool
}

variable "tags" {
  description = "Tags applied to all network resources."
  type        = map(string)
  default     = {}
}

variable "vpc_cidr" {
  description = "CIDR block for the VPC."
  type        = string
  default     = "10.20.0.0/16"
}

variable "public_subnets" {
  description = "Public subnet CIDR blocks."
  type        = list(string)
  default     = ["10.20.1.0/24", "10.20.2.0/24"]
}

variable "private_subnets" {
  description = "Private subnet CIDR blocks."
  type        = list(string)
  default     = ["10.20.11.0/24", "10.20.12.0/24"]
}
