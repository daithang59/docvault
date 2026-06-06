# Đề xuất tính năng học hỏi từ các app khác

Tài liệu này tổng hợp các tính năng "dễ thấy khác biệt" có thể học hỏi từ các sản phẩm phổ biến, gắn với hạ tầng DocVault đã có. Dùng làm danh sách công việc (roadmap) để triển khai dần.

Cập nhật lần cuối: 2026-06-06.

---

## 1. Đã hoàn thành (có test + xác minh)

Các tính năng dưới đây đã được triển khai theo TDD và đã chạy test/build/lint/e2e:

- **Share link có thời hạn** — tạo/list/revoke/redeem, token một lần, TTL, giới hạn lượt mở; quyền VIEW/DOWNLOAD thực thi ở cả tải lẫn preview. Trang `/shared?token=` cho người nhận đã đăng nhập.
- **Legal hold** — giữ tài liệu theo yêu cầu pháp lý, miễn auto-archive của retention; chỉ admin, có lý do, ghi audit; badge trên danh sách + bộ lọc `has:legal-hold`.
- **Version diff + restore** — so sánh metadata hai version, khôi phục version cũ thành version mới (giữ lịch sử).
- **Command palette (Ctrl/Cmd+K)** — điều hướng + hành động theo role.
- **Audit cho step-up proof** — ghi cả lúc phát hành và lúc dùng proof (thành công/từ chối).
- **Rate-limit** — bật ở gateway cho proof + login (đang dùng được).
- **Security headers** — thêm HSTS, đã có sẵn CSP/X-Frame-Options/Referrer-Policy/Permissions-Policy/COOP/COEP/CORP.
- **Activity feed hợp nhất** — dòng thời gian gộp workflow history + comments + audit events (lọc trùng) trên trang chi tiết tài liệu; audit chỉ hiển thị cho người có quyền xem audit.

---

## 2. Còn lại nên làm (xếp theo ưu tiên)

### Ưu tiên cao — dễ thấy khác biệt, tận dụng hạ tầng sẵn có

#### 2.2. Bulk actions có undo trên danh sách (Linear/Jira)
- Bảng tài liệu đã hỗ trợ chọn nhiều dòng.
- Thêm hành động hàng loạt (submit / archive / đổi tag) kèm toast undo.

#### 2.3. Watermark động khi preview tài liệu mật (DocuSign/Adobe)
- Đóng dấu user + thời gian khi preview tài liệu CONFIDENTIAL/SECRET.
- `WatermarkService` đã tồn tại ở document-service nhưng chưa nối vào luồng preview — đây là việc "kết nối phần đã có".
- Tăng khả năng truy vết rò rỉ.

### Ưu tiên trung bình

#### 2.4. Trash với khôi phục có hạn (Google Drive/Dropbox)
- Đã có trạng thái DELETED và mô hình "tạo bản ghi mới giữ lịch sử" từ version restore.
- Mở khu Trash + nút restore trong cửa sổ giữ.

#### 2.5. Folder/cây thư mục thật (Google Drive/Dropbox)
- Hiện phân loại theo tag/classification.
- Cây thư mục là thứ người dùng DMS mong đợi, lên hình rõ.

#### 2.6. @mention trong comment kèm thông báo (Notion/Confluence)
- Đã có comment + notification-service.
- Chỉ cần nối mention để kéo người liên quan vào.

#### 2.7. Saved view thành "smart folder" chia sẻ nhóm (M-Files/SharePoint)
- Saved view đã có.
- Nâng thành bộ lọc động hiển thị như thư mục ảo.

#### 2.8. Approval nhiều bước có thứ tự (DocuSign/Adobe)
- Hiện chỉ một approver.
- Thêm sequential approvers (duyệt theo thứ tự), khớp workflow hiện tại.

### Ưu tiên thấp — bảo mật nâng cao (để sau)

#### 2.9. MFA/OTP thật trên Keycloak cho vai trò nhạy cảm
- Hiện reauth dựa trên `auth_time`/`prompt=login`, chưa phải MFA.
- Bật Keycloak required action OTP cho admin/compliance_officer.

#### 2.10. Rate-limit cho các backend service còn lại
- Hiện mới wire ở gateway.
- Wire `InternalAwareThrottlerGuard` + `ThrottlerModule` tương tự cho metadata/document/workflow/audit/notification để phòng thủ theo chiều sâu.

---

## 3. Thứ tự đề xuất triển khai

1. ~~Activity feed hợp nhất~~ — đã xong
2. Bulk actions có undo (2.2)
3. Watermark preview (2.3) — phần lõi đã có sẵn
4. Trash khôi phục (2.4)
5. Các mục còn lại theo nhu cầu

---

## 4. Lưu ý vận hành (chưa xử lý)

- **Migration chưa áp vào DB thật**: hai migration `add_legal_hold` và `add_document_share_links` chưa chạy `prisma migrate deploy`. Cần chạy khi deploy, nếu không các tính năng legal hold / share link sẽ lỗi ở runtime dù test đã xanh.
- **E2E còn thiếu**: chưa có e2e cho redeem share link ở `/shared` và revoke share link end-to-end (đã có unit test cho các phần này).
