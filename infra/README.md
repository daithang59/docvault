# Thu Muc `infra`

Thu muc nay chua cac thanh phan ha tang local cho DocVault.

## Hien co trong folder nay

- `docker-compose.dev.yml`
  - Khoi dong Postgres, MongoDB, MinIO, MinIO init va Keycloak
- `db/`
  - Script bootstrap Postgres
- `keycloak/`
  - Realm export, client, role va user seed
- `minio/`
  - Script tao bucket va bat SSE-S3 cho MinIO

## Dieu quan trong can biet

Compose hien tai chi dung de chay dependency infrastructure. Gateway, metadata-service va frontend chua duoc dockerize trong file nay.

## Cach dung nhanh

```bash
docker compose -f infra/docker-compose.dev.yml --env-file infra/.env up -d
```

Neu can dung gia tri mac dinh, co the copy `infra/.env.example` thanh `infra/.env`.
