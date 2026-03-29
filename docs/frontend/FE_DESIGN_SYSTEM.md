# DocVault FE Design System & UI Specification

Updated: 2026-03-15

## 1) Design Goals

FE design for DocVault must simultaneously convey 3 qualities:
- **Secure and trustworthy**: UI must feel like an internal document management system, not a casual file-sharing app.
- **Clear business status**: users glance at a document and immediately know if it is `DRAFT`, `PENDING`, `PUBLISHED`, or `ARCHIVED`.
- **Operational efficiency**: main flows must be fast, few clicks, suitable for MVP demo.

Recommended style:
- Modern enterprise UI
- Clean, spacious, low-noise
- Light backgrounds for readability, highlighted with navy/slate blue
- Status and classification use distinct colors but are restrained

---

## 2) Overall Visual Direction

### Brand Feeling
- Keywords: **Secure, Professional, Calm, Structured, Trustworthy**
- Avoid: overly flashy, heavy gradients, glassmorphism, or overly glossy cards
- Use: moderate border radius (`12px`–`16px`), light shadows, clear borders

### Layout Principles
- App shell 3 parts:
  - **Left sidebar**: main navigation
  - **Topbar**: search, role badge, user menu
  - **Content area**: page header + content body
- Use grid/card/list as appropriate, prioritize consistency over diversity
- Moderate whitespace to convey a "premium enterprise" feel

### Typography Principles
- Clear heading hierarchy, modern sans-serif
- Recommended fonts:
  - `Inter` for main text
  - fallback: `ui-sans-serif, system-ui, sans-serif`
- Reference sizes:
  - Page title: 28/32 semibold
  - Section title: 20/28 semibold
  - Card title: 16/24 semibold
  - Body: 14/22 regular
  - Caption/meta: 12/18 medium

---

## 3) FE MVP Sitemap

## Public/Auth
- `/login`

## App (authenticated)
- `/dashboard`
- `/documents`
- `/documents/new`
- `/documents/[id]`
- `/documents/[id]/edit`
- `/approvals`
- `/audit`
- `/profile` (lightweight optional)

---

## 4) Navigation by Role

### Viewer
Sees:
- Dashboard
- Documents
- Document Detail

Does not see:
- New Document
- Approvals
- Audit
- ACL management

### Editor
Sees:
- Dashboard
- Documents
- New Document
- Document Detail
- Edit Document

Can:
- create metadata
- upload files
- edit metadata when owner
- submit workflow
- manage basic ACL if owner

### Approver
Sees:
- Dashboard
- Documents
- Approvals
- Document Detail

Can:
- approve / reject
- archive published doc

### Compliance Officer
Sees:
- Dashboard
- Documents
- Document Detail
- Audit

Does not have a download button despite being able to read metadata.

### Admin
Sees everything.

---

## 5) Screen Details

## 5.1 Dashboard

### Goal
Let the user quickly see the system status by role.

### Components
- Small hero header: "Welcome back" + role badge
- 4 stat cards:
  - Total Documents
  - Draft
  - Pending Approval
  - Published
- Recent activity panel
- Recent documents table/list
- Quick actions

### Quick actions by role
- Viewer: View documents
- Editor: New document, Continue drafts
- Approver: Review pending approvals
- Compliance Officer: Open audit logs

### UI notes
- Dashboard should not have too many charts
- 1 mini trend chart is enough, or skip charts entirely if MVP data is minimal
- Focus on cards + recent items + actions

---

## 5.2 Documents List

### Goal
Most important screen. Must give the "document control center" feel.

### Header
- Title: `Documents`
- Short subtitle: manage and search documents
- Right CTA: `New Document` (editor/admin only)

