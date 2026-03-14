# `infra/minio`

Thu muc nay chua script khoi tao MinIO cho local development.

## File hien co

- `init.sh`

## Script dang lam gi

- Tao alias `mc` tro toi container MinIO
- Tao bucket theo bien moi truong `MINIO_BUCKET`
- Bat SSE-S3 cho bucket de mo phong at-rest encryption

## Cach dung

Script nay duoc container `minio-init` goi tu dong sau khi MinIO healthy trong `docker-compose.dev.yml`.
