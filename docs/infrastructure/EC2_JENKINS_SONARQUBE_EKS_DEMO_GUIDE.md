# Hướng Dẫn Cấu Hình Jenkins + SonarQube Trên EC2 Và Deploy DocVault Lên EKS

Tài liệu này chốt hướng triển khai phù hợp cho đồ án demo:

- Jenkins và SonarQube chạy trên 1 EC2 riêng bằng Docker Compose.
- Ứng dụng DocVault chạy trên Amazon EKS.
- Jenkins build/test/scan, push Docker image, cập nhật GitOps branch.
- Argo CD trên EKS đọc GitOps branch và sync ứng dụng.

Không đưa Jenkins và SonarQube lên EKS trong phạm vi đồ án vì sẽ tăng độ phức tạp vận hành: PVC, StorageClass, Ingress, backup, RBAC và sizing cho tool DevOps. Cách EC2 + Docker Compose vẫn thể hiện được đầy đủ CI/CD, SAST, SCA, image scan, GitOps và Kubernetes deployment.

## 1. Kiến Trúc Tổng Thể

```text
Developer laptop
  |
  | git push
  v
GitHub repository
  |
  | webhook
  v
EC2 DevOps Server
  - Jenkins
  - SonarQube
  - PostgreSQL for SonarQube
  - Docker Engine
  |
  | build image + security scan + push image
  v
Docker Hub
  |
  | Jenkins update infra/k8s/values trên gitops-testing
  v
GitOps branch
  |
  | Argo CD sync
  v
Amazon EKS
  - web
  - gateway
  - metadata-service
  - document-service
  - workflow-service
  - audit-service
  - notification-service
```

Repo hiện tại đang dùng Docker Hub qua `dockerhub-credentials` và `dockerOrg` trong `vars/docvaultConfig.groovy`. Nếu muốn dùng Amazon ECR thì cần sửa pipeline, nên với demo nên giữ Docker Hub để ít phát sinh lỗi.

## 2. Tài Nguyên Cần Chuẩn Bị

### AWS

- 1 EC2 Ubuntu 22.04 hoặc 24.04 cho Jenkins/SonarQube.
- 1 EKS cluster cho ứng dụng DocVault.
- Có thể tạo EC2 DevOps server bằng Terraform tại `infra/terraform/aws-devops-ec2`.
- Security Group cho EC2:
  - SSH `22`: chỉ mở từ IP cá nhân.
  - Jenkins `8080`: chỉ mở từ IP cá nhân hoặc IP webhook/proxy nếu cần.
  - SonarQube `9000`: chỉ mở từ IP cá nhân.
  - Không mở `0.0.0.0/0` cho `8080` và `9000` nếu không cần demo public.

### Sizing EC2 Khuyến Nghị

| Mục | Khuyến nghị |
|---|---|
| Instance | `t3.large` tối thiểu; `t3.xlarge` ổn định hơn khi build nhiều image |
| Disk | 80 GB gp3 trở lên |
| OS | Ubuntu Server 22.04/24.04 LTS |
| Swap | Nên tạo 4-8 GB swap nếu dùng `t3.large` |

Jenkins, SonarQube, Docker build cache và Trivy/Dependency-Check cache đều tốn RAM/disk. Nếu ngày demo cần ổn định, dùng `t3.xlarge`, demo xong stop EC2.

### Tài Khoản / Token

Cần có:

- GitHub PAT có quyền clone/push repo.
- Docker Hub token để push image.
- SonarQube token cho Jenkins.
- NVD API key cho OWASP Dependency-Check.
- Kubeconfig read-only cho Argo CD health check nếu muốn bật stage này.

### Dựng EC2 DevOps Server Bằng Terraform

Repo có stack Terraform riêng cho EC2 Jenkins/SonarQube tại:

```text
infra/terraform/aws-devops-ec2
```

