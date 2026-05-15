data "aws_availability_zones" "available" {
  state = "available"
}

locals {
  name            = "${var.name_prefix}-${var.environment}"
  ubuntu_codename = var.ubuntu_version == "22.04" ? "jammy" : "noble"
  create_key_pair = trimspace(var.ssh_public_key) != ""
  instance_key_name = local.create_key_pair ? aws_key_pair.admin[0].key_name : (
    trimspace(var.existing_key_name) != "" ? var.existing_key_name : null
  )

  tags = {
    Project     = "DocVault"
    Environment = var.environment
    ManagedBy   = "Terraform"
    Component   = "DevOpsServer"
  }

  admin_ports = {
    ssh = {
      from_port   = 22
      to_port     = 22
      description = "SSH from admin CIDRs"
    }
    jenkins = {
      from_port   = 8080
      to_port     = 8080
      description = "Jenkins from admin CIDRs"
    }
    sonarqube = {
      from_port   = 9000
      to_port     = 9000
      description = "SonarQube from admin CIDRs"
    }
  }

  docker_compose_content = templatefile("${path.module}/templates/docker-compose.devops.yml.tftpl", {
    compose_project_name = var.compose_project_name
    jenkins_java_opts    = var.jenkins_java_opts
  })
}

data "aws_ami" "ubuntu" {
  most_recent = true
  owners      = ["099720109477"]

  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd*/ubuntu-${local.ubuntu_codename}-${var.ubuntu_version}-amd64-server-*"]
  }

  filter {
    name   = "architecture"
    values = ["x86_64"]
  }

  filter {
    name   = "root-device-type"
    values = ["ebs"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

resource "aws_key_pair" "admin" {
  count = local.create_key_pair ? 1 : 0

  key_name   = local.name
  public_key = var.ssh_public_key

  tags = merge(local.tags, {
    Name = "${local.name}-key"
  })
}

resource "aws_vpc" "this" {
  cidr_block           = var.vpc_cidr
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = merge(local.tags, {
    Name = "${local.name}-vpc"
  })
}

resource "aws_internet_gateway" "this" {
  vpc_id = aws_vpc.this.id

  tags = merge(local.tags, {
    Name = "${local.name}-igw"
  })
}

resource "aws_subnet" "public" {
  vpc_id                  = aws_vpc.this.id
  cidr_block              = var.public_subnet_cidr
  availability_zone       = data.aws_availability_zones.available.names[0]
  map_public_ip_on_launch = true

  tags = merge(local.tags, {
    Name = "${local.name}-public-a"
  })
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.this.id

  tags = merge(local.tags, {
    Name = "${local.name}-public-rt"
  })
}

resource "aws_route" "public_internet" {
  route_table_id         = aws_route_table.public.id
  destination_cidr_block = "0.0.0.0/0"
  gateway_id             = aws_internet_gateway.this.id
}

resource "aws_route_table_association" "public" {
  subnet_id      = aws_subnet.public.id
  route_table_id = aws_route_table.public.id
}

resource "aws_security_group" "devops" {
  name        = "${local.name}-sg"
  description = "Access to the DocVault Jenkins and SonarQube EC2 server"
  vpc_id      = aws_vpc.this.id

  tags = merge(local.tags, {
    Name = "${local.name}-sg"
  })
}

resource "aws_security_group_rule" "admin_ingress" {
  for_each = local.admin_ports

  type              = "ingress"
  from_port         = each.value.from_port
  to_port           = each.value.to_port
  protocol          = "tcp"
  cidr_blocks       = var.admin_cidr_blocks
  description       = each.value.description
  security_group_id = aws_security_group.devops.id
}

resource "aws_security_group_rule" "egress" {
  type              = "egress"
  from_port         = 0
  to_port           = 0
  protocol          = "-1"
  cidr_blocks       = ["0.0.0.0/0"]
  description       = "Allow outbound access for package downloads, GitHub, Docker Hub, and plugin downloads"
  security_group_id = aws_security_group.devops.id
}

resource "aws_instance" "devops" {
  ami                         = data.aws_ami.ubuntu.id
  instance_type               = var.instance_type
  subnet_id                   = aws_subnet.public.id
  vpc_security_group_ids      = [aws_security_group.devops.id]
  key_name                    = local.instance_key_name
  associate_public_ip_address = true

  metadata_options {
    http_endpoint = "enabled"
    http_tokens   = "required"
  }

  root_block_device {
    volume_size           = var.root_volume_size
    volume_type           = "gp3"
    encrypted             = true
    delete_on_termination = true
  }

  user_data = templatefile("${path.module}/templates/bootstrap.sh.tftpl", {
    repo_url_json          = jsonencode(var.repo_url)
    repo_branch_json       = jsonencode(var.repo_branch)
    swap_size_gb           = var.swap_size_gb
    docker_compose_content = local.docker_compose_content
  })

  volume_tags = merge(local.tags, {
    Name = "${local.name}-root"
  })

  tags = merge(local.tags, {
    Name = local.name
  })

  lifecycle {
    precondition {
      condition     = local.instance_key_name != null
      error_message = "Set either existing_key_name or ssh_public_key so you can SSH into the DevOps EC2 server."
    }
  }
}
