# Huong Dan Cau Hinh Jenkins + SonarQube Tren EC2 Va Deploy DocVault Len EKS

Tai lieu nay chot huong trien khai phu hop cho do an demo:

- Jenkins va SonarQube chay tren 1 EC2 rieng bang Docker Compose.
- Ung dung DocVault chay tren Amazon EKS.
- Jenkins build/test/scan, push Docker image, cap nhat GitOps branch.
- Argo CD tren EKS doc GitOps branch va sync ung dung.

Khong dua Jenkins va SonarQube len EKS trong pham vi do an vi se tang do phuc tap van hanh: PVC, StorageClass, Ingress, backup, RBAC va sizing cho tool DevOps. Cach EC2 + Docker Compose van the hien duoc day du CI/CD, SAST, SCA, image scan, GitOps va Kubernetes deployment.

## 1. Kien Truc Tong The

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
  | Jenkins update infra/k8s/values tren gitops-testing
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

Repo hien tai dang dung Docker Hub qua `dockerhub-credentials` va `dockerOrg` trong `vars/docvaultConfig.groovy`. Neu muon dung Amazon ECR thi can sua pipeline, nen voi demo nen giu Docker Hub de it phat sinh loi.

## 2. Tai Nguyen Can Chuan Bi

### AWS

- 1 EC2 Ubuntu 22.04 hoac 24.04 cho Jenkins/SonarQube.
- 1 EKS cluster cho ung dung DocVault.
- Security Group cho EC2:
  - SSH `22`: chi mo tu IP ca nhan.
  - Jenkins `8080`: chi mo tu IP ca nhan hoac IP webhook/proxy neu can.
  - SonarQube `9000`: chi mo tu IP ca nhan.
  - Khong mo `0.0.0.0/0` cho `8080` va `9000` neu khong can demo public.

### Sizing EC2 Khuyen Nghi

| Muc | Khuyen nghi |
|---|---|
| Instance | `t3.large` toi thieu; `t3.xlarge` on dinh hon khi build nhieu image |
| Disk | 80 GB gp3 tro len |
| OS | Ubuntu Server 22.04/24.04 LTS |
| Swap | Nen tao 4-8 GB swap neu dung `t3.large` |

Jenkins, SonarQube, Docker build cache va Trivy/Dependency-Check cache deu ton RAM/disk. Neu ngay demo can on dinh, dung `t3.xlarge`, demo xong stop EC2.

### Tai Khoan / Token

Can co:

- GitHub PAT co quyen clone/push repo.
- Docker Hub token de push image.
- SonarQube token cho Jenkins.
- NVD API key cho OWASP Dependency-Check.
- Kubeconfig read-only cho Argo CD health check neu muon bat stage nay.

## 3. Tao Hoac Kiem Tra EKS

Repo da co Terraform cho EKS tai:

```text
infra/terraform/aws-eks
```

Lenh tham khao:

```bash
cd infra/terraform/aws-eks
cp terraform.tfvars.example terraform.tfvars
terraform init
terraform fmt -recursive
terraform validate
terraform plan -out tfplan
terraform apply tfplan
```

Sau khi tao cluster:

```bash
aws eks update-kubeconfig --region ap-southeast-1 --name docvault-eks
kubectl get nodes
```

Cai Argo CD va apply cac Application manifests theo tai lieu hien co:

```bash
kubectl create namespace argocd
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml
kubectl apply -f infra/argocd-apps/docvault-infra.yaml
kubectl apply -f infra/argocd-apps/docvault-apps.yaml
kubectl get applications -n argocd
```

Neu da co EKS/Argo CD san, chi can dam bao Argo CD dang doc dung repo va dung branch GitOps, vi pipeline se cap nhat image tag trong `infra/k8s/values/*.yaml`.

## 4. Cai Docker Tren EC2

SSH vao EC2:

```bash
ssh ubuntu@<EC2_PUBLIC_IP>
```

Cai Docker:

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

Dang xuat SSH roi dang nhap lai, sau do kiem tra:

```bash
docker version
docker compose version
```

Cau hinh host cho SonarQube:

```bash
echo "vm.max_map_count=262144" | sudo tee /etc/sysctl.d/99-sonarqube.conf
echo "fs.file-max=131072" | sudo tee -a /etc/sysctl.d/99-sonarqube.conf
sudo sysctl --system
```

Neu dung instance RAM thap, tao swap:

```bash
sudo fallocate -l 6G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
free -h
```

