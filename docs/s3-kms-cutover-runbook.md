# DocVault S3 + KMS Cutover Runbook

Updated: 2026-06-16

Runbook nay huong dan chuyen `document-service` tu MinIO trong Kubernetes sang Amazon S3 + AWS KMS tren EKS.

Muc tieu cuoi cung:

- `document-service` ghi/doc file vao S3 bucket Terraform quan ly.
- Object moi duoc ma hoa bang SSE-KMS va KMS customer managed key co automatic rotation.
- `document-service` dung IRSA, khong dung `S3_ACCESS_KEY` / `S3_SECRET_KEY`.
- MinIO khong bi xoa ngay. MinIO duoc giu lai trong rollback window, sau do moi cleanup.

## 1. Ket Luan Ngan Gon

Jenkins storage job thuong chi can chay 1 lan cho moi environment de bootstrap S3/KMS/IAM role va cap nhat GitOps values. Job co the chay lai neu Terraform storage thay doi, cluster/environment duoc tao lai, hoac can dong bo lai values tu Terraform outputs.

Job nay khong tu dong xoa MinIO. MinIO dang chay trong namespace `docvault` se con ton tai cho den khi GitOps infra overlay va Kubernetes resource duoc cleanup rieng.

Khong can chay lai job chi de rotate KMS key. KMS automatic rotation do AWS quan ly.

## 2. Hien Trang Cluster Hien Tai

Theo output ban cung cap:

```text
namespace docvault: Active
service minio: ClusterIP, ports 9000/9001, age 15d
pod minio-0: Running
pod docvault-document-service-...: Running
```

Trong repo hien tai, `infra/k8s/values/document-service.yaml` van dang dung MinIO:

```yaml
env:
  S3_ENDPOINT: "http://minio:9000"
  S3_BUCKET: "docvault"
  S3_REGION: "us-east-1"
  S3_FORCE_PATH_STYLE: "true"

envValueFrom:
  - name: S3_ACCESS_KEY
    valueFrom:
      secretKeyRef:
        name: minio-secret
        key: MINIO_ROOT_USER
  - name: S3_SECRET_KEY
    valueFrom:
      secretKeyRef:
        name: minio-secret
        key: MINIO_ROOT_PASSWORD
```

`infra/k8s/infra-deps/overlays/testing/kustomization.yaml` include `../../base`, va base dang include:

```text
minio.yaml
minio-init-job.yaml
```

Vi vay sau khi switch app sang S3, MinIO van tiep tuc chay neu GitOps infra overlay chua duoc doi.

## 3. Dieu Kien Truoc Khi Cutover

Kiem tra cac dieu kien nay truoc khi chay apply:

- Branch ma Jenkins doc da co `Jenkinsfile.storage`.
- Jenkins shared library da co `vars/documentStorageGitOps.groovy`.
- Terraform `infra/terraform/aws-eks` da expose outputs:
  - `documents_bucket_name`
  - `documents_kms_key_arn`
  - `document_service_role_arn`
- `document-service` code da support:
  - unset `S3_ENDPOINT` cho native AWS S3
  - `S3_USE_STATIC_CREDENTIALS=false`
  - `S3_SERVER_SIDE_ENCRYPTION=aws:kms`
  - `S3_KMS_KEY_ID`
  - `S3_BUCKET_KEY_ENABLED=true`
- Helm chart da support `serviceAccount` va `automountServiceAccountToken`.
- Jenkins agent co cac lenh:
  - `terraform`
  - `yq`
  - `helm`
  - `git`
- Jenkins co AWS credentials tam thoi de chay Terraform. Voi setup hien tai, uu tien IAM Roles Anywhere theo `docs/jenkins_iam_roles_anywhere.md`.
- Jenkins credential `github-credentials` co quyen push branch GitOps, vi job se commit values len `gitops-testing`.
- Terraform remote backend da san sang neu day la environment dung chung. Khong nen de Jenkins apply tren local state.

## 4. Tao Jenkins Storage Job

Tao mot Jenkins Pipeline job rieng, khong dung job CD app chinh.

1. Vao Jenkins -> New Item.
2. Dat ten, vi du:

```text
docvault-document-storage-gitops
```

3. Chon `Pipeline`.
4. Cau hinh Pipeline:

```text
Definition: Pipeline script from SCM
SCM: Git
Repository URL: https://github.com/daithang59/docvault.git
Credentials: credential Git cua repo
Branch Specifier: */main
Script Path: Jenkinsfile.storage
```

