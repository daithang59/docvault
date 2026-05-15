# DocVault EKS - Backup Trước Khi Terraform Destroy Và Khôi Phục Sau Khi Apply Lại

Cập nhật: 2026-05-15

Phạm vi: checklist backup trước khi chạy `terraform destroy` trong
`infra/terraform/aws-eks`, và ghi lại những gì có thể khôi phục sau khi tạo
lại EKS cluster.

---

## 1. Kết Luận Nhanh

`terraform destroy` của thư mục `infra/terraform/aws-eks` sẽ xóa EKS cluster,
managed node group, VPC/subnets/routes/security groups, EKS add-ons, IAM/OIDC,
KMS key của EKS secrets encryption và CloudWatch log group do Terraform quản lý.

Những thứ cần backup trước destroy:

| Mục | Bắt buộc? | Lý do |
|---|---:|---|
| `terraform.tfvars`, `terraform.tfstate`, `terraform.tfstate.backup` | Có | Để biết cấu hình và inventory cũ sau khi state bị destroy cập nhật |
| Kubernetes inventory YAML | Nên | Để đối chiếu namespace, service, Argo CD app, PVC/PV sau khi tạo lại |
| Kubernetes secrets | Có nếu muốn giữ đúng secret runtime | Chứa password/token/client secret; không commit |
| Postgres data | Có nếu data demo quan trọng | Nằm trên PVC/EBS hoặc dump logic |
| MongoDB data | Có nếu audit/demo data quan trọng | Nằm trên PVC/EBS hoặc dump logic |
| MinIO data | Có nếu file/object demo quan trọng | Nằm trên PVC/EBS |
| Keycloak realm runtime | Chỉ cần nếu đã sửa qua UI | Manifest hiện tại import realm từ Git và dùng `emptyDir` |
| Monitoring/Loki/Grafana runtime data | Thường không | Hiện không có PVC riêng; metrics/logs runtime sẽ mất và stack được tạo lại từ Git/Helm |
| RDS/S3/ECR ngoài Terraform này | Kiểm tra riêng | `terraform destroy` EKS không quản lý chung |

Nếu chỉ cần dựng lại demo sạch từ GitOps, không cần data cũ, thì backup
Terraform state/tfvars và inventory là đủ. Nếu cần khôi phục dữ liệu, hãy tạo
EBS snapshots cho 3 volume bên dưới trước destroy.

---

## 2. Trạng Thái Thực Tế Đã Kiểm Tra

Kiểm tra lúc lập runbook:

- AWS account: `900069968619`
- Kubernetes context: `arn:aws:eks:ap-southeast-1:900069968619:cluster/docvault-eks`
- Cluster: `docvault-eks`
- Node group: `docvault-ng-20260505092814132600000013`
- Node group scaling: `minSize=0`, `maxSize=3`, `desiredSize=0`
- Instance type: `t3.large`
- Services public: không có `LoadBalancer`, không có `Ingress`
- NodePort hiện có: `docvault-web` port `30006`, `keycloak` port `30080`
- RDS: không thấy DB instance nào trong các AWS regions đã enabled
- ECR `ap-southeast-1`: không thấy repository nào
- Argo CD apps đang có revision ứng dụng: `c37b9f4ef75ef57dd9594a336dd95955ff21aa7f`
- Monitoring namespace đang có Prometheus/Loki/Grafana pods, nhưng không thấy
  PVC riêng; data runtime của monitoring/logging có thể mất khi destroy

PVC/PV quan trọng:

| Component | PVC | PV | EBS volume | Size | AZ | Reclaim |
|---|---|---|---|---:|---|---|
| MongoDB | `mongo-data-mongo-0` | `pvc-026f5356-95ec-4149-bd27-8073c03f3b7e` | `vol-00f401e59a93b02ce` | 10Gi | `ap-southeast-1a` | Retain |
| Postgres | `postgres-data-db-0` | `pvc-27f9cad2-9110-4d94-912d-d1684211f2f9` | `vol-010ea17ee6713d9e0` | 10Gi | `ap-southeast-1a` | Retain |
| MinIO | `minio-data-minio-0` | `pvc-bc1f8e17-ece7-460b-b72f-d287cafbf3f2` | `vol-0a9cd9b1eae9daca4` | 20Gi | `ap-southeast-1a` | Retain |

