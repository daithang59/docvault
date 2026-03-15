# `infra/keycloak`

Thu muc nay chua du lieu seed cho Keycloak.

## File hien co

- `realm-docvault.json`

## Noi dung da seed

- Realm `docvault`
- Client `docvault-gateway`
- Roles:
  - `viewer`
  - `editor`
  - `approver`
  - `co`
  - `admin`
- Users demo:
  - `viewer1`
  - `editor1`
  - `approver1`
  - `co1`
  - `admin1`

## Cach dung

File nay duoc mount vao container Keycloak trong `docker-compose.dev.yml` va duoc import tu dong khi container khoi dong voi `start-dev --import-realm`.

## Luu y

- Password demo cua cac user la `Passw0rd!`
- Client secret cua `docvault-gateway` la `dev-gateway-secret`
