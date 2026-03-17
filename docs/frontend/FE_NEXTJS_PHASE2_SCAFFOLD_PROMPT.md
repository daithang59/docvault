# PHASE 2 — PROMPT CHO AI AGENT: DỰNG SCAFFOLD + SOURCE SKELETON FE NEXT.JS DOCVAULT

Bạn là AI Agent chịu trách nhiệm **khởi tạo toàn bộ scaffold frontend Next.js** cho dự án **DocVault**. Ở phase này, mục tiêu **không phải** hoàn thiện full business logic hay polish UI 100%, mà là dựng một **codebase sạch, chạy được, có cấu trúc production-ready**, để phase tiếp theo chỉ cần fill logic và hoàn thiện từng page.

Bạn phải bám sát các file context đã có từ người dùng:
- `README_CONTEXT.md`
- `PROJECT_STATUS.md`
- `REFRACTOR_SUMMARY.md`
- `ERD.md`
- `API_CONTRACT.md`
- `FE_DESIGN_SYSTEM.md`
- `FE_COLOR_PALETTE.md`
- `FE_AGENT_CONTEXT_PROMPT.md`
- `FE_NEXTJS_IMPLEMENTATION_PROMPT.md`

Nếu có khác biệt giữa tài liệu cũ và implementation hiện tại, **ưu tiên implementation hiện tại** theo `PROJECT_STATUS.md`, `REFRACTOR_SUMMARY.md`, và `API_CONTRACT.md`.

---

## 1. Mục tiêu phase 2

Hãy tạo một frontend **Next.js App Router** hoàn chỉnh ở mức scaffold, gồm:

1. Khởi tạo project frontend nếu chưa có.
2. Cài đặt và cấu hình các thư viện nền tảng.
3. Tạo folder structure production-ready.
4. Tạo app shell, layout, sidebar, header, route groups.
5. Tạo design tokens và theme foundation.
6. Tạo typed API client và service modules.
7. Tạo auth/session layer dùng Keycloak token từ backend/gateway flow hiện tại.
8. Tạo route guard và permission helpers.
9. Tạo React Query provider, query keys, mutation skeleton.
10. Tạo source skeleton cho toàn bộ page chính.
11. Tạo reusable UI components cơ bản.
12. Tạo mock-safe loading, empty, error states.
13. Đảm bảo app chạy được local, build được, lint pass.

Ở phase này, ưu tiên:
- cấu trúc chuẩn
- typing rõ ràng
- code dễ mở rộng
- module boundaries tốt
- UI skeleton đẹp, đồng bộ palette

Chưa cần:
- hoàn thiện tất cả use case chi tiết
- tối ưu pixel-perfect 100%
- drag/drop nâng cao
- virtualized table nâng cao
- biểu đồ phức tạp
- i18n phức tạp

---

## 2. Tech stack bắt buộc

Sử dụng:
- **Next.js 14+ hoặc mới hơn**, App Router
- **TypeScript** strict mode
- **Tailwind CSS**
- **shadcn/ui**
- **TanStack Query**
- **React Hook Form**
- **Zod**
- **Axios** hoặc fetch wrapper typed (ưu tiên axios để interceptor rõ)
- **Lucide React**
- **clsx** / `cn` helper
- Có thể dùng `date-fns`
- Có thể dùng `nuqs` hoặc URL search param helper nếu cần

Không dùng state management nặng như Redux nếu chưa cần.

---

## 3. Yêu cầu chất lượng code

Phải bảo đảm:
- TypeScript strict
- không dùng `any` bừa bãi
- tách layer rõ: `types`, `lib/api`, `features`, `components`, `hooks`
- component nhỏ, dễ tái sử dụng
- không hardcode role logic lung tung trong UI; phải gom helper permission
- không gọi API trực tiếp trong random component nếu đã có service/hook
- form có validation rõ bằng Zod
- loading/error/empty state nhất quán
- skeleton screen đồng bộ
- route naming nhất quán
- không phá App Router conventions

---

## 4. Cấu trúc thư mục bắt buộc

