# Thư mục `apps`

Thư mục này chứa các ứng dụng ở tầng presentation của DocVault.

## Ứng dụng hiện có

| App | Công nghệ | Vai trò |
| --- | --- | --- |
| `web` | Next.js, React, TypeScript | Frontend chính cho dashboard, quản lý tài liệu, phê duyệt, audit, security, evidence, retention và quản trị thành viên. |

## Chạy frontend

Từ repo root:

```bash
pnpm --filter web dev
```

Mặc định app chạy tại:

```text
http://localhost:3006
```

Nếu cần đổi port:

```bash
pnpm --filter web dev -- --port 3100
```

## Ghi chú cấu hình

Frontend có thể gọi API theo hai cách:

- Same-origin proxy qua `NEXT_PUBLIC_API_BASE_URL=/api`.
- Gọi thẳng gateway qua `NEXT_PUBLIC_API_BASE_URL=http://localhost:3000/api`.

Khi chạy local đầy đủ, gateway cần chạy ở `http://localhost:3000`.
