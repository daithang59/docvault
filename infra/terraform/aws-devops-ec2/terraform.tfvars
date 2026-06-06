aws_region  = "ap-southeast-1"
environment = "testing"
name_prefix = "docvault-devops"

# Replace this with your workstation public IP CIDR before apply.
# Example: ["203.0.113.10/32"]
admin_cidr_blocks = ["0.0.0.0/0"]

# Set one SSH access option:
# - existing_key_name: use a key pair that already exists in this AWS region.
# - ssh_public_key: create a new EC2 key pair from public key material.
existing_key_name = ""
ssh_public_key    = "ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQDQm8VT6Wt1LZf/0oHU2IkjcqO7kvwPWTqRvr3cNNTUH1xD+xjHHHlm0yPuaKZtt7oNzK6Kl9+6b8+gqEmSLObnLHEE3IR4E6PiFklqFj47FcRs4aXvLK4J05pUJjV1Uv6uijuF5XLiLGNNablI7hZ/uohdbTFkQ4sWnWkRr7iSJX8yGlQrRCquO3vOVkQsmc8qb74EW5Hu43Plq8c1YN7eI1PGg+6uCO00NcfL/0fdZI6Z1fZRrvl8eysLQHyf5nbVh7lZbKW1/ax2TTqKYiNrpGskFYr1LzYszx8+ckJejB40BT+iiPw0EgCO4WawK/XrF/rscCajByZTf6f+jZJR thang@LAPTOP-4DGRPIBV"

instance_type    = "t3.large"
root_volume_size = 80
ubuntu_version   = "24.04"
swap_size_gb     = 6

repo_url    = "https://github.com/daithang59/docvault.git"
repo_branch = "devsecops-pipeline"