Hãy dựng cấu trúc tối thiểu như sau, có thể tinh chỉnh hợp lý nhưng không được lệch ý tưởng:

```text
apps/web/
  src/
    app/
      (auth)/
        login/
          page.tsx
      (dashboard)/
        layout.tsx
        documents/
          page.tsx
          new/
            page.tsx
          [id]/
            page.tsx
            edit/
              page.tsx
        approvals/
          page.tsx
        audit/
          page.tsx
        settings/
          page.tsx
      api/
        health/route.ts
      globals.css
      layout.tsx
      not-found.tsx
      error.tsx
      loading.tsx
    components/
      layout/
        app-sidebar.tsx
        app-header.tsx
        breadcrumb.tsx
        page-shell.tsx
      common/
        app-logo.tsx
        badge-status.tsx
        badge-classification.tsx
        empty-state.tsx
        error-state.tsx
        loading-state.tsx
        section-header.tsx
        confirm-dialog.tsx
        search-input.tsx
      data-table/
        app-table.tsx
        table-toolbar.tsx
        table-pagination.tsx
      forms/
        form-field.tsx
        rhf-input.tsx
        rhf-select.tsx
        rhf-textarea.tsx
        rhf-multi-select.tsx
      documents/
        document-card.tsx
        document-list-filters.tsx
        document-metadata-form.tsx
        upload-file-panel.tsx
        acl-panel.tsx
        versions-panel.tsx
        workflow-timeline.tsx
        document-actions.tsx
      approvals/
        approval-queue-table.tsx
        approval-action-bar.tsx
      audit/
        audit-filter-bar.tsx
        audit-table.tsx
    features/
      auth/
        auth.types.ts
        auth.constants.ts
        auth.session.ts
        auth.store.ts
        auth.hooks.ts
        auth.guards.ts
      documents/
        documents.types.ts
        documents.schemas.ts
        documents.keys.ts
        documents.api.ts
        documents.hooks.ts
        documents.permissions.ts
      approvals/
        approvals.types.ts
        approvals.keys.ts
        approvals.api.ts
        approvals.hooks.ts
      audit/
        audit.types.ts
        audit.keys.ts
        audit.api.ts
        audit.hooks.ts
      acl/
        acl.types.ts
        acl.api.ts
        acl.hooks.ts
      workflow/
        workflow.types.ts
        workflow.api.ts
        workflow.hooks.ts
    lib/
      api/
        client.ts
        interceptors.ts
        errors.ts
        response.ts
      auth/
        token.ts
        roles.ts
        permissions.ts
      constants/
        app.ts
        routes.ts
        query-keys.ts
      theme/
        tokens.ts
        status-colors.ts
        classification-colors.ts
      utils/
        cn.ts
        date.ts
        file.ts
        download.ts
        guards.ts
        search-params.ts
      validators/
        common.ts
    providers/
      app-provider.tsx
      query-provider.tsx
      theme-provider.tsx
      auth-provider.tsx
    types/
      api.ts
      common.ts
      pagination.ts
      enums.ts
    config/
      env.ts
      nav.ts
  public/
  components.json
  package.json
  tsconfig.json
  tailwind.config.ts
  postcss.config.js
  next.config.mjs
  .env.example
```

Nếu repo là monorepo thì đặt đúng vào app FE hiện có, nhưng vẫn giữ structure logic tương tự.

---

## 5. Quy ước route FE phải tạo

Tạo các route sau:

- `/login`
- `/documents`
- `/documents/new`
- `/documents/[id]`
- `/documents/[id]/edit`
- `/approvals`
- `/audit`
- `/settings`

Hành vi cơ bản:
- chưa login thì redirect `/login`
- login xong vào `/documents`
- role không đủ thì show unauthorized state hoặc redirect hợp lý
- route `/audit` chỉ cho `compliance_officer` và có thể `admin`
- route `/approvals` chỉ cho `approver` và có thể `admin`
- edit/create chỉ cho `editor` và `admin`

---

## 6. Màu sắc và theme foundation bắt buộc

Tạo theme foundation theo `FE_COLOR_PALETTE.md`.

