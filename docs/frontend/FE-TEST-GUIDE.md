# FE Test Guide — DocVault Web

## 1. Startup

### Step 1.1 — Verify backend is running

```bash
curl http://localhost:3000/health
# → {"status":"ok","service":"gateway"}
```

### Step 1.2 — Start frontend

```bash
cd apps/web
pnpm dev
```

Frontend runs at **http://localhost:3006** (Next.js default port, different from backend gateway :3000).

> If accessing from another machine on LAN, set the env var before running:
>
> ```bash
> NEXT_PUBLIC_API_BASE_URL=http://<LAN_IP>:3000/api pnpm dev
> ```

---

## 2. Environment Variables

Open `apps/web/.env`:

```env
NEXT_PUBLIC_APP_NAME=DocVault
NEXT_PUBLIC_API_BASE_URL=http://localhost:3000/api
FRONTEND_URL=http://localhost:3006
KEYCLOAK_BASE_URL=http://localhost:8080
KEYCLOAK_REALM=docvault
KEYCLOAK_CLIENT_ID=docvault-gateway
KEYCLOAK_CLIENT_SECRET=dev-gateway-secret
```

> **Note:** Frontend runs on port **3006**, backend gateway on **3000**. Gateway prefix `/api` is handled by the backend — `.env` only needs to match the above.

---

## 3. Test Each Page by Role

### 3.1 — Login Page (`/login`)

Open browser → **http://localhost:3006/login**

#### ✅ Test 1: SSO Login (Production/OIDC flow)

1. Click **"Sign in with SSO"**
2. Browser redirects to Keycloak login page
3. Login with Keycloak credentials → redirect to `/login?auth=ok`
4. Session saved to localStorage → redirect to `/dashboard`

**Demo accounts (Keycloak realm `docvault`):**

| Username | Password | Role |
|---|---|---|
| `viewer1` | `Passw0rd!` | viewer |
| `editor1` | `Passw0rd!` | editor |
| `approver1` | `Passw0rd!` | approver |
| `co1` | `Passw0rd!` | compliance_officer |
| `admin` | `Passw0rd!` | admin |

#### ✅ Test 2: Callback error handling

- When Keycloak returns `?error=access_denied` → show error toast `Login failed: access_denied`
- URL cleaned back to `/login`

#### ✅ Test 3: Not logged in → cannot access `/dashboard`

1. Open **incognito tab**
2. Navigate directly to `http://localhost:3006/dashboard`

**Expected:**
- Shows loading state "Signing you in..." for ~1 frame
- Redirects to `/login`

---

### 3.2 — Dashboard (`/dashboard`)

After logging in with `editor1`:

#### ✅ Test 1: Stat cards display correctly

| Card | Value |
|---|---|
| Total Documents | Total docs count |
| Draft | Docs with `status=DRAFT` |
| Pending Approval | Docs with `status=PENDING` |
| Published | Docs with `status=PUBLISHED` |

#### ✅ Test 2: Recent Documents list

- Shows correctly **newest first** (sorted by `updatedAt` desc, slice 5)
- Each item click → navigate to `/documents/[id]`
- Empty state: `"No documents yet."`

#### ✅ Test 3: Quick Actions by role

| Role | Visible Quick Actions |
|---|---|
| `viewer` | Browse Documents |
| `editor` | Browse Documents + Create Document + My Documents |
| `approver` | Browse Documents + Review Approvals (+ badge with pending count) |
| `compliance_officer` | Browse Documents + Audit Logs |
| `admin` | All actions (including My Documents) |

#### ✅ Test 4: Role Badge in header

Top-right of PageHeader → badge displays current role (e.g. `"EDITOR"`, `"APPROVER"`)

---

### 3.3 — Documents List (`/documents`)

Navigate to `/documents` (or click "Browse Documents" on Dashboard)

#### ✅ Test 1: Document list

- Table displays correct documents (columns: title, status badge, classification badge, updatedAt)
- Click row → navigate to detail page

#### ✅ Test 2: Filter by status

| Filter | Expected |
|---|---|
| All | All docs |
| Draft | DRAFT only |
| Pending | PENDING only |
| Published | PUBLISHED only |
| Archived | ARCHIVED only |