## 5. Clone Repo Len EC2

```bash
sudo mkdir -p /opt/docvault
sudo chown ubuntu:ubuntu /opt/docvault
git clone https://github.com/daithang59/docvault.git /opt/docvault
cd /opt/docvault
git checkout devsecops-pipeline
```

Neu repo hoac branch cua ban khac, thay URL/branch cho dung.

Tao file `.env` cho Docker Compose:

```bash
cat > /opt/docvault/.env <<'EOF'
SONAR_DB_PASSWORD=change-this-demo-password
EOF
```

## 6. Tao Docker Compose Cho DevOps Server

Tao file:

```text
/opt/docvault/docker-compose.devops.yml
```

Noi dung:

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

Build va chay:

```bash
cd /opt/docvault
docker compose -f docker-compose.devops.yml build jenkins
docker compose -f docker-compose.devops.yml up -d
docker compose -f docker-compose.devops.yml ps
```

Lay Jenkins initial password:

```bash
docker exec docvault-jenkins cat /var/jenkins_home/secrets/initialAdminPassword
```

Mo:

```text
http://<EC2_PUBLIC_IP>:8080
http://<EC2_PUBLIC_IP>:9000
```

## 7. Cau Hinh Jenkins

### 7.1 Cai Plugins

Cai cac plugin toi thieu:

- Pipeline
- Git
- GitHub Branch Source
- Credentials Binding
- Docker Pipeline
- Workspace Cleanup
- SonarQube Scanner for Jenkins
- Timestamper

Restart Jenkins sau khi cai plugin.

### 7.2 Gan Label Cho Built-in Node

`Jenkinsfile` dang dung:

```groovy
agent { label 'docker-agent-alpine-ubuntu-vm' }
```

Vao:

```text
Manage Jenkins -> Nodes -> Built-In Node -> Configure -> Labels
```

Them label:

```text
docker-agent-alpine-ubuntu-vm
```

Kiem tra trong Jenkins job hoac Script Console, agent phai chay duoc:

```bash
docker --version
kubectl version --client=true
```

### 7.3 Tao Jenkins Credentials

Vao:

```text
Manage Jenkins -> Credentials -> System -> Global credentials
```

Tao cac credential sau:

| ID | Kind | Ghi chu |
|---|---|---|
| `dockerhub-credentials` | Username with password | Username Docker Hub + access token |
| `github-credentials` | Username with password | GitHub username + PAT co quyen push GitOps branch |
| `sonar-token` | Secret text | Token tao trong SonarQube |
| `nvd-api-key` | Secret text | NVD API key cho OWASP Dependency-Check |
| `jenkins-argocd-kubeconfig` | Secret file | Tuy chon, chi can neu bat Argo CD health check |

Neu chua co `nvd-api-key`, stage Dependency-Check se fail vi `vars/dependencyCheck.groovy` dang yeu cau credential nay.

### 7.4 Cau Hinh SonarQube Server Trong Jenkins

Vao:

```text
Manage Jenkins -> System -> SonarQube servers
```

Dien:

```text
Name: sqdocvault
Server URL: http://sonarqube:9000
Server authentication token: sonar-token
```

Ten `sqdocvault` phai dung vi `vars/docvaultConfig.groovy` dang cau hinh:

```groovy
sonarQubeInstallation: 'sqdocvault'
```

## 8. Cau Hinh SonarQube

Mo SonarQube:

```text
http://<EC2_PUBLIC_IP>:9000
```

Dang nhap mac dinh:

```text
Username: admin
Password: admin
```

Doi password ngay sau lan dang nhap dau.

Tao token cho Jenkins:

```text
My Account -> Security -> Generate Tokens
```

Dat ten vi du:

```text
jenkins-sonar-token
```

Copy token va tao Jenkins credential `sonar-token`.

Tao webhook de Quality Gate co the goi ve Jenkins:

```text
Administration -> Configuration -> Webhooks -> Create
```

Dien:

```text
Name: jenkins-quality-gate
URL: http://jenkins:8080/sonarqube-webhook/
```

Webhook nay dung Docker Compose network noi bo, khong can public Jenkins.

## 9. Cau Hinh Repo Va Pipeline

### 9.1 Kiem Tra `vars/docvaultConfig.groovy`

File:

```text
vars/docvaultConfig.groovy
```

Can kiem tra cac gia tri:

