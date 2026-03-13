## Summary

<!-- Describe WHAT this PR does and WHY. Link the issue/task if applicable. -->

Closes #<!-- issue number -->

---

## Type of Change

- [ ] `type:feature` — new feature or behavior
- [ ] `type:bug` — bug fix
- [ ] `type:chore` — build, CI, dependencies, refactor
- [ ] `type:security` — security fix or policy enforcement

**Affected service(s):**
- [ ] `svc:gateway`
- [ ] `svc:metadata`
- [ ] `svc:document`
- [ ] `svc:workflow`
- [ ] `svc:audit`
- [ ] `svc:notify`
- [ ] `area:infra`
- [ ] `area:frontend`

---

## Checklist

### Code Quality
- [ ] Code compiles / linted with no errors
- [ ] No hardcoded secrets or credentials committed
- [ ] Environment variables updated in `.env.example` if needed

### RBAC & Security
- [ ] RBAC enforcement is at the **backend/gateway layer** (not UI only)
- [ ] Compliance Officer download deny path is preserved (if touched)
- [ ] New endpoints verified: no token → 401, wrong role → 403, correct → 200

### Testing
- [ ] Unit tests added or updated for changed logic
- [ ] E2E / integration tests pass locally (if applicable)
- [ ] Manual smoke test done: `docker compose -f infra/docker-compose.dev.yml up`

### Audit & Logging
- [ ] Significant actions (upload, submit, approve, download allow/deny) emit audit events

### Documentation
- [ ] README / inline comments updated if behavior changed
- [ ] OpenAPI spec in `libs/contracts/openapi/` updated if endpoints changed

---

## Testing Evidence

<!-- Paste logs, screenshots, or Postman collection output demonstrating the change works. -->

```
# Example curl / output that proves it works
```

---

## Notes for Reviewer

<!-- Anything the reviewer should pay special attention to. -->