#### ✅ Test 3: Sorting

- Click column header → toggle asc/desc
- Default sort `updatedAt` desc

#### ✅ Test 4: RBAC — Viewer does not see New Document button

Login as `viewer` → navigate to `/documents`

**Expected:** No "New Document" button

#### ✅ Test 5: Inline workflow actions

| Role | Actions on row |
|---|---|
| editor (owner, DRAFT) | Submit |
| editor (owner, PUBLISHED) | Archive |
| approver (PENDING) | Approve, Reject |
| viewer | Download |

#### ✅ Test 6: Confirm dialogs

- Submit: dialog "Send this document for approval?"
- Approve: dialog "This document will be published."
- Reject: dialog with textarea for reason
- Archive: dialog "Document will be archived."

---

### 3.4 — Create Document (`/documents/new`)

> Only `editor` and `admin` can access this page.

#### ✅ Test 1: RBAC — Non-owning editor can access page

1. Login as `editor1`
2. Navigate to `/documents/new`
3. **Expected:** Form displays normally (creating a new doc, not editing an existing one)

#### ✅ Test 2: Form validation

- Leave `title` blank → submit → error **"Title is required"** (React Hook Form)
- Classification is required, defaults to `INTERNAL`
- Tags are multi-select

#### ✅ Test 3: Create document successfully

Fill form:

```json
{
  "title": "Q1 2026 Security Policy",
  "description": "Draft of the quarterly security policy",
  "classification": "CONFIDENTIAL",
  "tags": ["security", "policy"]
}
```

Submit → redirect to newly created `/documents/[id]`
- Status = **DRAFT**
- Owner = current user

#### ✅ Test 4: Create + upload file simultaneously

- Select file in dropzone before submitting
- Submit → document created → file uploaded → redirect → version displayed

#### ✅ Test 5: Create succeeds but file upload fails

- Select a file but the upload API fails
- → Toast success "Document created successfully." + Toast error "Document created, but file upload failed: ..."
- → Still redirects to detail page

#### ✅ Test 6: Upload file > 20MB

- Create a 25MB test file
- Attempt upload → **Expected:** Toast error `413 Payload Too Large`

---

### 3.5 — Document Detail (`/documents/[id]`)

Navigate to the detail page of a created document.

#### ✅ Test 1: Header — document info

Title, description, classification badge, status badge, tags, owner info, created/updated timestamps

#### ✅ Test 2: Versions Card

- List of uploaded versions
- Each version: filename, size, checksum, createdAt
- **"Download"** button → download file (if `canDownload=true`)

#### ✅ Test 3: Workflow Timeline

- Displays history: submit, approve, reject, archive
- Each step: actor, timestamp, action, reason (if any reject)

#### ✅ Test 4: ACL Card (if permission)

- `canReadAcl` (`editor`, `approver`, `compliance_officer`, `admin`) → sees ACL card
- Owner or admin → sees **"Add Access"** button

#### ✅ Test 5: Action Panel (by status & role)

| Status | Role | Visible Actions |
|---|---|---|
| DRAFT | editor (owner) | Submit, Edit |
| DRAFT | viewer | No actions |
| PENDING | approver | Approve, Reject (with reason input) |
| PENDING | editor | No actions |
| PUBLISHED | viewer/editor | Download, Archive |
| ARCHIVED | (all) | View only |
| PUBLISHED/ARCHIVED | viewer/editor/approver/admin | Preview (if `canPreview=true`) |
| PUBLISHED/ARCHIVED | co (only PUBLIC classification) | Preview |

#### ✅ Test 6: Submit document (DRAFT → PENDING)

1. Document in **DRAFT**, login as `editor1` (owner)
2. Click **Submit** → Confirm dialog → Submit
3. Status changes → **PENDING**
4. Timeline adds **SUBMIT** step

#### ✅ Test 7: Approve document (PENDING → PUBLISHED)

1. Document in **PENDING**
2. Login as `approver1`
3. Open document → click **Approve**
4. Status changes → **PUBLISHED**
5. Timeline adds **APPROVE** step

#### ✅ Test 8: Reject document with reason (PENDING → DRAFT)

