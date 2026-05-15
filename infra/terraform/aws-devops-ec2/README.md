# DocVault AWS DevOps EC2 Terraform

This directory creates a standalone EC2 server for the DocVault DevSecOps demo:

- Ubuntu EC2 instance for Jenkins and SonarQube.
- Small public VPC with a single public subnet.
- Security group allowing SSH, Jenkins, and SonarQube only from `admin_cidr_blocks`.
- Docker Engine and Docker Compose installed by first-boot user data.
- Jenkins, Docker-in-Docker, SonarQube, and PostgreSQL started with Docker Compose.

The EKS cluster remains managed by `infra/terraform/aws-eks`. Keep this stack separate so you can stop, destroy, or recreate the DevOps server without touching EKS.

## Usage

```bash
cd infra/terraform/aws-devops-ec2
cp terraform.tfvars.example terraform.tfvars
```

Edit `terraform.tfvars` before applying:

- Replace `admin_cidr_blocks` with your workstation public IP CIDR.
- Set either `existing_key_name` or `ssh_public_key`.
- Keep `root_volume_size` at 80 GiB or higher for Docker cache, Jenkins, SonarQube, and scanner data.

Then run:

```bash
terraform init
terraform fmt -recursive
terraform validate
terraform plan -out tfplan
terraform apply tfplan
```

Useful outputs after apply:

```bash
terraform output jenkins_url
terraform output sonarqube_url
terraform output ssh_command
terraform output bootstrap_log_command
terraform output jenkins_initial_password_command
```

The first boot can take several minutes because the server installs Docker, clones the repo, builds the Jenkins image, and pulls SonarQube/PostgreSQL images.

## Bootstrap Verification

```bash
ssh ubuntu@<EC2_PUBLIC_IP> 'sudo tail -n 200 /var/log/docvault-devops-bootstrap.log'
ssh ubuntu@<EC2_PUBLIC_IP> 'cd /opt/docvault && docker compose -f docker-compose.devops.yml ps'
ssh ubuntu@<EC2_PUBLIC_IP> 'sudo docker exec docvault-jenkins cat /var/jenkins_home/secrets/initialAdminPassword'
```

Open:

```text
http://<EC2_PUBLIC_IP>:8080
http://<EC2_PUBLIC_IP>:9000
```

Jenkins credentials, SonarQube token, Jenkins shared library, and pipeline job are still configured manually through the UI. This avoids storing Docker Hub, GitHub, NVD, or SonarQube tokens in Terraform state.

## Notes

- Do not commit `terraform.tfvars`, local state, or plan files.
- The SonarQube PostgreSQL password is generated on the EC2 server and stored only in `/opt/docvault/.env`.
- User data runs on first boot. Changing the bootstrap template later does not reconfigure an already-running server automatically.
- To save cost after a demo, stop the EC2 instance or run `terraform destroy` from this directory after backing up any Jenkins/SonarQube data you need.
