import 'dotenv/config';
import { createHash } from 'crypto';
import { Collection, MongoClient } from 'mongodb';

export const DEMO_FLAG = 'DOCVAULT_ALLOW_AUDIT_TAMPER_DEMO';
export const NONLOCAL_OVERRIDE_FLAG =
  'DOCVAULT_ALLOW_NONLOCAL_AUDIT_TAMPER_DEMO';

const COLLECTION_NAME = 'audit_events';
const DEFAULT_VERIFY_LIMIT = 1000;
const MIN_EVENTS_FOR_TAMPER = 2;

const LOCAL_MONGO_HOSTS = new Set([
  'localhost',
  '127.0.0.1',
  '::1',
  'mongo',
  'docvault-mongo',
  'host.docker.internal',
]);

type Env = Record<string, string | undefined>;

export interface AuditEventRecord {
  _id?: unknown;
  eventId?: string;
  timestamp?: Date | string;
  actorId?: string;
  actorRoles?: string[];
  action?: string;
  resourceType?: string;
  resourceId?: string | null;
  result?: string;
  reason?: string | null;
  ip?: string | null;
  traceId?: string | null;
  metadata?: Record<string, unknown>;
  prevHash?: string | null;
  hash?: string;
}

export interface ChainVerificationResult {
  valid: boolean;
  checked: number;
  firstBrokenIndex?: number;
  message?: string;
}

interface DemoOptions {
  apply: boolean;
  dryRun: boolean;
  help: boolean;
  limit: number;
}

function isExplicitTrue(value: string | undefined): boolean {
  return value?.toLowerCase() === 'true';
}

export function assertDemoEnabled(env: Env = process.env): void {
  if (!isExplicitTrue(env[DEMO_FLAG])) {
    throw new Error(
      `Refusing to run audit tamper demo. Set ${DEMO_FLAG}=true for local/dev demo use.`,
    );
  }
}

export function assertLocalMongoUrl(
  mongoUrl: string,
  env: Env = process.env,
): { hosts: string[]; overrideUsed: boolean } {
  const hosts = extractMongoHosts(mongoUrl);
  const nonLocalHosts = hosts.filter((host) => !isLocalMongoHost(host));

  if (hosts.length === 0) {
    throw new Error('Refusing to use an invalid or unsupported MongoDB URL.');
  }

  if (nonLocalHosts.length > 0) {
    if (isExplicitTrue(env[NONLOCAL_OVERRIDE_FLAG])) {
      return { hosts, overrideUsed: true };
    }

    throw new Error(
      `Refusing to use non-local MongoDB host(s): ${nonLocalHosts.join(
        ', ',
      )}. Use localhost/127.0.0.1/local Docker Mongo only, or set ${NONLOCAL_OVERRIDE_FLAG}=true for an explicit override.`,
    );
  }

  return { hosts, overrideUsed: false };
}

