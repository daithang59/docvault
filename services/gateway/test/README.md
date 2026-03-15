# `services/gateway/test`

Thu muc nay chua test e2e cua gateway.

## Trang thai hien tai

- Da co file scaffold tu NestJS
- Test e2e hien tai chua duoc cap nhat theo route thuc te cua gateway

## Nen lam tiep

Cap nhat lai test de cover:

- `GET /health`
- `GET /me` voi token hop le/khong hop le
- `GET /admin-only` voi role `admin` va role khac
- metadata proxy khi metadata-service available
