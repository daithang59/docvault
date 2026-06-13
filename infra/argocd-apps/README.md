# Argo CD App Of Apps

`docvault-root` is the one-time bootstrap Application. It watches this
directory and manages the child Argo CD Applications here.

Apply the root app once:

```powershell
kubectl apply -f infra/argocd-bootstrap/docvault-root.yaml
```

After that, changes to child Application manifests in `infra/argocd-apps`
are reconciled by Argo CD from the `gitops-testing` branch.

The root Application lives outside this directory on purpose, so it does not
try to manage itself. `prune` is disabled on the root app to avoid accidentally
deleting child Applications during bootstrap; remove child apps manually or
enable root pruning later after the flow is stable.
