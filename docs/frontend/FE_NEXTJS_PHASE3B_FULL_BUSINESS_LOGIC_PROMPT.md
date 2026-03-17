# FE Next.js — Phase 3B Prompt
## Mục tiêu: Hoàn thiện full business logic FE trên nền backend đã E2E pass

Bạn là AI Agent đang làm việc trên codebase FE Next.js của dự án **DocVault**.

Backend đã:
- chạy được toàn bộ services
- infra đã lên
- gateway và các service trả `/docs` thành công
- pass E2E qua script backend cho các flow chính:
  - auth
  - create
  - upload
  - submit
  - approve
  - download
  - stream
  - compliance
  - audit

Điều này có nghĩa là trong **Phase 3B**, bạn phải **ưu tiên runtime behavior/backend code thật** hơn mọi prompt/tài liệu cũ nếu có khác biệt.

---

# 1. Mục tiêu Phase 3B

Hoàn thiện toàn bộ **business logic FE** cho MVP DocVault để người dùng có thể thao tác thật trên giao diện với backend đã được verify E2E.

Cụ thể:
1. hoàn thiện page logic cho toàn bộ màn hình chính
2. nối mutation/query thật đến backend
3. hoàn thiện role-based action visibility + disabled state
4. hoàn thiện status-based business actions
5. hoàn thiện form validation
6. hoàn thiện loading / empty / error / forbidden / conflict UX
7. hoàn thiện flow upload / submit / approve / reject / archive / download / audit
8. giữ code sạch, typed, dễ maintain
9. không mở rộng scope sang các tính năng ngoài MVP

---

# 2. Nguyên tắc bắt buộc

## 2.1. Backend runtime là nguồn sự thật
Nếu:
- prompt cũ khác backend
- docs cũ khác code backend
- alias compatibility khác runtime response thật

=> ưu tiên **backend runtime + backend code thật**.

Không giữ các giả định cũ chỉ để “khớp tài liệu”.

---

## 2.2. Không làm lại scaffold Phase 2 / Phase 3A
Giữ nguyên kiến trúc đã có nếu đang hợp lý:
- app router structure
- providers
- service/api layer
- feature-based modules
- auth/session layer
- query hooks
- permission helpers

Chỉ refactor khi giúp business logic rõ hơn hoặc loại bỏ code sai/hardcoded.

---

## 2.3. Tập trung vào logic và UX nghiệp vụ
Mục tiêu chính là:
- thao tác đúng
- quyền đúng
- trạng thái đúng
- phản hồi UI đúng

Không dành nhiều effort cho animation, micro-interaction, hoặc polishing hình thức quá sâu.

---

# 3. Bối cảnh nghiệp vụ cần bám

## 3.1. Roles
Hệ thống có các role:
- `viewer`
- `editor`
- `approver`
- `compliance_officer`
- `admin` (local/dev convenience)

## 3.2. Workflow
Workflow hiện tại:
- `DRAFT -> PENDING -> PUBLISHED -> ARCHIVED`
- reject: `PENDING -> DRAFT`

## 3.3. Domain behavior FE phải phản ánh đúng
- `viewer`: xem danh sách/chi tiết, tải tài liệu khi đủ điều kiện
- `editor`: tạo document metadata, upload version, submit, có thể archive nếu backend policy cho phép
- `approver`: approve/reject document đang pending
- `compliance_officer`: xem metadata và audit, **không được download**
- `admin`: dev/local convenience, nhưng FE không được hardcode mọi quyền “siêu nhân” nếu backend không cho

Nếu backend policy thực tế khác assumption cũ, FE phải bám theo backend thật.

---

# 4. Phạm vi tính năng phải hoàn thiện

## 4.1. App shell / navigation / layout
Hoàn thiện:
- sidebar
- top bar
- current user display
- role badge nếu phù hợp
- route active state
- logout
- loading state khi boot session

Navigation phải phù hợp role:
- viewer/editor/approver/compliance/admin nhìn thấy menu phù hợp
- không hiện menu vô nghĩa với role không có quyền

---

## 4.2. Auth/session
Hoàn thiện:
- session bootstrap
- lấy current user từ `/me` nếu có, fallback token parse nếu cần
- lưu/clear token/session nhất quán
- redirect khi chưa login
- xử lý 401: clear session + đưa về login
- xử lý 403: giữ trang và hiện trạng thái bị từ chối / toast phù hợp