Ít nhất phải có:
- CSS variables hoặc token object cho:
  - background
  - foreground
  - card
  - border
  - muted
  - primary
  - secondary
  - destructive
  - success
  - warning
  - sidebar bg
  - sidebar text
  - sidebar active
- status color map:
  - DRAFT
  - PENDING
  - PUBLISHED
  - ARCHIVED
- classification color map:
  - PUBLIC
  - INTERNAL
  - CONFIDENTIAL
  - SECRET

Sidebar tối, content sáng, card clean, enterprise look.

---

## 7. Session/Auth scaffold

Thiết kế auth layer đủ dùng cho phase tiếp theo.

### 7.1 Session model
Tạo kiểu dữ liệu session tối thiểu:
- accessToken
- refreshToken nếu có
- expiresAt nếu có
- user info:
  - sub / id
  - username
  - email
  - roles: string[]

### 7.2 Auth assumptions
Hệ thống dùng **Keycloak**, nhưng FE hiện tại có thể chỉ cần:
- lưu token trong memory hoặc storage theo chiến lược an toàn hiện tại của dự án
- gắn bearer token vào mọi request qua interceptor
- parse roles từ token hoặc session payload

Không tự ý phát minh full OAuth flow nếu backend chưa yêu cầu. Phase này chỉ cần scaffold đủ để nối thật sau.

### 7.3 Bắt buộc tạo
- `auth-provider.tsx`
- `auth.session.ts`
- `token.ts`
- `roles.ts`
- `permissions.ts`
- `auth.guards.ts`
- hook `useSession()`
- hook `useRequireAuth()`
- helper `hasRole`, `hasAnyRole`, `canViewAudit`, `canApprove`, `canEditDocument`, `canManageAcl`, `canDownloadDocument`

### 7.4 Login page
Tạo login page đẹp, tối giản, branded DocVault.
Page này có thể là placeholder nếu chưa có endpoint auth cuối cùng, nhưng phải có:
- form username/password hoặc nút “Sign in with Keycloak” tùy kiến trúc hiện tại
- state loading
- state error
- note môi trường dev nếu cần

Nếu backend auth chưa chốt, tạo abstraction rõ để sau này thay implementation dễ dàng.

---

## 8. API client scaffold

Tạo 1 client typed dùng chung.

### 8.1 Base config
Dùng biến môi trường:
- `NEXT_PUBLIC_API_BASE_URL`
- `NEXT_PUBLIC_APP_NAME`

Tạo `.env.example`.

### 8.2 API error model
Tạo chuẩn hóa lỗi:
- status code
- message
- code nếu có
- details nếu có

Tạo helper để map lỗi sang UI message.

### 8.3 Interceptors
- inject bearer token
- normalize response errors
- optionally handle 401 redirect/logout

### 8.4 Service modules cần tạo sẵn
- `documents.api.ts`
- `workflow.api.ts`
- `approvals.api.ts`
- `audit.api.ts`
- `acl.api.ts`

### 8.5 Endpoint mapping phải bám contract hiện tại
Theo `API_CONTRACT.md`, scaffold method cho ít nhất:

#### Documents / Metadata
- `GET /metadata/documents`
- `POST /metadata/documents`
- `GET /metadata/documents/:docId`
- `PATCH /metadata/documents/:docId`
- `GET /metadata/documents/:docId/workflow-history`
- `GET /metadata/documents/:docId/acl`
- `POST /metadata/documents/:docId/acl`
- `POST /metadata/documents/:docId/download-authorize`

#### Document service
- `POST /documents/:docId/upload`
- `POST /documents/:docId/presign-download`

#### Workflow
- `POST /workflow/:docId/submit`
- `POST /workflow/:docId/approve`
- `POST /workflow/:docId/reject`
- `POST /workflow/:docId/archive`

#### Audit
- `GET /audit/query`

Phải tạo signature typed cho từng method dù phase này chưa dùng hết.

---

## 9. Types và DTO bắt buộc

Tạo typed DTO tối thiểu cho FE, bám contract và ERD.

