locals {
  name = var.cluster_name

  tags = {
    Project     = "DocVault"
    Environment = var.environment
    ManagedBy   = "Terraform"
  }
}

module "network" {
  source = "../modules/network"

  name               = local.name
  enable_nat_gateway = var.enable_nat_gateway
  tags               = local.tags
}

module "eks_cluster" {
  source = "../modules/eks-cluster"

  name                                 = local.name
  cluster_version                      = var.cluster_version
  cluster_endpoint_public_access_cidrs = var.cluster_endpoint_public_access_cidrs
  enable_nat_gateway                   = var.enable_nat_gateway
  node_instance_types                  = var.node_instance_types
  node_desired_size                    = var.node_desired_size
  node_min_size                        = var.node_min_size
  node_max_size                        = var.node_max_size
  node_disk_size                       = var.node_disk_size
  nodeport_access_cidrs                = var.nodeport_access_cidrs
  private_subnet_ids                   = module.network.private_subnets
  public_subnet_ids                    = module.network.public_subnets
  tags                                 = local.tags
  vpc_id                               = module.network.vpc_id
}

module "external_secrets_irsa" {
  source = "../modules/external-secrets-irsa"

  aws_region        = var.aws_region
  environment       = var.environment
  name              = local.name
  oidc_provider     = module.eks_cluster.oidc_provider
  oidc_provider_arn = module.eks_cluster.oidc_provider_arn
  tags              = local.tags
}

module "documents_storage" {
  source = "../modules/documents-storage"

  aws_region        = var.aws_region
  environment       = var.environment
  name              = local.name
  oidc_provider     = module.eks_cluster.oidc_provider
  oidc_provider_arn = module.eks_cluster.oidc_provider_arn
  tags              = local.tags
}

module "cnpg_backups_storage" {
  source = "../modules/cnpg-backups-storage"

  aws_region        = var.aws_region
  environment       = var.environment
  name              = local.name
  oidc_provider     = module.eks_cluster.oidc_provider
  oidc_provider_arn = module.eks_cluster.oidc_provider_arn
  tags              = local.tags
}

module "jenkins_roles_anywhere" {
  source = "../modules/jenkins-roles-anywhere"

  aws_region                                     = var.aws_region
  enable_jenkins_roles_anywhere                  = var.enable_jenkins_roles_anywhere
  jenkins_rolesanywhere_ca_certificate_path      = var.jenkins_rolesanywhere_ca_certificate_path
  jenkins_rolesanywhere_certificate_common_name  = var.jenkins_rolesanywhere_certificate_common_name
  jenkins_rolesanywhere_profile_name             = var.jenkins_rolesanywhere_profile_name
  jenkins_rolesanywhere_role_name                = var.jenkins_rolesanywhere_role_name
  jenkins_rolesanywhere_session_duration_seconds = var.jenkins_rolesanywhere_session_duration_seconds
  jenkins_rolesanywhere_trust_anchor_name        = var.jenkins_rolesanywhere_trust_anchor_name
  jenkins_secretsmanager_policy_name             = var.jenkins_secretsmanager_policy_name
  jenkins_secretsmanager_secret_names            = var.jenkins_secretsmanager_secret_names
  tags                                           = local.tags
}
