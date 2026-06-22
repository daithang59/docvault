# `infra/k8s/infra-deps/overlays/testing-s3`

Overlay nay dung cho moi truong `testing` sau khi `document-service` da cutover
sang AWS S3 + KMS.

No ke thua overlay `../testing` va xoa cac resource MinIO khoi desired state:

- `ExternalSecret/minio-secret`
- `StatefulSet/minio`
- `Service/minio`
- `Job/minio-init`

PVC `minio-data-minio-0` khong bi quan ly/xoa boi overlay nay. Chi xoa PVC
thu cong khi da chac chan khong can du lieu MinIO cu nua.
