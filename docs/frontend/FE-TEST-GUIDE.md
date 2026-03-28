# FE Test Guide — DocVault Web

## 1. Khởi động

### Bước 1.1 — Verify backend đang chạy

```bash
curl http://localhost:3000/health
# → {"status":"ok","service":"gateway"}
```

### Bước 1.2 — Khởi động frontend

```bash
cd apps/web
pnpm dev
```

Frontend chạy tại **http://localhost:3006** (Next.js default port, khác với backend gateway :3000).

> Nếu truy cập từ máy khác trong LAN, cần sửa env trước khi chạy:
>
> ```bash
> NEXT_PUBLIC_API_BASE_URL=http://<LAN_IP>:3000/api pnpm dev
> ```

---

## 2. Kiểm tra biến môi trường

Mở `apps/web/.env`:

```env
NEXT_PUBLIC_APP_NAME=DocVault
NEXT_PUBLIC_API_BASE_URL=http://localhost:3000/api
FRONTEND_URL=http://localhost:3006
KEYCLOAK_BASE_URL=http://localhost:8080
KEYCLOAK_REALM=docvault
KEYCLOAK_CLIENT_ID=docvault-gateway
KEYCLOAK_CLIENT_SECRET=dev-gateway-secret
```

> **Lưu ý:** Frontend chạy trên port **3006**, backend gateway trên **3000**. Gateway prefix `/api` đã được backend xử lý — `.env` chỉ cần đúng như trên.

---

## 3. Test từng trang theo Role

### 3.1 — Login Page (`/login`)

Mở trình duyệt → **http://localhost:3006/login**

#### ✅ Test 1: SSO Login (Production/OIDC flow)

1. Nhấn **"Sign in with SSO"**
2. Browser redirect sang Keycloak login page
3. Đăng nhập bằng Keycloak credentials → redirect về `/login?auth=ok`
4. Session được lưu vào localStorage → redirect sang `/dashboard`

**Demo accounts (Keycloak realm `docvault`):**

| Username | Password | Role |
|---|---|---|
| `viewer1` | `Passw0rd!` | viewer |
| `editor1` | `Passw0rd!` | editor |
| `approver1` | `Passw0rd!` | approver |
| `co1` | `Passw0rd!` | compliance_officer |
| `admin` | `Passw0rd!` | admin |

#### ✅ Test 2: Callback error handling

- Khi Keycloak trả `?error=access_denied` → hiển thị toast lỗi `Login failed: access_denied`
- URL được clean về `/login`

#### ✅ Test 3: Chưa login → không vào được `/dashboard`

1. Mở **tab ẩn danh**
2. Gõ thẳng `http://localhost:3006/dashboard`

**Kỳ vọng:**
- Hiển thị loading state "Signing you in..." trong ~1 frame
- Redirect về `/login`

---

### 3.2 — Dashboard (`/dashboard`)

Sau khi login với `editor1`:

#### ✅ Test 1: Stat cards hiển thị đúng

| Card | Giá trị |
|---|---|
| Total Documents | Tổng số docs |
| Draft | Số docs `status=DRAFT` |
| Pending Approval | Số docs `status=PENDING` |
| Published | Số docs `status=PUBLISHED` |

#### ✅ Test 2: Recent Documents list

- Hiển thị đúng thứ tự **mới nhất lên đầu** (sort by `updatedAt` desc, slice 5)
- Mỗi item click → sang `/documents/[id]`
- Empty state: `"No documents yet."`

#### ✅ Test 3: Quick Actions theo role

| Role | Quick Actions thấy được |
|---|---|
| `viewer` | Browse Documents |
| `editor` | Browse Documents + Create Document + My Documents |
| `approver` | Browse Documents + Review Approvals (+ badge số pending) |
| `compliance_officer` | Browse Documents + Audit Logs |
| `admin` | Tất cả action (bao gồm My Documents) |

#### ✅ Test 4: Role Badge trên header

Góc phải PageHeader → badge hiển thị đúng role hiện tại (VD: `"EDITOR"`, `"APPROVER"`)

---

### 3.3 — Documents List (`/documents`)

