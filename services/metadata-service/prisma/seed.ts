import 'dotenv/config';

// Load .env from project root (two levels up from prisma/seed.ts).
require('dotenv').config({ path: '../../.env' });

import {
  PrismaClient,
  DocumentStatus,
  ClassificationLevel,
  AclSubjectType,
  DocumentPermission,
  AclEffect,
  WorkflowAction,
  OrganizationRole,
} from '../generated/prisma';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error('Missing DATABASE_URL.');
}

const pool = new Pool({ connectionString: DATABASE_URL });
const adapter = new PrismaPg(pool as any);
const prisma = new PrismaClient({ adapter });

const RESET_FLAG = 'DOCVAULT_ALLOW_METADATA_RESEED';
const LOCAL_DATABASE_HOSTS = new Set([
  'localhost',
  '127.0.0.1',
  '::1',
  'postgres',
  'docvault-postgres',
  'host.docker.internal',
]);

// Default seed organization. All baseline documents belong to this org.
const ORG1 = '00000000-0000-0000-0000-000000000001';

const DOC_IDS = {
  financeReport: '00000000-0000-0000-0000-000000000101',
  handbook: '00000000-0000-0000-0000-000000000102',
  roadmap: '00000000-0000-0000-0000-000000000103',
  allHands: '00000000-0000-0000-0000-000000000104',
  financeTeamForecast: '00000000-0000-0000-0000-000000000105',
} as const;

// Demo user subs are resolved from Keycloak at seed time (not hardcoded) so
// they always match the running realm. Otherwise users get lazily provisioned
// into separate orgs and lose access to seeded documents.
const KC_BASE = process.env.KEYCLOAK_BASE_URL ?? 'http://localhost:8080';
const KC_REALM = process.env.KEYCLOAK_REALM ?? 'docvault';
const KC_CLIENT = process.env.KEYCLOAK_CLIENT_ID ?? 'docvault-gateway';
const KC_SECRET = process.env.KEYCLOAK_CLIENT_SECRET ?? 'dev-gateway-secret';
const DEMO_PASSWORD = process.env.SEED_DEMO_PASSWORD ?? 'Passw0rd!';

interface DemoUsers {
  editor1: string;
  admin1: string;
  approver1: string;
  viewer1: string;
  co1: string;
}

interface SeedDocumentInput {
  id: string;
  title: string;
  legacyTitles?: string[];
  description: string;
  ownerId: string;
  classification: ClassificationLevel;
  tags: string[];
  status: DocumentStatus;
  publishedAt?: Date | null;
}

interface SeedAclInput {
  id: string;
  docId: string;
  subjectType: AclSubjectType;
  subjectId: string | null;
  permission: DocumentPermission;
  effect: AclEffect;
}

interface SeedWorkflowInput {
  id: string;
  docId: string;
  fromStatus: DocumentStatus;
  toStatus: DocumentStatus;
  action: WorkflowAction;
  actorId: string;
}

function flagEnabled(name: string): boolean {
  return process.env[name]?.toLowerCase() === 'true';
}

function assertLocalDatabase(connectionString: string): void {
  let host = '';
  try {
    host = new URL(connectionString).hostname.toLowerCase();
  } catch {
    throw new Error('Invalid DATABASE_URL.');
  }

  if (!LOCAL_DATABASE_HOSTS.has(host)) {
    throw new Error(
      `Refusing destructive metadata reseed against non-local database host: ${host}.`,
    );
  }
}