3 EBS volumes trên đang `available` vì node group đã scale về 0. Chúng được
mã hóa bằng AWS-managed key `alias/aws/ebs`, không phải KMS key của module EKS,
nên việc destroy KMS key của EKS không làm mất khả năng decrypt các volume này.

---

## 3. Tạo Thư Mục Backup Local

Dùng thư mục ngoài repo để tránh commit nhầm secret, tfstate hoặc dump data.

PowerShell:

```powershell
$env:AWS_REGION="ap-southeast-1"
$env:CLUSTER_NAME="docvault-eks"
$env:DOCVAULT_NS="docvault"
$env:ARGOCD_NS="argocd"

$BackupRoot = "C:\Users\THANG\docvault-backups\eks-destroy-$(Get-Date -Format yyyyMMdd-HHmmss)"
New-Item -ItemType Directory -Path $BackupRoot -Force | Out-Null
Write-Host "BackupRoot=$BackupRoot"
```

Tất cả file trong thư mục backup này có thể chứa secret. Không commit lên Git.

---

## 4. Backup Terraform Và AWS Inventory

```powershell
cd C:\Users\THANG\docvault\infra\terraform\aws-eks

Copy-Item .\terraform.tfvars "$BackupRoot\terraform.tfvars" -ErrorAction SilentlyContinue
Copy-Item .\terraform.tfstate "$BackupRoot\terraform.tfstate.before-destroy" -ErrorAction SilentlyContinue
Copy-Item .\terraform.tfstate.backup "$BackupRoot\terraform.tfstate.backup.before-destroy" -ErrorAction SilentlyContinue

terraform output -json > "$BackupRoot\terraform-output.json"
terraform state list > "$BackupRoot\terraform-state-list.txt"

aws sts get-caller-identity > "$BackupRoot\aws-identity.json"
aws eks describe-cluster `
  --region $env:AWS_REGION `
  --name $env:CLUSTER_NAME `
  > "$BackupRoot\eks-cluster.json"

$NodeGroupName = aws eks list-nodegroups `
  --region $env:AWS_REGION `
  --cluster-name $env:CLUSTER_NAME `
  --query "nodegroups[0]" `
  --output text

aws eks describe-nodegroup `
  --region $env:AWS_REGION `
  --cluster-name $env:CLUSTER_NAME `
  --nodegroup-name $NodeGroupName `
  > "$BackupRoot\eks-nodegroup.json"
```

---

## 5. Backup Kubernetes Inventory

Lệnh này chỉ backup metadata và manifest runtime. Nó không backup dữ liệu trong
Postgres/MongoDB/MinIO.

```powershell
kubectl config current-context > "$BackupRoot\kubectl-context.txt"

kubectl get ns,pods,deploy,statefulset,svc,ingress,pvc,pv,storageclass -A -o wide `
  > "$BackupRoot\k8s-inventory-wide.txt"

kubectl get applications -n $env:ARGOCD_NS -o yaml `
  > "$BackupRoot\argocd-applications.yaml"

kubectl get all -n $env:DOCVAULT_NS -o yaml `
  > "$BackupRoot\docvault-all.yaml"

kubectl get pvc -n $env:DOCVAULT_NS -o yaml `
  > "$BackupRoot\docvault-pvc.yaml"

kubectl get pv -o yaml `
  > "$BackupRoot\cluster-pv.yaml"

kubectl get configmap -n $env:DOCVAULT_NS -o yaml `
  > "$BackupRoot\docvault-configmaps.yaml"
```

---

## 6. Backup Secrets

Cần backup nếu muốn restore đúng secret runtime hiện tại. File output rất nhạy
cảm, vì Kubernetes Secret chỉ base64 encode, không phải encryption cho file.

```powershell
kubectl get secret -n $env:DOCVAULT_NS `
  docvault-app-secrets postgres-secret mongodb-secret `
  -o yaml > "$BackupRoot\docvault-secrets.yaml"

kubectl get secret -n $env:ARGOCD_NS `
  argocd-secret argocd-redis argocd-notifications-secret `
  --ignore-not-found `
  -o yaml > "$BackupRoot\argocd-secrets.yaml"
```