Truy cập `/documents` (hoặc click "Browse Documents" trên Dashboard)

#### ✅ Test 1: Danh sách documents

- Table hiển thị đúng các documents (columns: title, status badge, classification badge, updatedAt)
- Click row → sang trang chi tiết

#### ✅ Test 2: Filter theo status

| Filter | Kỳ vọng |
|---|---|
| All | Tất cả docs |
| Draft | Chỉ DRAFT |
| Pending | Chỉ PENDING |
| Published | Chỉ PUBLISHED |
| Archived | Chỉ ARCHIVED |

#### ✅ Test 3: Sorting

- Click column header → toggle asc/desc
- Mặc định sort `updatedAt` desc

#### ✅ Test 4: RBAC — Viewer không thấy nút tạo mới

Đăng nhập `viewer` → vào `/documents`

**Kỳ vọng:** Không có nút "New Document"

#### ✅ Test 5: Inline workflow actions

| Role | Actions trên row |
|---|---|
| editor (owner, DRAFT) | Submit |
| editor (owner, PUBLISHED) | Archive |
| approver (PENDING) | Approve, Reject |
| viewer | Download |

#### ✅ Test 6: Confirm dialogs

- Submit: dialog "Send this document for approval?"
- Approve: dialog "This document will be published."
- Reject: dialog với textarea nhập reason
- Archive: dialog "Document will be archived."

---

### 3.4 — Create Document (`/documents/new`)

> Chỉ `editor` và `admin` mới vào được trang này.

#### ✅ Test 1: RBAC — Editor không sở hữu → vào được trang

1. Đăng nhập `editor1`
2. Vào `/documents/new`
3. **Kỳ vọng:** Form hiển thị bình thường (tạo doc mới, không phải edit doc có sẵn)

#### ✅ Test 2: Form validation

- Để trống `title` → submit → lỗi **"Title is required"** (React Hook Form)
- Classification bắt buộc, mặc định `INTERNAL`
- Tags là multi-select

#### ✅ Test 3: Tạo document thành công

Điền form:

```json
{
  "title": "Chính sách Bảo mật Q1/2026",
  "description": "Bản draft chính sách bảo mật quý 1 năm 2026",
  "classification": "CONFIDENTIAL",
  "tags": ["security", "policy"]
}
```

Submit → redirect sang `/documents/[id]` mới tạo
- Status = **DRAFT**
- Owner = user hiện tại

#### ✅ Test 4: Tạo + upload file cùng lúc

- Chọn file trong dropzone trước khi submit
- Submit → document tạo → file upload → redirect → version hiển thị

#### ✅ Test 5: Tạo thành công nhưng upload file thất bại

- Chọn file nhưng API upload lỗi
- → Toast success "Document created successfully." + Toast error "Document created, but file upload failed: ..."
- → Vẫn redirect sang detail page

#### ✅ Test 6: Upload file > 20MB

- Tạo file test 25MB
- Thử upload → **Kỳ vọng:** Toast lỗi `413 Payload Too Large`

---

### 3.5 — Document Detail (`/documents/[id]`)

Vào trang chi tiết của một document đã tạo.

#### ✅ Test 1: Header — thông tin document

Title, description, classification badge, status badge, tags, owner info, created/updated timestamps

#### ✅ Test 2: Versions Card

- Danh sách các version đã upload
- Mỗi version: filename, size, checksum, createdAt
- Nút **"Download"** → tải file về (nếu `canDownload=true`)

#### ✅ Test 3: Workflow Timeline

- Hiển thị lịch sử: submit, approve, reject, archive
- Mỗi bước: actor, timestamp, action, reason (nếu có reject)

#### ✅ Test 4: ACL Card (nếu có quyền)

- `canReadAcl` (`editor`, `approver`, `compliance_officer`, `admin`) → thấy ACL card
- Owner hoặc admin → thấy nút **"Add Access"**

#### ✅ Test 5: Action Panel (theo status & role)

