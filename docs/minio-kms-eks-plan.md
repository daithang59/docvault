# Kế Hoạch Triển Khai Mã Hóa MinIO bằng AWS KMS trên EKS (Lựa Chọn 1)

Kế hoạch này phác thảo các bước chi tiết để thiết lập Server-Side Encryption (SSE-KMS) cho cụm MinIO StatefulSet đang chạy trên EKS, sử dụng **MinIO KES (Key Encryption Service)** làm cầu nối giao tiếp với **AWS KMS**. Giải pháp sử dụng **IRSA** (IAM Roles for Service Accounts) để loại bỏ hoàn toàn việc lưu trữ hardcoded credentials (Access Key / Secret Key).

## 1. Tổng Quan Kiến Trúc

- **AWS KMS**: Nơi lưu trữ Customer Managed Key (CMK) đóng vai trò là Master Key.
- **MinIO KES**: Chạy như một Deployment/Sidecar trong EKS. Nhận yêu cầu mã hóa từ MinIO, sau đó gọi AWS KMS để sinh Data Entity Keys (DEK). KES tận dụng IAM Role được gán cho Pod thông qua IRSA.
- **MinIO (StatefulSet)**: Quản lý Storage. Khi nhận file từ backend `document-service`, MinIO sẽ yêu cầu KES cấp khóa mã hóa. File được mã hóa trực tiếp trên RAM trước khi ghi xuống đĩa (Data-at-rest encryption).

---

## 2. Các Bước Triển Khai

### Bước 1: Khởi tạo AWS KMS Key
1. Truy cập AWS KMS Console, tạo một **Symmetric Key** (Customer Managed Key).
2. Tích chọn **Automatic Key Rotation** để AWS tự xoay vòng khóa này 1 năm/lần.
3. Ghi lại `Key ID` (hoặc ARN) của khóa vừa tạo. Ví dụ: `arn:aws:kms:ap-southeast-1:111122223333:key/abcd-1234...`
4. Có thể đặt Alias cho dễ nhớ, ví dụ: `alias/docvault-minio-key`.

### Bước 2: Thiết lập IRSA cho KES trên EKS
Sử dụng `eksctl` hoặc Terraform để tạo IAM Policy và OIDC Trust Relationship cho KES Service Account.

**IAM Policy (MinioKMSPolicy):**
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "MinioKMSAccess",
      "Effect": "Allow",
      "Action": [
        "kms:Encrypt",
        "kms:Decrypt",
        "kms:GenerateDataKey"
      ],
      "Resource": "arn:aws:kms:<REGION>:<ACCOUNT_ID>:key/<KMS_KEY_ID>"
    }
  ]
}
```

**Tạo Kubernetes Service Account gắn với IAM Role:**
```bash
eksctl create iamserviceaccount \
  --cluster=<YOUR_CLUSTER_NAME> \
  --namespace=<MINIO_NAMESPACE> \
  --name=minio-kes-sa \
  --attach-policy-arn=arn:aws:iam::<ACCOUNT_ID>:policy/MinioKMSPolicy \
  --approve
```

### Bước 3: Triển khai MinIO KES lên EKS
Bạn có thể chạy KES như một Deployment riêng biệt hoặc một Sidecar container trong chính Pod của MinIO. (Khuyến nghị: Chạy như Deployment riêng trong cùng namespace).

**kes-config.yaml (ConfigMap):**
```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: kes-config
  namespace: minio-namespace
data:
  config.yml: |-
    address: 0.0.0.0:7373
    admin:
      identity: disabled  # Thay bằng client cert hash của MinIO admin
    tls:
      key: /certs/kes.key
      cert: /certs/kes.cert
    keystore:
      aws:
        kms:
          endpoint: https://kms.<REGION>.amazonaws.com
          region: <REGION>
          defaultKeyID: <KMS_KEY_ID>
          # KHÔNG có secretKey hay accessKey ở đây.
          # KES sẽ tự lấy credentials qua IRSA web identity token do K8s mount vào.
```

**kes-deployment.yaml:**
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: minio-kes
  namespace: minio-namespace
spec:
  replicas: 2
  template:
    spec:
      serviceAccountName: minio-kes-sa # Gắn Service Account có IRSA
      containers:
      - name: kes
        image: minio/kes:latest
        command: ["/kes", "server", "--config", "/config/config.yml"]
        volumeMounts:
        - name: kes-config-volume
          mountPath: /config
        - name: kes-certs
          mountPath: /certs
      volumes:
      # ... configmap & secret volumes cho certs ...
```

### Bước 4: Cấu hình MinIO StatefulSet kết nối tới KES
Để MinIO sử dụng KES làm backend mã hóa, cần truyền các biến môi trường vào Pod MinIO.

Bổ sung vào `env` của container MinIO trong StatefulSet:
```yaml
env:
  - name: MINIO_KMS_KES_ENDPOINT
    value: "https://minio-kes-service.minio-namespace.svc.cluster.local:7373"
  - name: MINIO_KMS_KES_CERT_FILE
    value: "/certs/minio-client.cert"
  - name: MINIO_KMS_KES_KEY_FILE
    value: "/certs/minio-client.key"
  - name: MINIO_KMS_KES_CAPATH
    value: "/certs/ca.cert"
  - name: MINIO_KMS_KES_KEY_NAME
    value: "docvault-backend-key" # Tên khóa gốc sẽ được tạo trong KMS
  
  # Ép buộc mọi file tải lên đều bị mã hóa dù API client có yêu cầu hay không
  - name: MINIO_KMS_AUTO_ENCRYPTION
    value: "on"
```
*(Lưu ý: KES và MinIO giao tiếp bắt buộc qua mTLS, bạn sẽ cần gen certs nội bộ cho MinIO client và KES server bằng `cert-manager` hoặc `kes identity`).*

---

## 3. Quy trình xác nhận (Validation)
1. **Kiểm tra KES kết nối AWS:** Xem log của KES pod. Nếu không có lỗi auth, KES đã mượn thành công IAM Role qua EKS OIDC.
2. **Kiểm tra MinIO kết nối KES:** Trong log khởi động MinIO, bạn sẽ thấy dòng báo KMS backend đã sẵn sàng:
   `KMS: KES cluster <minio-kes-service...:7373> is ready`.
3. **Upload test:** Dùng `document-service` up 1 file test `secret-doc.pdf`.
4. **Kiểm tra mã hóa:** 
   - Truy cập vào ổ cứng PVC của MinIO StatefulSet.
   - Chạy lệnh `cat <path_to_file>` hoặc `mc stat myminio/bucket/secret-doc.pdf`. 
   - Bạn sẽ thấy metadata `X-Amz-Server-Side-Encryption: aws:kms` và dữ liệu gốc bị biến thành binary rác (đã mã hóa).

## 4. Maintenance / Xử Lý Sự Cố (SOP)
- **Key Rotation**: AWS tự xử lý. Các file cũ tiếp tục dùng Data Key cũ nhưng được gói (wrap) bởi phiên bản CMK cũ. Các file mới sẽ được mã hóa bằng CMK phiên bản mới. KHÔNG CẦN DOWN TIME.
- **KMS Rate Limit**: Mặc định KMS cho phép hàng nghìn request/giây. MinIO KES có built-in cache in-memory để giảm API call lên AWS KMS, chi phí sẽ rất thấp.