Cách này thay thế các bước thủ công ở mục 4-6: tạo EC2, cài Docker, clone repo, tạo Docker Compose và chạy Jenkins/SonarQube. Sau khi apply xong, vẫn cấu hình Jenkins credentials, SonarQube token, Jenkins shared library và pipeline job qua UI ở các mục 7-9 để không đưa secret vào Terraform state.

Lệnh tham khảo:

```bash
cd infra/terraform/aws-devops-ec2
cp terraform.tfvars.example terraform.tfvars
```

Sửa `terraform.tfvars` trước khi apply:

```hcl
admin_cidr_blocks = ["<YOUR_PUBLIC_IP>/32"]
existing_key_name = "<YOUR_EC2_KEY_PAIR_NAME>"
# hoặc dùng ssh_public_key nếu muốn Terraform tạo key pair từ public key.
```

Apply:

```bash
terraform init
terraform fmt -recursive
terraform validate
terraform plan -out tfplan
terraform apply tfplan
```

Sau khi apply:

```bash
terraform output jenkins_url
terraform output sonarqube_url
terraform output ssh_command
terraform output bootstrap_log_command
terraform output jenkins_initial_password_command
```

Kiểm tra trạng thái bootstrap/container:

```bash
ssh ubuntu@<EC2_PUBLIC_IP> 'sudo tail -n 200 /var/log/docvault-devops-bootstrap.log'
ssh ubuntu@<EC2_PUBLIC_IP> 'cd /opt/docvault && docker compose -f docker-compose.devops.yml ps'
```

Nếu dùng Terraform EC2, sau khi Jenkins/SonarQube đã lên, chuyển thẳng tới mục 7 để cấu hình Jenkins.

## 3. Tạo Hoặc Kiểm Tra EKS

Repo đã có Terraform cho EKS tại:

```text
infra/terraform/aws-eks
```

Lệnh tham khảo:

```bash
cd infra/terraform/aws-eks
cp terraform.tfvars.example terraform.tfvars
terraform init
terraform fmt -recursive
terraform validate
terraform plan -out tfplan
terraform apply tfplan
```

Sau khi tạo cluster:

```bash
aws eks update-kubeconfig --region ap-southeast-1 --name docvault-eks
kubectl get nodes
```

Cài Argo CD và apply các Application manifests theo tài liệu hiện có:

```bash
kubectl create namespace argocd
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml
kubectl apply -f infra/argocd-apps/docvault-infra.yaml
kubectl apply -f infra/argocd-apps/docvault-apps.yaml
kubectl get applications -n argocd
```

Nếu đã có EKS/Argo CD sẵn, chỉ cần đảm bảo Argo CD đang đọc đúng repo và đúng branch GitOps, vì pipeline sẽ cập nhật image tag trong `infra/k8s/values/*.yaml`.

## 4. Cài Docker Trên EC2

Đây là cách thủ công. Nếu đã dựng EC2 bằng Terraform ở mục `Dựng EC2 DevOps Server Bằng Terraform`, bỏ qua mục 4-6 và chuyển tới mục 7.

SSH vào EC2:

```bash
ssh ubuntu@<EC2_PUBLIC_IP>
```

Cài Docker:

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg git
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker ubuntu
```

Đăng xuất SSH rồi đăng nhập lại, sau đó kiểm tra:

```bash
docker version
docker compose version
```

Cấu hình host cho SonarQube:

```bash
echo "vm.max_map_count=262144" | sudo tee /etc/sysctl.d/99-sonarqube.conf
echo "fs.file-max=131072" | sudo tee -a /etc/sysctl.d/99-sonarqube.conf
sudo sysctl --system
```

Nếu dùng instance RAM thấp, tạo swap:

```bash
sudo fallocate -l 6G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
free -h
```

## 5. Clone Repo Lên EC2

```bash
sudo mkdir -p /opt/docvault
sudo chown ubuntu:ubuntu /opt/docvault
git clone https://github.com/daithang59/docvault.git /opt/docvault
cd /opt/docvault
git checkout devsecops-pipeline
```

Nếu repo hoặc branch của bạn khác, thay URL/branch cho đúng.

Tạo file `.env` cho Docker Compose:

```bash
cat > /opt/docvault/.env <<'EOF'
SONAR_DB_PASSWORD=change-this-demo-password
EOF
```

## 6. Tạo Docker Compose Cho DevOps Server

Tạo file:

```text
/opt/docvault/docker-compose.devops.yml
```

Nội dung:

```yaml
name: docvault-devops

