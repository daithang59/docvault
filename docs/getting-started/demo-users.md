# DocVault — Demo Users & Role Mapping

## Keycloak Seed Users

Password for all seeded users: **`Passw0rd!`**

| Username | Role | Capabilities |
|----------|------|-------------|
| `viewer1` | `viewer` | View documents, download published docs (if ACL allows) |
| `editor1` | `editor` | Create docs, upload files, submit for approval, archive own published docs |
| `approver1` | `approver` | Approve / reject pending docs |
| `co1` | `compliance_officer` | Query audit logs — **cannot download files** |
| `admin1` | `admin` | Local admin role for most management actions, but not every route is fully superuser-open |

> **Note:** `co1` has both `co` and `compliance_officer` Keycloak roles. The gateway normalizes `co` → `compliance_officer`.

## Login Modes

### A. JWT Token Login (Real Backend)

1. Get a token from Keycloak:
```bash
curl -s -X POST \
  http://localhost:8080/realms/docvault/protocol/openid-connect/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "client_id=docvault-gateway&client_secret=dev-gateway-secret&grant_type=password&username=editor1&password=Passw0rd!" \
  | jq -r '.access_token'
```

2. Paste the JWT into the "JWT Token" tab on the login page.

### B. Demo Login (No Backend Required)

1. Go to `http://localhost:3100/login`
2. Click "Demo Login" tab
3. Enter any username (e.g. `demo_editor`)
4. Select a role from the dropdown
5. Click "Enter as [Role]"

Demo sessions are stored in localStorage and simulate role-based UI without calling the real API.

## Role Capabilities Matrix

| Action | viewer | editor | approver | compliance_officer | admin |
|--------|--------|--------|----------|--------------------|-------|
| List documents | ✅ | ✅ | ✅ | ✅ | ✅ |
| View detail | ✅ | ✅ | ✅ | ✅ | ✅ |
| Create document | ❌ | ✅ | ❌ | ❌ | ✅ |
| Upload file | ❌ | ✅ | ❌ | ❌ | ✅ |
| Submit (DRAFT→PENDING) | ❌ | ✅ (owner only) | ❌ | ❌ | ✅ |
| Approve (PENDING→PUBLISHED) | ❌ | ❌ | ✅ | ❌ | ✅ |
| Reject (PENDING→DRAFT) | ❌ | ❌ | ✅ | ❌ | ✅ |
| Archive (PUBLISHED→ARCHIVED) | ❌ | ✅ (owner only) | ❌ | ❌ | ✅ |
| Download published doc | ✅ | ✅ | ✅ | ❌ (always denied) | ✅ |
| View approvals queue | ❌ | ❌ | ✅ | ❌ | ✅ |
| Query audit logs | ❌ | ❌ | ❌ | ✅ | ❌ |
| Manage ACL | ❌ | ✅ | ❌ | ❌ | ✅ |

> Current runtime note: `GET /api/audit/query` is guarded for `compliance_officer` only at gateway/service level.