1. Document in **PENDING**
2. Click **Reject**
3. Enter reason: `"Table of contents missing, needs to be added"`
4. Status changes → **DRAFT**
5. Timeline records reason

#### ✅ Test 9: Download file — compliance_officer blocked ⚠️

> **Most important frontend security test!**

1. Login as `co1` (`compliance_officer`)
2. Open a **PUBLISHED** document
3. `canDownload = false` for CO (enforced in `permissions.ts`)

**Expected:**
- Metadata + workflow timeline → viewable ✅
- **Download button → NOT shown** or **disabled** ❌

---

### 3.6 — Edit Document (`/documents/[id]/edit`)

#### ✅ Test 1: Owning editor (DRAFT) → can edit

1. Login as `editor1`
2. Open `editor1`'s document (DRAFT) → click **Edit**
3. Edit title/description → **Save Changes**
4. **Expected:** Update succeeds, return to detail

#### ✅ Test 2: Owning editor but not DRAFT → cannot edit

1. Login as `editor1`
2. Open `editor1`'s document in **PENDING** or **PUBLISHED**
3. Click **Edit**

**Expected:** Inline error message "You do not have permission to edit this document."

#### ✅ Test 3: Non-owning editor → cannot edit

1. Login as `editor1`
2. Open `admin`'s document → click **Edit**
3. **Expected:** Inline error message "You do not have permission to edit this document."

#### ✅ Test 4: Admin always can edit (regardless of owner)

1. Login as `admin`
2. Open `editor1`'s document (DRAFT)
3. Click **Edit**

**Expected:** Edit form displays normally

---

### 3.7 — Approvals Page (`/approvals`)

> Only `approver` and `admin` can access.

#### ✅ Test 1: Displays PENDING list

1. Login as `approver1`
2. Navigate to `/approvals`
3. **Expected:** Only documents with `status=PENDING` displayed

#### ✅ Test 2: Pending count badge

- Header shows red badge with pending count (e.g. `"5"`)
- Badge not shown if `pendingDocs.length === 0`

#### ✅ Test 3: Review drawer — Approve

1. Select a document → click **Review** → drawer opens
2. Click **Approve** → drawer closes → document disappears from list (moves to PUBLISHED)
3. Toast: "Document approved and published."

#### ✅ Test 4: Review drawer — Reject

1. Select another document → click **Review** → drawer opens
2. Click **Reject** → enter reason
3. Document disappears (moves to DRAFT)
4. Toast: "Document rejected."

#### ✅ Test 5: Empty state

- When no pending docs → displays EmptyState: "No pending approvals"

#### ✅ Test 6: Viewer cannot access `/approvals`

1. Login as `viewer1`
2. Navigate directly to `http://localhost:3006/approvals`

**Expected:** Inline message "You do not have permission to access approvals." (not a redirect, shown inline)

---

### 3.8 — Audit Page (`/audit`)

> Only `compliance_officer` and `admin` can access.

#### ✅ Test 1: Display audit events

1. Login as `co1`
2. Navigate to `/audit`
3. **Expected:** Audit events table with columns: timestamp, actor, action, resource, result

#### ✅ Test 2: Filter audit events

- Search by actor
- Filter by action type
- Filter by result (SUCCESS / DENY / ERROR)
- Date range picker

#### ✅ Test 3: Pagination

- Audit events are paginated
- Change page size

#### ✅ Test 4: Non-CO cannot access `/audit`

1. Login as `editor1`
2. Navigate to `http://localhost:3006/audit`

**Expected:** Inline message "You do not have permission to access audit logs." (not a redirect, shown inline)

---

### 3.9 — My Documents Page (`/my-documents`)

> Only `editor` and `admin` see this in the sidebar.

#### ✅ Test 1: RBAC — Sidebar nav

1. Login as `editor1` → sidebar shows **"My Documents"**
2. Login as `viewer1` → sidebar **DOES NOT** show "My Documents"
3. Login as `admin` → sidebar shows "My Documents"

#### ✅ Test 2: Only shows own documents

1. Login as `editor1`
2. Navigate to `/my-documents`
3. **Expected:** Only documents where `ownerId` matches `editor1`'s username
4. Documents from `admin` or other users → **DO NOT appear**

#### ✅ Test 3: Filter & Search work

