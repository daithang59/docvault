# DocVault — Demo Flow Script

A step-by-step walkthrough for demonstrating the full DocVault MVP workflow.

## Prerequisites

All services running:
```bash
# Infra
docker compose -f infra/docker-compose.dev.yml --env-file infra/.env.example up -d

# Backend services (each in separate terminal)
pnpm --filter metadata-service start:dev
pnpm --filter audit-service start:dev
pnpm --filter document-service start:dev
pnpm --filter notification-service start:dev
pnpm --filter workflow-service start:dev
pnpm --filter gateway start:dev

# Frontend
pnpm --filter web dev -- --port 3100
```

Navigate to: **http://localhost:3100**

---

## Step 1 — Editor: Login

1. Click **Demo Login** tab (or use JWT Token tab with real token)
2. Username: `editor1`, select role: **Editor**
3. Click **Enter as Editor**
4. ✅ Should redirect to Dashboard, showing sidebar with Documents and Dashboard links

---

## Step 2 — Editor: Create Document

1. Click **Documents** in sidebar → Click **New Document** button
2. Fill in:
   - **Title**: `Q1 2026 Financial Report`
   - **Description**: `Quarterly financial summary`
   - **Classification**: `Confidential`
   - **Tags**: `finance`, `quarterly`
3. Drag & drop or click to attach a PDF file
4. Click **Save Draft**
5. ✅ Should redirect to document detail page, status = **Draft**

---

## Step 3 — Editor: Submit for Approval

1. On the document detail page, look for **Action Panel** on the right
2. Click **Submit for Review**
3. Confirm in the dialog
4. ✅ Toast: "Document submitted for approval"
5. ✅ Status changes to **Pending Review**

---

## Step 4 — Approver: Login

1. Click user avatar in top-right → **Sign out**
2. Demo Login as `approver1`, role: **Approver**
3. Click **Approvals** in sidebar
4. ✅ Should see the submitted document in the pending list

---

## Step 5 — Approver: Approve Document

1. Click on the pending document row → Review drawer opens on right
2. Review the document details and workflow history
3. Click **Approve**
4. Confirm in dialog
5. ✅ Toast: "Document approved and published"
6. ✅ Document disappears from approvals queue

*Alternative — Reject:*
- Click **Reject**, optionally enter reason, confirm
- Document returns to Draft status

---

## Step 6 — Viewer: Login and Download

1. Sign out → Demo Login as `viewer1`, role: **Viewer**
2. Go to **Documents** → Find the published document
3. Click on it → Navigate to detail page
4. Status should show **Published**
5. Click **Download** in the action panel
6. ✅ Browser should start downloading the file

---

## Step 7 — Compliance Officer: Audit

1. Sign out → Demo Login as `co1`, role: **Compliance Officer**
2. Go to **Audit** in sidebar
3. ✅ Should see audit log table with all events from the demo flow above
4. Try filtering by action type or date
5. Navigate to a document detail page
6. ✅ No **Download** button visible (compliance_officer is blocked)

---

## Quick Backend E2E (no browser needed)

```bash
node scripts/e2e-check.mjs
```

Covers all flows automatically. See [README.md](../README.md#e2e-checks-covered) for what is tested.

---

## Notes for Presenter

- Demo Login mode can be used to inspect role-based UI quickly
- For a real end-to-end demo, keep all backend services running and prefer JWT Login with Keycloak tokens
- Frontend should run on port `3100` to avoid conflicts with gateway `3000` and metadata-service `3001`