### Toolbar
- Search input by title/tag/owner (if backend doesn't have real search yet, mock UI first)
- Filter chips / selects:
  - Status
  - Classification
  - Tag
  - Ownership scope (Mine / All) if needed
- Sort dropdown
- View toggle: table / card (optional, table is default)

### Table columns
- Title
- Classification
- Tags
- Status
- Current Version
- Owner
- Updated At
- Actions

### Suggested row actions
- View
- Edit (owner/editor/admin)
- Download (when allowed)
- Submit (editor owner, status DRAFT)
- Approve/Reject (at approvals page preferably, but can show lightly in detail)
- Archive (approver/admin when published)

### UX notes
- Status badge must be very clear
- Classification badge smaller than status badge
- Tags should not take up too much horizontal space
- Empty state: folder-lock icon + clear CTA

---

## 5.3 Create New Document

### Goal
Create a new document quickly with minimal friction.

### Form sections
1. Basic Info
- Title
- Description

2. Security Metadata
- Classification
- Tags

3. Initial File Upload
- Drag & drop zone
- File name / size / content type preview

4. Access Control (optional for MVP, can be split into a later step)
- Basic ACL entries

### Form CTAs
- Save Draft
- Save and Upload
- Cancel

### UX notes
- Light step feel is fine but still one page
- No rigid multi-step wizard needed for MVP
- Upload zone should be very clear and prominent since it's a central operation

---

## 5.4 Document Detail

### Goal
This is the central business screen.

### Recommended layout
Two-column page:
- **Left column (main)**: metadata + versions + workflow history
- **Right column (side panel)**: status card + actions card + ACL summary

### Main content
1. Document header
- Title
- Description
- Status badge
- Classification badge
- Tags
- Owner / createdAt / updatedAt

2. Version history
- Version list as timeline or card list
- Each version has filename, size, truncated checksum, uploaded by, createdAt
- Download action on current version if allowed

3. Workflow history
- Vertical timeline
- fromStatus → toStatus
- action, actorId, reason, createdAt

### Side panel
1. Status summary card
- Current status
- Published date / Archived date
- Current version

2. Actions card
By role and status:
- DRAFT + owner/editor: Edit, Upload new file, Submit
- PENDING + approver: Approve, Reject
- PUBLISHED + allowed: Download
- PUBLISHED + approver/admin: Archive
- Compliance officer: Download button not shown

3. ACL summary card
- Number of rules
- Preview of first 3 rules
- Manage ACL button if role permits

### UX notes
- All dangerous actions must have a confirm modal
- Reject requires a modal for entering reason
- Archive requires a brief confirm modal

---

## 5.5 Approvals

### Goal
Working screen for approvers.

### Structure
- Title + subtitle
- Filter bar: classification, owner, updatedAt
- Pending queue list/table

### Table columns
- Title
- Owner
- Classification
- Submitted At (use updatedAt temporarily if no separate field)
- Current Version
- Actions

### Actions
- Review
- Approve
- Reject

### Review drawer/modal
A side drawer for quick review is recommended:
- metadata
- version summary
- short workflow history
- approve/reject buttons right in the drawer

---

## 5.6 Audit

### Goal
Let compliance officers easily search readable, trustworthy operation history.

### Header
- Title: `Audit Logs`
- Subtitle: query system activity

### Filters
- Date range
- Actor/User
- Action
- Result
- Resource type/id (if expanded)

### Result table
- Timestamp
- Actor
- Action
- Resource
- Result
- IP / light metadata
- Hash indicator (optional: show integrity icon)

### UX notes
- Design leans toward clean, serious data table
- Avoid overdoing "security dashboard" with too many mock charts
- Can add a "Tamper-evident logs" badge in the top-right to increase trustworthiness

---

## 5.7 Login

### Goal
Simple, attractive, properly enterprise.

### Layout
- Left: brand panel with short DocVault description
- Right: login card

### Content
- Logo / product name
- Headline: `Secure document control for internal teams`
- Username/password form or SSO button if going through Keycloak redirect

### Visual notes
- Light background + very subtle abstract pattern
- No overly playful illustrations

---

## 6) Badge System

## Status Badges
- `DRAFT`: neutral / slate
- `PENDING`: amber
- `PUBLISHED`: green
- `ARCHIVED`: gray

## Classification Badges
- `PUBLIC`: light blue-gray
- `INTERNAL`: blue
- `CONFIDENTIAL`: orange
- `SECRET`: red

## Role Badges
- `viewer`: neutral
- `editor`: blue
- `approver`: violet
- `compliance_officer`: red-slate
- `admin`: dark navy

---

## 7) Component Inventory

## Core Layout
- AppShell
- SidebarNav
- Topbar
- Breadcrumbs
- PageHeader

## Data Display
- StatCard
- DataTable
- EmptyState
- StatusBadge
- ClassificationBadge
- TagChip
- Timeline
- DetailList

## Forms
- TextInput
- TextArea
- Select
- MultiTagInput
- FileDropzone
- ACLRuleRow

## Feedback
- Toast
- InlineAlert
- ConfirmDialog
- RejectReasonDialog
- Skeleton loaders
- PermissionDeniedState

## Domain Components
- DocumentListTable
- DocumentSummaryCard
- VersionList
- WorkflowTimeline
- ACLSummaryCard
- ApprovalQueueTable
- AuditLogTable

---

## 8) Key Interaction States

### Loading
- List page: skeleton rows
- Detail page: skeleton header + side card
- Buttons have their own loading state

### Empty
- Documents empty
- Approvals empty
- Audit empty

### Error
- 401: session expired → redirect login
- 403: show a polite permission message, not too technical
- 404: document not found
- 500: generic retry state

### Success Messaging
- `Document created successfully`
- `File uploaded successfully`
- `Submitted for approval`
- `Document approved`
- `Document rejected`
- `Download link generated`

---

## 9) RBAC UI Matrix

## Documents List
- Viewer: view, maybe download when published
- Editor: create, edit own, submit own
- Approver: view, go to approvals
- Compliance Officer: view only, no download
- Admin: all

## Detail
- Download button only shown if role + policy allow
- Approve/Reject only shown at `PENDING` for approver/admin
- Submit only shown at `DRAFT` for owner/editor/admin
- Archive only shown at `PUBLISHED` for approver/admin

## Audit
- Compliance_officer/admin only

## ACL
- Editor owner/admin

---

## 10) Recommended UI Tech Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- shadcn/ui for primitive components
- Lucide icons
- TanStack Table for tables
- React Hook Form + Zod for forms
- Zustand or TanStack Query + local state per project style

---

## 11) Color Principles in UI

- 70–80% of UI uses neutral palette
- Brand color only used for primary CTA, links, active nav, focus ring
- Status colors only used for badges, alerts, action emphasis
- Background should have many light layers instead of dark ones
- Avoid using red too much — only for `SECRET`, destructive, compliance accent

---

## 12) Short Prompt for AI Agent Building UI

Build the FE for DocVault in a modern enterprise dashboard style, clean, spacious, secure-by-design. Main color tone is navy/slate on a light background, with clear status and document classification badges. Left sidebar, compact topbar, wide content area. Prioritize readability, clear cards/tables, moderate border radius, light shadows, Inter typography. Required pages: Dashboard, Documents List, New Document, Document Detail, Approvals, Audit Logs, Login. UI must correctly reflect RBAC and actual workflow: `DRAFT -> PENDING -> PUBLISHED -> ARCHIVED`, reject returns to `DRAFT`, compliance officer views audit/metadata but has no download.