- Search by title → correct results
- Filter by status (DRAFT, PENDING, PUBLISHED, ARCHIVED) → correct
- Filter by classification → correct
- Sort by `updatedAt` desc default

#### ✅ Test 4: Inline workflow actions

- On row: Submit (DRAFT), Approve (PENDING if approver/admin), Archive (PUBLISHED)
- Download works (calls presigned URL)
- Confirm dialog shows correctly

#### ✅ Test 5: Pagination

- When many docs → pagination shown at bottom of table
- Change page size works
- Page transitions preserve filters

#### ✅ Test 6: Empty state

- When no docs created yet → shows: **"You haven't created any documents yet."** + **"Create Document"** button
- When docs exist but filter doesn't match → shows: **"Try adjusting your filters."**

#### ✅ Test 7: "New Document" button on header

- Always shows **"New Document"** button on PageHeader → click → navigate to `/documents/new`

---

### 3.10 — Document Preview (`/documents/[id]`)

> Preview documents directly without downloading, using pdf.js.

#### ✅ Test 1: Preview button shows correctly by permission

- Document **PUBLISHED** or **ARCHIVED** → **"Preview"** button shown (if `canPreview=true`)
- Document **DRAFT** or **PENDING** → **"Preview"** button **NOT** shown
- `compliance_officer` only sees Preview for **PUBLIC** classification ⚠️

| Role | PUBLISHED (PUBLIC) | PUBLISHED (CONFIDENTIAL) | ARCHIVED |
|---|---|---|---|
| viewer | ✅ Preview | ✅ Preview | ✅ Preview |
| editor | ✅ Preview | ✅ Preview | ✅ Preview |
| approver | ✅ Preview | ✅ Preview | ✅ Preview |
| compliance_officer | ✅ Preview | ❌ Not shown | ❌ Not shown |
| admin | ✅ Preview | ✅ Preview | ✅ Preview |

#### ✅ Test 2: Preview PDF file

1. Open document with PDF file → click **"Preview"** on version card
2. **Expected:**
   - Dialog opens, shows loading spinner "Loading preview..."
   - PDF renders as images (per page) using pdf.js
   - Shows filename + version number in dialog header
   - No download button in dialog → **view only, cannot download** ✅

#### ✅ Test 3: Preview image file (PNG/JPEG/GIF/WebP)

1. Upload an image version → click Preview
2. **Expected:** Image displayed in dialog, fits in viewport

#### ✅ Test 4: Zoom controls

- **Zoom In (+)** button → zoom in (25% steps), max 300%
- **Zoom Out (−)** button → zoom out (25% steps), min 25%
- **Reset** button (shows %) → back to 100%
- **Ctrl + Scroll** (or Cmd + Scroll on Mac) → zoom in/out
- Zoom controls only shown in `pdf` or `image` state

#### ✅ Test 5: Close dialog

- Click **X** button → dialog closes
- Press **Escape** key → dialog closes

#### ✅ Test 6: Unsupported preview format

1. Upload `.docx` or `.xlsx` file → click Preview
2. **Expected:** Shows: **"This file cannot be previewed"**

#### ✅ Test 7: Preview timeout / error

1. Simulate slow network (DevTools → throttle **"Slow 3G"**) → click Preview
2. If takes over 20s → **Expected:** Shows error: **"Preview request timeout"**

#### ✅ Test 8: Prevent right-click download

- In preview dialog → right-click → **context menu blocked** (`onContextMenu preventDefault`)

---

### 3.11 — Profile Page (`/profile`)

> Replaces the old Settings page (`/settings`). Displays personal information from Keycloak.

#### ✅ Test 1: Display user info

1. Login as any account → navigate to `/profile`
2. **Expected:**
   - **Hero Card**: Avatar initials (2 letters), display name, username, role badges, "Active" status
   - **Account Information**: Username, Email, User ID, Authentication = "Keycloak SSO"
   - **Roles & Permissions**: Current role badges

#### ✅ Test 2: Loading state

- While fetching profile from Keycloak → avatar shows spinner, info shows skeleton

#### ✅ Test 3: Keycloak fallback

- If API `/api/users/profile` fails → fallback to session info
- Shows warning: **"Unable to connect to Keycloak. Information may be incomplete."**