```groovy
dockerOrg: 'daithang59',
gitOpsRepoUrl: 'https://github.com/daithang59/docvault.git',
gitOpsBranch: 'gitops-testing',
sonarHostUrl: sonarHostUrl,
```

Neu Docker Hub namespace hoac GitHub repo cua ban khac, sua:

```groovy
dockerOrg: '<dockerhub-username>',
gitOpsRepoUrl: 'https://github.com/<user-or-org>/docvault.git',
```

Dong thoi kiem tra repository trong:

```text
infra/k8s/values/*.yaml
```

Tat ca image repository nen trung Docker Hub namespace ma Jenkins push len.

### 9.2 Tao Branch GitOps

Tren may local hoac EC2:

```bash
git checkout devsecops-pipeline
git checkout -B gitops-testing
git push -u origin gitops-testing
git checkout devsecops-pipeline
```

Pipeline se push commit `[skip ci]` vao branch `gitops-testing` sau khi build image.

### 9.3 Cau Hinh Jenkins Shared Library

`Jenkinsfile` dang co:

```groovy
@Library('docvault@devsecops-pipeline') _
```

Vao:

```text
Manage Jenkins -> System -> Global Trusted Pipeline Libraries
```

Cau hinh:

```text
Name: docvault
Default version: devsecops-pipeline
Retrieval method: Modern SCM
SCM: Git
Project Repository: https://github.com/daithang59/docvault.git
Credentials: github-credentials
```

Neu repo cua ban khac, thay URL tuong ung.

### 9.4 Tao Jenkins Pipeline Job

Vao:

```text
New Item -> Pipeline -> docvault-devsecops
```

Cau hinh:

```text
Definition: Pipeline script from SCM
SCM: Git
Repository URL: https://github.com/daithang59/docvault.git
Credentials: github-credentials
Branch Specifier: */devsecops-pipeline
Script Path: Jenkinsfile
```

Build trigger neu muon GitHub push tu dong chay:

```text
GitHub hook trigger for GITScm polling
```

Neu Jenkins co public URL, tao GitHub webhook:

```text
Payload URL: http://<EC2_PUBLIC_IP>:8080/github-webhook/
Content type: application/json
Event: Just the push event
```

Neu khong muon public Jenkins, co the demo bang nut `Build with Parameters`.

## 10. Cau Hinh Kubeconfig Cho Argo CD Health Check

Stage `Argo CD Health Check` la tuy chon. Neu chua can, chay pipeline voi:

```text
RUN_ARGO_HEALTH_CHECK=false
```

Neu muon bat, repo da co RBAC:

```text
infra/k8s/ci/jenkins-argocd-reader.yaml
scripts/create-jenkins-argocd-kubeconfig.ps1
```

Chay script tu may dang co quyen admin vao EKS:

```powershell
.\scripts\create-jenkins-argocd-kubeconfig.ps1
```

Script tao file:

```text
jenkins-argocd-reader.kubeconfig
```

Upload file nay vao Jenkins credential:

```text
Kind: Secret file
ID: jenkins-argocd-kubeconfig
```

Khi chay pipeline, dien:

```text
RUN_ARGO_HEALTH_CHECK=true
KUBECONFIG_CREDENTIAL_ID=jenkins-argocd-kubeconfig
ARGOCD_NAMESPACE=argocd
```

## 11. Lan Chay Pipeline Dau Tien

Chay `Build with Parameters`:

```text
FORCE_BUILD_ALL=true
GITOPS_BRANCH=gitops-testing
DEPLOY_TARGET_URL=
RUN_ARGO_HEALTH_CHECK=false
KUBECONFIG_CREDENTIAL_ID=
RUN_ZAP=false
ZAP_TARGET=
```

Thu tu stage ky vong:

1. `Checkout & Initialize Config`
2. `Prevent Loop`
3. `System Check`
4. `Install`
5. `Pre-build Security`
6. `Build & Scan Services`
7. `Push & GitOps`

Sau khi Jenkins push GitOps branch, kiem tra:

```bash
git fetch origin gitops-testing
git checkout gitops-testing
git log -3 --oneline
git diff HEAD~1 -- infra/k8s/values
```

Kiem tra Argo CD va EKS:

```bash
kubectl get applications -n argocd
kubectl get pods -A
```

Sau khi co URL frontend/gateway that, co the chay them:

```text
DEPLOY_TARGET_URL=http://<app-url>
RUN_ARGO_HEALTH_CHECK=true
KUBECONFIG_CREDENTIAL_ID=jenkins-argocd-kubeconfig
RUN_ZAP=true
ZAP_TARGET=http://<app-url>
```

