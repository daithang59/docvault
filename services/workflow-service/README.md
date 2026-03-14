# `workflow-service`

Day la folder placeholder cho workflow/state-machine service.

## Trang thai hien tai

- Chua co source code
- Chua co API submit/approve/reject

## Vai tro du kien

- Dieu phoi vong doi document
- Enforce transition nhu:
  - `Draft -> Pending`
  - `Pending -> Approved`
  - `Pending -> Rejected`
- Goi `metadata-service` de cap nhat status
- Co the phat sinh audit/notification event

## Khi bat dau implement

Nen xac dinh truoc:

- state machine toi thieu
- quyen role cho tung transition
- hop dong API voi `metadata-service`