Nếu sau khi tạo lại cluster chỉ muốn dùng secret demo trong Git, có thể bỏ qua
restore secrets và để Argo CD tạo lại từ manifest.

---

## 7. Backup Data Bằng EBS Snapshots

Đây là cách phù hợp với trạng thái hiện tại vì node group đã scale về 0 và các
EBS volumes đang detached/`available`. Snapshot giữ được disk state của PVC,
nhưng restore vào cluster mới cần thao tác gắn PV thủ công.

```powershell
$PostgresVolume="vol-010ea17ee6713d9e0"
$MongoVolume="vol-00f401e59a93b02ce"
$MinioVolume="vol-0a9cd9b1eae9daca4"

$PostgresSnapshot = aws ec2 create-snapshot `
  --region $env:AWS_REGION `
  --volume-id $PostgresVolume `
  --description "DocVault postgres PVC backup before EKS destroy" `
  --tag-specifications 'ResourceType=snapshot,Tags=[{Key=Project,Value=DocVault},{Key=Backup,Value=eks-destroy},{Key=Component,Value=postgres},{Key=SourceVolume,Value=vol-010ea17ee6713d9e0}]' `
  --query SnapshotId `
  --output text

$MongoSnapshot = aws ec2 create-snapshot `
  --region $env:AWS_REGION `
  --volume-id $MongoVolume `
  --description "DocVault mongodb PVC backup before EKS destroy" `
  --tag-specifications 'ResourceType=snapshot,Tags=[{Key=Project,Value=DocVault},{Key=Backup,Value=eks-destroy},{Key=Component,Value=mongodb},{Key=SourceVolume,Value=vol-00f401e59a93b02ce}]' `
  --query SnapshotId `
  --output text

$MinioSnapshot = aws ec2 create-snapshot `
  --region $env:AWS_REGION `
  --volume-id $MinioVolume `
  --description "DocVault minio PVC backup before EKS destroy" `
  --tag-specifications 'ResourceType=snapshot,Tags=[{Key=Project,Value=DocVault},{Key=Backup,Value=eks-destroy},{Key=Component,Value=minio},{Key=SourceVolume,Value=vol-0a9cd9b1eae9daca4}]' `
  --query SnapshotId `
  --output text

@"
postgres=$PostgresSnapshot
mongodb=$MongoSnapshot
minio=$MinioSnapshot
"@ > "$BackupRoot\ebs-snapshots.txt"

aws ec2 wait snapshot-completed `
  --region $env:AWS_REGION `
  --snapshot-ids $PostgresSnapshot $MongoSnapshot $MinioSnapshot

aws ec2 describe-snapshots `
  --region $env:AWS_REGION `
  --snapshot-ids $PostgresSnapshot $MongoSnapshot $MinioSnapshot `
  > "$BackupRoot\ebs-snapshots.describe.json"
```

Sau khi snapshot xong, snapshots vẫn tính phí storage snapshot cho đến khi xóa.

---

## 8. Backup Logic Nếu Muốn Chắc Hơn Về DB

EBS snapshot là đủ cho demo, nhưng backup logic dễ restore hơn và độc lập
hơn với Kubernetes PV. Hiện tại node group đang `desiredSize=0`, nên muốn chạy
`pg_dump`/`mongodump` phải mở node lại tạm thời.

Mở node lại:

```powershell
aws eks update-nodegroup-config `
  --region $env:AWS_REGION `
  --cluster-name $env:CLUSTER_NAME `
  --nodegroup-name $NodeGroupName `
  --scaling-config minSize=1,maxSize=3,desiredSize=1

kubectl wait --for=condition=Ready nodes --all --timeout=10m
kubectl wait --for=condition=Ready pod/db-0 pod/mongo-0 pod/minio-0 -n $env:DOCVAULT_NS --timeout=10m
```

Postgres:

```powershell
kubectl exec -n $env:DOCVAULT_NS db-0 -- sh -c 'PGPASSWORD="$POSTGRES_PASSWORD" pg_dump -U "$POSTGRES_USER" -d docvault_metadata -Fc -f /tmp/docvault_metadata.dump'
kubectl exec -n $env:DOCVAULT_NS db-0 -- sh -c 'PGPASSWORD="$POSTGRES_PASSWORD" pg_dump -U "$POSTGRES_USER" -d docvault_audit -Fc -f /tmp/docvault_audit.dump'