Neu `Jenkinsfile.storage` chua merge vao `main`, tro `Branch Specifier` den branch dang chua file nay.

Lan dau bam `Build Now` de Jenkins load parameters. Tu lan sau dung `Build with Parameters`.

## 5. Chay Plan Truoc

Chay job voi:

```text
GITOPS_BRANCH=gitops-testing
AWS_REGION=ap-southeast-1
APPLY_DOCUMENT_STORAGE_TERRAFORM=false
DOCUMENT_STORAGE_REQUIRE_APPROVAL=true
DOCUMENT_STORAGE_VALUES_FILE=infra/k8s/values/document-service.yaml
```

Ket qua mong doi:

- Jenkins chay `terraform init`.
- Jenkins chay `terraform fmt -check -recursive`.
- Jenkins chay `terraform validate`.
- Jenkins chay `terraform plan -out=tfplan`.
- Job dung lai sau plan va khong sua GitOps values.

Neu plan co thay doi ngoai S3/KMS/IAM role document-service, dung lai va review truoc khi apply.

## 6. Neu Khong Can Giu File Cu Trong MinIO

Day la luong nhanh cho lab/demo neu file cu trong MinIO khong quan trong.

1. Chay Jenkins storage job voi:

```text
APPLY_DOCUMENT_STORAGE_TERRAFORM=true
DOCUMENT_STORAGE_REQUIRE_APPROVAL=true
```

2. Approve Jenkins input.
3. Job se:

```text
terraform apply tfplan
terraform output -raw documents_bucket_name
terraform output -raw documents_kms_key_arn
terraform output -raw document_service_role_arn
clone branch gitops-testing
cap nhat infra/k8s/values/document-service.yaml
helm lint
helm template
commit va push [skip ci]
```

4. Doi Argo CD sync `docvault-document-service`.
5. Kiem tra upload/download file moi tren app.
6. Giu MinIO trong rollback window. Khong xoa MinIO ngay.

## 7. Neu Can Giu File Cu Trong MinIO

Neu MinIO dang co file can giu, can migrate object sang S3 truoc khi mo lai traffic binh thuong.

### 7.1 Chon thoi diem maintenance

Trong maintenance window:

- Tam dung upload moi.
- Thong bao team khong tao document moi trong luc migrate.
- Neu can chat che hon, tam thoi scale `document-service` hoac gateway ve 0, hoac chan route upload o ingress/gateway.

Vi Argo CD app `docvault-document-service` hien co automated sync, nen de kiem soat cutover co the tam thoi tat automated sync truoc khi Jenkins job push values.

PowerShell:

```powershell
kubectl -n argocd patch application docvault-document-service --type merge -p '{"spec":{"syncPolicy":{"syncOptions":["CreateNamespace=true","RespectIgnoreDifferences=true"]}}}'
```

Kiem tra:

```powershell
kubectl -n argocd get application docvault-document-service -o yaml | Select-String -Pattern "automated|syncOptions" -Context 1,3
```

### 7.2 Tao S3/KMS va push values bang Jenkins

Chay Jenkins storage job:

```text
APPLY_DOCUMENT_STORAGE_TERRAFORM=true
DOCUMENT_STORAGE_REQUIRE_APPROVAL=true
```

Approve input. Job se tao S3/KMS/IAM role va push values moi vao `gitops-testing`.

Neu automated sync da tat, Argo CD se thay Git thay doi nhung chua tu sync workload. Day la luc migrate MinIO -> S3.

### 7.3 Lay Terraform outputs

Tren may local co AWS/Terraform access:

```powershell
$bucket = terraform -chdir=infra\terraform\aws-eks output -raw documents_bucket_name
$kmsArn = terraform -chdir=infra\terraform\aws-eks output -raw documents_kms_key_arn
$roleArn = terraform -chdir=infra\terraform\aws-eks output -raw document_service_role_arn

Write-Host "bucket=$bucket"
Write-Host "kms=$kmsArn"
Write-Host "role=$roleArn"
```

### 7.4 Port-forward MinIO

Mo terminal rieng:

```powershell
kubectl -n docvault port-forward svc/minio 19000:9000
```

Lay MinIO credentials tu Kubernetes secret:

