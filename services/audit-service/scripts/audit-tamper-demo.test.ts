import * as assert from 'assert/strict';
import {
  DEMO_FLAG,
  NONLOCAL_OVERRIDE_FLAG,
  assertDemoEnabled,
  assertLocalMongoUrl,
  buildCanonicalPayload,
  computeAuditHash,
  selectNonHeadTamperTarget,
  verifyAuditChain,
  type AuditEventRecord,
} from './audit-tamper-demo';

type TestFn = () => void;

function test(name: string, fn: TestFn) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

function makeEvent(
  eventId: string,
  timestamp: Date,
  prevHash: string | null,
): AuditEventRecord {
  const event: AuditEventRecord = {
    eventId,
    timestamp,
    actorId: 'user-1',
    actorRoles: ['VIEWER'],
    action: 'DOCUMENT_READ',
    resourceType: 'DOCUMENT',
    resourceId: 'doc-1',
    result: 'ALLOW',
    reason: null,
    ip: '127.0.0.1',
    traceId: `trace-${eventId}`,
    prevHash,
    hash: '',
  };

  event.hash = computeAuditHash(
    prevHash,
    buildCanonicalPayload({
      eventId: event.eventId,
      timestamp: timestamp.toISOString(),
      actorId: event.actorId,
      actorRoles: event.actorRoles,
      action: event.action,
      resourceType: event.resourceType,
      resourceId: event.resourceId,
      result: event.result,
      reason: event.reason,
      ip: event.ip,
      traceId: event.traceId,
      metadata: undefined,
    }),
  );

  return event;
}

test('requires the explicit tamper demo environment flag', () => {
  assert.throws(
    () => assertDemoEnabled({}),
    new RegExp(`${DEMO_FLAG}=true`),
  );
  assert.doesNotThrow(() => assertDemoEnabled({ [DEMO_FLAG]: 'true' }));
});

test('allows only local MongoDB URLs unless the second override is explicit', () => {
  assert.equal(
    assertLocalMongoUrl(
      'mongodb://root:rootpw@localhost:27017/docvault_audit?authSource=admin',
      {},
    ).overrideUsed,
    false,
  );
  assert.equal(
    assertLocalMongoUrl('mongodb://mongo:27017/docvault_audit', {})
      .overrideUsed,
    false,
  );

  assert.throws(
    () =>
      assertLocalMongoUrl('mongodb://prod-db.example.com:27017/docvault', {}),
    /Refusing to use non-local MongoDB host/,
  );
  assert.throws(
    () => assertLocalMongoUrl('mongodb+srv://cluster.example.com/docvault', {}),
    /Refusing to use non-local MongoDB host/,
  );

  assert.equal(
    assertLocalMongoUrl('mongodb://prod-db.example.com:27017/docvault', {
      [NONLOCAL_OVERRIDE_FLAG]: 'true',
    }).overrideUsed,
    true,
  );
});

test('selects a non-head audit event and rejects short chains', () => {
  const first = makeEvent('event-1', new Date('2026-05-30T00:00:00Z'), null);
  const second = makeEvent(
    'event-2',
    new Date('2026-05-30T00:01:00Z'),
    first.hash,
  );
  const third = makeEvent(
    'event-3',
    new Date('2026-05-30T00:02:00Z'),
    second.hash,
  );

  assert.equal(selectNonHeadTamperTarget([first, second]).eventId, first.eventId);
  assert.equal(
    selectNonHeadTamperTarget([first, second, third]).eventId,
    second.eventId,
  );
  assert.throws(
    () => selectNonHeadTamperTarget([first]),
    /Need at least 2 audit events/,
  );
});

test('chain verification detects a mutated non-head event', () => {
  const first = makeEvent('event-1', new Date('2026-05-30T00:00:00Z'), null);
  const second = makeEvent(
    'event-2',
    new Date('2026-05-30T00:01:00Z'),
    first.hash,
  );

  assert.deepEqual(verifyAuditChain([first, second]), {
    valid: true,
    checked: 2,
  });

  const tampered = [{ ...first, reason: 'tampered' }, second];

  assert.equal(verifyAuditChain(tampered).valid, false);
  assert.equal(verifyAuditChain(tampered).firstBrokenIndex, 0);
  assert.match(verifyAuditChain(tampered).message ?? '', /Hash mismatch/);
});