#### ✅ Test 4: Read-only notice

- Bottom of page shows "Manage account on Keycloak" card with **"Read-only"** badge
- Guides user to update personal info on Keycloak Admin Console

#### ✅ Test 5: Per-role display check

| Login | DisplayName | Username | Roles |
|---|---|---|---|
| `viewer1` | (name from Keycloak) | viewer1 | `VIEWER` |
| `editor1` | (name from Keycloak) | editor1 | `EDITOR` |
| `approver1` | (name from Keycloak) | approver1 | `APPROVER` |
| `co1` | (name from Keycloak) | co1 | `COMPLIANCE_OFFICER` |
| `admin` | (name from Keycloak) | admin | `ADMIN` |

---

### 3.12 — Notifications (API module)

> Notification module has been scaffolded. Check basic API integration.

#### ✅ Test 1: API endpoint `/notify` responds

1. Login → open DevTools **Network tab**
2. Check if request `GET /api/notify` is sent
3. **Expected:** Response 200 with notifications array or empty array `[]`

#### ✅ Test 2: Mark all read

1. If unread notifications exist → call `POST /api/notify/mark-read`
2. **Expected:** Response `{ "ok": true }`

> **Note:** Notification bell/panel UI may not be fully implemented yet, test focuses on API response.

---

## 4. Responsive & UI Testing

| Device | Check |
|---|---|
| Desktop (≥1024px) | Sidebar visible, 3-column layout (documents detail) |
| Tablet (768–1023px) | Sidebar collapsible |
| Mobile (<768px) | Sidebar hidden, hamburger menu, single column |

---

## 5. Test Edge Cases

### ✅ Session expired → automatic logout

1. Login → session saved to localStorage key `docvault_session`
2. Open DevTools → delete `docvault_session` from localStorage
3. Refresh `/dashboard`

**Expected:** Loading state → redirect to `/login`

### ✅ Network error when calling API

1. Open DevTools → **Network tab** → throttle **"Offline"**
2. Refresh `/dashboard`

**Expected:** ErrorState displayed with **"Retry"** button

### ✅ Document does not exist

1. Navigate to `http://localhost:3006/documents/00000000-0000-0000-0000-000000000000`

**Expected:** ErrorState with "Failed to load document." and Retry button

### ✅ Toast messages match each action

| Action | Success Toast |
|---|---|
| Create document | "Document created successfully." |
| Update document | "Document updated successfully." |
| Submit | "Document submitted for approval." |
| Approve | "Document approved and published." |
| Reject | "Document rejected." |
| Archive | "Document archived." |
| Version upload | "Version uploaded successfully." |

### ✅ 409 Conflict handling

- Submit DRAFT fails (already PENDING) → Toast: `"Document is no longer in a submittable state."`
- Approve non-PENDING → Toast: `"Document is no longer pending approval."`
- Archive non-PUBLISHED → Toast: `"Document cannot be archived in its current state."`

### ✅ 403 Forbidden handling

- Forbidden action → Toast: `"You do not have permission to perform this action."`

---

## 6. Summary Results Table

