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

Frontend chạy tại **http://localhost:3000** (Next.js mặc định).

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
```

> **Lưu ý:** Backend gateway không có prefix `/api` trong code nhưng frontend đang dùng `/api`. Kiểm tra xem gateway có rewrite `/api/*` không trong gateway config.

---

## 3. Test từng trang theo Role

### 3.1 — Login Page (`/login`)

Mở trình duyệt → **http://localhost:3000/login**

#### ✅ Test 1: Demo Login (Development mode)

1. Chọn tab **"Demo Login"**
2. Chọn role → nhấn **"Enter as [Role]"**
3. Redirect sang `/dashboard`

| Role thử | Kỳ vọng |
|---|---|
| `viewer` | Vào được Dashboard, **không** thấy menu "New Document" |
| `editor` | Vào được Dashboard, thấy menu "New Document" |
| `approver` | Vào được Dashboard, thấy menu "Approvals" |
| `compliance_officer` | Vào được Dashboard, thấy menu "Audit" |
| `admin` | Vào được Dashboard, thấy **TẤT CẢ** menu |

#### ✅ Test 2: JWT Token Login

1. Chuyển sang tab **"JWT Token"**
2. Lấy token từ Keycloak:

```bash
curl -X POST http://localhost:8080/realms/docvault/protocol/openid-connect/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "client_id=docvault-gateway&client_secret=dev-gateway-secret&grant_type=password&username=editor1&password=Passw0rd!"
```

3. Paste token vào ô **"JWT Token"**
4. Nhấn **"Sign in with Token"**

#### ✅ Test 3: Chưa login → không vào được `/dashboard`

1. Mở **tab ẩn danh**
2. Gõ thẳng `http://localhost:3000/dashboard`

**Kỳ vọng:** Redirect về `/login`

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

- Hiển thị đúng thứ tự **mới nhất lên đầu**
- Mỗi item click → sang `/documents/[id]`

#### ✅ Test 3: Quick Actions theo role

| Role | Quick Actions thấy được |
|---|---|
| `viewer` | Browse Documents |
| `editor` | Browse Documents + Create Document |
| `approver` | Browse Documents + Review Approvals |
| `compliance_officer` | Browse Documents + Audit Logs |
| `admin` | Tất cả 4 action |

#### ✅ Test 4: Role Badge trên header

Góc phải header → badge hiển thị đúng role hiện tại (VD: `"EDITOR"`, `"APPROVER"`)

---

### 3.3 — Documents List (`/documents`)

Truy cập `/documents` (hoặc click "Browse Documents" trên Dashboard)

#### ✅ Test 1: Danh sách documents

- Table/list hiển thị đúng các documents
- Mỗi row: title, status badge, classification, updatedAt
- Click row → sang trang chi tiết

#### ✅ Test 2: Filter theo status

| Filter | Kỳ vọng |
|---|---|
| All | Tất cả docs (hoặc ACL-filtered) |
| Draft | Chỉ DRAFT |
| Pending | Chỉ PENDING |
| Published | Chỉ PUBLISHED |
| Archived | Chỉ ARCHIVED |

#### ✅ Test 3: RBAC — Viewer không thấy nút tạo mới

Đăng nhập `viewer` → vào `/documents`

**Kỳ vọng:** Không có nút "New Document" hoặc nút đó bị ẩn/disabled

---

### 3.4 — Create Document (`/documents/new`)

> Chỉ `editor` và `admin` mới vào được trang này.

#### ✅ Test 1: Form validation

- Để trống `title` → submit → lỗi **"Title is required"**
- Nhập title quá dài (>255 chars) → lỗi validation

#### ✅ Test 2: Tạo document thành công

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

#### ✅ Test 3: Upload file

- Trên trang document detail → kéo thả file vào dropzone
- Hoặc click dropzone → chọn file (max **20 MB**)
- Upload thành công → hiển thị version mới trong card "Versions"

#### ✅ Test 4: Upload file > 20MB

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
- Nút **"Download"** → tải file về

#### ✅ Test 3: Workflow Timeline

- Hiển thị lịch sử: submit, approve, reject, archive
- Mỗi bước: actor, timestamp, action

#### ✅ Test 4: Action Panel (theo status & role)

| Trạng thái | Role | Actions hiển thị |
|---|---|---|
| DRAFT | editor (owner) | Submit, Edit |
| DRAFT | viewer | Không có action |
| PENDING | approver | Approve, Reject (với input reason) |
| PENDING | editor | Không có action |
| PUBLISHED | viewer/editor | Download, Archive |
| ARCHIVED | (tất cả) | Chỉ xem |

#### ✅ Test 5: Approve document

1. Document ở **PENDING**
2. Đăng nhập `approver1`
3. Vào document → nhấn **Approve**
4. Status đổi → **PUBLISHED**
5. Timeline thêm bước **APPROVE**

#### ✅ Test 6: Reject document với lý do

1. Document ở **PENDING**
2. Nhấn **Reject**
3. Nhập reason: `"Thiếu mục lục, cần bổ sung"`
4. Status đổi → **DRAFT**
5. Timeline ghi nhận reason

#### ✅ Test 7: Download file — compliance_officer bị cấm ⚠️

> **Test bảo mật quan trọng nhất của frontend!**

1. Đăng nhập `co1` (`compliance_officer`)
2. Vào một document đã **PUBLISHED**

**Kỳ vọng:**
- Metadata + workflow timeline → xem được ✅
- Nút **Download → KHÔNG hiển thị** hoặc bị **disabled** ❌
- Nếu có nút → click → toast lỗi **403**

---

### 3.6 — Edit Document (`/documents/[id]/edit`)

#### ✅ Test 1: Editor sở hữu → được sửa

1. Đăng nhập `editor1`
2. Vào document của `editor1` → nhấn **Edit**
3. Sửa title/description → **Save**
4. **Kỳ vọng:** Cập nhật thành công, quay lại detail

#### ✅ Test 2: Editor không sở hữu → không sửa được

1. Đăng nhập `editor1`
2. Vào document của `admin` → nhấn **Edit**
3. **Kỳ vọng:** 403 hoặc nút **Edit không hiển thị**

---

### 3.7 — Approvals Page (`/approvals`)

> Chỉ `approver` và `admin` mới vào được.

#### ✅ Test 1: Hiển thị danh sách PENDING

1. Đăng nhập `approver1`
2. Vào `/approvals`
3. **Kỳ vọng:** Chỉ hiển thị documents có `status=PENDING`

#### ✅ Test 2: Review và approve/reject

1. Chọn 1 document → nhấn **Approve** → document biến mất khỏi danh sách (chuyển sang PUBLISHED)
2. Chọn 1 document khác → nhấn **Reject** → nhập reason → document biến mất

#### ✅ Test 3: Viewer không vào được `/approvals`

1. Đăng nhập `viewer1`
2. Gõ thẳng `http://localhost:3000/approvals`
3. **Kỳ vọng:** Redirect hoặc lỗi **403**

---

### 3.8 — Audit Page (`/audit`)

> Chỉ `compliance_officer` mới vào được.

#### ✅ Test 1: Hiển thị audit events

1. Đăng nhập `co1`
2. Vào `/audit`
3. **Kỳ vọng:** Bảng audit events với các cột: timestamp, actor, action, resource, result, reason

#### ✅ Test 2: Filter audit events

| Filter | Kỳ vọng |
|---|---|
| actorId | Lọc theo user |
| action | Lọc theo action type |
| result | SUCCESS / DENY / ERROR |
| Date range | Lọc theo khoảng thời gian |

#### ✅ Test 3: Verify hash chain

- Có nút **"Verify Chain"** hoặc chạy auto
- **Kỳ vọng:** Hiển thị `valid: true` với số events đã check

#### ✅ Test 4: Non-CO không vào được `/audit`

1. Đăng nhập `editor1`
2. Gõ `http://localhost:3000/audit`
3. **Kỳ vọng:** Redirect hoặc **403**

---

## 4. Test Responsive & UI

| Thiết bị | Kiểm tra |
|---|---|
| Desktop (≥1024px) | Layout 3-column (documents detail) |
| Tablet (768–1023px) | Collapsible sidebar, grid 2-col |
| Mobile (<768px) | Sidebar hidden, single column, hamburger menu |

---

## 5. Test Edge Cases

### ✅ Session hết hạn → logout tự động

1. Login → session được lưu localStorage
2. Sửa token trong localStorage thành token hết hạn
3. Refresh trang

**Kỳ vọng:** Redirect về `/login`

### ✅ Network error khi gọi API

1. Bật DevTools → **Network tab** → throttle **"Offline"**
2. Refresh trang `/dashboard`

**Kỳ vọng:** Error state hiển thị, có nút **"Retry"**

### ✅ Document không tồn tại

1. Gõ `http://localhost:3000/documents/00000000-0000-0000-0000-000000000000`

**Kỳ vọng:** Trang not-found hoặc error state

---

## 6. Bảng tổng hợp kết quả

| STT | Test Case | Role | Kỳ vọng | Pass |
|---|---|---|---|---|
| 1 | Demo login → dashboard | viewer | ✅ Redirect OK | ⬜ |
| 2 | Demo login → dashboard | editor | ✅ Redirect OK | ⬜ |
| 3 | Demo login → dashboard | approver | ✅ Redirect OK | ⬜ |
| 4 | Demo login → dashboard | compliance_officer | ✅ Redirect OK | ⬜ |
| 5 | Demo login → dashboard | admin | ✅ Redirect OK | ⬜ |
| 6 | JWT token login | any | ✅ User info parsed | ⬜ |
| 7 | Chưa login → /dashboard | — | ✅ Redirect /login | ⬜ |
| 8 | Dashboard stat cards | editor | ✅ Hiển thị đúng | ⬜ |
| 9 | Viewer: ẩn "New Document" | viewer | ✅ Không thấy | ⬜ |
| 10 | Approver: thấy "Approvals" | approver | ✅ Menu hiện | ⬜ |
| 11 | CO: thấy "Audit" | co | ✅ Menu hiện | ⬜ |
| 12 | Tạo document mới | editor | ✅ 201 + redirect | ⬜ |
| 13 | Validation: empty title | editor | ✅ Lỗi hiển thị | ⬜ |
| 14 | Upload file ≤ 20MB | editor | ✅ Version hiện | ⬜ |
| 15 | Upload file > 20MB | editor | ✅ 413 toast | ⬜ |
| 16 | Submit (DRAFT→PENDING) | editor | ✅ Status đổi | ⬜ |
| 17 | Approve (PENDING→PUBLISHED) | approver | ✅ publishedAt set | ⬜ |
| 18 | Reject với reason | approver | ✅ DRAFT + reason | ⬜ |
| 19 | Archive (PUBLISHED→ARCHIVED) | editor | ✅ archivedAt set | ⬜ |
| 20 | CO: không download được | co | ✅ Nút ẩn/disabled | ⬜ |
| 21 | Editor: edit doc của mình | editor | ✅ OK | ⬜ |
| 22 | Editor: không edit doc người khác | editor | ✅ 403/ẩn | ⬜ |
| 23 | Approvals page: danh sách PENDING | approver | ✅ Đúng docs | ⬜ |
| 24 | Viewer vào /approvals | viewer | ✅ Redirect/403 | ⬜ |
| 25 | Audit page: events list | co | ✅ Hiển thị | ⬜ |
| 26 | Audit: filter hoạt động | co | ✅ Lọc đúng | ⬜ |
| 27 | Verify hash chain | co | ✅ valid=true | ⬜ |
| 28 | Viewer vào /audit | viewer | ✅ Redirect/403 | ⬜ |
| 29 | Download presigned URL | viewer | ✅ File tải về | ⬜ |
| 30 | Mobile responsive | all | ✅ Layout OK | ⬜ |

---

## 7. Sau khi Frontend test xong

Chạy script E2E để xác nhận backend + frontend integration:

```bash
# Đảm bảo tất cả services + infra đang chạy
node scripts/e2e-check.mjs
```

Nếu tất cả test đều ✅ → **MVP hoàn chỉnh!** 🎉
