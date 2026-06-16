moved {
  from = module.vpc
  to   = module.network.module.vpc
}

moved {
  from = module.eks
  to   = module.eks_cluster.module.eks
}

moved {
  from = aws_security_group_rule.nodeport["web"]
  to   = module.eks_cluster.aws_security_group_rule.nodeport["web"]
}

moved {
  from = aws_security_group_rule.nodeport["keycloak"]
  to   = module.eks_cluster.aws_security_group_rule.nodeport["keycloak"]
}

moved {
  from = aws_iam_role.external_secrets
  to   = module.external_secrets_irsa.aws_iam_role.external_secrets
}

moved {
  from = aws_iam_policy.external_secrets
  to   = module.external_secrets_irsa.aws_iam_policy.external_secrets
}

moved {
  from = aws_iam_role_policy_attachment.external_secrets
  to   = module.external_secrets_irsa.aws_iam_role_policy_attachment.external_secrets
}

moved {
  from = aws_kms_key.documents_s3
  to   = module.documents_storage.aws_kms_key.documents_s3
}

moved {
  from = aws_kms_alias.documents_s3
  to   = module.documents_storage.aws_kms_alias.documents_s3
}

moved {
  from = aws_s3_bucket.documents
  to   = module.documents_storage.aws_s3_bucket.documents
}

moved {
  from = aws_s3_bucket_public_access_block.documents
  to   = module.documents_storage.aws_s3_bucket_public_access_block.documents
}

moved {
  from = aws_s3_bucket_versioning.documents
  to   = module.documents_storage.aws_s3_bucket_versioning.documents
}

moved {
  from = aws_s3_bucket_server_side_encryption_configuration.documents
  to   = module.documents_storage.aws_s3_bucket_server_side_encryption_configuration.documents
}

moved {
  from = aws_s3_bucket_policy.documents
  to   = module.documents_storage.aws_s3_bucket_policy.documents
}

moved {
  from = aws_iam_role.document_service
  to   = module.documents_storage.aws_iam_role.document_service
}

moved {
  from = aws_iam_policy.document_service_s3
  to   = module.documents_storage.aws_iam_policy.document_service_s3
}

moved {
  from = aws_iam_role_policy_attachment.document_service_s3
  to   = module.documents_storage.aws_iam_role_policy_attachment.document_service_s3
}

moved {
  from = aws_rolesanywhere_trust_anchor.jenkins[0]
  to   = module.jenkins_roles_anywhere.aws_rolesanywhere_trust_anchor.jenkins[0]
}

moved {
  from = aws_iam_role.jenkins_rolesanywhere[0]
  to   = module.jenkins_roles_anywhere.aws_iam_role.jenkins_rolesanywhere[0]
}

moved {
  from = aws_iam_role_policy.jenkins_secretsmanager_read[0]
  to   = module.jenkins_roles_anywhere.aws_iam_role_policy.jenkins_secretsmanager_read[0]
}

moved {
  from = aws_rolesanywhere_profile.jenkins[0]
  to   = module.jenkins_roles_anywhere.aws_rolesanywhere_profile.jenkins[0]
}