services:
  docker:
    image: docker:27-dind
    container_name: docvault-docker
    restart: unless-stopped
    privileged: true
    environment:
      DOCKER_TLS_CERTDIR: "/certs"
    command: ["--storage-driver=overlay2"]
    volumes:
      - jenkins_home:/var/jenkins_home
      - jenkins_docker_certs:/certs/client
      - docker_data:/var/lib/docker

  jenkins:
    build:
      context: .
      dockerfile: Dockerfile.jenkins
    image: docvault-jenkins:lts-jdk21
    container_name: docvault-jenkins
    restart: unless-stopped
    environment:
      DOCKER_HOST: "tcp://docker:2376"
      DOCKER_CERT_PATH: "/certs/client"
      DOCKER_TLS_VERIFY: "1"
      SONAR_HOST_URL: "http://sonarqube:9000"
      JAVA_OPTS: "-Xms512m -Xmx1536m"
    ports:
      - "8080:8080"
      - "50000:50000"
    volumes:
      - jenkins_home:/var/jenkins_home
      - jenkins_docker_certs:/certs/client:ro
    depends_on:
      - docker
      - sonarqube

  sonarqube:
    image: sonarqube:community
    container_name: docvault-sonarqube
    restart: unless-stopped
    depends_on:
      - sonar-postgres
    environment:
      SONAR_JDBC_URL: "jdbc:postgresql://sonar-postgres:5432/sonarqube"
      SONAR_JDBC_USERNAME: "sonar"
      SONAR_JDBC_PASSWORD: "${SONAR_DB_PASSWORD}"
    ports:
      - "9000:9000"
    volumes:
      - sonarqube_data:/opt/sonarqube/data
      - sonarqube_extensions:/opt/sonarqube/extensions
      - sonarqube_logs:/opt/sonarqube/logs
    ulimits:
      nofile:
        soft: 65536
        hard: 65536
      nproc: 4096

  sonar-postgres:
    image: postgres:16-alpine
    container_name: docvault-sonar-postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: "sonar"
      POSTGRES_PASSWORD: "${SONAR_DB_PASSWORD}"
      POSTGRES_DB: "sonarqube"
    volumes:
      - sonar_postgres_data:/var/lib/postgresql/data

volumes:
  jenkins_home:
  jenkins_docker_certs:
  docker_data:
  sonarqube_data:
  sonarqube_extensions:
  sonarqube_logs:
  sonar_postgres_data:
