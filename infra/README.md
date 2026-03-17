# Thu muc `infra`

Thu muc nay chua cac thanh phan ha tang local cho DocVault.

## Hien co trong folder nay

- `docker-compose.dev.yml`
  - Khoi dong Postgres, MongoDB, MinIO, MinIO init job va Keycloak
- `db/`
  - Script bootstrap Postgres, bao gom init database can thiet cho metadata va audit
- `keycloak/`
  - Realm export, client, role va user seed cho local
- `minio/`
  - Script tao bucket MinIO

## Dieu quan trong can biet

- File compose nay chi dung cho dependency infrastructure.
- Gateway, cac backend service va frontend hien chay bang `pnpm`, khong nam trong compose.
- MongoDB van con trong compose nhung khong phai thanh phan chinh cua MVP runtime hien tai.

## Cach dung nhanh

Khuyen nghi dung truc tiep file example:

```bash
docker compose -f infra/docker-compose.dev.yml --env-file infra/.env.example up -d
```

Neu muon co file rieng:

```bash
cp infra/.env.example infra/.env
docker compose -f infra/docker-compose.dev.yml --env-file infra/.env up -d
```

Xem them huong dan day du tai `../docs/RUN_PROJECT.md`.
