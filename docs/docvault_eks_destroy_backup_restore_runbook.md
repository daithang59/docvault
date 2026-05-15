# DocVault EKS - Backup truoc khi terraform destroy va khoi phuc sau khi apply lai

Updated: 2026-05-15

Scope: checklist backup truoc khi chay `terraform destroy` trong
`infra/terraform/aws-eks`, va ghi lai nhung gi co the khoi phuc sau khi tao
lai EKS cluster.

---

## 1. Ket luan nhanh

`terraform destroy` cua thu muc `infra/terraform/aws-eks` se xoa EKS cluster,
managed node group, VPC/subnets/routes/security groups, EKS add-ons, IAM/OIDC,
KMS key cua EKS secrets encryption va CloudWatch log group do Terraform quan ly.

Nhung thu can backup truoc destroy:

| Muc | Bat buoc? | Ly do |
|---|---:|---|
| `terraform.tfvars`, `terraform.tfstate`, `terraform.tfstate.backup` | Co | De biet cau hinh va inventory cu sau khi state bi destroy cap nhat |
| Kubernetes inventory YAML | Nen | De doi chieu namespace, service, Argo CD app, PVC/PV sau khi tao lai |
| Kubernetes secrets | Co neu muon giu dung secret runtime | Chua password/token/client secret; khong commit |
| Postgres data | Co neu data demo quan trong | Nam tren PVC/EBS hoac dump logic |
| MongoDB data | Co neu audit/demo data quan trong | Nam tren PVC/EBS hoac dump logic |
| MinIO data | Co neu file/object demo quan trong | Nam tren PVC/EBS |
| Keycloak realm runtime | Chi can neu da sua qua UI | Manifest hien tai import realm tu Git va dung `emptyDir` |
| Monitoring/Loki/Grafana runtime data | Thuong khong | Hien khong co PVC rieng; metrics/logs runtime se mat va stack duoc tao lai tu Git/Helm |
| RDS/S3/ECR ngoai Terraform nay | Kiem tra rieng | `terraform destroy` EKS khong quan ly chung |

Neu chi can dung lai demo sach tu GitOps, khong can data cu, thi backup
Terraform state/tfvars va inventory la du. Neu can khoi phuc du lieu, hay tao
EBS snapshots cho 3 volume ben duoi truoc destroy.

---

## 2. Trang thai thuc te da kiem tra

Kiem tra luc lap runbook:

- AWS account: `900069968619`
- Kubernetes context: `arn:aws:eks:ap-southeast-1:900069968619:cluster/docvault-eks`
- Cluster: `docvault-eks`
- Node group: `docvault-ng-20260505092814132600000013`
- Node group scaling: `minSize=0`, `maxSize=3`, `desiredSize=0`
- Instance type: `t3.large`
- Services public: khong co `LoadBalancer`, khong co `Ingress`
- NodePort hien co: `docvault-web` port `30006`, `keycloak` port `30080`
- RDS: khong thay DB instance nao trong cac AWS regions da enabled
- ECR `ap-southeast-1`: khong thay repository nao
- Argo CD apps dang co revision ung dung: `c37b9f4ef75ef57dd9594a336dd95955ff21aa7f`
- Monitoring namespace dang co Prometheus/Loki/Grafana pods, nhung khong thay
  PVC rieng; data runtime cua monitoring/logging co the mat khi destroy

PVC/PV quan trong:

| Component | PVC | PV | EBS volume | Size | AZ | Reclaim |
|---|---|---|---|---:|---|---|
| MongoDB | `mongo-data-mongo-0` | `pvc-026f5356-95ec-4149-bd27-8073c03f3b7e` | `vol-00f401e59a93b02ce` | 10Gi | `ap-southeast-1a` | Retain |
| Postgres | `postgres-data-db-0` | `pvc-27f9cad2-9110-4d94-912d-d1684211f2f9` | `vol-010ea17ee6713d9e0` | 10Gi | `ap-southeast-1a` | Retain |
| MinIO | `minio-data-minio-0` | `pvc-bc1f8e17-ece7-460b-b72f-d287cafbf3f2` | `vol-0a9cd9b1eae9daca4` | 20Gi | `ap-southeast-1a` | Retain |

3 EBS volumes tren dang `available` vi node group da scale ve 0. Chung duoc
ma hoa bang AWS-managed key `alias/aws/ebs`, khong phai KMS key cua module EKS,
nen viec destroy KMS key cua EKS khong lam mat kha nang decrypt cac volume nay.

---

## 3. Tao thu muc backup local

Dung thu muc ngoai repo de tranh commit nham secret, tfstate hoac dump data.

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

Tat ca file trong thu muc backup nay co the chua secret. Khong commit len Git.

---

## 4. Backup Terraform va AWS inventory

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

## 5. Backup Kubernetes inventory

Lenh nay chi backup metadata va manifest runtime. No khong backup du lieu trong
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

## 6. Backup secrets

Can backup neu muon restore dung secret runtime hien tai. File output rat nhay
cam, vi Kubernetes Secret chi base64 encode, khong phai encryption cho file.

```powershell
kubectl get secret -n $env:DOCVAULT_NS `
  docvault-app-secrets postgres-secret mongodb-secret `
  -o yaml > "$BackupRoot\docvault-secrets.yaml"

kubectl get secret -n $env:ARGOCD_NS `
  argocd-secret argocd-redis argocd-notifications-secret `
  --ignore-not-found `
  -o yaml > "$BackupRoot\argocd-secrets.yaml"
