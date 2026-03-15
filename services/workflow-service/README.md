# workflow-service

Workflow service owns the MVP state machine:

- `DRAFT -> PENDING` on submit
- `PENDING -> PUBLISHED` on approve
- `PENDING -> DRAFT` on reject

It updates status through metadata-service and emits audit plus notification side effects.