```

Build và chạy:

```bash
cd /opt/docvault
docker compose -f docker-compose.devops.yml build jenkins
docker compose -f docker-compose.devops.yml up -d
docker compose -f docker-compose.devops.yml ps
```

Lấy Jenkins initial password:

```bash
docker exec docvault-jenkins cat /var/jenkins_home/secrets/initialAdminPassword
```

Mở:

```text
http://<EC2_PUBLIC_IP>:8080
http://<EC2_PUBLIC_IP>:9000
```

## 7. Cấu Hình Jenkins

### 7.1 Cài Plugins

Cài các plugin tối thiểu:

- Pipeline
- Git
- GitHub Branch Source
- Credentials Binding
- Docker Pipeline
- Workspace Cleanup
- SonarQube Scanner for Jenkins
- Timestamper

Restart Jenkins sau khi cài plugin.

### 7.2 Gắn Label Cho Built-in Node

`Jenkinsfile` đang dùng:

```groovy
agent { label 'docker-agent-alpine-ubuntu-vm' }
```

Vào:

```text
Manage Jenkins -> Nodes -> Built-In Node -> Configure -> Labels
```

Thêm label:

```text
docker-agent-alpine-ubuntu-vm
```

Kiểm tra trong Jenkins job hoặc Script Console, agent phải chạy được:

```bash
docker --version
kubectl version --client=true
```

### 7.3 Tạo Jenkins Credentials

Vào:

```text
Manage Jenkins -> Credentials -> System -> Global credentials
```

Tạo các credential sau:

| ID | Kind | Ghi chú |
|---|---|---|
| `dockerhub-credentials` | Username with password | Username Docker Hub + access token |
| `github-credentials` | Username with password | GitHub username + PAT có quyền push GitOps branch |
| `sonar-token` | Secret text | Token tạo trong SonarQube |
| `nvd-api-key` | Secret text | NVD API key cho OWASP Dependency-Check |
| `jenkins-argocd-kubeconfig` | Secret file | Tùy chọn, chỉ cần nếu bật Argo CD health check |

Nếu chưa có `nvd-api-key`, stage Dependency-Check sẽ fail vì `vars/dependencyCheck.groovy` đang yêu cầu credential này.

### 7.4 Cấu Hình SonarQube Server Trong Jenkins

Vào:

```text
Manage Jenkins -> System -> SonarQube servers
```

Điền:

```text
Name: sqdocvault
Server URL: http://sonarqube:9000
Server authentication token: sonar-token
```

Tên `sqdocvault` phải đúng vì `vars/docvaultConfig.groovy` đang cấu hình:

```groovy
sonarQubeInstallation: 'sqdocvault'
```

## 8. Cấu Hình SonarQube

Mở SonarQube:

```text
http://<EC2_PUBLIC_IP>:9000
```

Đăng nhập mặc định:

```text
Username: admin
Password: admin
```

Đổi password ngay sau lần đăng nhập đầu.

Tạo token cho Jenkins:

```text
My Account -> Security -> Generate Tokens
```

Đặt tên ví dụ:

```text
jenkins-sonar-token
```

Copy token và tạo Jenkins credential `sonar-token`.

Tạo webhook để Quality Gate có thể gọi về Jenkins:

```text
Administration -> Configuration -> Webhooks -> Create
```

Điền:

```text
Name: jenkins-quality-gate
URL: http://jenkins:8080/sonarqube-webhook/
```

Webhook này dùng Docker Compose network nội bộ, không cần public Jenkins.

## 9. Cấu Hình Repo Và Pipeline

### 9.1 Kiểm Tra `vars/docvaultConfig.groovy`

File:

```text
vars/docvaultConfig.groovy
```

Cần kiểm tra các giá trị:

```groovy
dockerOrg: 'daithang59',
gitOpsRepoUrl: 'https://github.com/daithang59/docvault.git',
gitOpsBranch: 'gitops-testing',
sonarHostUrl: sonarHostUrl,
```

Nếu Docker Hub namespace hoặc GitHub repo của bạn khác, sửa:

```groovy
dockerOrg: '<dockerhub-username>',
gitOpsRepoUrl: 'https://github.com/<user-or-org>/docvault.git',
```

Đồng thời kiểm tra repository trong:

```text
infra/k8s/values/*.yaml
```

Tất cả image repository nên trùng Docker Hub namespace mà Jenkins push lên.

### 9.2 Tạo Branch GitOps

Trên máy local hoặc EC2:

```bash
git checkout devsecops-pipeline
git checkout -B gitops-testing
git push -u origin gitops-testing
git checkout devsecops-pipeline
```

Pipeline sẽ push commit `[skip ci]` vào branch `gitops-testing` sau khi build image.

### 9.3 Cấu Hình Jenkins Shared Library

`Jenkinsfile` đang có:

```groovy
@Library('docvault@devsecops-pipeline') _
```

Vào:

```text
Manage Jenkins -> System -> Global Trusted Pipeline Libraries
```

Cấu hình:

```text
Name: docvault
Default version: devsecops-pipeline
Retrieval method: Modern SCM
SCM: Git
Project Repository: https://github.com/daithang59/docvault.git
Credentials: github-credentials
```

Nếu repo của bạn khác, thay URL tương ứng.

### 9.4 Tạo Jenkins Pipeline Job

Vào:

```text
New Item -> Pipeline -> docvault-devsecops
```

Cấu hình:

```text
Definition: Pipeline script from SCM
SCM: Git
Repository URL: https://github.com/daithang59/docvault.git
Credentials: github-credentials
Branch Specifier: */devsecops-pipeline
Script Path: Jenkinsfile
```

Build trigger nếu muốn GitHub push tự động chạy:

```text
GitHub hook trigger for GITScm polling
```

Nếu Jenkins có public URL, tạo GitHub webhook:

```text
Payload URL: http://<EC2_PUBLIC_IP>:8080/github-webhook/
Content type: application/json
Event: Just the push event
```

Nếu không muốn public Jenkins, có thể demo bằng nút `Build with Parameters`.

## 10. Cấu Hình Kubeconfig Cho Argo CD Health Check

Stage `Argo CD Health Check` là tùy chọn. Nếu chưa cần, chạy pipeline với:

```text
RUN_ARGO_HEALTH_CHECK=false
```

Nếu muốn bật, repo đã có RBAC:

```text
infra/k8s/ci/jenkins-argocd-reader.yaml
scripts/create-jenkins-argocd-kubeconfig.ps1
```

Chạy script từ máy đang có quyền admin vào EKS:

```powershell
.\scripts\create-jenkins-argocd-kubeconfig.ps1
```

Script tạo file:

```text
jenkins-argocd-reader.kubeconfig
```

Upload file này vào Jenkins credential:

```text
Kind: Secret file
ID: jenkins-argocd-kubeconfig
```

Khi chạy pipeline, điền:

```text
RUN_ARGO_HEALTH_CHECK=true
KUBECONFIG_CREDENTIAL_ID=jenkins-argocd-kubeconfig
ARGOCD_NAMESPACE=argocd
```

## 11. Lần Chạy Pipeline Đầu Tiên

Chạy `Build with Parameters`:

```text
FORCE_BUILD_ALL=true
GITOPS_BRANCH=gitops-testing
DEPLOY_TARGET_URL=
RUN_ARGO_HEALTH_CHECK=false
KUBECONFIG_CREDENTIAL_ID=
RUN_ZAP=false
ZAP_TARGET=
```

Thứ tự stage kỳ vọng:

1. `Checkout & Initialize Config`
2. `Prevent Loop`
3. `System Check`
4. `Install`
5. `Pre-build Security`
6. `Build & Scan Services`
7. `Push & GitOps`

Sau khi Jenkins push GitOps branch, kiểm tra:

```bash
git fetch origin gitops-testing
git checkout gitops-testing
git log -3 --oneline
git diff HEAD~1 -- infra/k8s/values
```

Kiểm tra Argo CD và EKS:

```bash
kubectl get applications -n argocd
kubectl get pods -A
```

Sau khi có URL frontend/gateway thật, có thể chạy thêm:

```text
DEPLOY_TARGET_URL=http://<app-url>
RUN_ARGO_HEALTH_CHECK=true
KUBECONFIG_CREDENTIAL_ID=jenkins-argocd-kubeconfig
RUN_ZAP=true
ZAP_TARGET=http://<app-url>
```

## 12. Checklist Demo Với Giảng Viên

Trước buổi demo:

- [ ] EC2 đang chạy và `docker compose ps` đều healthy/up.
- [ ] Jenkins truy cập được tại `http://<EC2_PUBLIC_IP>:8080`.
- [ ] SonarQube truy cập được tại `http://<EC2_PUBLIC_IP>:9000`.
- [ ] Jenkins có credentials: `dockerhub-credentials`, `github-credentials`, `sonar-token`, `nvd-api-key`.
- [ ] Jenkins built-in node có label `docker-agent-alpine-ubuntu-vm`.
- [ ] Jenkins shared library `docvault` trỏ đúng repo/branch.
- [ ] Branch `gitops-testing` tồn tại.
- [ ] Argo CD đang sync các app DocVault.
- [ ] EKS pods của DocVault đang `Running`.

