# DocVault Public Ingress

This overlay exposes the browser-facing DocVault endpoints through the existing
ingress-nginx controller:

| Host | Backend |
| --- | --- |
| `app.docvault.id.vn` | `docvault-web:3006` |
| `auth.docvault.id.vn` | `keycloak:8080` |

TLS certificates are requested through the existing
`letsencrypt-cloudflare` ClusterIssuer.

## Cloudflare DNS

Point both records to the ingress-nginx AWS load balancer hostname:

```text
app.docvault.id.vn   CNAME   <ingress-nginx-controller ELB hostname>   Proxied
auth.docvault.id.vn  CNAME   <ingress-nginx-controller ELB hostname>   Proxied
```

Keep `harbor.docvault.id.vn` DNS-only so Docker registry pushes do not pass
through the Cloudflare proxy.

Find the current ingress-nginx load balancer hostname:

```powershell
kubectl get svc ingress-nginx-controller -n ingress-nginx `
  -o jsonpath="{.status.loadBalancer.ingress[0].hostname}"
```

After syncing Argo CD, verify:

```powershell
kubectl get ingress -n docvault
kubectl get certificate -n docvault
curl.exe -I https://app.docvault.id.vn
curl.exe -I https://auth.docvault.id.vn/realms/docvault
```