| Trạng thái | Role | Actions hiển thị |
|---|---|---|
| DRAFT | editor (owner) | Submit, Edit |
| DRAFT | viewer | Không có action |
| PENDING | approver | Approve, Reject (với input reason) |
| PENDING | editor | Không có action |
| PUBLISHED | viewer/editor | Download, Archive |
| ARCHIVED | (tất cả) | Chỉ xem |
| PUBLISHED/ARCHIVED | viewer/editor/approver/admin | Preview (nếu `canPreview=true`) |
| PUBLISHED/ARCHIVED | co (chỉ PUBLIC classification) | Preview |

#### ✅ Test 6: Submit document (DRAFT → PENDING)

1. Document ở **DRAFT**, đăng nhập `editor1` (owner)
2. Nhấn **Submit** → Confirm dialog → Submit
3. Status đổi → **PENDING**
4. Timeline thêm bước **SUBMIT**

#### ✅ Test 7: Approve document (PENDING → PUBLISHED)

1. Document ở **PENDING**
2. Đăng nhập `approver1`
3. Vào document → nhấn **Approve**
4. Status đổi → **PUBLISHED**
5. Timeline thêm bước **APPROVE**

#### ✅ Test 8: Reject document với lý do (PENDING → DRAFT)

1. Document ở **PENDING**
2. Nhấn **Reject**
3. Nhập reason: `"Thiếu mục lục, cần bổ sung"`
4. Status đổi → **DRAFT**
5. Timeline ghi nhận reason

#### ✅ Test 9: Download file — compliance_officer bị cấm ⚠️

> **Test bảo mật quan trọng nhất của frontend!**

1. Đăng nhập `co1` (`compliance_officer`)
2. Vào một document đã **PUBLISHED**
3. `canDownload = false` cho CO (enforced ở `permissions.ts`)

**Kỳ vọng:**
- Metadata + workflow timeline → xem được ✅
- Nút **Download → KHÔNG hiển thị** hoặc bị **disabled** ❌

---

### 3.6 — Edit Document (`/documents/[id]/edit`)

#### ✅ Test 1: Editor sở hữu (DRAFT) → được sửa

1. Đăng nhập `editor1`
2. Vào document của `editor1` (DRAFT) → nhấn **Edit**
3. Sửa title/description → **Save Changes**
4. **Kỳ vọng:** Cập nhật thành công, quay lại detail

#### ✅ Test 2: Editor sở hữu nhưng không phải DRAFT → không sửa được

1. Đăng nhập `editor1`
2. Vào document của `editor1` đã ở **PENDING** hoặc **PUBLISHED**
3. Nhấn **Edit**

**Kỳ vọng:** Inline error message "You do not have permission to edit this document."

#### ✅ Test 3: Editor không sở hữu → không sửa được

1. Đăng nhập `editor1`
2. Vào document của `admin` → nhấn **Edit**
3. **Kỳ vọng:** Inline error message "You do not have permission to edit this document."

#### ✅ Test 4: Admin luôn được sửa (bất kể owner)

1. Đăng nhập `admin`
2. Vào document của `editor1` (DRAFT)
3. Nhấn **Edit**

**Kỳ vọng:** Form sửa hiển thị bình thường

---

### 3.7 — Approvals Page (`/approvals`)

> Chỉ `approver` và `admin` mới vào được.

#### ✅ Test 1: Hiển thị danh sách PENDING

1. Đăng nhập `approver1`
2. Vào `/approvals`
3. **Kỳ vọng:** Chỉ hiển thị documents có `status=PENDING`

#### ✅ Test 2: Badge số lượng pending

- Header hiển thị badge đỏ với số pending (VD: `"5"`)
- Badge không hiển thị nếu `pendingDocs.length === 0`

#### ✅ Test 3: Review drawer — Approve

1. Chọn 1 document → nhấn **Review** → drawer mở
2. Nhấn **Approve** → drawer đóng → document biến mất khỏi danh sách (chuyển sang PUBLISHED)
3. Toast: "Document approved and published."

#### ✅ Test 4: Review drawer — Reject

1. Chọn 1 document khác → nhấn **Review** → drawer mở
2. Nhấn **Reject** → nhập reason
3. Document biến mất (chuyển sang DRAFT)
4. Toast: "Document rejected."

