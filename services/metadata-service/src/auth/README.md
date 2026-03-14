# `services/metadata-service/src/auth`

Thu muc nay chua cac thanh phan auth/RBAC cua metadata-service.

## File hien co

- `auth.module.ts`
  - Dang ky `PassportModule`
- `jwt.strategy.ts`
  - Verify JWT voi Keycloak JWKS va map role ve `req.user.roles`
- `roles.decorator.ts`
  - Khai bao metadata role cho route
- `roles.guard.ts`
  - Enforce role bang cach doi chieu role bat buoc voi role trong token

## Luu y

Role compliance officer trong code hien tai la `co`.
