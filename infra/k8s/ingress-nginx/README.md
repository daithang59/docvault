# `infra/k8s/ingress-nginx`

Thư mục này chứa cấu hình và hướng dẫn cài ingress-nginx controller trên AWS EKS. Controller này nhận traffic public từ AWS Load Balancer rồi route vào các Kubernetes Service.

## File trong thư mục

- `README.md`
  - Tài liệu giải thích thư mục này.

- `values-eks.yaml`
  - Values dùng khi cài Helm chart `ingress-nginx/ingress-nginx`.
  - Đặt controller service type là `LoadBalancer`.
  - Dùng AWS Network Load Balancer bằng annotation `service.beta.kubernetes.io/aws-load-balancer-type: nlb`.
  - Đặt NLB internet-facing.
  - Cấu hình `proxy-body-size: "0"` để không giới hạn body ở controller level.
  - Tăng timeout đọc/gửi lên `900` giây cho request dài hoặc upload lớn.

## Cài đặt

```powershell
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
helm repo update

helm upgrade --install ingress-nginx ingress-nginx/ingress-nginx `
  --namespace ingress-nginx `
  --create-namespace `
  -f infra/k8s/ingress-nginx/values-eks.yaml
```

## Kiểm tra

```powershell
kubectl get pods -n ingress-nginx
kubectl get svc ingress-nginx-controller -n ingress-nginx
```

Hostname LoadBalancer lấy từ service `ingress-nginx-controller` sẽ được dùng để cấu hình DNS ở Cloudflare.