kubectl cp "$env:DOCVAULT_NS/db-0:/tmp/docvault_metadata.dump" "$BackupRoot\postgres-docvault_metadata.dump"
kubectl cp "$env:DOCVAULT_NS/db-0:/tmp/docvault_audit.dump" "$BackupRoot\postgres-docvault_audit.dump"
```

MongoDB:

```powershell
kubectl exec -n $env:DOCVAULT_NS mongo-0 -- mongodump `
  --username root `
  --password rootpw `
  --authenticationDatabase admin `
  --db docvault_audit `
  --archive=/tmp/mongo-docvault_audit.archive.gz `
  --gzip

kubectl cp "$env:DOCVAULT_NS/mongo-0:/tmp/mongo-docvault_audit.archive.gz" "$BackupRoot\mongo-docvault_audit.archive.gz"
```

Keycloak chỉ cần export nếu đã sửa user/client/realm qua UI sau khi deploy:

```powershell
$KeycloakPod = kubectl get pod -n $env:DOCVAULT_NS -l app=keycloak -o jsonpath='{.items[0].metadata.name}'
kubectl exec -n $env:DOCVAULT_NS $KeycloakPod -- /opt/keycloak/bin/kc.sh export --realm docvault --file /tmp/docvault-realm-export.json
kubectl cp "$env:DOCVAULT_NS/${KeycloakPod}:/tmp/docvault-realm-export.json" "$BackupRoot\keycloak-realm-export.json"
```

Sau khi dump xong, có thể scale node về 0 lại nếu chưa destroy ngay.

---

## 9. Kiểm Tra Tài Nguyên Ngoài Terraform EKS

Những tài nguyên ngoài Terraform EKS sẽ không bị xóa bởi `terraform destroy`,
nhưng vẫn có thể tính phí. Kiểm tra trước khi destroy:

```powershell
aws rds describe-db-instances `
  --region $env:AWS_REGION `
  --query "DBInstances[].{id:DBInstanceIdentifier,status:DBInstanceStatus,engine:Engine,class:DBInstanceClass,storage:AllocatedStorage}" `
  --output table

aws ecr describe-repositories `
  --region $env:AWS_REGION `
  --query "repositories[].repositoryName" `
  --output table

aws ec2 describe-volumes `
  --region $env:AWS_REGION `
  --filters Name=tag:Project,Values=DocVault `
  --query "Volumes[].{id:VolumeId,state:State,size:Size,az:AvailabilityZone,tags:Tags}" `
  --output json > "$BackupRoot\docvault-ebs-volumes.json"

kubectl get svc -A --field-selector spec.type=LoadBalancer -o wide
kubectl get ingress -A -o wide
```

Lúc lập runbook này, không thấy RDS DB instance đang tồn tại trong các enabled
regions, không thấy LoadBalancer/Ingress, và ECR `ap-southeast-1` đang trống.

---

## 10. Destroy Sau Khi Backup

Nếu đã tạo snapshot, đợi snapshot `completed` trước khi destroy.

```powershell
cd C:\Users\THANG\docvault\infra\terraform\aws-eks

terraform plan -destroy -out destroy.tfplan
terraform show destroy.tfplan
terraform apply destroy.tfplan
```

Sau destroy:

```powershell
aws eks describe-cluster --region $env:AWS_REGION --name $env:CLUSTER_NAME
```

Lệnh trên nên báo cluster không tồn tại.

---

## 11. Khôi Phục Sau Khi Terraform Apply Lại

Tạo lại EKS:

```powershell
cd C:\Users\THANG\docvault\infra\terraform\aws-eks
terraform init
terraform validate
terraform plan -out tfplan
terraform apply tfplan

