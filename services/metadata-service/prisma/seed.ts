import 'dotenv/config';

// Load .env from project root (two levels up from prisma/seed.ts)
require('dotenv').config({ path: '../../.env' });

import {
  PrismaClient,
  DocumentStatus,
  ClassificationLevel,
  AclSubjectType,
  DocumentPermission,
  AclEffect,
  WorkflowAction,
} from '../generated/prisma';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
const adapter = new PrismaPg(pool as any);
const prisma = new PrismaClient({ adapter });

// Default seed organization — all sample documents belong to this org.
const ORG1 = '00000000-0000-0000-0000-000000000001';

// Demo user subs are resolved from Keycloak at seed time (not hardcoded) so
// they always match the running realm — otherwise users get lazily
// provisioned into separate orgs and lose access to seeded documents.
const KC_BASE = process.env.KEYCLOAK_BASE_URL ?? 'http://localhost:8080';
const KC_REALM = process.env.KEYCLOAK_REALM ?? 'docvault';
const KC_CLIENT = process.env.KEYCLOAK_CLIENT_ID ?? 'docvault-gateway';
const KC_SECRET = process.env.KEYCLOAK_CLIENT_SECRET ?? 'dev-gateway-secret';
const DEMO_PASSWORD = process.env.SEED_DEMO_PASSWORD ?? 'Passw0rd!';

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
    throw new Error(`Cannot resolve sub for ${username}: HTTP ${res.status}`);
  }
  const { access_token } = (await res.json()) as { access_token: string };
  const payload = JSON.parse(
    Buffer.from(access_token.split('.')[1], 'base64').toString('utf8'),
  ) as { sub: string };
  return payload.sub;
}

// Populated by resolveDemoUsers() before any seeding.
let EDITOR1 = '';
let ADMIN1 = '';
let APPROVER1 = '';
let VIEWER1 = '';
let CO1 = '';

async function resolveDemoUsers(): Promise<void> {
  [EDITOR1, ADMIN1, APPROVER1, VIEWER1, CO1] = await Promise.all([
    resolveSub('editor1'),
    resolveSub('admin1'),
    resolveSub('approver1'),
    resolveSub('viewer1'),
    resolveSub('co1'),
  ]);
}