```

Neu sau khi tao lai cluster chi muon dung secret demo trong Git, co the bo qua
restore secrets va de Argo CD tao lai tu manifest.

---

## 7. Backup data bang EBS snapshots

Day la cach phu hop voi trang thai hien tai vi node group da scale ve 0 va cac
EBS volumes dang detached/`available`. Snapshot giu duoc disk state cua PVC,
nhung restore vao cluster moi can thao tac gan PV thu cong.

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

Sau khi snapshot xong, snapshots van tinh phi storage snapshot cho den khi xoa.

---

## 8. Backup logic neu muon chac hon ve DB

EBS snapshot la du cho demo, nhung backup logic de restore de hon va doc lap
hon voi Kubernetes PV. Hien tai node group dang `desiredSize=0`, nen muon chay
`pg_dump`/`mongodump` phai mo node lai tam thoi.

Mo node lai:

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

Keycloak chi can export neu da sua user/client/realm qua UI sau khi deploy:

```powershell
$KeycloakPod = kubectl get pod -n $env:DOCVAULT_NS -l app=keycloak -o jsonpath='{.items[0].metadata.name}'
kubectl exec -n $env:DOCVAULT_NS $KeycloakPod -- /opt/keycloak/bin/kc.sh export --realm docvault --file /tmp/docvault-realm-export.json
kubectl cp "$env:DOCVAULT_NS/${KeycloakPod}:/tmp/docvault-realm-export.json" "$BackupRoot\keycloak-realm-export.json"
```

Sau khi dump xong, co the scale node ve 0 lai neu chua destroy ngay.

---

## 9. Kiem tra tai nguyen ngoai Terraform EKS

Nhung tai nguyen ngoai Terraform EKS se khong bi xoa boi `terraform destroy`,
nhung van co the tinh phi. Kiem tra truoc khi destroy:

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

Luc lap runbook nay, khong thay RDS DB instance dang ton tai trong cac enabled
regions, khong thay LoadBalancer/Ingress, va ECR `ap-southeast-1` dang trong.

---

## 10. Destroy sau khi backup

Neu da tao snapshot, doi snapshot `completed` truoc khi destroy.

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

Lenh tren nen bao cluster khong ton tai.

---

## 11. Khoi phuc sau khi terraform apply lai

Tao lai EKS:

```powershell
cd C:\Users\THANG\docvault\infra\terraform\aws-eks
terraform init
terraform validate
terraform plan -out tfplan
terraform apply tfplan

aws eks update-kubeconfig --region ap-southeast-1 --name docvault-eks
kubectl get nodes
```

Cai lai Argo CD va apply GitOps apps theo runbook chinh:

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

Sau khi node co external IP moi, chay lai script patch URL runtime:

```powershell
cd C:\Users\THANG\docvault
.\scripts\setup-eks-access.ps1
```

Neu khong can data cu, dung den day la du: Argo CD se tao lai app tu Git.

---

## 12. Restore tu EBS snapshots

Chi can lam phan nay neu muon lay lai data Postgres/MongoDB/MinIO cu.

Y tuong:

1. Tao EBS volumes moi tu snapshots trong AZ ma node moi co the chay, uu tien
   `ap-southeast-1a` de khop voi backup hien tai.
2. Tao static PV tro vao volume ID moi.
3. Dam bao ten PVC khop voi StatefulSet:
   - `postgres-data-db-0`
   - `mongo-data-mongo-0`
   - `minio-data-minio-0`
4. Chi sync/apply StatefulSet sau khi PV/PVC restore da san sang, de tranh EBS
   CSI tao volume trong moi.

Tao volume moi tu snapshot:

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

Tao static PV manifest rieng, thay 3 `volumeHandle` bang volume ID moi:

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

Thu tu restore an toan:

```powershell
kubectl create namespace docvault --dry-run=client -o yaml | kubectl apply -f -
kubectl apply -f C:\Users\THANG\docvault\infra\k8s\infra-deps\storageclass.yaml
kubectl apply -f C:\Users\THANG\docvault-backups\restore-static-pv.yaml
kubectl apply -f C:\Users\THANG\docvault\infra\argocd-apps\docvault-infra.yaml
```

Kiem tra:

```powershell
kubectl get pv
kubectl get pvc -n docvault
kubectl get pods -n docvault
```

Neu PVC da bi tao voi volume moi truoc khi restore, dung dung lai va xu ly thu
cong. Dung xoa PVC/PV co data neu chua chac volume nao dang chua du lieu can
giu.

---

## 13. Restore tu logical dump

Neu da tao `pg_dump`/`mongodump`, restore sau khi pods moi chay:

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

## 14. Sau khi restore xong

```powershell
kubectl get applications -n argocd
kubectl get pods -n docvault
kubectl get pvc -n docvault

kubectl port-forward svc/docvault-gateway -n docvault 30000:3000
curl -I http://localhost:30000/api/health
```

Neu dung NodePort public, chay lai:

```powershell
.\scripts\setup-eks-access.ps1
```

Sau khi chac chan data da restore duoc, quyet dinh co giu hay xoa snapshots.
Snapshots va retained/restored EBS volumes van tinh phi den khi xoa.