```powershell
$minioUserB64 = kubectl -n docvault get secret minio-secret -o jsonpath='{.data.MINIO_ROOT_USER}'
$minioPassB64 = kubectl -n docvault get secret minio-secret -o jsonpath='{.data.MINIO_ROOT_PASSWORD}'
$minioBucketB64 = kubectl -n docvault get secret minio-secret -o jsonpath='{.data.MINIO_BUCKET}'

$minioUser = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($minioUserB64))
$minioPass = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($minioPassB64))
$minioBucket = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($minioBucketB64))

Write-Host "minioBucket=$minioBucket"
```

Neu secret khong co `MINIO_BUCKET`, bucket hien tai trong values la `docvault`:

```powershell
$minioBucket = "docvault"
```

### 7.5 Mirror MinIO -> S3 bang mc

May chay lenh can co `mc` va AWS credentials ghi duoc vao S3 bucket. Neu dung temporary credentials, dam bao session token duoc cau hinh dung cho tool ban dung.

```powershell
mc alias set minio-local http://127.0.0.1:19000 $minioUser $minioPass
mc alias set aws-s3 https://s3.ap-southeast-1.amazonaws.com $env:AWS_ACCESS_KEY_ID $env:AWS_SECRET_ACCESS_KEY --api S3v4

mc ls minio-local/$minioBucket
mc mirror --overwrite minio-local/$minioBucket aws-s3/$bucket
```

Neu bucket policy S3 yeu cau request header SSE-KMS, hay dam bao tool copy gui SSE-KMS headers. Neu `mc mirror` trong setup cua ban khong gui duoc header can thiet, dung Kubernetes migration Job rieng co AWS SDK/CLI hoac tam thoi chay copy bang mot script S3 PutObject co:

```text
ServerSideEncryption=aws:kms
SSEKMSKeyId=<documents_kms_key_arn>
BucketKeyEnabled=true
```

Sau khi mirror, kiem tra nhanh object count/sample:

```powershell
mc ls --recursive minio-local/$minioBucket | Measure-Object
aws s3 ls s3://$bucket --recursive | Measure-Object
```

So luong co the khong giong 100% neu co hidden/system object hoac file da xoa/versioned object. Voi demo, can it nhat verify sample nhung document quan trong.

### 7.6 Sync document-service sang S3

Neu dung Argo CD CLI:

```powershell
argocd app sync docvault-document-service
argocd app wait docvault-document-service --sync --health --timeout 300
```

Neu khong dung Argo CD CLI, vao Argo CD UI va sync app `docvault-document-service`.

Bat lai automated sync neu ban da tat:

```powershell
kubectl -n argocd patch application docvault-document-service --type merge -p '{"spec":{"syncPolicy":{"automated":{"prune":false,"selfHeal":true},"syncOptions":["CreateNamespace=true","RespectIgnoreDifferences=true"]}}}'
```

## 8. Values Mong Doi Sau Jenkins Job

Sau khi Jenkins push GitOps values, `infra/k8s/values/document-service.yaml` tren branch `gitops-testing` nen co dang:

```yaml
env:
  S3_BUCKET: "docvault-documents-testing-<account-id>"
  S3_REGION: "ap-southeast-1"
  S3_SERVER_SIDE_ENCRYPTION: "aws:kms"
  S3_KMS_KEY_ID: "arn:aws:kms:ap-southeast-1:<account-id>:key/<key-id>"
  S3_BUCKET_KEY_ENABLED: "true"
  S3_USE_STATIC_CREDENTIALS: "false"
  S3_ENDPOINT: ""
  S3_FORCE_PATH_STYLE: "false"

serviceAccount:
  create: true
  name: docvault-document-service
  automountToken: true
  annotations:
    eks.amazonaws.com/role-arn: "arn:aws:iam::<account-id>:role/<role-name>"
```

`envValueFrom` khong con `S3_ACCESS_KEY` va `S3_SECRET_KEY`.

## 9. Xac Minh Argo CD Va Kubernetes

Kiem tra Argo CD application:

