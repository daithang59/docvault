#!/bin/sh
set -e

mc alias set local http://minio:9000 "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD"

# Create bucket if not exists
mc mb -p "local/$MINIO_BUCKET" || true

# Bật SSE-S3 default cho bucket (mô phỏng at-rest encryption)
# (MinIO hỗ trợ encryption config theo bucket)
mc encrypt set sse-s3 "local/$MINIO_BUCKET" || true

echo "MinIO init done: bucket=$MINIO_BUCKET (SSE-S3 enabled)"