Không làm refresh token phức tạp nếu backend/project chưa support đầy đủ, nhưng phải không để session handling rối.

---

## 4.3. Dashboard (nếu đang có)
Nếu project hiện có dashboard route:
- chỉ hiển thị summary cơ bản
- counters/cards phải dựa trên data thật nếu endpoint có
- nếu chưa có endpoint dashboard chuyên dụng, dùng cách đơn giản hoặc giữ dashboard nhẹ, không bịa số liệu

Không mở rộng dashboard thành analytics phức tạp.

---

## 4.4. Documents list page
Hoàn thiện trang danh sách tài liệu:
- load documents từ backend thật
- render table/list rõ ràng
- hiển thị ít nhất:
  - title
  - status
  - classification
  - owner/created by nếu có
  - current version
  - updated/created time
- có search/filter mức phù hợp với backend hiện tại
- nếu backend chưa hỗ trợ search/filter server-side thì:
  - document rõ là client-side filtering
  - code gọn, không giả vờ là server-side

Phải có:
- loading state
- empty state
- error state
- row click hoặc action vào detail

---

## 4.5. Create document page
Hoàn thiện form tạo metadata tài liệu:
- field đúng theo backend contract
- validation mức hợp lý
- error message thân thiện
- submit thành công thì:
  - toast success
  - redirect sang detail hoặc list
- invalidation/refetch đúng

Ít nhất phải validate:
- title bắt buộc
- classification bắt buộc nếu backend yêu cầu
- các field enum hợp lệ
- trim input cơ bản

---

## 4.6. Document detail page
Đây là page quan trọng nhất. Hoàn thiện toàn bộ logic:

Hiển thị:
- document metadata
- status badge
- classification badge
- current version
- versions list nếu có
- owner / created by / timestamps nếu có
- tags / description nếu có
- ACL preview nếu có
- workflow history section/link
- audit-related info nếu phù hợp

Phần action bar phải phụ thuộc:
- role hiện tại
- status document
- policy backend

Ví dụ:
- editor có thể upload/submit khi document đang phù hợp
- approver có thể approve/reject nếu status = `PENDING`
- user có quyền download mới thấy nút download
- compliance officer không thấy hoặc không dùng được download
- archive chỉ hiện khi backend policy cho phép

Không hardcode điều kiện dài trong component; phải dùng permission/business helpers.

---

## 4.7. Upload version flow
Hoàn thiện upload file:
- file picker / drag-drop cơ bản nếu đã có
- gọi đúng endpoint upload
- xử lý loading/progress tối thiểu nếu dễ làm
- hiển thị lỗi upload rõ ràng
- sau upload:
  - refetch detail
  - refetch versions nếu có
  - cập nhật current version đúng

Nếu backend trả lỗi như oversize/invalid file/state conflict, map ra message hợp lý.

---

## 4.8. Submit flow
Hoàn thiện thao tác submit:
- chỉ hiện khi role/status phù hợp
- có confirm action nếu cần
- mutation gọi đúng backend
- xử lý success:
  - toast
  - refetch detail/list/approvals/workflow history
- xử lý 409:
  - message rõ kiểu “Tài liệu không còn ở trạng thái có thể gửi duyệt”

---

## 4.9. Approvals page
Hoàn thiện trang approvals:
- load danh sách document pending cần duyệt
- render list/table rõ ràng
- filter/search cơ bản nếu cần
- click vào detail hoặc inline action

Trang này chủ yếu cho:
- approver
- admin nếu backend/local cho phép

Nếu role khác truy cập:
- route guard hoặc forbidden state rõ ràng

---

## 4.10. Approve / Reject flow
Hoàn thiện 2 thao tác này đầy đủ:

### Approve
- chỉ cho role hợp lệ
- chỉ dùng cho `PENDING`
- success -> status thành `PUBLISHED`
- invalidation đúng

### Reject
- có modal/form nhập reason nếu backend yêu cầu
- validate reason nếu cần
- success -> status quay về `DRAFT`
- invalidation đúng

Xử lý lỗi chuẩn:
- 403: không có quyền
- 409: trạng thái không còn hợp lệ
- network/server error: message thân thiện

---

## 4.11. Archive flow
Hoàn thiện archive theo **backend policy thật**.

Quan trọng:
- không dùng assumption cũ nếu Phase 3A đã xác định archive policy khác
- chỉ hiện action khi helper xác định user hiện tại được phép archive

