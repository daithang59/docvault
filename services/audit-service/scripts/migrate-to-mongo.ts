/**
 * Script migrate audit logs from PostgreSQL → MongoDB.
 *
 * Usage:
 *   pnpm ts-node scripts/migrate-to-mongo.ts
 *
 * Prerequisites:
 *   - PostgreSQL source is accessible (DATABASE_URL)
 *   - MongoDB destination is accessible (MONGODB_URI)
 *   - audit-service is STOPPED (no writes during migration)
 *
 * Notes:
 *   - Hash chain is recomputed for migrated events (MongoDB is empty at start)
 *   - MongoDB must be empty — script aborts if any existing data is found
 *   - Re-running this script is NOT safe after first successful run
 */

import 'dotenv/config';
import { createHash } from 'crypto';
import { Client as PgClient } from 'pg';
import { MongoClient, Collection } from 'mongodb';

const BATCH_SIZE = 500;

interface PgAuditEvent {
  eventid: string;
  timestamp: Date;
  actorid: string;
  actorroles: string[];
  action: string;
  resourcetype: string;
  resourceid: string | null;
  result: string;
  reason: string | null;
  ip: string | null;
  traceid: string | null;
  prevhash: string | null;
  hash: string;
}

interface MongoAuditEvent {
  eventId: string;
  timestamp: Date;
  actorId: string;
  actorRoles: string[];
  action: string;
  resourceType: string;
  resourceId?: string;
  result: string;
  reason?: string;
  ip?: string;
  traceId?: string;
  prevHash?: string;
  hash: string;
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

function computeHash(prevHash: string | null, canonicalPayload: string): string {
  const input = `${prevHash ?? ''}|${canonicalPayload}`;
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

async function main() {
  const pgUrl = process.env.DATABASE_URL;
  const mongoUrl = process.env.MONGODB_URI;

  if (!pgUrl || !mongoUrl) {
    console.error('❌  Missing DATABASE_URL or MONGODB_URI in environment');
    process.exit(1);
  }

  // ── Connect to PostgreSQL ──────────────────────────────────────────────────
  const pg = new PgClient({ connectionString: pgUrl });
  await pg.connect();
  console.log('✅  Connected to PostgreSQL');

  // ── Connect to MongoDB ─────────────────────────────────────────────────────
  const mongo = new MongoClient(mongoUrl);
  await mongo.connect();
  console.log('✅  Connected to MongoDB');

  const db = mongo.db();
  const collection: Collection<MongoAuditEvent> = db.collection('audit_events');

  // ── Safety check: MongoDB must be empty ───────────────────────────────────
  const existingCount = await collection.countDocuments();
  if (existingCount > 0) {
    console.error(`❌  MongoDB already has ${existingCount} document(s). Wipe it first before re-running.`);
    await pg.end();
    await mongo.close();
    process.exit(1);
  }

  // ── Count source rows ─────────────────────────────────────────────────────
  const { rows: totalRows } = await pg.query<{ count: string }>(
    'SELECT COUNT(*) as count FROM audit_events',
  );
  const total = Number(totalRows[0].count);
  console.log(`📦  Found ${total} events to migrate`);

  if (total === 0) {
    console.log('✅  Nothing to migrate');
    await pg.end();
    await mongo.close();
    return;
  }

  // ── Fetch and migrate in batches ─────────────────────────────────────────
  let processed = 0;
  let prevHash: string | null = null;
  let offset = 0;

  while (offset < total) {
    const { rows: batch } = await pg.query<PgAuditEvent>(
      `SELECT eventid, timestamp, actorid, actorroles, action,
              resourcetype, resourceid, result, reason, ip, traceid,
              prevhash, hash
       FROM audit_events
       ORDER BY timestamp ASC
       LIMIT ${BATCH_SIZE} OFFSET ${offset}`,
    );

    if (batch.length === 0) break;

    const mongoEvents: MongoAuditEvent[] = [];

    for (const row of batch) {
      // Recompute hash chain from scratch in MongoDB
      const canonicalPayload = buildCanonicalPayload({
        eventId: row.eventid,
        timestamp: row.timestamp.toISOString(),
        actorId: row.actorid,
        actorRoles: row.actorroles,
        action: row.action,
        resourceType: row.resourcetype,
        resourceId: row.resourceid ?? undefined,
        result: row.result,
        reason: row.reason ?? undefined,
        ip: row.ip ?? undefined,
        traceId: row.traceid ?? undefined,
      });

      const hash = computeHash(prevHash, canonicalPayload);

      mongoEvents.push({
        eventId: row.eventid,
        timestamp: row.timestamp,
        actorId: row.actorid,
        actorRoles: row.actorroles,
        action: row.action,
        resourceType: row.resourcetype,
        resourceId: row.resourceid ?? undefined,
        result: row.result,
        reason: row.reason ?? undefined,
        ip: row.ip ?? undefined,
        traceId: row.traceid ?? undefined,
        prevHash: prevHash ?? undefined,
        hash,
      });

      prevHash = hash;
    }

    await collection.insertMany(mongoEvents, { ordered: false });
    processed += batch.length;
    offset += BATCH_SIZE;
    console.log(`   Migrated ${processed}/${total} events`);
  }

  // ── Verify ───────────────────────────────────────────────────────────────
  const mongoCount = await collection.countDocuments();
  console.log(
    mongoCount === total
      ? `✅  Migration complete: ${mongoCount} events in MongoDB`
      : `⚠️   Mismatch: PostgreSQL had ${total}, MongoDB has ${mongoCount}`,
  );

  await pg.end();
  await mongo.close();
}

main().catch((err) => {
  console.error('❌  Migration failed:', err);
  process.exit(1);
});