| # | Test Case | Role | Expected | Pass |
|---|---|---|---|---|
| 1 | SSO login → dashboard | any | ✅ Redirect OK | ⬜ |
| 2 | SSO error → inline error | any | ✅ Error displayed | ⬜ |
| 3 | Not logged in → /dashboard | — | ✅ Redirect /login | ⬜ |
| 4 | Dashboard stat cards | editor | ✅ Correct display | ⬜ |
| 5 | Viewer: "New Document" hidden | viewer | ✅ Not visible | ⬜ |
| 6 | Approver: "Review Approvals" visible | approver | ✅ Menu shows + badge | ⬜ |
| 7 | CO: "Audit Logs" visible | co | ✅ Menu shows | ⬜ |
| 8 | Role badge displays correctly | all | ✅ Badge matches role | ⬜ |
| 9 | Create new document | editor | ✅ 201 + redirect | ⬜ |
| 10 | Validation: empty title | editor | ✅ Error displayed | ⬜ |
| 11 | Create + upload file simultaneously | editor | ✅ Doc + version | ⬜ |
| 12 | Create succeeds, upload fails | editor | ✅ 2 toasts + redirect | ⬜ |
| 13 | Submit (DRAFT→PENDING) | editor | ✅ Status changes | ⬜ |
| 14 | Approve (PENDING→PUBLISHED) | approver | ✅ publishedAt set | ⬜ |
| 15 | Reject with reason | approver | ✅ DRAFT + reason in timeline | ⬜ |
| 16 | Archive (PUBLISHED→ARCHIVED) | editor | ✅ archivedAt set | ⬜ |
| 17 | CO: cannot download | co | ✅ Button hidden/disabled | ⬜ |
| 18 | Editor: edit own doc (DRAFT) | editor | ✅ OK | ⬜ |
| 19 | Editor: edit own doc (non-DRAFT) | editor | ✅ Inline error | ⬜ |
| 20 | Editor: cannot edit others' doc | editor | ✅ Inline error | ⬜ |
| 21 | Admin: edit others' doc | admin | ✅ OK | ⬜ |
| 22 | Approvals page: PENDING list | approver | ✅ Correct docs | ⬜ |
| 23 | Approvals: pending count badge | approver | ✅ Badge shows correct number | ⬜ |
| 24 | Approvals: Review drawer approve | approver | ✅ Doc disappears | ⬜ |
| 25 | Approvals: Review drawer reject | approver | ✅ Doc disappears + reason | ⬜ |
| 26 | Viewer accesses /approvals | viewer | ✅ Inline error | ⬜ |
| 27 | Audit page: events list | co | ✅ Displays | ⬜ |
| 28 | Audit: filters work | co | ✅ Correct filtering | ⬜ |
| 29 | Viewer accesses /audit | viewer | ✅ Inline error | ⬜ |
| 30 | Download presigned URL | viewer | ✅ File downloads | ⬜ |
| 31 | Upload file > 20MB | editor | ✅ 413 toast | ⬜ |
| 32 | 409 Conflict handling | editor | ✅ Correct message | ⬜ |
| 33 | 403 Forbidden handling | viewer | ✅ Toast shown | ⬜ |
| 34 | Session expired | any | ✅ Redirect /login | ⬜ |
| 35 | Network offline | any | ✅ ErrorState + Retry | ⬜ |
| 36 | Document not found | any | ✅ ErrorState | ⬜ |
| 37 | Mobile responsive | all | ✅ Layout OK | ⬜ |
| | **— My Documents —** | | | |
| 38 | My Documents: sidebar nav RBAC | editor/admin | ✅ Visible | ⬜ |
| 39 | My Documents: only own docs | editor | ✅ Filtered by owner | ⬜ |
| 40 | My Documents: filter & search | editor | ✅ Correct results | ⬜ |
| 41 | My Documents: pagination | editor | ✅ Page navigation OK | ⬜ |
| 42 | My Documents: empty state | editor | ✅ Correct message | ⬜ |
| 43 | My Documents: inline actions | editor | ✅ Submit/Archive OK | ⬜ |
| | **— Document Preview —** | | | |
| 44 | Preview PDF: render pages | editor | ✅ Pages displayed | ⬜ |
| 45 | Preview Image: display image | editor | ✅ Image shown | ⬜ |
| 46 | Preview: zoom controls | any | ✅ Zoom in/out/reset | ⬜ |
| 47 | Preview: CO only PUBLIC | co | ✅ Non-PUBLIC hidden | ⬜ |
| 48 | Preview: unsupported format | any | ✅ Unsupported msg | ⬜ |
| 49 | Preview: prevent right-click | any | ✅ Context menu blocked | ⬜ |
| 50 | Preview: close (X / Escape) | any | ✅ Dialog closes | ⬜ |
| | **— Profile —** | | | |
| 51 | Profile: display user info | all | ✅ Avatar + info | ⬜ |
| 52 | Profile: Keycloak fallback | all | ✅ Warning shown | ⬜ |
| 53 | Profile: role badges correct | all | ✅ Badges match role | ⬜ |

---

## 7. After Frontend Tests Complete

Run E2E script to confirm backend + frontend integration:

```bash
# Make sure all services + infra are running
node scripts/e2e-check.mjs
```

If all tests are ✅ → **MVP complete!** 🎉
