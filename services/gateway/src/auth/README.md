# `services/gateway/src/auth`

Thu muc nay chua cac thanh phan auth/RBAC cua gateway.

## File hien co

- `auth.module.ts`
  - Dang ky `PassportModule` voi strategy mac dinh la `jwt`
- `jwt.strategy.ts`
  - Verify JWT bang JWKS tu Keycloak
  - Resolve `realm_access.roles` thanh `req.user.roles`
- `roles.decorator.ts`
  - Decorator `@Roles(...)`
- `roles.guard.ts`
  - Guard kiem tra user co it nhat mot role bat buoc hay khong

## Gioi han hien tai

- Chua kiem tra audience tu token
- Chua co permission model chi tiet hon role
