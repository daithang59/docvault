# DocVault DevOps EC2 - Stop, Start hoac Destroy

Updated: 2026-05-15  
Scope: Jenkins + SonarQube EC2 duoc tao boi Terraform tai `infra/terraform/aws-devops-ec2`.

---

## Quy uoc chay lenh

- Chay cac lenh trong tai lieu nay bang **pwsh/PowerShell 7** tren Windows.
- Khong dung `cmd.exe` vi cu phap bien moi truong `$env:...` va dau backtick xuong dong chi dung cho PowerShell.
- Cac lenh `ssh ... '...'` ben duoi van duoc go trong pwsh; phan trong dau nhay don se chay tren EC2 Ubuntu.

---

## 1. Ket luan nhanh

| Cach | Tiet kiem | Mat gi | Khi nao dung |
|---|---:|---|---|
| Stop EC2 instance | Giam tien EC2 compute | Public IP co the doi khi start lai; EBS van tinh phi | Tam nghi vai gio/vai ngay va se lam tiep |
| `terraform destroy` | Xoa gan nhu toan bo tai nguyen stack EC2 | Mat Jenkins jobs, credentials, SonarQube data, Docker volumes neu chua backup | Ket thuc demo hoac muon xoa sach |

Khuyen nghi: **stop EC2 instance** neu con lam tiep. Chi chay **terraform destroy** khi da demo xong han hoac chap nhan mat cau hinh Jenkins/SonarQube.

Luu y quan trong:

- Stop EC2 giu lai root EBS volume, nen Jenkins/SonarQube data trong Docker volumes van con.
- Stop EC2 khong xoa Terraform state.
- Destroy Terraform se xoa EC2 va root volume vi stack dang dung `delete_on_termination = true`.
- Neu dang mo `admin_cidr_blocks = ["0.0.0.0/0"]` de debug, nen doi lai CIDR hep truoc khi de instance chay lau.

---

## 2. Bien moi truong

pwsh:

```pwsh
$env:AWS_REGION="ap-southeast-1"
$env:DEVOPS_TF_DIR="infra/terraform/aws-devops-ec2"
```

Kiem tra dang dung dung AWS account:

```pwsh
aws sts get-caller-identity
```

Lay instance ID theo tag mac dinh cua stack:

```pwsh
$env:DEVOPS_INSTANCE_ID = aws ec2 describe-instances `
  --region $env:AWS_REGION `
  --filters `
    "Name=tag:Name,Values=docvault-devops-testing" `
    "Name=instance-state-name,Values=pending,running,stopping,stopped" `
  --query "Reservations[0].Instances[0].InstanceId" `
  --output text

Write-Host "DEVOPS_INSTANCE_ID=$env:DEVOPS_INSTANCE_ID"
```

Neu ban da doi `name_prefix` hoac `environment` trong Terraform, sua gia tri `docvault-devops-testing` cho dung tag `Name` cua EC2.

---

## 3. Stop EC2 Khi Tam Dung

Kiem tra trang thai hien tai:

```pwsh
aws ec2 describe-instances `
  --region $env:AWS_REGION `
  --instance-ids $env:DEVOPS_INSTANCE_ID `
  --query "Reservations[0].Instances[0].{InstanceId:InstanceId,State:State.Name,PublicIp:PublicIpAddress}" `
  --output table
```

Stop instance:

```pwsh
aws ec2 stop-instances `
  --region $env:AWS_REGION `
  --instance-ids $env:DEVOPS_INSTANCE_ID

aws ec2 wait instance-stopped `
  --region $env:AWS_REGION `
  --instance-ids $env:DEVOPS_INSTANCE_ID
```

Xac nhan da stop:

```pwsh
aws ec2 describe-instances `
  --region $env:AWS_REGION `
  --instance-ids $env:DEVOPS_INSTANCE_ID `
  --query "Reservations[0].Instances[0].State.Name" `
  --output text
```

Ket qua nen la:

```text
stopped
```

---

## 4. Start Lai De Lam Tiep

Start instance:

```pwsh
aws ec2 start-instances `
  --region $env:AWS_REGION `
  --instance-ids $env:DEVOPS_INSTANCE_ID

aws ec2 wait instance-running `
  --region $env:AWS_REGION `
  --instance-ids $env:DEVOPS_INSTANCE_ID
```

Lay public IP moi:

```pwsh
$env:DEVOPS_PUBLIC_IP = aws ec2 describe-instances `
  --region $env:AWS_REGION `
  --instance-ids $env:DEVOPS_INSTANCE_ID `
  --query "Reservations[0].Instances[0].PublicIpAddress" `
  --output text

Write-Host "DEVOPS_PUBLIC_IP=$env:DEVOPS_PUBLIC_IP"
```

Mo Jenkins va SonarQube:

```text
http://<DEVOPS_PUBLIC_IP>:8080
http://<DEVOPS_PUBLIC_IP>:9000
```

Kiem tra container sau khi start:

```pwsh
ssh ubuntu@$env:DEVOPS_PUBLIC_IP 'cd /opt/docvault && docker compose -f docker-compose.devops.yml ps'
```

Neu SSH can private key rieng:

```pwsh
ssh -i $HOME\.ssh\docvault_devops_ec2 ubuntu@$env:DEVOPS_PUBLIC_IP 'cd /opt/docvault && docker compose -f docker-compose.devops.yml ps'
```

Neu bi timeout sau khi start:

- Public IP cua EC2 co the da doi.
- Public IP ca nhan cua ban co the da doi.
- Cap nhat `admin_cidr_blocks` trong `infra/terraform/aws-devops-ec2/terraform.tfvars`, roi chay lai `terraform apply`.

Lay public IP ca nhan hien tai:

```pwsh
Invoke-RestMethod https://checkip.amazonaws.com
```

---

## 5. Destroy Terraform Khi Muon Xoa Sach

Chi chay buoc nay khi da chap nhan mat EC2, Docker volumes, Jenkins config, Jenkins credentials, SonarQube database va lich su build.

Chuyen vao thu muc Terraform:

```pwsh
Set-Location $env:DEVOPS_TF_DIR
```

Xem plan destroy:

```pwsh
terraform plan -destroy -out destroy.tfplan
```

Neu plan chi xoa tai nguyen cua stack `aws-devops-ec2`, apply:

```pwsh
terraform apply destroy.tfplan
```

Sau destroy, kiem tra lai:

```pwsh
aws ec2 describe-instances `
  --region $env:AWS_REGION `
  --filters "Name=tag:Name,Values=docvault-devops-testing" `
  --query "Reservations[].Instances[].{InstanceId:InstanceId,State:State.Name,PublicIp:PublicIpAddress}" `
  --output table
```

Neu khong con instance nao dang `running` hoac `stopped` voi tag nay thi EC2 DevOps server da duoc xoa.

---

## 6. Khi Nao Nen Chon Cach Nao

- Tam nghi trong ngay, ngay mai lam tiep: dung **stop EC2**.
- Can giu Jenkins credentials, job, plugin, SonarQube project: dung **stop EC2**.
- Da demo xong, muon tiet kiem chi phi toi da: dung **terraform destroy**.
- Muon tao lai moi tu dau cho sach: dung **terraform destroy**, sau do `terraform apply` lai stack.
