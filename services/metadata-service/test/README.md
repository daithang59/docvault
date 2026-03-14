# `services/metadata-service/test`

Thu muc nay chua test e2e cua metadata-service.

## Trang thai hien tai

- Da co scaffold e2e test tu NestJS
- Test hien tai chua duoc cap nhat theo route thuc te cua service

## Nen lam tiep

Cap nhat test de cover:

- `GET /health`
- `GET /documents` theo role
- `POST /documents` voi `editor/admin` va role khong hop le
- `GET /me` voi token hop le/khong hop le
