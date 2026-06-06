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

## Bao mat (MFA + brute-force)

Realm da bat cac thiet lap bao mat o cap realm:

- `bruteForceProtected: true` — khoa tam thoi sau 5 lan dang nhap sai (toi da 900s)
- `passwordPolicy` — toi thieu 8 ky tu, co chu hoa/thuong/so/ky tu dac biet, khac username
- `otpPolicyType: totp` — chuan TOTP (6 chu so, chu ky 30s)

### MFA bat buoc

Cac user co vai tro dac quyen bi bat buoc cau hinh TOTP khi dang nhap lan dau
(`requiredActions: ["CONFIGURE_TOTP"]`):

- `admin1` (admin)
- `co1` (compliance_officer)
- `admin-mfa-demo`, `co-mfa-demo` (tai khoan demo)

Cac user `viewer1`, `editor1`, `approver1` khong bat buoc MFA.

### Cach kiem thu MFA

1. Khoi dong infra: `docker compose -f infra/docker-compose.dev.yml up keycloak`
   (neu doi realm sau khi da chay, can `--import-realm` lai hoac xoa volume de re-import)
2. Dang nhap bang `admin1` / `Passw0rd!`
3. Keycloak se yeu cau quet QR bang app authenticator (Google Authenticator, Authy...)
4. Nhap ma 6 chu so de hoan tat — cac lan sau se can ma OTP nay

> Thay doi realm chi co hieu luc khi Keycloak re-import. Container chi import realm
> mot lan luc tao; xoa volume cua Keycloak roi khoi dong lai de ap dung cau hinh moi.