#### ✅ Test 5: Empty state

- Khi không có pending docs → hiển thị EmptyState: "No pending approvals"

#### ✅ Test 6: Viewer không vào được `/approvals`

1. Đăng nhập `viewer1`
2. Gõ thẳng `http://localhost:3006/approvals`

**Kỳ vọng:** Inline message "You do not have permission to access approvals." (không redirect, hiển thị inline)

---

### 3.8 — Audit Page (`/audit`)

> Chỉ `compliance_officer` và `admin` mới vào được.

#### ✅ Test 1: Hiển thị audit events

1. Đăng nhập `co1`
2. Vào `/audit`
3. **Kỳ vọng:** Bảng audit events với các cột: timestamp, actor, action, resource, result

#### ✅ Test 2: Filter audit events

- Tìm kiếm theo actor
- Filter theo action type
- Filter theo result (SUCCESS / DENY / ERROR)
- Date range picker

#### ✅ Test 3: Pagination

- Audit events được paginate
- Thay đổi page size

#### ✅ Test 4: Non-CO không vào được `/audit`

1. Đăng nhập `editor1`
2. Gõ `http://localhost:3006/audit`

**Kỳ vọng:** Inline message "You do not have permission to access audit logs." (không redirect, hiển thị inline)

---

### 3.9 — My Documents Page (`/my-documents`)

> Chỉ `editor` và `admin` nhìn thấy trong sidebar.

#### ✅ Test 1: RBAC — Sidebar nav

1. Đăng nhập `editor1` → sidebar hiển thị mục **"My Documents"**
2. Đăng nhập `viewer1` → sidebar **KHÔNG** hiển thị "My Documents"
3. Đăng nhập `admin` → sidebar hiển thị "My Documents"

#### ✅ Test 2: Chỉ hiển thị documents của mình

1. Đăng nhập `editor1`
2. Vào `/my-documents`
3. **Kỳ vọng:** Chỉ hiển thị docs mà `ownerId` trùng với username của `editor1`
4. Docs của `admin` hoặc user khác → **KHÔNG xuất hiện**

#### ✅ Test 3: Filter & Search hoạt động

- Tìm kiếm theo title → đúng kết quả
- Filter theo status (DRAFT, PENDING, PUBLISHED, ARCHIVED) → đúng
- Filter theo classification → đúng
- Sort theo `updatedAt` desc mặc định

#### ✅ Test 4: Inline workflow actions

- Trên row: Submit (DRAFT), Approve (PENDING nếu là approver/admin), Archive (PUBLISHED)
- Download hoạt động (gọi presigned URL)
- Confirm dialog hiển thị đúng

#### ✅ Test 5: Pagination

- Khi có nhiều docs → pagination hiển thị ở cuối table
- Thay đổi page size hoạt động
- Chuyển page giữ filter

#### ✅ Test 6: Empty state

- Khi chưa tạo doc nào → hiển thị: **"You haven't created any documents yet."** + nút **"Create Document"**
- Khi có docs nhưng filter không khớp → hiển thị: **"Try adjusting your filters."**

#### ✅ Test 7: Nút "New Document" trên header

- Luôn hiển thị nút **"New Document"** trên PageHeader → click → sang `/documents/new`

---

### 3.10 — Document Preview (`/documents/[id]`)

> Tính năng preview tài liệu trực tiếp không cần download, sử dụng pdf.js.

#### ✅ Test 1: Nút Preview hiển thị đúng quyền

- Document **PUBLISHED** hoặc **ARCHIVED** → nút **"Preview"** hiển thị (nếu `canPreview=true`)
- Document **DRAFT** hoặc **PENDING** → nút **"Preview"** **KHÔNG** hiển thị
- `compliance_officer` chỉ thấy Preview cho classification **PUBLIC** ⚠️

