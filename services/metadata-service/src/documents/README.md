# `services/metadata-service/src/documents`

Thu muc nay chua module nghiep vu document metadata.

## File hien co

- `documents.module.ts`
  - Dang ky controller va service cho document
- `documents.controller.ts`
  - Expose `GET /documents` va `POST /documents`
- `documents.service.ts`
  - Goi `PrismaService` de doc/ghi bang `document_metadata`
- `dto/`
  - Chua DTO cho API tao document

## Vai tro

Day la noi metadata-service bat dau tach nghiep vu document khoi `AppController`, giup service de mo rong ve sau.