export function buildCanonicalPayload(fields: Record<string, any>): string {
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

export function computeAuditHash(
  prevHash: string | null,
  canonicalPayload: string,
): string {
  const input = `${prevHash ?? ''}|${canonicalPayload}`;
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

// Mirror AuditService.sortMetadataValue: deterministically sort object keys
// (recursively) so JSON.stringify yields the same string the service hashed.
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

// Mirror AuditService.canonicalMetadata: undefined/null/empty object all map to
// undefined (omitted from the canonical payload), otherwise sort then stringify.
export function canonicalMetadata(
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

export function verifyAuditChain(
  events: AuditEventRecord[],
): ChainVerificationResult {
  if (events.length === 0) {
    return { valid: true, checked: 0 };
  }

  for (let i = 0; i < events.length; i += 1) {
    const event = events[i];
    const expectedPrevHash = i === 0 ? null : events[i - 1].hash;
    // Mirror AuditService.create: the `metadata` key is only added to the
    // canonical payload when canonicalMetadata returns a value. Always passing
    // it (even as undefined) would emit "metadata=" for metadata-less events
    // and diverge from the hash the service actually computed.
    const canonicalFields: Record<string, any> = {
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
      canonicalFields.metadata = metadataStr;
    }
    const canonicalPayload = buildCanonicalPayload(canonicalFields);
    const expectedHash = computeAuditHash(
      i === 0 ? null : (events[i - 1].hash ?? null),
      canonicalPayload,
    );

    if (event.hash !== expectedHash) {
      return {
        valid: false,
        checked: i + 1,
        firstBrokenIndex: i,
        message: `Hash mismatch at event index ${i} (eventId=${event.eventId}). Expected=${expectedHash}, got=${event.hash}`,
      };
    }

    if (event.prevHash !== expectedPrevHash) {
      return {
        valid: false,
        checked: i + 1,
        firstBrokenIndex: i,
        message: `prevHash mismatch at event index ${i} (eventId=${event.eventId}). Expected=${expectedPrevHash}, got=${event.prevHash}`,
      };
    }
  }

  return { valid: true, checked: events.length };
}

export function selectNonHeadTamperTarget<T extends AuditEventRecord>(
  events: T[],
): T {
  if (events.length < MIN_EVENTS_FOR_TAMPER) {
    throw new Error(
      `Need at least ${MIN_EVENTS_FOR_TAMPER} audit events to mutate a non-head event; found ${events.length}.`,
    );
  }

  return events[Math.max(0, events.length - 2)];
}

function buildTamperedReason(
  event: AuditEventRecord,
  now = new Date(),
): string {
  const currentReason = event.reason ? String(event.reason) : 'none';
  return `${currentReason} | tamper-demo ${now.toISOString()}`;
}

function canonicalTimestamp(value: AuditEventRecord['timestamp']) {
  if (value instanceof Date) return value.toISOString();
  if (value && typeof (value as any).toISOString === 'function') {
    return (value as any).toISOString();
  }
  return value;
}

function extractMongoHosts(mongoUrl: string): string[] {
  const match = mongoUrl.match(/^mongodb(?:\+srv)?:\/\/([^/?#]+)/i);
  if (!match) return [];

  const authority = match[1];
  const hostsPart = authority.includes('@')
    ? authority.slice(authority.lastIndexOf('@') + 1)
    : authority;

  return hostsPart
    .split(',')
    .map((host) => normalizeMongoHost(host))
    .filter(Boolean);
}

function normalizeMongoHost(hostAndPort: string): string {
  const value = hostAndPort.trim().toLowerCase();
  if (!value) return '';

  if (value.startsWith('[')) {
    const end = value.indexOf(']');
    return end === -1 ? value : value.slice(1, end);
  }

  return value.split(':')[0].replace(/\.$/, '');
}

function isLocalMongoHost(host: string): boolean {
  return LOCAL_MONGO_HOSTS.has(host) || /^127(?:\.\d{1,3}){3}$/.test(host);
}

function parseArgs(argv: string[]): DemoOptions {
  let apply = false;
  let explicitDryRun = false;
  let help = false;
  let limit = DEFAULT_VERIFY_LIMIT;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === '--apply') {
      apply = true;
      continue;
    }

    if (arg === '--dry-run') {
      explicitDryRun = true;
      continue;
    }

    if (arg === '--limit') {
      const rawLimit = argv[i + 1];
      const parsedLimit = Number(rawLimit);
      if (
        !Number.isInteger(parsedLimit) ||
        parsedLimit < MIN_EVENTS_FOR_TAMPER
      ) {
        throw new Error(
          `--limit must be an integer >= ${MIN_EVENTS_FOR_TAMPER}. Received: ${rawLimit}`,
        );
      }
      limit = parsedLimit;
      i += 1;
      continue;
    }

    if (arg === '--help' || arg === '-h') {
      help = true;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  if (apply && explicitDryRun) {
    throw new Error('Use either --apply or --dry-run, not both.');
  }

  return {
    apply,
    dryRun: !apply,
    help,
    limit,
  };
}

async function loadAuditEvents(
  collection: Collection<AuditEventRecord>,
  limit: number,
): Promise<AuditEventRecord[]> {
  return collection
    .find({})
    .sort({ timestamp: 1, _id: 1 })
    .limit(limit)
    .toArray();
}

async function runDemo(options: DemoOptions): Promise<number> {
  assertDemoEnabled();

  const mongoUrl = process.env.MONGODB_URI;
  if (!mongoUrl) {
    throw new Error('Missing MONGODB_URI.');
  }

  const guard = assertLocalMongoUrl(mongoUrl);
  if (guard.overrideUsed) {
    console.warn(
      `WARNING: ${NONLOCAL_OVERRIDE_FLAG}=true allowed a non-local MongoDB URL.`,
    );
  }

  const client = new MongoClient(mongoUrl);
  await client.connect();

  try {
    const collection = client
      .db()
      .collection<AuditEventRecord>(COLLECTION_NAME);
    const beforeEvents = await loadAuditEvents(collection, options.limit);
    const before = verifyAuditChain(beforeEvents);

    console.log(`Local verify-chain before tamper: ${formatResult(before)}`);

    if (!before.valid) {
      console.error(
        'Audit chain is already invalid; refusing to mutate local data.',
      );
      return 1;
    }

    if (beforeEvents.length < MIN_EVENTS_FOR_TAMPER) {
      console.log(
        `Need at least ${MIN_EVENTS_FOR_TAMPER} audit events to mutate a non-head event; found ${beforeEvents.length}.`,
      );
      console.log(
        'Create at least two audit events in the local/dev stack, then rerun this script.',
      );
      return 0;
    }

    const target = selectNonHeadTamperTarget(beforeEvents);
    console.log(
      `Selected non-head event: eventId=${target.eventId}, timestamp=${canonicalTimestamp(
        target.timestamp,
      )}`,
    );

    if (options.dryRun) {
      console.log('Dry run only. No audit event was mutated.');
      console.log('Rerun with --apply to perform the local/dev tamper demo.');
      return 0;
    }

    if (!target._id) {
      throw new Error('Selected audit event has no _id; cannot update safely.');
    }

    const update = await collection.updateOne(
      { _id: target._id as any },
      { $set: { reason: buildTamperedReason(target) } },
    );

    if (update.modifiedCount !== 1) {
      throw new Error(
        `Expected to mutate exactly one audit event; modified ${update.modifiedCount}.`,
      );
    }

    const afterEvents = await loadAuditEvents(collection, options.limit);
    const after = verifyAuditChain(afterEvents);

    console.log(`Local verify-chain after tamper: ${formatResult(after)}`);

    if (after.valid) {
      console.error(
        'Tamper demo did not break the audit hash chain as expected.',
      );
      return 1;
    }

    printRecoveryInstructions();
    return 0;
  } finally {
    await client.close();
  }
}

function formatResult(result: ChainVerificationResult): string {
  return JSON.stringify(result);
}

function printUsage() {
  console.log(`Usage:
  pnpm --filter audit-service audit:tamper-demo -- --dry-run
  pnpm --filter audit-service audit:tamper-demo -- --apply

Required safety flag:
  ${DEMO_FLAG}=true

Optional non-local override:
  ${NONLOCAL_OVERRIDE_FLAG}=true

Options:
  --dry-run   Preview the target event without mutating data (default)
  --apply     Mutate one non-head audit event and verify the chain breaks
  --limit N   Number of oldest audit events to verify (default ${DEFAULT_VERIFY_LIMIT})
`);
}

function printRecoveryInstructions() {
  console.log(`Recovery for local/dev:
  - Reset or reseed local audit data from the normal dev flow.
  - Or delete local audit events with mongosh against MONGODB_URI:
    db.audit_events.deleteMany({})
  - If the Mongo volume is disposable, recreate the local dev Mongo volume and reseed.`);
}

if (require.main === module) {
  try {
    const options = parseArgs(process.argv.slice(2));

    if (options.help) {
      printUsage();
    } else {
      runDemo(options)
        .then((exitCode) => {
          process.exitCode = exitCode;
        })
        .catch((error) => {
          console.error(error instanceof Error ? error.message : error);
          process.exitCode = 1;
        });
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