aws eks update-kubeconfig --region ap-southeast-1 --name docvault-eks
kubectl get nodes
```

Cài lại Argo CD và apply GitOps apps theo runbook chính:

```powershell
kubectl create namespace argocd
kubectl apply -n argocd --server-side --force-conflicts `
  -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml

kubectl get pods -n argocd -w

kubectl apply -f C:\Users\THANG\docvault\infra\argocd-apps\docvault-infra.yaml
kubectl apply -f C:\Users\THANG\docvault\infra\argocd-apps\docvault-apps.yaml
kubectl apply -f C:\Users\THANG\docvault\infra\argocd-apps\monitoring.yaml
kubectl apply -f C:\Users\THANG\docvault\infra\argocd-apps\loki.yaml
```

Sau khi node có external IP mới, chạy lại script patch URL runtime:

```powershell
cd C:\Users\THANG\docvault
.\scripts\setup-eks-access.ps1
```

Nếu không cần data cũ, dừng đến đây là đủ: Argo CD sẽ tạo lại app từ Git.

---

## 12. Restore Từ EBS Snapshots

Chỉ cần làm phần này nếu muốn lấy lại data Postgres/MongoDB/MinIO cũ.

Ý tưởng:

1. Tạo EBS volumes mới từ snapshots trong AZ mà node mới có thể chạy, ưu tiên
   `ap-southeast-1a` để khớp với backup hiện tại.
2. Tạo static PV trỏ vào volume ID mới.
3. Đảm bảo tên PVC khớp với StatefulSet:
   - `postgres-data-db-0`
   - `mongo-data-mongo-0`
   - `minio-data-minio-0`
4. Chỉ sync/apply StatefulSet sau khi PV/PVC restore đã sẵn sàng, để tránh EBS
   CSI tạo volume mới.

Tạo volume mới từ snapshot:

```powershell
$PostgresSnapshot="<snap-postgres-id>"
$MongoSnapshot="<snap-mongodb-id>"
$MinioSnapshot="<snap-minio-id>"

$PostgresVolumeNew = aws ec2 create-volume `
  --region $env:AWS_REGION `
  --availability-zone ap-southeast-1a `
  --snapshot-id $PostgresSnapshot `
  --volume-type gp3 `
  --tag-specifications 'ResourceType=volume,Tags=[{Key=Project,Value=DocVault},{Key=Restore,Value=eks-reapply},{Key=Component,Value=postgres}]' `
  --query VolumeId `
  --output text

$MongoVolumeNew = aws ec2 create-volume `
  --region $env:AWS_REGION `
  --availability-zone ap-southeast-1a `
  --snapshot-id $MongoSnapshot `
  --volume-type gp3 `
  --tag-specifications 'ResourceType=volume,Tags=[{Key=Project,Value=DocVault},{Key=Restore,Value=eks-reapply},{Key=Component,Value=mongodb}]' `
  --query VolumeId `
  --output text

$MinioVolumeNew = aws ec2 create-volume `
  --region $env:AWS_REGION `
  --availability-zone ap-southeast-1a `
  --snapshot-id $MinioSnapshot `
  --volume-type gp3 `
  --tag-specifications 'ResourceType=volume,Tags=[{Key=Project,Value=DocVault},{Key=Restore,Value=eks-reapply},{Key=Component,Value=minio}]' `
  --query VolumeId `
  --output text

aws ec2 wait volume-available `
  --region $env:AWS_REGION `
  --volume-ids $PostgresVolumeNew $MongoVolumeNew $MinioVolumeNew
```

Tạo static PV manifest riêng, thay 3 `volumeHandle` bằng volume ID mới:

```yaml
apiVersion: v1
kind: PersistentVolume
metadata:
  name: restore-postgres-data-db-0
spec:
  capacity:
    storage: 10Gi
  accessModes:
    - ReadWriteOnce
  persistentVolumeReclaimPolicy: Retain
  storageClassName: docvault-gp3
  volumeMode: Filesystem
  claimRef:
    namespace: docvault
    name: postgres-data-db-0
  csi:
    driver: ebs.csi.aws.com
    volumeHandle: <new-postgres-volume-id>
    fsType: ext4
  nodeAffinity:
    required:
      nodeSelectorTerms:
        - matchExpressions:
            - key: topology.kubernetes.io/zone
              operator: In
              values:
                - ap-southeast-1a
---
apiVersion: v1
kind: PersistentVolume
metadata:
  name: restore-mongo-data-mongo-0
