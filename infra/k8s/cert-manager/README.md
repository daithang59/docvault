# `infra/k8s/cert-manager`

Thư mục này chứa cấu hình cert-manager để cấp TLS certificate cho domain public của DocVault.

## File trong thư mục

- `clusterissuer-letsencrypt-cloudflare.yaml`
  - Tạo `ClusterIssuer` tên `letsencrypt-cloudflare`.
  - Dùng Let's Encrypt ACME production endpoint.
  - Dùng DNS-01 challenge qua Cloudflare.
  - Đọc Cloudflare API token từ secret `cloudflare-api-token-secret`, key `api-token`.
  - Giới hạn DNS zone `docvault.id.vn`.
  - Lưu private key ACME account vào secret `letsencrypt-cloudflare-account-key`.

## Vai trò trong pipeline

Ingress trong `infra/k8s/public-ingress` dùng annotation:

```text
cert-manager.io/cluster-issuer: letsencrypt-cloudflare
```

cert-manager sẽ dựa vào ClusterIssuer này để tự xin và gia hạn TLS certificate.
