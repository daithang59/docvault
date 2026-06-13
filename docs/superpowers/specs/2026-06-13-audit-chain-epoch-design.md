# Audit Chain Epoch Design

## Context

DocVault audit events are hash-chained with `prevHash` and `hash`. The current
`verify-chain` flow is intentionally tamper-evident: if an old event is edited,
deleted, reordered, or rehashed incorrectly, verification returns invalid.

The local development script can recompute hashes to make a chain valid again,
but that behavior is not appropriate for production because it changes evidence
and can hide the fact that the historical audit record was compromised.

## Goal

Add a production-safe recovery model for audit chain integrity incidents:

- keep compromised history visible;
- avoid pretending repaired hashes are original evidence;
- allow new audit events to continue in a trusted chain;
- give compliance/admin users a clear status for current and historical audit
  evidence.

## Recommended Model

Introduce audit chain epochs. An epoch is one continuous hash chain. At most one
epoch is active for new writes.

When verification finds an unrecoverable break:

1. Snapshot the current audit database for evidence.
2. Identify the first broken event and last trusted hash.
3. Mark the current epoch as `COMPROMISED`.
4. Record an audit-chain incident with verification details.
5. Start a new active epoch.
6. Link the first event in the new epoch to the incident record.

The old epoch remains queryable and visibly compromised. The new epoch can be
valid from the point of recovery onward.

## Data Model

Add `epochId` to audit events:

```ts
audit_events {
  epochId: string;
  eventId: string;
  timestamp: Date;
  prevHash: string | null;
  hash: string;
  signature?: string;
  signatureKid?: string;
}
```

Add an epoch collection:

```ts
audit_chain_epochs {
  epochId: string;
  status: 'ACTIVE' | 'SEALED' | 'COMPROMISED';
  startedAt: Date;
  endedAt?: Date;
  genesisReason: 'INITIAL' | 'ROTATION' | 'COMPROMISE_RECOVERY';
  previousEpochId?: string;
  lastTrustedHash?: string;
  firstBrokenIndex?: number;
  firstBrokenEventId?: string;
  incidentId?: string;
  createdBy: string;
  reason: string;
}
```

Add an incident collection or reuse an existing security recommendation workflow
if the project wants fewer persistence surfaces:

```ts
audit_chain_incidents {
  incidentId: string;
  detectedAt: Date;
  detectedBy: string;
  affectedEpochId: string;
  firstBrokenIndex: number;
  firstBrokenEventId?: string;
  lastTrustedHash?: string;
  verifyMessage: string;
  status: 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED';
  resolution: 'RESTORED_FROM_TRUSTED_BACKUP' | 'NEW_EPOCH_STARTED';
}
```

## Backend Behavior

`create()` appends only to the active epoch. The previous head lookup should be
scoped by `epochId`, and the unique `prevHash` index should include `epochId` so
separate epochs can each have a genesis event.

`verifyChain()` should support:

- verifying the active epoch;
- verifying a specific epoch;
- returning an aggregate status across epochs.

Aggregate status should distinguish:

- active epoch valid;
- historical epoch compromised;
- no active epoch;
- signature failures;
- unsigned legacy events.

## Recovery Flow

Production should not expose a general "repair hash" button.

The safe action is "Seal and Start New Epoch", available only to admin or a
compliance role with an explicit reason. The action should be blocked unless the
current verification result is invalid and the operator confirms that trusted
restore is not being applied.

The action writes its own audit event into the new epoch, for example:

```text
AUDIT_CHAIN_EPOCH_STARTED
metadata: {
  previousEpochId,
  incidentId,
  firstBrokenIndex,
  lastTrustedHash
}
```

If trusted backup restore is available, restore original events first and verify
again. Only start a new epoch when the original chain cannot be restored.

## UI Behavior

The Audit page should not show only a single red/green chain state. It should
show current and historical posture:

```text
Current epoch: Valid
Previous epoch: Compromised under incident AUDIT-INC-0007
Broken at event index 3
Last trusted hash: abc...
```

The Security/Evidence pages should treat a compromised historical epoch as a
compliance finding, but they should not block the display of valid evidence from
the new active epoch.

## Security Rules

- Keep `repair-audit-chain.ts` for local/development only.
- Do not add a production endpoint that recomputes old hashes silently.
- Require `AUDIT_SIGNING_SECRET` in production so raw DB write access is not
  enough to forge valid signed events.
- Log every epoch state transition.
- Preserve compromised data instead of deleting or rewriting it.

## Test Strategy

Add focused backend tests for:

- appending events into the active epoch;
- verifying a valid active epoch;
- detecting a compromised epoch;
- creating a new epoch after compromise;
- ensuring new epoch verification does not depend on the compromised epoch;
- aggregate status reporting both active-valid and historical-compromised;
- unique `prevHash` behavior scoped by `epochId`;
- authorization for the recovery action.

Add frontend tests for:

- active valid state;
- invalid active state;
- valid active epoch with compromised historical epoch;
- recovery action visibility by role;
- evidence readiness when only historical epochs are compromised.

## Non-Goals

- This design does not make tampered historical events trustworthy.
- This design does not replace incident response or trusted backup restore.
- This design does not expose hash recomputation as a production recovery path.
- This design does not require users to edit audit records from the app UI.

## Success Criteria

The feature is complete when production can continue writing trusted audit events
after an unrecoverable chain compromise while preserving clear evidence that the
older epoch was compromised.