Phải:
- confirm trước khi archive
- success -> status `ARCHIVED`
- invalidation/refetch đúng
- nếu gateway/backend chưa support endpoint nào đó, ghi rõ và block UI hợp lý

---

## 4.12. Workflow history
Hoàn thiện section hoặc page workflow history:
- load đúng endpoint
- hiển thị timeline hoặc table sạch, dễ đọc
- mỗi item có:
  - action/transition
  - actor
  - timestamp
  - note/reason nếu có
- loading / empty / error state đầy đủ

---

## 4.13. ACL UI
Nếu ACL đã trong scope và endpoint usable:
- load ACL đúng
- hiển thị danh sách entries rõ ràng
- nếu update ACL nằm trong MVP hiện tại và backend support:
  - cho add/edit/remove entry cơ bản
  - validate enum/subject/permission
  - save mutation + refetch đúng
- nếu backend chỉ sẵn sàng read hoặc contract update chưa chắc chắn:
  - hoàn thiện read-only UI
  - disable phần edit rõ ràng, không bịa behavior

---

## 4.14. Download flow
Hoàn thiện đúng flow tải tài liệu theo backend thật.

Không được giả định 1 bước nếu backend đang dùng nhiều bước.

Nếu backend runtime hiện tại là:
1. authorize/kiểm tra policy
2. presign hoặc stream

thì FE phải phản ánh đúng.

Yêu cầu:
- chỉ hiện download action cho user hợp lệ
- compliance officer không được download
- handle error đúng:
  - 403 không quyền
  - 409 / state conflict nếu chưa đúng trạng thái
  - 404 nếu version/file không tồn tại
- UX tải file phải rõ:
  - mở tab mới / redirect / fetch blob tùy contract thực tế
- code phải tập trung tại service/helper, tránh để component biết quá nhiều low-level details

---

## 4.15. Audit page
Hoàn thiện trang audit:
- chỉ cho compliance officer / role phù hợp
- query audit logs từ backend thật
- filter cơ bản theo:
  - action
  - actor/user
  - result nếu có
  - time range nếu backend support
- render table rõ ràng
- loading / empty / error state

Nếu backend chưa support full filter set:
- chỉ expose filter nào thực sự hoạt động
- không dựng UI filter giả rồi bỏ đó

---

# 5. Error UX bắt buộc

## 5.1. Chuẩn hóa trải nghiệm lỗi
Mọi page/action chính phải xử lý tốt:
- 401 unauthorized
- 403 forbidden
- 404 not found
- 409 conflict
- 422/400 validation
- 500/network error

Ví dụ:
- 401 -> clear session + redirect login
- 403 -> toast + giữ user ở trạng thái hiểu được
- 404 -> not found state
- 409 -> giải thích conflict nghiệp vụ
- network -> thông báo không kết nối được server

Không show raw stack trace hoặc message backend thô nếu không phù hợp.

---

## 5.2. Disabled state và guard
Không chỉ dựa vào backend trả lỗi.
FE phải:
- ẩn action không thể dùng
- hoặc disable action với tooltip/message ngắn
- guard route nếu role hoàn toàn không phù hợp

Tuy nhiên vẫn phải giữ defensive handling nếu user bypass UI.

---

# 6. Query / state management

## 6.1. Query keys
Dùng query keys tập trung và nhất quán cho:
- auth/current user
- documents list
- document detail
- approvals list
- workflow history
- ACL
- audit logs

## 6.2. Invalidation
Sau mỗi mutation, invalidation phải đúng tối thiểu:

### create document
- documents list

### upload version
- document detail
- versions/workflow history nếu liên quan

### submit
- documents list
- document detail
- approvals list
- workflow history

### approve/reject
- documents list
- document detail
- approvals list
- workflow history

### archive
- documents list
- document detail
- workflow history

### ACL update
- document detail nếu có preview ACL
- ACL query

---

# 7. Helpers cần có

Tạo hoặc hoàn thiện helper/business policy functions, ví dụ:
- `canViewDocuments`
- `canViewDocumentDetail`
- `canCreateDocument`
- `canUploadVersion`
- `canSubmitDocument`
- `canApproveDocument`
- `canRejectDocument`
- `canArchiveDocument`
- `canDownloadDocument`
- `canViewAudit`
- `canManageAcl`

