# `infra/k8s/cloudflare-tunnel`

Thư mục này chứa manifest triển khai Cloudflare Tunnel bằng `cloudflared`. Đây là phương án expose service qua Cloudflare Tunnel, tách với phương án ingress-nginx/NLB.

## File trong thư mục

- `cloudflared.yaml`
  - Tạo namespace `cloudflare-tunnel`.
  - Tạo Deployment `cloudflared` với 1 replica.
  - Dùng image `cloudflare/cloudflared:2026.5.0`.
  - Lấy tunnel token từ secret `cloudflared-token`, key `token`.
  - Bật metrics ở port `2000`.
  - Cấu hình readiness/liveness probe ở endpoint `/ready`.
  - Tạo NetworkPolicy chỉ cho egress cần thiết tới Cloudflare/DNS qua port `443`, `7844`, `53`.

## Điểm bảo mật

- Tắt tự mount service account token.
- Chạy non-root user/group `65532`.
- Dùng `seccompProfile: RuntimeDefault`.
- Không cho privilege escalation.
- Root filesystem read-only.
- Drop toàn bộ Linux capabilities.
