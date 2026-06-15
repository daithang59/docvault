# `infra/k8s/public-ingress`

Thư mục này chứa Kustomize overlay để mở các endpoint public của DocVault qua ingress-nginx và cert-manager.

## Endpoint public

| Host | Backend |
| --- | --- |
| `app.docvault.id.vn` | `docvault-web:3006` |
| `auth.docvault.id.vn` | `keycloak:8080` |

TLS certificate được cấp bằng ClusterIssuer `letsencrypt-cloudflare`.

## Thư mục con

- `overlays/`
  - Chứa overlay theo môi trường.
  - Hiện có `testing`.
  - Xem `overlays/README.md`.

## Cloudflare DNS

Trỏ hai record này tới hostname LoadBalancer của ingress-nginx:

```text
app.docvault.id.vn   CNAME   <ingress-nginx-controller ELB hostname>   Proxied
auth.docvault.id.vn  CNAME   <ingress-nginx-controller ELB hostname>   Proxied
```

Với Harbor, nên giữ `harbor.docvault.id.vn` ở chế độ DNS-only nếu dùng Docker registry push/pull qua domain đó.

Lấy hostname hiện tại của ingress-nginx:

```powershell
kubectl get svc ingress-nginx-controller -n ingress-nginx `
  -o jsonpath="{.status.loadBalancer.ingress[0].hostname}"
```

## Kiểm tra sau sync

```powershell
kubectl get ingress -n docvault
kubectl get certificate -n docvault
curl.exe -I https://app.docvault.id.vn
curl.exe -I https://auth.docvault.id.vn/realms/docvault
```