## 12. Checklist Demo Voi Giang Vien

Truoc buoi demo:

- [ ] EC2 dang chay va `docker compose ps` deu healthy/up.
- [ ] Jenkins truy cap duoc tai `http://<EC2_PUBLIC_IP>:8080`.
- [ ] SonarQube truy cap duoc tai `http://<EC2_PUBLIC_IP>:9000`.
- [ ] Jenkins co credentials: `dockerhub-credentials`, `github-credentials`, `sonar-token`, `nvd-api-key`.
- [ ] Jenkins built-in node co label `docker-agent-alpine-ubuntu-vm`.
- [ ] Jenkins shared library `docvault` tro dung repo/branch.
- [ ] Branch `gitops-testing` ton tai.
- [ ] Argo CD dang sync cac app DocVault.
- [ ] EKS pods cua DocVault dang `Running`.

Flow demo ngan gon:

1. Push mot commit nho len branch `devsecops-pipeline`.
2. Jenkins tu chay pipeline hoac bam `Build with Parameters`.
3. Mo log cac stage: install, test, Dependency-Check, Trivy, SonarQube, Checkov, build image.
4. Mo SonarQube xem project `DocVault`.
5. Mo GitHub branch `gitops-testing` xem commit update image tag.
6. Mo Argo CD xem app synced/healthy.
7. Mo URL ung dung DocVault tren EKS.

## 13. Troubleshooting Nhanh

### Jenkins khong chay duoc Docker

Kiem tra:

```bash
docker exec -it docvault-jenkins sh -lc "env | grep DOCKER && docker version"
docker logs --tail 100 docvault-docker
```

Neu Jenkins bao khong ket noi duoc Docker daemon, restart cap container Jenkins/Docker:

```bash
cd /opt/docvault
docker compose -f docker-compose.devops.yml down
docker compose -f docker-compose.devops.yml up -d
```

### SonarQube khong len

Kiem tra log:

```bash
docker logs --tail 200 docvault-sonarqube
```

Kiem tra sysctl:

```bash
sysctl vm.max_map_count
```

Gia tri nen la:

```text
vm.max_map_count = 262144
```

### Jenkins khong tim thay `sqdocvault`

Kiem tra:

```text
Manage Jenkins -> System -> SonarQube servers
```

Name phai dung:

```text
sqdocvault
```

### Dependency-Check fail vi credential

Pipeline yeu cau Jenkins credential:

```text
nvd-api-key
```

Tao credential dang `Secret text`. Neu khong muon dung stage nay cho demo, can sua pipeline/shared library rieng; khong nen xoa credential tam thoi bang cach hardcode token.

### Push Docker Hub fail

Kiem tra:

- Credential ID phai la `dockerhub-credentials`.
- Docker Hub token con hieu luc.
- `dockerOrg` trong `vars/docvaultConfig.groovy` phai trung namespace Docker Hub.
- `infra/k8s/values/*.yaml` phai tro dung image repository.

### GitOps push fail

Kiem tra:

- Credential ID phai la `github-credentials`.
- PAT co quyen push repo.
- Branch `gitops-testing` da ton tai.
- `gitOpsRepoUrl` trong `vars/docvaultConfig.groovy` dung repo cua ban.

### Argo CD khong sync image moi

Kiem tra:

```bash
kubectl get applications -n argocd
kubectl describe application <app-name> -n argocd
```

Dam bao Argo CD Application dang track branch `gitops-testing` va path dung voi chart/values trong repo.

## 14. Van Hanh Va Don Dep Sau Demo

Tam dung Jenkins/SonarQube tren EC2:

```bash
cd /opt/docvault
docker compose -f docker-compose.devops.yml stop
```

Chay lai:

```bash
cd /opt/docvault
docker compose -f docker-compose.devops.yml start
```

Backup volume Docker neu can giu cau hinh Jenkins/SonarQube:

```bash
docker volume ls | grep docvault-devops
```

Sau demo, de tiet kiem chi phi:

- Stop EC2 neu chua can dung.
- Pause/resume hoac destroy EKS theo cac runbook hien co:
  - `docs/docvault_eks_pause_resume_runbook.md`
  - `docs/docvault_eks_destroy_backup_restore_runbook.md`

Khong xoa EBS volume/EC2 volume neu chua backup Jenkins home va SonarQube database.
