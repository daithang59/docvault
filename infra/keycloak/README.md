# `infra/keycloak`

Thư mục này chứa dữ liệu seed cho Keycloak local. Keycloak là identity provider của DocVault, dùng để phát hành token đăng nhập và gán role cho user demo.

## File trong thư mục

- `README.md`
  - Tài liệu giải thích thư mục này.

- `realm-docvault.json`
  - Realm export cho môi trường local.
  - Tạo realm `docvault`.
  - Tạo client `docvault-gateway`.
  - Tạo roles:
    - `viewer`
    - `editor`
    - `approver`
    - `co`
    - `compliance_officer`
    - `admin`
  - Tạo users demo:
    - `viewer1`
    - `editor1`
    - `approver1`
    - `co1`
    - `admin1`
    - `co-mfa-demo`
    - `admin-mfa-demo`
  - Bật password policy, brute-force protection và TOTP policy để mô phỏng yêu cầu bảo mật.

- `seed-roles.sh`
  - Script idempotent gọi Keycloak Admin REST API.
  - Đợi realm `docvault` sẵn sàng.
  - Lấy admin token từ realm `master`.
  - Tìm user theo username.
  - Gán role cho các user demo.
  - Cần thiết vì `start-dev --import-realm` chỉ import realm ở lần khởi tạo đầu tiên; restart container có thể không tự gán lại role như mong muốn.

## Cách được dùng trong local

`docker-compose.dev.yml` mount `realm-docvault.json` vào container Keycloak và chạy:

```text
start-dev --import-realm
```

Sau khi Keycloak healthy, service `keycloak-init` chạy `seed-roles.sh` để đảm bảo role mapping đúng.

## Lưu ý bảo mật

- User demo local dùng password mẫu trong realm export.
- Client secret local là giá trị dev, không dùng cho production.
- Khi chỉnh realm cho Kubernetes testing, kiểm tra thêm file `infra/k8s/infra-deps/overlays/testing/realm-docvault.json` vì file local và file testing không hoàn toàn giống nhau.
