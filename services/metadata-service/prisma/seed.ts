import 'dotenv/config';

// Load .env from project root (two levels up from prisma/seed.ts)
require('dotenv').config({ path: '../../.env' });

import { PrismaClient, DocumentStatus, ClassificationLevel, AclSubjectType, DocumentPermission, AclEffect, WorkflowAction } from '../generated/prisma';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

// Keycloak user sub UUIDs (from Keycloak Admin API)
const EDITOR1   = '0e23e8e2-8f9d-4381-a7d6-9f181550de7f';
const ADMIN1    = '8c5c10f1-187f-4f21-9430-76c6a852f9e1';
const APPROVER1 = '181882a9-1394-4f5c-93e8-0dd5105620ae';

const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
const adapter = new PrismaPg(pool as any);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🌱 Seeding database...');

  // Clean up
  await prisma.documentWorkflowHistory.deleteMany();
  await prisma.documentAcl.deleteMany();
  await prisma.documentVersion.deleteMany();
  await prisma.documentComment.deleteMany();
  await prisma.document.deleteMany();

  // ── Documents ──────────────────────────────────────────────
  const doc1 = await prisma.document.create({
    data: {
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
      { docId: doc1.id, subjectType: AclSubjectType.ROLE, subjectId: 'editor', permission: DocumentPermission.READ, effect: AclEffect.ALLOW },
      { docId: doc1.id, subjectType: AclSubjectType.ROLE, subjectId: 'approver', permission: DocumentPermission.READ, effect: AclEffect.ALLOW },
      { docId: doc1.id, subjectType: AclSubjectType.ROLE, subjectId: 'admin', permission: DocumentPermission.WRITE, effect: AclEffect.ALLOW },
      { docId: doc1.id, subjectType: AclSubjectType.ALL, subjectId: null, permission: DocumentPermission.READ, effect: AclEffect.DENY },
    ],
  });

  // ── ACL: doc2 (INTERNAL) ────────────────────────────────────
  await prisma.documentAcl.createMany({
    data: [
      { docId: doc2.id, subjectType: AclSubjectType.ROLE, subjectId: 'viewer', permission: DocumentPermission.READ, effect: AclEffect.ALLOW },
      { docId: doc2.id, subjectType: AclSubjectType.ROLE, subjectId: 'editor', permission: DocumentPermission.WRITE, effect: AclEffect.ALLOW },
      { docId: doc2.id, subjectType: AclSubjectType.ROLE, subjectId: 'admin', permission: DocumentPermission.WRITE, effect: AclEffect.ALLOW },
    ],
  });

  // ── ACL: doc3 (CONFIDENTIAL, DRAFT) ─────────────────────────
  await prisma.documentAcl.createMany({
    data: [
      { docId: doc3.id, subjectType: AclSubjectType.USER, subjectId: EDITOR1, permission: DocumentPermission.WRITE, effect: AclEffect.ALLOW },
      { docId: doc3.id, subjectType: AclSubjectType.USER, subjectId: EDITOR1, permission: DocumentPermission.READ, effect: AclEffect.ALLOW },
      { docId: doc3.id, subjectType: AclSubjectType.ROLE, subjectId: 'admin', permission: DocumentPermission.WRITE, effect: AclEffect.ALLOW },
    ],
  });

  // ── ACL: doc4 (PUBLIC) ──────────────────────────────────────
  await prisma.documentAcl.createMany({
    data: [
      { docId: doc4.id, subjectType: AclSubjectType.ALL, subjectId: null, permission: DocumentPermission.READ, effect: AclEffect.ALLOW },
    ],
  });

  // ── Workflow history ─────────────────────────────────────────
  await prisma.documentWorkflowHistory.createMany({
    data: [
      {
        docId: doc1.id, fromStatus: DocumentStatus.DRAFT, toStatus: DocumentStatus.PENDING, action: WorkflowAction.SUBMIT, actorId: EDITOR1,
      },
      {
        docId: doc1.id, fromStatus: DocumentStatus.PENDING, toStatus: DocumentStatus.PUBLISHED, action: WorkflowAction.APPROVE, actorId: APPROVER1,
      },
      {
        docId: doc2.id, fromStatus: DocumentStatus.DRAFT, toStatus: DocumentStatus.PENDING, action: WorkflowAction.SUBMIT, actorId: ADMIN1,
      },
      {
        docId: doc2.id, fromStatus: DocumentStatus.PENDING, toStatus: DocumentStatus.PUBLISHED, action: WorkflowAction.APPROVE, actorId: APPROVER1,
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
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