/** Resolve a Keycloak user's `sub` by logging in via password grant. */
async function resolveSub(username: string): Promise<string> {
  const res = await fetch(
    `${KC_BASE}/realms/${KC_REALM}/protocol/openid-connect/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'password',
        client_id: KC_CLIENT,
        client_secret: KC_SECRET,
        username,
        password: DEMO_PASSWORD,
      }),
    },
  );

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(
      `Cannot resolve sub for ${username}: HTTP ${res.status} ${body}`,
    );
  }

  const { access_token } = (await res.json()) as { access_token: string };
  const payload = JSON.parse(
    Buffer.from(access_token.split('.')[1], 'base64url').toString('utf8'),
  ) as { sub: string };

  return payload.sub;
}

async function resolveDemoUsers(): Promise<DemoUsers> {
  const [editor1, admin1, approver1, viewer1, co1] = await Promise.all([
    resolveSub('editor1'),
    resolveSub('admin1'),
    resolveSub('approver1'),
    resolveSub('viewer1'),
    resolveSub('co1'),
  ]);

  return { editor1, admin1, approver1, viewer1, co1 };
}

async function resetMetadata(): Promise<void> {
  assertLocalDatabase(DATABASE_URL);

  await prisma.documentWorkflowHistory.deleteMany();
  await prisma.documentAcl.deleteMany();
  await prisma.documentShareLink.deleteMany();
  await prisma.documentVersion.deleteMany();
  await prisma.documentComment.deleteMany();
  await prisma.document.deleteMany();
  await prisma.documentSavedView.deleteMany();
  await prisma.organizationMembership.deleteMany();
  await prisma.organization.deleteMany();
}

async function seedOrganization(users: DemoUsers): Promise<void> {
  await prisma.organization.upsert({
    where: { id: ORG1 },
    update: {
      name: 'Acme Corporation',
      slug: 'acme',
      ownerId: users.admin1,
    },
    create: {
      id: ORG1,
      name: 'Acme Corporation',
      slug: 'acme',
      ownerId: users.admin1,
    },
  });

  const memberships = [
    { userId: users.admin1, role: OrganizationRole.ADMIN },
    { userId: users.editor1, role: OrganizationRole.MEMBER },
    { userId: users.approver1, role: OrganizationRole.MEMBER },
    { userId: users.viewer1, role: OrganizationRole.MEMBER },
    { userId: users.co1, role: OrganizationRole.MEMBER },
  ];

  for (const membership of memberships) {
    await prisma.organizationMembership.upsert({
      where: {
        organizationId_userId: {
          organizationId: ORG1,
          userId: membership.userId,
        },
      },
      update: { role: membership.role },
      create: {
        organizationId: ORG1,
        userId: membership.userId,
        role: membership.role,
      },
    });
  }
}

async function upsertSeedDocument(
  input: SeedDocumentInput,
): Promise<{ id: string; title: string; status: DocumentStatus }> {
  const byId = await prisma.document.findUnique({ where: { id: input.id } });
  const matchingTitles = [input.title, ...(input.legacyTitles ?? [])];
  const existing =
    byId ??
    (await prisma.document.findFirst({
      where: {
        organizationId: ORG1,
        title: { in: matchingTitles },
      },
      orderBy: { createdAt: 'asc' },
    }));

  const data = {
    organizationId: ORG1,
    title: input.title,
    description: input.description,
    ownerId: input.ownerId,
    classification: input.classification,
    tags: input.tags,
    status: input.status,
    publishedAt: input.publishedAt ?? null,
    archivedAt: null,
    deletedAt: null,
  };

  if (existing) {
    return prisma.document.update({
      where: { id: existing.id },
      data,
      select: { id: true, title: true, status: true },
    });
  }

  return prisma.document.create({
    data: {
      id: input.id,
      ...data,
    },
    select: { id: true, title: true, status: true },
  });
}

async function replaceAclEntry(input: SeedAclInput): Promise<void> {
  await prisma.documentAcl.deleteMany({
    where: {
      docId: input.docId,
      subjectType: input.subjectType,
      subjectId: input.subjectId,
      permission: input.permission,
      effect: input.effect,
    },
  });

  await prisma.documentAcl.upsert({
    where: { id: input.id },
    update: {
      docId: input.docId,
      subjectType: input.subjectType,
      subjectId: input.subjectId,
      permission: input.permission,
      effect: input.effect,
    },
    create: input,
  });
}

async function replaceWorkflowEntry(input: SeedWorkflowInput): Promise<void> {
  await prisma.documentWorkflowHistory.deleteMany({
    where: {
      docId: input.docId,
      fromStatus: input.fromStatus,
      toStatus: input.toStatus,
      action: input.action,
      actorId: input.actorId,
    },
  });

  await prisma.documentWorkflowHistory.upsert({
    where: { id: input.id },
    update: {
      docId: input.docId,
      fromStatus: input.fromStatus,
      toStatus: input.toStatus,
      action: input.action,
      actorId: input.actorId,
    },
    create: input,
  });
}

function buildDocuments(users: DemoUsers): SeedDocumentInput[] {
  return [
    {
      id: DOC_IDS.financeReport,
      title: 'Q1 Financial Report 2026',
      description: 'Quarterly financial overview for Q1 2026',
      ownerId: users.editor1,
      classification: ClassificationLevel.CONFIDENTIAL,
      tags: ['finance', 'quarterly', 'seed-baseline'],
      status: DocumentStatus.PUBLISHED,
      publishedAt: new Date('2026-02-01T00:00:00.000Z'),
    },
    {
      id: DOC_IDS.handbook,
      title: 'Employee Handbook v3',
      description: 'Company-wide employee handbook',
      ownerId: users.admin1,
      classification: ClassificationLevel.INTERNAL,
      tags: ['hr', 'policy', 'seed-baseline'],
      status: DocumentStatus.PUBLISHED,
      publishedAt: new Date('2026-01-15T00:00:00.000Z'),
    },
    {
      id: DOC_IDS.roadmap,
      title: 'Product Roadmap 2026',
      description: 'Engineering roadmap for 2026',
      ownerId: users.editor1,
      classification: ClassificationLevel.CONFIDENTIAL,
      tags: ['product', 'roadmap', 'seed-baseline'],
      status: DocumentStatus.DRAFT,
      publishedAt: null,
    },
    {
      id: DOC_IDS.allHands,
      title: 'Meeting Notes - All Hands Feb',
      legacyTitles: ['Meeting Notes \u2014 All Hands Feb'],
      description: 'All-hands meeting notes February 2026',
      ownerId: users.admin1,
      classification: ClassificationLevel.PUBLIC,
      tags: ['meeting', 'seed-baseline'],
      status: DocumentStatus.PUBLISHED,
      publishedAt: new Date('2026-02-20T00:00:00.000Z'),
    },
    {
      id: DOC_IDS.financeTeamForecast,
      title: 'Finance Team Budget Forecast 2026',
      description:
        'Confidential finance-team forecast used for GROUP ACL demos',
      ownerId: users.admin1,
      classification: ClassificationLevel.CONFIDENTIAL,
      tags: ['finance', 'forecast', 'seed-baseline', 'group-acl'],
      status: DocumentStatus.PUBLISHED,
      publishedAt: new Date('2026-03-01T00:00:00.000Z'),
    },
  ];
}

function buildAclEntries(
  docsByKey: Record<keyof typeof DOC_IDS, string>,
  users: DemoUsers,
): SeedAclInput[] {
  return [
    {
      id: '00000000-0000-0000-0000-000000001001',
      docId: docsByKey.financeReport,
      subjectType: AclSubjectType.ROLE,
      subjectId: 'editor',
      permission: DocumentPermission.READ,
      effect: AclEffect.ALLOW,
    },
    {
      id: '00000000-0000-0000-0000-000000001002',
      docId: docsByKey.financeReport,
      subjectType: AclSubjectType.ROLE,
      subjectId: 'approver',
      permission: DocumentPermission.READ,
      effect: AclEffect.ALLOW,
    },
    {
      id: '00000000-0000-0000-0000-000000001003',
      docId: docsByKey.financeReport,
      subjectType: AclSubjectType.ROLE,
      subjectId: 'admin',
      permission: DocumentPermission.WRITE,
      effect: AclEffect.ALLOW,
    },
    {
      id: '00000000-0000-0000-0000-000000001004',
      docId: docsByKey.financeReport,
      subjectType: AclSubjectType.ALL,
      subjectId: null,
      permission: DocumentPermission.READ,
      effect: AclEffect.DENY,
    },
    {
      id: '00000000-0000-0000-0000-000000001005',
      docId: docsByKey.handbook,
      subjectType: AclSubjectType.ROLE,
      subjectId: 'viewer',
      permission: DocumentPermission.READ,
      effect: AclEffect.ALLOW,
    },
    {
      id: '00000000-0000-0000-0000-000000001006',
      docId: docsByKey.handbook,
      subjectType: AclSubjectType.ROLE,
      subjectId: 'editor',
      permission: DocumentPermission.WRITE,
      effect: AclEffect.ALLOW,
    },
    {
      id: '00000000-0000-0000-0000-000000001007',
      docId: docsByKey.handbook,
      subjectType: AclSubjectType.ROLE,
      subjectId: 'admin',
      permission: DocumentPermission.WRITE,
      effect: AclEffect.ALLOW,
    },
    {
      id: '00000000-0000-0000-0000-000000001008',
      docId: docsByKey.roadmap,
      subjectType: AclSubjectType.USER,
      subjectId: users.editor1,
      permission: DocumentPermission.WRITE,
      effect: AclEffect.ALLOW,
    },
    {
      id: '00000000-0000-0000-0000-000000001009',
      docId: docsByKey.roadmap,
      subjectType: AclSubjectType.USER,
      subjectId: users.editor1,
      permission: DocumentPermission.READ,
      effect: AclEffect.ALLOW,
    },
    {
      id: '00000000-0000-0000-0000-000000001010',
      docId: docsByKey.roadmap,
      subjectType: AclSubjectType.ROLE,
      subjectId: 'admin',
      permission: DocumentPermission.WRITE,
      effect: AclEffect.ALLOW,
    },
    {
      id: '00000000-0000-0000-0000-000000001011',
      docId: docsByKey.allHands,
      subjectType: AclSubjectType.ALL,
      subjectId: null,
      permission: DocumentPermission.READ,
      effect: AclEffect.ALLOW,
    },
    {
      id: '00000000-0000-0000-0000-000000001012',
      docId: docsByKey.financeTeamForecast,
      subjectType: AclSubjectType.GROUP,
      subjectId: 'finance-team',
      permission: DocumentPermission.READ,
      effect: AclEffect.ALLOW,
    },
    {
      id: '00000000-0000-0000-0000-000000001013',
      docId: docsByKey.financeTeamForecast,
      subjectType: AclSubjectType.ROLE,
      subjectId: 'admin',
      permission: DocumentPermission.WRITE,
      effect: AclEffect.ALLOW,
    },
  ];
}

function buildWorkflowEntries(
  docsByKey: Record<keyof typeof DOC_IDS, string>,
  users: DemoUsers,
): SeedWorkflowInput[] {
  return [
    {
      id: '00000000-0000-0000-0000-000000002001',
      docId: docsByKey.financeReport,
      fromStatus: DocumentStatus.DRAFT,
      toStatus: DocumentStatus.PENDING,
      action: WorkflowAction.SUBMIT,
      actorId: users.editor1,
    },
    {
      id: '00000000-0000-0000-0000-000000002002',
      docId: docsByKey.financeReport,
      fromStatus: DocumentStatus.PENDING,
      toStatus: DocumentStatus.PUBLISHED,
      action: WorkflowAction.APPROVE,
      actorId: users.approver1,
    },
    {
      id: '00000000-0000-0000-0000-000000002003',
      docId: docsByKey.handbook,
      fromStatus: DocumentStatus.DRAFT,
      toStatus: DocumentStatus.PENDING,
      action: WorkflowAction.SUBMIT,
      actorId: users.admin1,
    },
    {
      id: '00000000-0000-0000-0000-000000002004',
      docId: docsByKey.handbook,
      fromStatus: DocumentStatus.PENDING,
      toStatus: DocumentStatus.PUBLISHED,
      action: WorkflowAction.APPROVE,
      actorId: users.approver1,
    },
    {
      id: '00000000-0000-0000-0000-000000002005',
      docId: docsByKey.financeTeamForecast,
      fromStatus: DocumentStatus.DRAFT,
      toStatus: DocumentStatus.PENDING,
      action: WorkflowAction.SUBMIT,
      actorId: users.admin1,
    },
    {
      id: '00000000-0000-0000-0000-000000002006',
      docId: docsByKey.financeTeamForecast,
      fromStatus: DocumentStatus.PENDING,
      toStatus: DocumentStatus.PUBLISHED,
      action: WorkflowAction.APPROVE,
      actorId: users.approver1,
    },
  ];
}

async function main() {
  const shouldReset = flagEnabled(RESET_FLAG);
  console.log('Seeding metadata database...');

  if (shouldReset) {
    console.log(`Reset enabled via ${RESET_FLAG}=true.`);
    await resetMetadata();
  } else {
    console.log(
      `Reset disabled. Set ${RESET_FLAG}=true for a local full wipe.`,
    );
  }

  const users = await resolveDemoUsers();

  await seedOrganization(users);

  const docsByKey = {} as Record<keyof typeof DOC_IDS, string>;
  const documents = [];
  for (const input of buildDocuments(users)) {
    const seeded = await upsertSeedDocument(input);
    const key = (Object.keys(DOC_IDS) as Array<keyof typeof DOC_IDS>).find(
      (candidate) => DOC_IDS[candidate] === input.id,
    );
    if (key) docsByKey[key] = seeded.id;
    documents.push(seeded);
  }

  for (const input of buildAclEntries(docsByKey, users)) {
    await replaceAclEntry(input);
  }

  for (const input of buildWorkflowEntries(docsByKey, users)) {
    await replaceWorkflowEntry(input);
  }

  console.log(`Seeded ${documents.length} baseline documents.`);
  for (const document of documents) {
    console.log(`- ${document.title} (${document.status})`);
  }
}

async function run() {
  try {
    await main();
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  } finally {
    try {
      await prisma.$disconnect();
    } catch (error) {
      console.error(error);
      process.exitCode = 1;
    }

    try {
      await pool.end();
    } catch (error) {
      console.error(error);
      process.exitCode = 1;
    }
  }
}

void run();