| Role | PUBLISHED (PUBLIC) | PUBLISHED (CONFIDENTIAL) | ARCHIVED |
|---|---|---|---|
| viewer | ✅ Preview | ✅ Preview | ✅ Preview |
| editor | ✅ Preview | ✅ Preview | ✅ Preview |
| approver | ✅ Preview | ✅ Preview | ✅ Preview |
| compliance_officer | ✅ Preview | ❌ Không thấy | ❌ Không thấy |
| admin | ✅ Preview | ✅ Preview | ✅ Preview |

#### ✅ Test 2: Preview file PDF

1. Vào document có file PDF → nhấn **"Preview"** trên version card
2. **Kỳ vọng:**
   - Dialog mở ra, hiển thị loading spinner "Đang tải preview..."
   - PDF render thành ảnh (từng trang) bằng pdf.js
   - Hiển thị tên file + version number trên header dialog
   - Không có nút download trong dialog → **chỉ xem, không tải** ✅

#### ✅ Test 3: Preview file ảnh (PNG/JPEG/GIF/WebP)

1. Upload 1 version file ảnh → nhấn Preview
2. **Kỳ vọng:** Ảnh hiển thị trong dialog, fit trong viewport

#### ✅ Test 4: Zoom controls

- Nút **Zoom In (+)** → phóng to (bước 25%), tối đa 300%
- Nút **Zoom Out (−)** → thu nhỏ (bước 25%), tối thiểu 25%
- Nút **Reset** (hiển thị %) → quay về 100%
- **Ctrl + Scroll** (hoặc Cmd + Scroll trên Mac) → zoom in/out
- Zoom controls chỉ hiển thị khi đang ở trạng thái `pdf` hoặc `image`

#### ✅ Test 5: Đóng dialog

- Nhấn nút **X** → dialog đóng
- Nhấn phím **Escape** → dialog đóng

#### ✅ Test 6: File không hỗ trợ preview

1. Upload file `.docx` hoặc `.xlsx` → nhấn Preview
2. **Kỳ vọng:** Hiển thị: **"Preview không khả dụng cho loại file này"**

#### ✅ Test 7: Preview timeout / lỗi

1. Mô phỏng network chậm (DevTools → throttle **"Slow 3G"**) → nhấn Preview
2. Nếu quá 20s → **Kỳ vọng:** Hiển thị lỗi: **"Preview request timeout"**

#### ✅ Test 8: Chống click-chuột-phải download

- Trong dialog preview → click chuột phải → **context menu bị chặn** (`onContextMenu preventDefault`)

---

### 3.11 — Profile Page (`/profile`)

> Thay thế trang Settings cũ (`/settings`). Hiển thị thông tin cá nhân từ Keycloak.

#### ✅ Test 1: Hiển thị thông tin user

1. Đăng nhập bất kỳ account → vào `/profile`
2. **Kỳ vọng:**
   - **Hero Card**: Avatar initials (2 chữ đầu), tên hiển thị, username, role badges, status "Active"
   - **Thông tin tài khoản**: Username, Email, User ID, Xác thực = "Keycloak SSO"
   - **Vai trò & quyền hạn**: Các role badges hiện tại

#### ✅ Test 2: Loading state

- Khi đang fetch profile từ Keycloak → avatar hiển thị spinner, info hiển thị skeleton

#### ✅ Test 3: Keycloak fallback

- Nếu API `/api/users/profile` lỗi → fallback về thông tin từ session
- Hiển thị warning: **"Không thể kết nối Keycloak. Thông tin có thể không đầy đủ."**

#### ✅ Test 4: Thông báo Read-only

- Cuối trang hiển thị card "Quản lý tài khoản trên Keycloak" với badge **"Read-only"**
- Hướng dẫn user đổi thông tin cá nhân trên Keycloak Admin Console

#### ✅ Test 5: Kiểm tra từng role

| Login | DisplayName | Username | Roles |
|---|---|---|---|
| `viewer1` | (tên từ Keycloak) | viewer1 | `VIEWER` |
| `editor1` | (tên từ Keycloak) | editor1 | `EDITOR` |
| `approver1` | (tên từ Keycloak) | approver1 | `APPROVER` |
| `co1` | (tên từ Keycloak) | co1 | `COMPLIANCE_OFFICER` |
| `admin` | (tên từ Keycloak) | admin | `ADMIN` |