### 9.1 Enums
Tạo enums hoặc literal union:
- `DocumentStatus = 'DRAFT' | 'PENDING' | 'PUBLISHED' | 'ARCHIVED'`
- `ClassificationLevel = 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL' | 'SECRET'`
- `AclPermission = 'READ' | 'WRITE' | 'DELETE' | 'APPROVE' | 'AUDIT' | 'SHARE'`
- `AclEffect = 'ALLOW' | 'DENY'`
- role literals: `viewer`, `editor`, `approver`, `compliance_officer`, `admin`

### 9.2 Document list item
Gồm tối thiểu:
- id
- title
- description
- status
- classificationLevel
- ownerId hoặc ownerDisplay
- currentVersionNumber
- createdAt
- updatedAt
- tags: string[]

### 9.3 Document detail
Gồm thêm:
- filename hiện tại nếu có
- mimeType nếu có
- fileSize nếu có
- acl summary nếu có
- versions
- workflow history

### 9.4 ACL item
- subjectType
- subjectId
- permission
- effect
- createdAt

### 9.5 Workflow history item
- action
- actorId / actorDisplay
- fromStatus
- toStatus
- comment
- createdAt

### 9.6 Audit row
- id
- action
- actor
- result
- targetType
- targetId
- timestamp
- metadata/context nếu có

### 9.7 Pagination/search params
Tạo type riêng cho list filters và pagination params.

---

## 10. React Query scaffold

Tạo TanStack Query foundation.

### 10.1 Provider
Tạo `query-provider.tsx`, mount ở app root.

### 10.2 Query key factory
Ít nhất có:
- `documentsKeys.all`
- `documentsKeys.list(filters)`
- `documentsKeys.detail(id)`
- `documentsKeys.workflowHistory(id)`
- `documentsKeys.acl(id)`
- `approvalsKeys.queue(filters)`
- `auditKeys.query(filters)`

### 10.3 Hooks bắt buộc
Tạo hook skeleton cho:
- `useDocumentsList`
- `useDocumentDetail`
- `useCreateDocument`
- `useUpdateDocument`
- `useUploadDocumentFile`
- `useWorkflowHistory`
- `useDocumentAcl`
- `useUpdateDocumentAcl`
- `useAuthorizeDownload`
- `usePresignDownload`
- `useSubmitDocument`
- `useApproveDocument`
- `useRejectDocument`
- `useArchiveDocument`
- `useApprovalQueue`
- `useAuditQuery`

Các hook phải có invalidation cơ bản đúng hướng.

---

## 11. App shell và layout

Tạo dashboard layout đẹp, sạch, nhất quán.

### 11.1 Sidebar
Hiển thị:
- Documents
- New Document
- Approvals (nếu role phù hợp)
- Audit (nếu role phù hợp)
- Settings

Sidebar phải:
- dark theme
- active item rõ
- có app logo/text DocVault
- responsive collapse ở mobile

### 11.2 Header
Hiển thị:
- breadcrumb hoặc page title
- ô search placeholder (global search chưa cần hoạt động thật)
- user menu/avatar placeholder
- logout action scaffold

### 11.3 Page shell
Tạo layout wrapper thống nhất:
- title
- description
- actions area
- content section spacing chuẩn

---

## 12. Component reusable phải tạo

### 12.1 Common UI
- `BadgeStatus`
- `BadgeClassification`
- `EmptyState`
- `ErrorState`
- `LoadingState`
- `ConfirmDialog`
- `SearchInput`
- `SectionHeader`

### 12.2 Form controls
Tạo wrapper tích hợp React Hook Form cho:
- text input
- textarea
- select
- multi-select tags
- date range basic nếu hợp lý

### 12.3 Table foundation
Tạo table foundation tái sử dụng cho documents/approvals/audit.
Không cần quá phức tạp nhưng phải có scaffold cho:
- columns
- toolbar
- pagination area
- empty state

### 12.4 Document-specific
- `DocumentCard`
- `DocumentListFilters`
- `DocumentMetadataForm`
- `UploadFilePanel`
- `AclPanel`
- `VersionsPanel`
- `WorkflowTimeline`
- `DocumentActions`