spec:
  capacity:
    storage: 10Gi
  accessModes:
    - ReadWriteOnce
  persistentVolumeReclaimPolicy: Retain
  storageClassName: docvault-gp3
  volumeMode: Filesystem
  claimRef:
    namespace: docvault
    name: mongo-data-mongo-0
  csi:
    driver: ebs.csi.aws.com
    volumeHandle: <new-mongo-volume-id>
    fsType: ext4
  nodeAffinity:
    required:
      nodeSelectorTerms:
        - matchExpressions:
            - key: topology.kubernetes.io/zone
              operator: In
              values:
                - ap-southeast-1a
---
apiVersion: v1
kind: PersistentVolume
metadata:
  name: restore-minio-data-minio-0
spec:
  capacity:
    storage: 20Gi
  accessModes:
    - ReadWriteOnce
  persistentVolumeReclaimPolicy: Retain
  storageClassName: docvault-gp3
  volumeMode: Filesystem
  claimRef:
    namespace: docvault
    name: minio-data-minio-0
  csi:
    driver: ebs.csi.aws.com
    volumeHandle: <new-minio-volume-id>
    fsType: ext4
  nodeAffinity:
    required:
      nodeSelectorTerms:
        - matchExpressions:
            - key: topology.kubernetes.io/zone
              operator: In
              values:
                - ap-southeast-1a
```

Thứ tự restore an toàn:

```powershell
kubectl create namespace docvault --dry-run=client -o yaml | kubectl apply -f -
kubectl apply -f C:\Users\THANG\docvault\infra\k8s\infra-deps\storageclass.yaml
kubectl apply -f C:\Users\THANG\docvault-backups\restore-static-pv.yaml
kubectl apply -f C:\Users\THANG\docvault\infra\argocd-apps\docvault-infra.yaml
```

Kiểm tra:

```powershell
kubectl get pv
kubectl get pvc -n docvault
kubectl get pods -n docvault
```

Nếu PVC đã bị tạo với volume mới trước khi restore, dừng dùng lại và xử lý thủ
công. Đừng xóa PVC/PV có data nếu chưa chắc volume nào đang chứa dữ liệu cần
giữ.

---

## 13. Restore Từ Logical Dump

Nếu đã tạo `pg_dump`/`mongodump`, restore sau khi pods mới chạy:

Postgres:

```powershell
kubectl cp "$BackupRoot\postgres-docvault_metadata.dump" "$env:DOCVAULT_NS/db-0:/tmp/docvault_metadata.dump"
kubectl exec -n $env:DOCVAULT_NS db-0 -- sh -c 'PGPASSWORD="$POSTGRES_PASSWORD" pg_restore -U "$POSTGRES_USER" -d docvault_metadata --clean --if-exists /tmp/docvault_metadata.dump'

kubectl cp "$BackupRoot\postgres-docvault_audit.dump" "$env:DOCVAULT_NS/db-0:/tmp/docvault_audit.dump"
kubectl exec -n $env:DOCVAULT_NS db-0 -- sh -c 'PGPASSWORD="$POSTGRES_PASSWORD" pg_restore -U "$POSTGRES_USER" -d docvault_audit --clean --if-exists /tmp/docvault_audit.dump'
```

MongoDB:

```powershell
kubectl cp "$BackupRoot\mongo-docvault_audit.archive.gz" "$env:DOCVAULT_NS/mongo-0:/tmp/mongo-docvault_audit.archive.gz"
kubectl exec -n $env:DOCVAULT_NS mongo-0 -- mongorestore `
  --username root `
  --password rootpw `
  --authenticationDatabase admin `
  --drop `
  --archive=/tmp/mongo-docvault_audit.archive.gz `
  --gzip
```

---

## 14. Sau Khi Restore Xong

```powershell
kubectl get applications -n argocd
kubectl get pods -n docvault
kubectl get pvc -n docvault

kubectl port-forward svc/docvault-gateway -n docvault 30000:3000
curl -I http://localhost:30000/api/health
```

Nếu dùng NodePort public, chạy lại:

```powershell
.\scripts\setup-eks-access.ps1
```

Sau khi chắc chắn data đã restore được, quyết định có giữ hay xóa snapshots.
Snapshots và retained/restored EBS volumes vẫn tính phí đến khi xóa.