async function main() {
  console.log('🌱 Seeding database...');

  // Resolve real Keycloak subs first so memberships match the running realm.
  await resolveDemoUsers();

  // Clean up
  await prisma.documentWorkflowHistory.deleteMany();
  await prisma.documentAcl.deleteMany();
  await prisma.documentVersion.deleteMany();
  await prisma.documentComment.deleteMany();
  await prisma.document.deleteMany();
  await prisma.organizationMembership.deleteMany();
  await prisma.organization.deleteMany();

  // ── Organization + memberships ─────────────────────────────
  // All demo users belong to one org (internal-company model).
  await prisma.organization.create({
    data: {
      id: ORG1,
      name: 'Acme Corporation',
      slug: 'acme',
      ownerId: ADMIN1,
      memberships: {
        create: [
          { userId: ADMIN1, role: 'ADMIN' },
          { userId: EDITOR1, role: 'MEMBER' },
          { userId: APPROVER1, role: 'MEMBER' },
          { userId: VIEWER1, role: 'MEMBER' },
          { userId: CO1, role: 'MEMBER' },
        ],
      },
    },
  });

  // ── Documents ──────────────────────────────────────────────
  const doc1 = await prisma.document.create({
    data: {
      organizationId: ORG1,
      title: 'Q1 Financial Report 2026',
      description: 'Quarterly financial overview for Q1 2026',
      ownerId: EDITOR1,
      classification: ClassificationLevel.CONFIDENTIAL,
      tags: ['finance', 'quarterly'],
      status: DocumentStatus.PUBLISHED,
      publishedAt: new Date('2026-02-01'),
    },
  });

  const doc2 = await prisma.document.create({
    data: {
      organizationId: ORG1,
      title: 'Employee Handbook v3',
      description: 'Company-wide employee handbook',
      ownerId: ADMIN1,
      classification: ClassificationLevel.INTERNAL,
      tags: ['hr', 'policy'],
      status: DocumentStatus.PUBLISHED,
      publishedAt: new Date('2026-01-15'),
    },
  });

  const doc3 = await prisma.document.create({
    data: {
      organizationId: ORG1,
      title: 'Product Roadmap 2026',
      description: 'Engineering roadmap for 2026',
      ownerId: EDITOR1,
      classification: ClassificationLevel.CONFIDENTIAL,
      tags: ['product', 'roadmap'],
      status: DocumentStatus.DRAFT,
    },
  });

  const doc4 = await prisma.document.create({
    data: {
      organizationId: ORG1,
      title: 'Meeting Notes — All Hands Feb',
      description: 'All-hands meeting notes February 2026',
      ownerId: ADMIN1,
      classification: ClassificationLevel.PUBLIC,
      tags: ['meeting'],
      status: DocumentStatus.PUBLISHED,
      publishedAt: new Date('2026-02-20'),
    },
  });

  // ── ACL: doc1 (CONFIDENTIAL) ────────────────────────────────
  await prisma.documentAcl.createMany({
    data: [
      {
        docId: doc1.id,
        subjectType: AclSubjectType.ROLE,
        subjectId: 'editor',
        permission: DocumentPermission.READ,
        effect: AclEffect.ALLOW,
      },
      {
        docId: doc1.id,
        subjectType: AclSubjectType.ROLE,
        subjectId: 'approver',
        permission: DocumentPermission.READ,
        effect: AclEffect.ALLOW,
      },
      {
        docId: doc1.id,
        subjectType: AclSubjectType.ROLE,
        subjectId: 'admin',
        permission: DocumentPermission.WRITE,
        effect: AclEffect.ALLOW,
      },
      {
        docId: doc1.id,
        subjectType: AclSubjectType.ALL,
        subjectId: null,
        permission: DocumentPermission.READ,
        effect: AclEffect.DENY,
      },
    ],
  });

  // ── ACL: doc2 (INTERNAL) ────────────────────────────────────
  await prisma.documentAcl.createMany({
    data: [
      {
        docId: doc2.id,
        subjectType: AclSubjectType.ROLE,
        subjectId: 'viewer',
        permission: DocumentPermission.READ,
        effect: AclEffect.ALLOW,
      },
      {
        docId: doc2.id,
        subjectType: AclSubjectType.ROLE,
        subjectId: 'editor',
        permission: DocumentPermission.WRITE,
        effect: AclEffect.ALLOW,
      },
      {
        docId: doc2.id,
        subjectType: AclSubjectType.ROLE,
        subjectId: 'admin',
        permission: DocumentPermission.WRITE,
        effect: AclEffect.ALLOW,
      },
    ],
  });

  // ── ACL: doc3 (CONFIDENTIAL, DRAFT) ─────────────────────────
  await prisma.documentAcl.createMany({
    data: [
      {
        docId: doc3.id,
        subjectType: AclSubjectType.USER,
        subjectId: EDITOR1,
        permission: DocumentPermission.WRITE,
        effect: AclEffect.ALLOW,
      },
      {
        docId: doc3.id,
        subjectType: AclSubjectType.USER,
        subjectId: EDITOR1,
        permission: DocumentPermission.READ,
        effect: AclEffect.ALLOW,
      },
      {
        docId: doc3.id,
        subjectType: AclSubjectType.ROLE,
        subjectId: 'admin',
        permission: DocumentPermission.WRITE,
        effect: AclEffect.ALLOW,
      },
    ],
  });

  // ── ACL: doc4 (PUBLIC) ──────────────────────────────────────
  await prisma.documentAcl.createMany({
    data: [
      {
        docId: doc4.id,
        subjectType: AclSubjectType.ALL,
        subjectId: null,
        permission: DocumentPermission.READ,
        effect: AclEffect.ALLOW,
      },
    ],
  });

  // ── Workflow history ─────────────────────────────────────────
  await prisma.documentWorkflowHistory.createMany({
    data: [
      {
        docId: doc1.id,
        fromStatus: DocumentStatus.DRAFT,
        toStatus: DocumentStatus.PENDING,
        action: WorkflowAction.SUBMIT,
        actorId: EDITOR1,
      },
      {
        docId: doc1.id,
        fromStatus: DocumentStatus.PENDING,
        toStatus: DocumentStatus.PUBLISHED,
        action: WorkflowAction.APPROVE,
        actorId: APPROVER1,
      },
      {
        docId: doc2.id,
        fromStatus: DocumentStatus.DRAFT,
        toStatus: DocumentStatus.PENDING,
        action: WorkflowAction.SUBMIT,
        actorId: ADMIN1,
      },
      {
        docId: doc2.id,
        fromStatus: DocumentStatus.PENDING,
        toStatus: DocumentStatus.PUBLISHED,
        action: WorkflowAction.APPROVE,
        actorId: APPROVER1,
      },
    ],
  });

  console.log(`✅ Created 4 documents`);
  console.log(`   - ${doc1.title} (${doc1.status})`);
  console.log(`   - ${doc2.title} (${doc2.status})`);
  console.log(`   - ${doc3.title} (${doc3.status})`);
  console.log(`   - ${doc4.title} (${doc4.status})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
