module "eks" {
  source = "git::https://github.com/terraform-aws-modules/terraform-aws-eks.git?ref=608c41a295a415f9aeea5c397a9dc123cee6d4c9" # v20.32.0

  cluster_name    = var.name
  cluster_version = var.cluster_version

  cluster_endpoint_public_access       = true
  cluster_endpoint_public_access_cidrs = var.cluster_endpoint_public_access_cidrs

  enable_cluster_creator_admin_permissions = true

  cluster_enabled_log_types = [
    "api",
    "audit",
    "authenticator",
    "controllerManager",
    "scheduler",
  ]

  cluster_addons = {
    coredns = {
      most_recent = true
    }
    kube-proxy = {
      most_recent = true
    }
    vpc-cni = {
      most_recent = true
    }
    aws-ebs-csi-driver = {
      most_recent = true
    }
  }

  vpc_id     = var.vpc_id
  subnet_ids = concat(var.public_subnet_ids, var.private_subnet_ids)

  eks_managed_node_groups = {
    docvault = {
      name = "docvault-ng"

      subnet_ids     = var.enable_nat_gateway ? var.private_subnet_ids : var.public_subnet_ids
      instance_types = var.node_instance_types
      capacity_type  = "ON_DEMAND"
      ami_type       = "AL2023_x86_64_STANDARD"

      min_size     = var.node_min_size
      max_size     = var.node_max_size
      desired_size = var.node_desired_size

      use_custom_launch_template = true

      iam_role_additional_policies = {
        AmazonEBSCSIDriverPolicy = "arn:aws:iam::aws:policy/service-role/AmazonEBSCSIDriverPolicy"
      }

      metadata_options = {
        http_endpoint               = "enabled"
        http_tokens                 = "required"
        http_put_response_hop_limit = 2
      }

      block_device_mappings = {
        xvda = {
          device_name = "/dev/xvda"
          ebs = {
            volume_size           = var.node_disk_size
            volume_type           = "gp3"
            encrypted             = true
            delete_on_termination = true
          }
        }
      }

      labels = {
        workload = "docvault"
      }
    }
  }

  tags = var.tags
}

locals {
  nodeport_rules = {
    web      = { port = 30006, desc = "NodePort: docvault-web" }
    keycloak = { port = 30080, desc = "NodePort: keycloak" }
  }
}

resource "aws_security_group_rule" "nodeport" {
  for_each = local.nodeport_rules

  type              = "ingress"
  from_port         = each.value.port
  to_port           = each.value.port
  protocol          = "tcp"
  cidr_blocks       = var.nodeport_access_cidrs
  description       = each.value.desc
  security_group_id = module.eks.node_security_group_id
}