```powershell
kubectl -n argocd get application docvault-document-service
kubectl -n argocd get application docvault-document-service -o jsonpath='{.status.sync.status}{" "}{.status.health.status}{"`n"}'
```

Kiem tra rollout:

```powershell
kubectl -n docvault rollout status deploy/docvault-document-service --timeout=300s
kubectl -n docvault get pods -l app=docvault-document-service
```

Kiem tra ServiceAccount IRSA:

```powershell
kubectl -n docvault get sa docvault-document-service -o yaml
```

Can thay annotation:

```yaml
eks.amazonaws.com/role-arn: arn:aws:iam::<account-id>:role/<document-service-role>
```

Kiem tra deployment env:

```powershell
kubectl -n docvault get deploy docvault-document-service -o yaml | Select-String -Pattern "serviceAccountName|automountServiceAccountToken|S3_BUCKET|S3_ENDPOINT|S3_USE_STATIC_CREDENTIALS|S3_KMS_KEY_ID" -Context 1,2
```

Neu image co `printenv`, co the kiem tra trong pod:

```powershell
kubectl -n docvault exec deploy/docvault-document-service -- printenv | Select-String -Pattern "^S3_"
```

Ky vong:

```text
S3_ENDPOINT=
S3_FORCE_PATH_STYLE=false
S3_USE_STATIC_CREDENTIALS=false
S3_SERVER_SIDE_ENCRYPTION=aws:kms
S3_BUCKET_KEY_ENABLED=true
```

Khong nen thay:

```text
S3_ACCESS_KEY=...
S3_SECRET_KEY=...
```

## 10. Xac Minh AWS S3/KMS

Lay outputs:

```powershell
$bucket = terraform -chdir=infra\terraform\aws-eks output -raw documents_bucket_name
$kmsArn = terraform -chdir=infra\terraform\aws-eks output -raw documents_kms_key_arn

Write-Host "bucket=$bucket"
Write-Host "kms=$kmsArn"
```

Kiem tra S3 bucket encryption:

```powershell
aws s3api get-bucket-encryption --bucket $bucket
```

Kiem tra versioning:

```powershell
aws s3api get-bucket-versioning --bucket $bucket
```

Kiem tra public access block:

```powershell
aws s3api get-public-access-block --bucket $bucket
```

Kiem tra KMS rotation:

```powershell
aws kms get-key-rotation-status --key-id $kmsArn
```

Ky vong `KeyRotationEnabled=true`.

## 11. Smoke Test App

Chay cac luong sau tren web/gateway:

1. Upload mot file moi.
2. Download file vua upload.
3. Preview file neu app co preview.
4. Upload file bi malware/EICAR neu demo flow co support, ky vong bi chan truoc storage.
5. Kiem tra document version duoc tao va object key co dang:

```text
doc/<document-id>/v<version>/<filename>
```

Lay object key tu DB/log/app response, roi kiem tra S3 object:

```powershell
aws s3api head-object `
  --bucket $bucket `
  --key "doc/<document-id>/v<version>/<filename>" `
  --query "{SSE:ServerSideEncryption,KMS:SSEKMSKeyId,BucketKey:BucketKeyEnabled,Metadata:Metadata}"
```

Ky vong:

```json
{
  "SSE": "aws:kms",
  "KMS": "arn:aws:kms:ap-southeast-1:<account-id>:key/<key-id>",
  "BucketKey": true
}
```

Neu upload fail voi loi `AccessDenied` hoac KMS, kiem tra:

- ServiceAccount annotation co dung role ARN khong.
- Pod co dung `serviceAccountName: docvault-document-service` khong.
- IAM trust policy co dung namespace `docvault` va service account `docvault-document-service` khong.
- `S3_KMS_KEY_ID` trong values co dung `documents_kms_key_arn` khong.
- Bucket policy co reject upload neu app khong gui SSE-KMS headers khong.

## 12. MinIO Sau Khi Cutover

Ngay sau khi app da sang S3, MinIO van co the tiep tuc chay:

```powershell
kubectl -n docvault get svc minio
kubectl -n docvault get pod minio-0
kubectl -n docvault get pvc | Select-String -Pattern "minio"
```

Day la binh thuong. Nen giu MinIO trong rollback window, vi:

- File cu co the van can doi chieu.
- Rollback ve MinIO nhanh hon neu S3 cutover co loi.
- PVC MinIO la noi giu data cu, khong nen xoa ngay.

Sau khi S3 smoke test pass, co the chon 1 trong 2 cach:

- Giu MinIO chay trong vai ngay de rollback nhanh.
- Scale MinIO ve 0 de giam resource Kubernetes nhung giu PVC.

Scale ve 0:

```powershell
kubectl -n docvault scale statefulset/minio --replicas=0
```

Luu y: neu Argo CD infra app sync lai manifest MinIO, MinIO co the duoc tao/chay lai. Muon cleanup sach can doi GitOps infra overlay truoc.

## 13. Cleanup MinIO Bang GitOps

Chi lam muc nay sau khi:

- App upload/download on dinh tren S3.
- Object cu da migrate neu can.
- Da qua rollback window.
- Da co sign-off xoa MinIO khoi AWS/testing environment.

