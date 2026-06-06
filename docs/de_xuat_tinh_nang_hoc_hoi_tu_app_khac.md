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
- **Bulk actions có undo** — hành động hàng loạt (submit/approve/archive/delete) hoãn 5s kèm toast Undo; nếu Undo, không có request nào gửi lên server.
- **Watermark động khi preview** — PDF CONFIDENTIAL/SECRET được đóng dấu user + thời gian + phân loại khi xem inline (tận dụng WatermarkService đã có, nối vào luồng preview của document-service).
- **Trash với khôi phục có hạn** — trang Trash liệt kê tài liệu DELETED với hạn khôi phục 30 ngày; khôi phục DELETED→DRAFT trong cửa sổ cho phép, ghi audit; chỉ owner-editor/admin.
- **Sequential approvers** — chuỗi duyệt nhiều bước có thứ tự; mỗi approver duyệt đúng lượt, chỉ publish sau bước cuối; card cấu hình + tiến độ trên trang chi tiết.
- **@mention trong comment** — parse @username trong nội dung, gửi thông báo MENTIONED cho người được nhắc (bỏ qua tự nhắc); gợi ý cú pháp ở ô nhập.
- **Smart folder (tag phân cấp)** — lọc folder theo path slash-style (chọn `finance` gồm cả `finance/q1`), kèm helper dựng cây thư mục.
- **UI cây thư mục điều hướng** — sidebar cây thư mục có thể mở/đóng trên trang Documents, đếm số tài liệu mỗi nhánh, click để lọc theo folder (phản ánh vào URL).

---

## Nhóm độ-tin-cậy (tiến tới thương mại)

- **Rate-limit toàn hệ thống** — đã wire `ThrottlerModule` + `APP_GUARD` (InternalAwareThrottlerGuard) cho cả 5 backend service (metadata/document/workflow/audit/notification), không chỉ gateway. Internal service-to-service call được miễn qua header `x-internal-call`.
- **Migration kiểm chứng trên DB thật** — đã áp toàn bộ và xác nhận schema up to date.
- Còn lại: integration test thật (giảm phụ thuộc mock), backup/restore, logging/metrics tập trung, MFA cho vai trò nhạy cảm, purge job cho trash.

## 2. Còn lại nên làm (xếp theo ưu tiên)

### Ưu tiên cao — dễ thấy khác biệt, tận dụng hạ tầng sẵn có

### Ưu tiên trung bình

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
2. ~~Bulk actions có undo~~ — đã xong
3. ~~Watermark preview~~ — đã xong
4. ~~Trash khôi phục~~ — đã xong
5. ~~Sequential approvers, @mention, smart folder~~ — đã xong
6. ~~UI cây thư mục điều hướng~~ — đã xong
7. Còn lại: nhóm độ-tin-cậy để thương mại (xem mục 4)

---

## 4. Lưu ý vận hành (chưa xử lý)

- **Migration đã áp vào DB thật**: toàn bộ migration (gồm `add_legal_hold`, `add_document_share_links`, `add_approval_chain`) đã chạy `prisma migrate deploy`; `prisma migrate status` báo "Database schema is up to date". Khi deploy môi trường mới vẫn cần chạy lại `migrate deploy`.
- **E2E còn thiếu**: chưa có e2e cho redeem share link ở `/shared` và revoke share link end-to-end (đã có unit test cho các phần này).
