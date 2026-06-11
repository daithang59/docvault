# NGINX Ingress Controller for AWS EKS

This directory contains the configurations and deployment instructions for NGINX Ingress Controller on AWS EKS.

## Deployment Instructions

To install or upgrade the NGINX Ingress Controller using Helm:

```powershell
# Add helm repository
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
helm repo update

# Install/upgrade
helm upgrade --install ingress-nginx ingress-nginx/ingress-nginx `
  --namespace ingress-nginx `
  --create-namespace `
  -f infra/k8s/ingress-nginx/values-eks.yaml
```

## Verification

Once installed, check that the controller pods are running and fetch the external AWS Load Balancer (NLB) address:

```powershell
# Check pods
kubectl get pods -n ingress-nginx

# Get LoadBalancer DNS name
kubectl get svc ingress-nginx-controller -n ingress-nginx
```

Use the output external hostname for mapping DNS (e.g., in Cloudflare) to route traffic to the ingress.
