data "aws_availability_zones" "available" {
  state = "available"
}

locals {
  az_count = max(length(var.public_subnets), length(var.private_subnets))
  azs      = slice(data.aws_availability_zones.available.names, 0, local.az_count)
}

module "vpc" {
  source = "git::https://github.com/terraform-aws-modules/terraform-aws-vpc.git?ref=7c1f791efd61f326ed6102d564d1a65d1eceedf0" # v5.21.0

  name = "${var.name}-vpc"
  cidr = var.vpc_cidr

  azs             = local.azs
  public_subnets  = var.public_subnets
  private_subnets = var.private_subnets

  enable_nat_gateway      = var.enable_nat_gateway
  single_nat_gateway      = true
  map_public_ip_on_launch = true

  enable_dns_hostnames = true
  enable_dns_support   = true

  manage_default_security_group  = true
  default_security_group_ingress = []
  default_security_group_egress  = []

  public_subnet_tags = {
    "kubernetes.io/role/elb" = 1
  }

  private_subnet_tags = {
    "kubernetes.io/role/internal-elb" = 1
  }

  tags = var.tags
}
