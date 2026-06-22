/**
 * Audit Chain Repair Script
 *
 * Repairs a broken audit hash chain by recomputing hashes and prevHash links
 * from the first broken event onwards.
 *
 * IMPORTANT: This is a DEV/LOCAL recovery tool only.
 * Recomputing hashes means the chain will be valid again, but the repaired
 * events will have DIFFERENT hashes than the originals — any external system
 * that recorded old hashes will see a discrepancy.
 *
 * Usage:
 *   npx ts-node scripts/repair-audit-chain.ts --dry-run    # preview only
 *   npx ts-node scripts/repair-audit-chain.ts --apply      # actually fix
 */

import 'dotenv/config';
import { createHash } from 'crypto';
import { Collection, MongoClient, ObjectId } from 'mongodb';

// ── Types ────────────────────────────────────────────────────────────────────

interface AuditEventRecord {
  _id: ObjectId;
  eventId: string;
  timestamp: Date | string;
  actorId: string;
  actorRoles: string[];
  action: string;
  resourceType: string;
  resourceId?: string | null;
  result: string;
  reason?: string | null;
  ip?: string | null;
  traceId?: string | null;
  metadata?: Record<string, unknown>;
  prevHash: string | null;
  hash: string;
  signature?: string;
  signatureKid?: string;
}

// ── Hash helpers (mirrored from AuditService) ────────────────────────────────

function sortMetadataValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sortMetadataValue(item));
  }
  if (value !== null && typeof value === 'object' && !(value instanceof Date)) {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((sorted, key) => {
        sorted[key] = sortMetadataValue(
          (value as Record<string, unknown>)[key],
        );
        return sorted;
      }, {});
  }
  return value;
}

function canonicalMetadata(
  metadata: Record<string, unknown> | undefined,
): string | undefined {
  if (
    metadata === undefined ||
    metadata === null ||
    Object.keys(metadata).length === 0
  ) {
    return undefined;
  }
  return JSON.stringify(sortMetadataValue(metadata));
}

function buildCanonicalPayload(fields: Record<string, any>): string {
  return Object.keys(fields)
    .sort()
    .map((key) => {
      const value = fields[key];
      if (value === undefined || value === null) return `${key}=`;
      if (Array.isArray(value)) return `${key}=${value.join(',')}`;
      return `${key}=${value}`;
    })
    .join('|');
}