Ngoài role, helper phải xét cả:
- document status
- ownership nếu backend policy liên quan
- current page context nếu cần

Không viết logic lặp trong component.

---

# 8. UI/UX yêu cầu tối thiểu

## 8.1. Giữ thống nhất design system đã chốt
Bám theo palette/design system đã có:
- layout enterprise, sạch
- màu trạng thái rõ
- badges/alerts/cards nhất quán
- typography dễ đọc
- sidebar tối, content sáng nếu đó là hệ đã chọn

## 8.2. States phải đầy đủ
Mỗi page chính đều phải có:
- loading
- empty
- error
- success feedback
- forbidden/not-found khi phù hợp

## 8.3. Không over-engineer
Không cần:
- animation phức tạp
- chart không cần thiết
- component abstraction quá mức
- global state không cần thiết nếu query + local state là đủ

---

# 9. Danh sách route/màn hình cần hoàn thiện

Tùy repo hiện tại, nhưng tối thiểu phải hoàn thiện các route tương đương:

- `/login`
- `/`
- `/documents`
- `/documents/new`
- `/documents/[id]`
- `/approvals`
- `/audit`

Nếu repo có thêm route cho ACL/history riêng thì hoàn thiện nhất quán với pattern hiện tại.

---

# 10. Manual verification checklist bắt buộc

Sau khi hoàn thiện, tự chạy FE với backend đã sẵn sàng và kiểm tra tối thiểu:

## Auth
- login/session bootstrap hoạt động
- logout hoạt động
- 401 redirect hoạt động

## Documents
- xem list được
- tạo document được
- vào detail được
- upload version được
- submit được

## Approvals
- approver thấy danh sách cần duyệt
- approve được
- reject được

## Download / Compliance
- user hợp lệ download được
- compliance officer không download được
- lỗi bị cấm hiển thị đúng

## Audit
- compliance officer vào audit được
- query cơ bản hoạt động

## Conflict / Forbidden
- action sai role bị chặn đúng
- action sai status ra thông báo 409 hợp lý

Nếu phần nào chưa verify được, phải ghi rõ:
- chưa verify cái gì
- vì sao
- code đã chuẩn bị đến đâu

---

# 11. Kết quả đầu ra mong muốn

Khi hoàn tất, hãy trả về:

## A. Tóm tắt thay đổi theo module
Ví dụ:
- auth/session
- documents list/detail/create
- upload
- workflow actions
- approvals
- audit
- acl
- download

## B. Những file chính đã sửa/tạo
Liệt kê file quan trọng

## C. Trạng thái verification
- build
- lint
- typecheck
- manual FE verification
- flow nào pass
- flow nào còn blocked

## D. Risk còn lại sau Phase 3B
Ví dụ:
- pagination server-side chưa có
- ACL edit chỉ read-only
- dashboard còn tối giản
- token refresh chưa có
- edge cases upload chưa đủ rộng

---

# 12. Definition of Done

Phase 3B được xem là xong khi:
- các màn hình chính hoạt động được với backend thật
- business actions chính chạy được từ UI
- role/status-based UI logic đúng
- loading/empty/error/conflict/forbidden UX đầy đủ ở mức MVP tốt
- code vẫn build/lint/typecheck pass
- có báo cáo verification rõ ràng, không nói chung chung

---

# 13. Ràng buộc quan trọng

- Không tự thêm feature ngoài MVP
- Không giữ contract cũ nếu backend runtime đã khác
- Không hardcode permission trong UI rải rác
- Không che giấu phần chưa verify
- Không tuyên bố “done” nếu chưa kiểm tra flow chính

---

# 14. Thứ tự triển khai đề xuất

1. rà lại codebase sau Phase 3A
2. chốt canonical DTO/runtime assumptions theo backend đã E2E pass
3. hoàn thiện auth/session/guards
4. hoàn thiện documents list/new/detail
5. hoàn thiện upload/submit
6. hoàn thiện approvals + approve/reject
7. hoàn thiện archive/download/workflow history
8. hoàn thiện audit + ACL UI
9. rà toàn bộ loading/error/forbidden/conflict states
10. manual verify với backend thật
11. xuất summary/report

---

Hãy thực hiện **Phase 3B** theo đúng scope trên. Tập trung vào **business logic FE hoàn chỉnh, đúng contract runtime, đúng role/status behavior, và verification thực tế**.