---

## 13. Skeleton cho từng page

## 13.1 `/documents`
Tạo page danh sách tài liệu gồm:
- page shell
- filter bar
- table hoặc card list desktop-first
- search input
- status filter
- classification filter
- owner filter placeholder nếu cần
- loading state
- empty state
- error state
- button “New Document” nếu role phù hợp

Phase này có thể dùng data thật nếu API sẵn sàng; nếu chưa chắc, hãy code theo query hook và để fallback/mock-safe.

## 13.2 `/documents/new`
Tạo form tạo metadata tài liệu:
- title
- description
- classification level
- tags
- button save draft
- sau khi tạo thành công có thể chuyển sang detail hoặc edit/upload flow
- validation bằng zod

Không cần full polish, nhưng flow phải rõ.

## 13.3 `/documents/[id]`
Tạo page detail gồm các section:
- summary card
- metadata section
- actions bar theo role/status
- versions panel
- workflow timeline
- acl panel
- tải file / authorize download section

Mỗi section có placeholder/loading đúng.

## 13.4 `/documents/[id]/edit`
Tạo form edit metadata cho document ở trạng thái cho phép edit.
Nếu status không cho edit hoặc role không đủ, show state phù hợp.

## 13.5 `/approvals`
Tạo page approval queue gồm:
- table danh sách pending documents
- quick actions scaffold approve/reject
- row click mở detail
- filter cơ bản
- restricted to approver/admin

## 13.6 `/audit`
Tạo page audit gồm:
- filter bar (time range, action, actor, result)
- audit table
- empty/loading/error states
- restricted to compliance_officer/admin

## 13.7 `/settings`
Tạo settings page tối thiểu gồm:
- profile/session card
- role list
- environment info cơ bản
- placeholder system preferences

## 13.8 `/login`
Đã mô tả ở phần auth.

---

## 14. Permission model FE bắt buộc

Tạo helper permission tập trung, không rải logic khắp nơi.

Ít nhất phải có các function:
- `canViewDocuments(user)`
- `canCreateDocument(user)`
- `canEditDocument(user, document)`
- `canSubmitDocument(user, document)`
- `canApproveDocument(user, document)`
- `canRejectDocument(user, document)`
- `canArchiveDocument(user, document)`
- `canViewAudit(user)`
- `canDownloadDocument(user, document)`
- `canManageAcl(user, document)`

Gợi ý nghiệp vụ hiện tại:
- viewer: xem list/detail, tải chỉ khi published và được phép
- editor: tạo/edit draft/upload/submit
- approver: approve/reject/archive, xem approval queue
- compliance_officer: xem audit, xem metadata nhưng không được download
- admin: có thể được phép rộng hơn trong dev/demo

Bám implementation hiện tại, không tự bịa role mới.

---

## 15. Xử lý download flow đúng contract

Tạo helper/service cho flow 2 bước:
1. `POST /metadata/documents/:docId/download-authorize` lấy token/grant
2. `POST /documents/:docId/presign-download` lấy URL hoặc stream info

Tạo abstraction `downloadDocument(docId)` ở FE để phase sau chỉ cần nối UI.
Nếu chưa thể hoàn thiện tải thật, vẫn phải để sẵn service/hook và placeholder UI.

---

## 16. Xử lý upload flow đúng hướng

Tạo `UploadFilePanel` với:
- chọn file
- validate basic size/type nếu có rule chung
- gọi `POST /documents/:docId/upload`
- hiển thị loading/progress placeholder
- success/error state

Nếu endpoint backend cần multipart/form-data, code đúng kiểu đó.

---

## 17. URL state và filters

Ở page list/approval/audit, hãy scaffold URL search params cho filter chính nếu hợp lý.
Ví dụ:
- `q`
- `status`
- `classification`
- `page`
- `pageSize`
- `from`
- `to`

Phase này chỉ cần hỗ trợ cơ bản, không cần quá nhiều edge case.

---

## 18. Error/loading/empty UX bắt buộc

Tạo pattern thống nhất:
- page loading skeleton
- section skeleton
- retry button khi lỗi
- empty states có icon + message + CTA hợp lý

