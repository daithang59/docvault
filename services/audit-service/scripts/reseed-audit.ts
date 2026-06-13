import 'dotenv/config';
import mongoose from 'mongoose';
import { AuditService } from '../src/audit/audit.service';
import { AuditEventSchema } from '../src/mongo/audit-event.schema';

/**
 * Local/dev only: wipe the audit_events collection and rebuild a clean,
 * fork-free hash chain using the real AuditService.create() path (including
 * the unique-prevHash index + concurrency-retry race fix).
 *
 * It also fires a concurrent burst of writes to prove the race fix prevents
 * the chain forking under contention.
 */

const RESEED_FLAG = 'DOCVAULT_ALLOW_AUDIT_RESEED';

const LOCAL_MONGO_HOSTS = [
  'localhost',
  '127.0.0.1',
  '::1',
  'mongo',
  'docvault-mongo',
  'host.docker.internal',
];

function assertEnabled(): void {
  if (process.env[RESEED_FLAG]?.toLowerCase() !== 'true') {
    throw new Error(
      `Refusing to reseed. Set ${RESEED_FLAG}=true for local/dev use.`,
    );
  }
}

function assertLocal(mongoUrl: string): void {
  const match = mongoUrl.match(/^mongodb(?:\+srv)?:\/\/([^/?#]+)/i);
  if (!match) throw new Error('Invalid MONGODB_URI.');
  const authority = match[1].includes('@')
    ? match[1].slice(match[1].lastIndexOf('@') + 1)
    : match[1];
  const hosts = authority
    .split(',')
    .map((h) => h.trim().toLowerCase().split(':')[0]);
  const nonLocal = hosts.filter((h) => !LOCAL_MONGO_HOSTS.includes(h));
  if (nonLocal.length > 0) {
    throw new Error(
      `Refusing to reseed non-local MongoDB host(s): ${nonLocal.join(', ')}.`,
    );
  }
}

async function main(): Promise<number> {
  assertEnabled();

  const mongoUrl = process.env.MONGODB_URI;
  if (!mongoUrl) throw new Error('Missing MONGODB_URI.');
  assertLocal(mongoUrl);

  await mongoose.connect(mongoUrl);

  try {
    const model = mongoose.model('AuditEvent', AuditEventSchema);

    // 1. Clean slate: drop the collection so stale (forked) data and any old
    //    indexes are gone, then re-sync indexes (creates unique prevHash index).
    const collections = await mongoose.connection
      .db!.listCollections({ name: 'audit_events' })
      .toArray();
    if (collections.length > 0) {
      await model.collection.drop();
    }
    await model.syncIndexes();
    console.log(
      'Dropped audit_events and synced indexes (unique prevHash enforced).',
    );

    const service = new AuditService(model as any);

    // 2. Seed a deterministic sequence of clean events.
    const seedEvents = [
      {
        actorId: 'user-alice',
        actorRoles: ['editor'],
        action: 'DOCUMENT_CREATED',
        resourceType: 'DOCUMENT',
        resourceId: 'doc-001',
        result: 'SUCCESS',
        metadata: {
          title: 'Contract A',
          classification: 'CONFIDENTIAL',
          amount: '100,000 USD',
        },
      },
      {
        actorId: 'user-alice',
        actorRoles: ['editor'],
        action: 'DOCUMENT_SUBMITTED',
        resourceType: 'DOCUMENT',
        resourceId: 'doc-001',
        result: 'SUCCESS',
      },
      {
        actorId: 'user-bob',
        actorRoles: ['approver'],
        action: 'DOCUMENT_APPROVED',
        resourceType: 'DOCUMENT',
        resourceId: 'doc-001',
        result: 'SUCCESS',
        metadata: { fromStatus: 'PENDING', toStatus: 'PUBLISHED' },
      },
      {
        actorId: 'user-carol',
        actorRoles: ['viewer'],
        action: 'DOCUMENT_DOWNLOAD_DENIED',
        resourceType: 'DOCUMENT',
        resourceId: 'doc-001',
        result: 'ERROR',
        reason: 'CONFIDENTIAL documents require at least the editor role',
      },
    ];

    for (const ev of seedEvents) {
      await service.create(ev as any);
    }
    console.log(`Seeded ${seedEvents.length} sequential events.`);

    // 3. Concurrency test: fire a burst of writes in parallel. Without the race
    //    fix these would fork on a shared prevHash; with it, every write either
    //    wins or retries against the new head, producing a single linear chain.
    const burst = 20;
    await Promise.all(
      Array.from({ length: burst }, (_, i) =>
        service.create({
          actorId: 'user-load',
          actorRoles: ['viewer'],
          action: 'DOCUMENT_VIEWED',
          resourceType: 'DOCUMENT',
          resourceId: `doc-burst-${i}`,
          result: 'SUCCESS',
          metadata: { index: i, source: 'reseed-concurrency-test' },
        } as any),
      ),
    );
    console.log(`Fired ${burst} concurrent writes (race-fix stress test).`);

    // 4. Verify the resulting chain is valid and fork-free.
    const result = await service.verifyChain(10000);
    console.log(`verify-chain after reseed: ${JSON.stringify(result)}`);

    const total = await model.countDocuments();
    const distinctPrev = (await model.distinct('prevHash')).length;
    const distinctHash = (await model.distinct('hash')).length;
    console.log(
      `Totals: events=${total}, distinct prevHash=${distinctPrev}, distinct hash=${distinctHash}`,
    );

    if (!result.valid) {
      console.error('Chain invalid after reseed — investigate.');
      return 1;
    }
    if (distinctHash !== total) {
      console.error('Duplicate hashes detected — chain not fork-free.');
      return 1;
    }

    console.log(
      'Reseed complete: clean, fork-free chain ready for the tamper demo.',
    );
    return 0;
  } finally {
    await mongoose.disconnect();
  }
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