function computeHash(
  prevHash: string | null,
  canonicalPayload: string,
): string {
  const input = `${prevHash ?? ''}|${canonicalPayload}`;
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

function canonicalTimestamp(value: Date | string | undefined): string {
  if (value instanceof Date) return value.toISOString();
  if (value && typeof (value as any).toISOString === 'function') {
    return (value as any).toISOString();
  }
  return value as string;
}

function getCanonicalFields(event: AuditEventRecord): Record<string, any> {
  const fields: Record<string, any> = {
    eventId: event.eventId,
    timestamp: canonicalTimestamp(event.timestamp),
    actorId: event.actorId,
    actorRoles: event.actorRoles,
    action: event.action,
    resourceType: event.resourceType,
    resourceId: event.resourceId,
    result: event.result,
    reason: event.reason,
    ip: event.ip,
    traceId: event.traceId,
  };
  const metadataStr = canonicalMetadata(event.metadata);
  if (metadataStr !== undefined) {
    fields.metadata = metadataStr;
  }
  return fields;
}

// ── Signing helpers ──────────────────────────────────────────────────────────

function getSigningSecret(): { kid?: string; secret: string } | null {
  const kid = process.env.AUDIT_SIGNING_KID?.trim();
  if (kid) {
    const secret = process.env[`AUDIT_SIGNING_SECRET_${kid}`];
    return secret && secret.trim().length > 0 ? { kid, secret } : null;
  }
  const secret = process.env.AUDIT_SIGNING_SECRET;
  return secret && secret.trim().length > 0 ? { secret } : null;
}

function signHash(hash: string, secret: string): string {
  return createHash('sha256')
    .update(`${secret}:${hash}`, 'utf8')
    .digest('hex');
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const dryRun = !args.includes('--apply');

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Audit Chain Repair Script
=========================
Repairs a broken audit hash chain by recomputing hashes from the break point.

Usage:
  npx ts-node scripts/repair-audit-chain.ts --dry-run    # preview (default)
  npx ts-node scripts/repair-audit-chain.ts --apply      # actually repair

Environment:
  MONGODB_URI          MongoDB connection string (required)
  AUDIT_SIGNING_SECRET Server-side HMAC secret (optional, for re-signing)
  AUDIT_SIGNING_KID    Key ID for secret rotation (optional)
`);
    return;
  }

  const mongoUrl = process.env.MONGODB_URI;
  if (!mongoUrl) {
    console.error('ERROR: Missing MONGODB_URI in environment.');
    process.exit(1);
  }

  console.log(`Mode: ${dryRun ? 'DRY RUN (no changes)' : 'APPLY (will modify DB)'}`);
  console.log('');

  const client = new MongoClient(mongoUrl);
  await client.connect();

  try {
    const collection = client
      .db()
      .collection<AuditEventRecord>('audit_events');

    // Load ALL events in chain order
    const events = await collection
      .find({})
      .sort({ timestamp: 1, _id: 1 })
      .toArray();

    console.log(`Total events in database: ${events.length}`);
    if (events.length === 0) {
      console.log('No events to repair.');
      return;
    }

    // ── Step 1: Find the first broken index ──────────────────────────────

    let firstBrokenIndex = -1;

    for (let i = 0; i < events.length; i++) {
      const event = events[i];
      const expectedPrevHash = i === 0 ? null : events[i - 1].hash;
      const canonicalPayload = buildCanonicalPayload(
        getCanonicalFields(event),
      );
      const expectedHash = computeHash(
        i === 0 ? null : events[i - 1].hash,
        canonicalPayload,
      );

      if (event.hash !== expectedHash || event.prevHash !== expectedPrevHash) {
        firstBrokenIndex = i;
        break;
      }
    }

    if (firstBrokenIndex === -1) {
      console.log('✅ Chain is already valid. Nothing to repair.');
      return;
    }

    console.log(`❌ Chain broken at index ${firstBrokenIndex} (eventId=${events[firstBrokenIndex].eventId})`);
    console.log(`   Events 0..${firstBrokenIndex - 1} are valid.`);
    console.log(`   Events ${firstBrokenIndex}..${events.length - 1} need recomputation (${events.length - firstBrokenIndex} events).`);
    console.log('');

    // ── Step 2: Recompute hashes from the break point ────────────────────

    const signing = getSigningSecret();
    if (signing) {
      console.log(`Signing enabled (kid=${signing.kid ?? 'default'}). Will re-sign repaired events.`);
    } else {
      console.log('No signing secret configured. Repaired events will be unsigned.');
    }
    console.log('');

    const updates: Array<{
      _id: ObjectId;
      eventId: string;
      oldHash: string;
      newHash: string;
      oldPrevHash: string | null;
      newPrevHash: string | null;
    }> = [];

    // Need to track the running "correct" previous hash
    let runningPrevHash: string | null =
      firstBrokenIndex === 0 ? null : events[firstBrokenIndex - 1].hash;

    for (let i = firstBrokenIndex; i < events.length; i++) {
      const event = events[i];
      const canonicalPayload = buildCanonicalPayload(
        getCanonicalFields(event),
      );
      const newHash = computeHash(runningPrevHash, canonicalPayload);

      if (event.hash !== newHash || event.prevHash !== runningPrevHash) {
        updates.push({
          _id: event._id,
          eventId: event.eventId,
          oldHash: event.hash,
          newHash,
          oldPrevHash: event.prevHash,
          newPrevHash: runningPrevHash,
        });
      }

      // Update running prev hash for next iteration
      runningPrevHash = newHash;
    }

    console.log(`Events requiring update: ${updates.length}`);
    console.log('');

    // ── Step 3: Show changes ─────────────────────────────────────────────

    for (const u of updates) {
      console.log(`  eventId: ${u.eventId}`);
      console.log(`    prevHash: ${u.oldPrevHash ?? 'null'} → ${u.newPrevHash ?? 'null'}`);
      console.log(`    hash:     ${u.oldHash} → ${u.newHash}`);
      console.log('');
    }

    // ── Step 4: Apply if not dry-run ─────────────────────────────────────

    if (dryRun) {
      console.log('🔍 Dry run complete. No changes made.');
      console.log('   Run with --apply to repair the chain.');
      return;
    }

    console.log('Applying repairs...');

    // Drop unique chain indexes temporarily to avoid conflicts during bulk
    // update (events may temporarily share prevHash values mid-repair).
    let droppedIndex = false;
    for (const indexName of ['epochId_1_prevHash_1', 'prevHash_1']) {
      try {
        await collection.dropIndex(indexName);
        droppedIndex = true;
        console.log(`  Temporarily dropped ${indexName}.`);
      } catch {
        // Index may not exist or have a different name — proceed anyway.
        console.log(`  Note: Could not drop ${indexName}. Proceeding.`);
      }
    }

    let updatedCount = 0;
    for (const u of updates) {
      const updateFields: Record<string, any> = {
        hash: u.newHash,
        prevHash: u.newPrevHash,
      };

      // Re-sign if signing is configured
      if (signing) {
        updateFields.signature = signHash(u.newHash, signing.secret);
        if (signing.kid) {
          updateFields.signatureKid = signing.kid;
        }
      }

      const result = await collection.updateOne(
        { _id: u._id },
        { $set: updateFields },
      );

      if (result.modifiedCount === 1) {
        updatedCount++;
      } else {
        console.error(`  ⚠ Failed to update eventId=${u.eventId}`);
      }
    }

    // Recreate the current unique chain index. Do not recreate the legacy
    // global prevHash_1 index; epochs need their own genesis event.
    if (droppedIndex) {
      await collection.createIndex(
        { epochId: 1, prevHash: 1 },
        { unique: true },
      );
      console.log('  Recreated unique epochId+prevHash index.');
    }

    console.log('');
    console.log(`✅ Repaired ${updatedCount}/${updates.length} events.`);

    // ── Step 5: Verify the repaired chain ────────────────────────────────

    console.log('');
    console.log('Verifying repaired chain...');

    const repairedEvents = await collection
      .find({})
      .sort({ timestamp: 1, _id: 1 })
      .toArray();

    let valid = true;
    for (let i = 0; i < repairedEvents.length; i++) {
      const event = repairedEvents[i];
      const expectedPrevHash = i === 0 ? null : repairedEvents[i - 1].hash;
      const canonicalPayload = buildCanonicalPayload(
        getCanonicalFields(event),
      );
      const expectedHash = computeHash(
        i === 0 ? null : repairedEvents[i - 1].hash,
        canonicalPayload,
      );

      if (event.hash !== expectedHash || event.prevHash !== expectedPrevHash) {
        console.error(`  ❌ Still broken at index ${i} (eventId=${event.eventId})`);
        valid = false;
        break;
      }
    }

    if (valid) {
      console.log(`  ✅ Chain is now valid! (${repairedEvents.length} events verified)`);
    }
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