Khuyen nghi lam bang mot PR rieng:

1. Tao overlay AWS/testing moi khong include MinIO, vi du:

```text
infra/k8s/infra-deps/overlays/testing-s3
```

2. Overlay moi khong nen include:

```text
minio.yaml
minio-init-job.yaml
```

3. Cap nhat `infra/argocd-apps/docvault-infra.yaml`:

```yaml
spec:
  source:
    path: infra/k8s/infra-deps/overlays/testing-s3
```

4. Sync `docvault-infra-deps`.

Vi `docvault-infra-deps` hien khong bat prune tu dong, resource MinIO co the khong bi xoa chi bang viec remove khoi Git. Sau khi da chac chan rollback khong can nua, xoa workload MinIO thu cong:

```powershell
kubectl -n docvault delete job minio-init --ignore-not-found
kubectl -n docvault delete statefulset minio --ignore-not-found
kubectl -n docvault delete svc minio --ignore-not-found
kubectl -n docvault delete externalsecret minio-secret --ignore-not-found
```

Sau khi xoa StatefulSet, PVC thuong van con. Kiem tra:

```powershell
kubectl -n docvault get pvc | Select-String -Pattern "minio"
```

Chi xoa PVC khi da chac chan khong can data MinIO nua:

```powershell
kubectl -n docvault delete pvc minio-data-minio-0
kubectl -n docvault delete secret minio-secret --ignore-not-found
```

Xoa PVC la buoc co kha nang mat data MinIO cu. Khong lam buoc nay neu chua co backup/sign-off.

## 14. Rollback

Rollback nhanh neu MinIO/PVC van con.

### 14.1 Neu chua co upload moi len S3

1. Revert Git commit da doi `document-service.yaml` sang S3, hoac sua lai values:

```yaml
env:
  S3_ENDPOINT: "http://minio:9000"
  S3_BUCKET: "docvault"
  S3_REGION: "us-east-1"
  S3_FORCE_PATH_STYLE: "true"

envValueFrom:
  - name: S3_ACCESS_KEY
    valueFrom:
      secretKeyRef:
        name: minio-secret
        key: MINIO_ROOT_USER
  - name: S3_SECRET_KEY
    valueFrom:
      secretKeyRef:
        name: minio-secret
        key: MINIO_ROOT_PASSWORD
```

2. Sync `docvault-document-service` tren Argo CD.
3. Neu da scale MinIO ve 0, bat lai:

```powershell
kubectl -n docvault scale statefulset/minio --replicas=1
kubectl -n docvault rollout status statefulset/minio --timeout=300s
```

4. Smoke test upload/download tren MinIO.

### 14.2 Neu da co upload moi len S3

Can mirror nguoc S3 -> MinIO truoc khi rollback app, neu khong DB se tro den object key co the chua ton tai trong MinIO.

```powershell
mc mirror --overwrite aws-s3/$bucket minio-local/$minioBucket
```

Sau khi mirror nguoc, rollback values va sync app nhu muc 14.1.

## 15. Tieu Chi Hoan Tat

Co the coi cutover thanh cong khi tat ca dieu kien sau dat:

- Jenkins storage job apply thanh cong.
- Branch `gitops-testing` co commit cap nhat `document-service.yaml`.
- Argo CD app `docvault-document-service` `Synced/Healthy`.
- Deployment `docvault-document-service` rollout thanh cong.
- ServiceAccount `docvault-document-service` co annotation IRSA role.
- Pod khong dung `S3_ACCESS_KEY` / `S3_SECRET_KEY`.
- Upload file moi thanh cong.
- `aws s3api head-object` cua file moi tra ve `ServerSideEncryption=aws:kms`.
- `aws kms get-key-rotation-status` tra ve `KeyRotationEnabled=true`.
- MinIO duoc giu lai hoac cleanup theo quy trinh, khong xoa PVC ngoai y muon.

## 16. Khi Nao Chay Lai Jenkins Storage Job

Chay lai job khi:

- Tao lai EKS/environment.
- Terraform document storage module thay doi.
- IAM role/policy, bucket policy, lifecycle, logging hoac notification thay doi.
- Can recover drift giua Terraform outputs va GitOps values.
- Can tao lai bucket/KMS trong account/region moi.

Khong can chay lai job khi:

- KMS automatic rotation den chu ky.
- Deploy image moi cua `document-service`.
- Sync Argo CD thong thuong.
- Restart pod `document-service`.