Flow demo ngắn gọn:

1. Push một commit nhỏ lên branch `devsecops-pipeline`.
2. Jenkins tự chạy pipeline hoặc bấm `Build with Parameters`.
3. Mở log các stage: install, test, Dependency-Check, Trivy, SonarQube, Checkov, build image.
4. Mở SonarQube xem project `DocVault`.
5. Mở GitHub branch `gitops-testing` xem commit update image tag.
6. Mở Argo CD xem app synced/healthy.
7. Mở URL ứng dụng DocVault trên EKS.

## 13. Troubleshooting Nhanh

### Jenkins Không Chạy Được Docker

Kiểm tra:

```bash
docker exec -it docvault-jenkins sh -lc "env | grep DOCKER && docker version"
docker logs --tail 100 docvault-docker
```

Nếu Jenkins báo không kết nối được Docker daemon, restart cặp container Jenkins/Docker:

```bash
cd /opt/docvault
docker compose -f docker-compose.devops.yml down
docker compose -f docker-compose.devops.yml up -d
```

### SonarQube Không Lên

Kiểm tra log:

```bash
docker logs --tail 200 docvault-sonarqube
```

Kiểm tra sysctl:

```bash
sysctl vm.max_map_count
```

Giá trị nên là:

```text
vm.max_map_count = 262144
```