---

### 3.12 — Notifications (API module)

> Module notifications đã được scaffold. Kiểm tra API integration cơ bản.

#### ✅ Test 1: API endpoint `/notify` phản hồi

1. Đăng nhập → mở DevTools **Network tab**
2. Kiểm tra request `GET /api/notify` được gửi
3. **Kỳ vọng:** Response 200 với mảng notifications hoặc mảng rỗng `[]`

#### ✅ Test 2: Mark all read

1. Nếu có notifications chưa đọc → gọi `POST /api/notify/mark-read`
2. **Kỳ vọng:** Response `{ "ok": true }`

> **Lưu ý:** UI notification bell/panel có thể chưa hoàn thiện, test tập trung vào API response.

---

## 4. Test Responsive & UI

| Thiết bị | Kiểm tra |
|---|---|
| Desktop (≥1024px) | Sidebar visible, layout 3-column (documents detail) |
| Tablet (768–1023px) | Sidebar collapsible |
| Mobile (<768px) | Sidebar hidden, hamburger menu, single column |

---

## 5. Test Edge Cases

### ✅ Session hết hạn → logout tự động

1. Login → session được lưu localStorage key `docvault_session`
2. Mở DevTools → xóa `docvault_session` khỏi localStorage
3. Refresh trang `/dashboard`

**Kỳ vọng:** Loading state → redirect về `/login`

### ✅ Network error khi gọi API

1. Bật DevTools → **Network tab** → throttle **"Offline"**
2. Refresh trang `/dashboard`

**Kỳ vọng:** ErrorState hiển thị, có nút **"Retry"**

### ✅ Document không tồn tại

1. Gõ `http://localhost:3006/documents/00000000-0000-0000-0000-000000000000`

**Kỳ vọng:** ErrorState với "Failed to load document." và nút Retry

### ✅ Toast messages đúng theo từng action

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

- Submit DRAFT thất bại (đã PENDING) → Toast: `"Tài liệu không còn ở trạng thái có thể gửi duyệt."`
- Approve không phải PENDING → Toast: `"Tài liệu không còn chờ duyệt."`
- Archive non-PUBLISHED → Toast: `"Tài liệu không thể lưu trữ ở trạng thái hiện tại."`

### ✅ 403 Forbidden handling

- Action bị cấm → Toast: `"Bạn không có quyền thực hiện thao tác này."`

---

## 6. Bảng tổng hợp kết quả