Ví dụ:
- Documents empty: “Chưa có tài liệu nào” + nút tạo mới nếu có quyền
- Approvals empty: “Không có tài liệu chờ duyệt”
- Audit empty: “Không có bản ghi phù hợp bộ lọc”

---

## 19. Seed/mock safety

Vì backend có thể chưa hoàn thiện 100%, hãy viết code theo hướng:
- ưu tiên query thật
- nhưng nếu endpoint chưa sẵn, component vẫn render được state placeholder hợp lý
- không làm app crash vì undefined data
- không block toàn project chỉ vì 1 endpoint chưa có

Có thể tạo mock adapters nội bộ nếu thật sự cần, nhưng phải dễ gỡ bỏ và không xen lẫn business logic chính.

---

## 20. Accessibility và UX tối thiểu

Bảo đảm:
- button/link có label rõ
- form field có label và error message
- keyboard navigation cơ bản ổn
- contrast đủ tốt
- badge/status dễ phân biệt
- mobile không vỡ layout nghiêm trọng

---

## 21. File cấu hình cần tạo/chỉnh

Hãy tạo hoặc cập nhật:
- `package.json`
- `.env.example`
- `tsconfig.json`
- `tailwind.config.ts`
- `components.json`
- `next.config.mjs`
- `src/config/env.ts`
- `src/config/nav.ts`

Trong `.env.example` ít nhất có:

```env
NEXT_PUBLIC_APP_NAME=DocVault
NEXT_PUBLIC_API_BASE_URL=http://localhost:8080/api
```

Điều chỉnh URL nếu repo hiện tại dùng gateway path khác.

---

## 22. Definition of Done cho phase 2

Chỉ được coi là xong khi đạt đủ:

1. FE project chạy local thành công.
2. App Router hoạt động.
3. Có dashboard layout với sidebar + header.
4. Có đầy đủ route scaffold.
5. Có auth/session/provider scaffold.
6. Có API client typed + service modules.
7. Có React Query provider + hooks skeleton.
8. Có reusable components cơ bản.
9. Có page skeleton cho documents/new/detail/edit/approvals/audit/settings/login.
10. Có permission helpers tập trung.
11. Có design tokens/palette áp dụng được.
12. Có loading/error/empty states cơ bản.
13. `npm run lint` hoặc tương đương pass.
14. `npm run build` hoặc tương đương pass.
15. Không có TODO kiểu “implement everything later” mà thiếu scaffold cốt lõi.

---

## 23. Kết quả đầu ra mong muốn từ AI Agent

Sau khi thực hiện, hãy trả về:

1. **Danh sách file đã tạo/chỉnh**
2. **Tóm tắt kiến trúc FE scaffold**
3. **Các giả định đã dùng**
4. **Các endpoint đã map**
5. **Những phần còn để phase 3 hoàn thiện**

Nếu có xung đột tài liệu, hãy ghi rõ bạn đã ưu tiên nguồn nào.

---

## 24. Hướng thực thi ưu tiên

Thứ tự làm việc mong muốn:

1. bootstrap dependencies + config
2. theme + globals + providers
3. auth/session scaffold
4. API client + service modules + types
5. layout + navigation
6. reusable UI foundation
7. page skeletons
8. query hooks + mutations skeleton
9. permission guards
10. final lint/build fix

---

## 25. Ràng buộc cuối cùng

- Không viết code sơ sài kiểu demo throwaway.
- Không bỏ qua typing.
- Không trộn business logic vào UI quá mức.
- Không tạo thiết kế lệch khỏi DocVault enterprise security dashboard.
- Không tự ý đổi workflow sang state khác; phải giữ:
  - `DRAFT -> PENDING -> PUBLISHED -> ARCHIVED`
  - reject đưa `PENDING -> DRAFT`
- Không thêm role ngoài context hiện tại.
- Không loại bỏ route/pages đã xác định trong design system.

Hãy bắt đầu thực hiện phase 2 ngay bây giờ và dựng scaffold hoàn chỉnh cho codebase FE.