### Jenkins Không Tìm Thấy `sqdocvault`

Kiểm tra:

```text
Manage Jenkins -> System -> SonarQube servers
```

Name phải đúng:

```text
sqdocvault
```

### Dependency-Check Fail Vì Credential

Pipeline yêu cầu Jenkins credential:

```text
nvd-api-key
```

Tạo credential dạng `Secret text`. Nếu không muốn dùng stage này cho demo, cần sửa pipeline/shared library riêng; không nên xóa credential tạm thời bằng cách hardcode token.

### Push Docker Hub Fail

Kiểm tra:

- Credential ID phải là `dockerhub-credentials`.
- Docker Hub token còn hiệu lực.
- `dockerOrg` trong `vars/docvaultConfig.groovy` phải trùng namespace Docker Hub.
- `infra/k8s/values/*.yaml` phải trỏ đúng image repository.

### GitOps Push Fail

Kiểm tra:

- Credential ID phải là `github-credentials`.
- PAT có quyền push repo.
- Branch `gitops-testing` đã tồn tại.
- `gitOpsRepoUrl` trong `vars/docvaultConfig.groovy` đúng repo của bạn.

### Argo CD Không Sync Image Mới

Kiểm tra:

```bash
kubectl get applications -n argocd
kubectl describe application <app-name> -n argocd
```

Đảm bảo Argo CD Application đang track branch `gitops-testing` và path đúng với chart/values trong repo.

## 14. Vận Hành Và Dọn Dẹp Sau Demo

Tạm dừng Jenkins/SonarQube trên EC2:

```bash
cd /opt/docvault
docker compose -f docker-compose.devops.yml stop
```

Chạy lại:

```bash
cd /opt/docvault
docker compose -f docker-compose.devops.yml start
```

Backup volume Docker nếu cần giữ cấu hình Jenkins/SonarQube:

```bash
docker volume ls | grep docvault-devops
```

Sau demo, để tiết kiệm chi phí:

- Stop EC2 nếu chưa cần dùng.
- Pause/resume hoặc destroy EKS theo các runbook hiện có:
  - `docs/infrastructure/docvault_eks_pause_resume_runbook.md`
  - `docs/infrastructure/docvault_eks_destroy_backup_restore_runbook.md`

Không xóa EBS volume/EC2 volume nếu chưa backup Jenkins home và SonarQube database.