| STT | Test Case | Role | Kỳ vọng | Pass |
|---|---|---|---|---|
| 1 | SSO login → dashboard | any | ✅ Redirect OK | ⬜ |
| 2 | SSO error → inline error | any | ✅ Error hiển thị | ⬜ |
| 3 | Chưa login → /dashboard | — | ✅ Redirect /login | ⬜ |
| 4 | Dashboard stat cards | editor | ✅ Hiển thị đúng | ⬜ |
| 5 | Viewer: ẩn "New Document" | viewer | ✅ Không thấy | ⬜ |
| 6 | Approver: thấy "Review Approvals" | approver | ✅ Menu hiện + badge | ⬜ |
| 7 | CO: thấy "Audit Logs" | co | ✅ Menu hiện | ⬜ |
| 8 | Role badge hiển thị đúng | all | ✅ Badge đúng role | ⬜ |
| 9 | Tạo document mới | editor | ✅ 201 + redirect | ⬜ |
| 10 | Validation: empty title | editor | ✅ Lỗi hiển thị | ⬜ |
| 11 | Tạo + upload file cùng lúc | editor | ✅ Doc + version | ⬜ |
| 12 | Tạo thành công, upload fail | editor | ✅ 2 toasts + redirect | ⬜ |
| 13 | Submit (DRAFT→PENDING) | editor | ✅ Status đổi | ⬜ |
| 14 | Approve (PENDING→PUBLISHED) | approver | ✅ publishedAt set | ⬜ |
| 15 | Reject với reason | approver | ✅ DRAFT + reason in timeline | ⬜ |
| 16 | Archive (PUBLISHED→ARCHIVED) | editor | ✅ archivedAt set | ⬜ |
| 17 | CO: không download được | co | ✅ Nút ẩn/disabled | ⬜ |
| 18 | Editor: edit doc của mình (DRAFT) | editor | ✅ OK | ⬜ |
| 19 | Editor: edit doc của mình (non-DRAFT) | editor | ✅ Inline error | ⬜ |
| 20 | Editor: không edit doc người khác | editor | ✅ Inline error | ⬜ |
| 21 | Admin: edit doc người khác | admin | ✅ OK | ⬜ |
| 22 | Approvals page: danh sách PENDING | approver | ✅ Đúng docs | ⬜ |
| 23 | Approvals: badge số pending | approver | ✅ Badge đúng số | ⬜ |
| 24 | Approvals: Review drawer approve | approver | ✅ Doc biến mất | ⬜ |
| 25 | Approvals: Review drawer reject | approver | ✅ Doc biến mất + reason | ⬜ |
| 26 | Viewer vào /approvals | viewer | ✅ Inline error | ⬜ |
| 27 | Audit page: events list | co | ✅ Hiển thị | ⬜ |
| 28 | Audit: filter hoạt động | co | ✅ Lọc đúng | ⬜ |
| 29 | Viewer vào /audit | viewer | ✅ Inline error | ⬜ |
| 30 | Download presigned URL | viewer | ✅ File tải về | ⬜ |
| 31 | Upload file > 20MB | editor | ✅ 413 toast | ⬜ |
| 32 | 409 Conflict handling | editor | ✅ Đúng message | ⬜ |
| 33 | 403 Forbidden handling | viewer | ✅ Toast hiển thị | ⬜ |
| 34 | Session hết hạn | any | ✅ Redirect /login | ⬜ |
| 35 | Network offline | any | ✅ ErrorState + Retry | ⬜ |
| 36 | Document không tồn tại | any | ✅ ErrorState | ⬜ |
| 37 | Mobile responsive | all | ✅ Layout OK | ⬜ |
| | **— My Documents —** | | | |
| 38 | My Documents: sidebar nav RBAC | editor/admin | ✅ Hiển thị | ⬜ |
| 39 | My Documents: chỉ docs của mình | editor | ✅ Filter đúng owner | ⬜ |
| 40 | My Documents: filter & search | editor | ✅ Kết quả đúng | ⬜ |
| 41 | My Documents: pagination | editor | ✅ Chuyển trang OK | ⬜ |
| 42 | My Documents: empty state | editor | ✅ Message đúng | ⬜ |
| 43 | My Documents: inline actions | editor | ✅ Submit/Archive OK | ⬜ |
| | **— Document Preview —** | | | |
| 44 | Preview PDF: render pages | editor | ✅ Pages hiển thị | ⬜ |
| 45 | Preview Image: hiển thị ảnh | editor | ✅ Ảnh hiển thị | ⬜ |
| 46 | Preview: zoom controls | any | ✅ Zoom in/out/reset | ⬜ |
| 47 | Preview: CO chỉ PUBLIC | co | ✅ Non-PUBLIC bị ẩn | ⬜ |
| 48 | Preview: file không hỗ trợ | any | ✅ Unsupported msg | ⬜ |
| 49 | Preview: chống chuột phải | any | ✅ Context menu chặn | ⬜ |
| 50 | Preview: close (X / Escape) | any | ✅ Dialog đóng | ⬜ |
| | **— Profile —** | | | |
| 51 | Profile: hiển thị user info | all | ✅ Avatar + info | ⬜ |
| 52 | Profile: Keycloak fallback | all | ✅ Warning hiển thị | ⬜ |
| 53 | Profile: role badges đúng | all | ✅ Badges đúng role | ⬜ |

---

## 7. Sau khi Frontend test xong

Chạy script E2E để xác nhận backend + frontend integration:

```bash
# Đảm bảo tất cả services + infra đang chạy
node scripts/e2e-check.mjs
```

Nếu tất cả test đều ✅ → **MVP hoàn chỉnh!** 🎉
