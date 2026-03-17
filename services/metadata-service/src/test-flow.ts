import 'dotenv/config';
import { PrismaService } from './prisma/prisma.service';
import { DocumentsService } from './documents/documents.service';
import { StatusService } from './status/status.service';
import { AclService } from './acl/acl.service';

async function run() {
  console.log('--- STARTING DOCVAULT ERD MVP INTEGRATION TEST ---');

  const prisma = new PrismaService();
  await prisma.onModuleInit();

  // Mock AuditClient to prevent real HTTP calls
  const mockAuditClient = {
    emitEvent: async (context: any, payload: any) => {
      console.log(
        `[AUDIT EMIT] Action: ${payload.action}, Resource: ${payload.resourceId}`,
      );
    },
  } as any;

  const documentsService = new DocumentsService(prisma, mockAuditClient);
  const statusService = new StatusService(prisma, mockAuditClient);
  const aclService = new AclService(prisma, mockAuditClient);

  const mockUser = {
    sub: 'test-admin-123',
    username: 'admin',
    roles: ['admin', 'editor', 'approver'],
  };
  const mockContext = {
    actorId: mockUser.sub,
    roles: mockUser.roles,
    traceId: 'test-trace',
  } as any;

  try {
    // 1. Create Document with Tags & Classification (New ERD features)
    console.log('\n1. Creating Document...');
    const doc = await documentsService.create(
      {
        title: 'Q3 Financial Report',
        description: 'Confidential report for Q3',
        classification: 'CONFIDENTIAL',
        tags: [' finance ', 'report', '', 'finance'], // Test sanitization
      },
      mockUser,
      mockContext,
    );

    console.log(
      `âœ… Document Created: ID=${doc.id}, Status=${doc.status}, Classification=${doc.classification}`,
    );
    console.log(`âœ… Sanitized Tags:`, doc.tags);

    // 2. Add ACL with GROUP (New ERD feature)
    console.log('\n2. Upserting ACL Rule for GROUP...');
    await aclService.upsert(
      doc.id,
      {
        subjectType: 'GROUP',
        subjectId: 'finance-team',
        permission: 'READ',
        effect: 'ALLOW',
      },
      mockUser,
      mockContext,
    );
    console.log(`âœ… Assigned READ permission to GROUP finance-team`);

    // 3. Workflow Transition: SUBMIT (DRAFT -> PENDING)
    console.log('\n3. Workflow: SUBMIT (DRAFT -> PENDING)...');
    await statusService.update(
      doc.id,
      {
        action: 'SUBMIT',
        status: 'PENDING',
      },
      mockUser,
      mockContext,
    );

    let updatedDoc = await prisma.document.findUnique({
      where: { id: doc.id },
    });
    console.log(`âœ… Status is now: ${updatedDoc?.status}`);

    // 4. Workflow Transition: APPROVE (PENDING -> PUBLISHED)
    console.log('\n4. Workflow: APPROVE (PENDING -> PUBLISHED)...');
    await statusService.update(
      doc.id,
      {
        action: 'APPROVE',
        status: 'PUBLISHED',
      },
      mockUser,
      mockContext,
    );

    updatedDoc = await prisma.document.findUnique({ where: { id: doc.id } });
    console.log(`âœ… Status is now: ${updatedDoc?.status}`);
    console.log(`âœ… PublishedAt: ${updatedDoc?.publishedAt}`);

    // 5. Workflow Transition: ARCHIVE (PUBLISHED -> ARCHIVED)
    console.log('\n5. Workflow: ARCHIVE (PUBLISHED -> ARCHIVED)...');
    await statusService.update(
      doc.id,
      {
        action: 'ARCHIVE',
        status: 'ARCHIVED',
      },
      mockUser,
      mockContext,
    );

    updatedDoc = await prisma.document.findUnique({ where: { id: doc.id } });
    console.log(`âœ… Status is now: ${updatedDoc?.status}`);
    console.log(`âœ… ArchivedAt: ${updatedDoc?.archivedAt}`);

    // 6. Verify Workflow History
    console.log('\n6. Fetching Document Workflow History...');
    const history = await prisma.documentWorkflowHistory.findMany({
      where: { docId: doc.id },
      orderBy: { createdAt: 'asc' },
    });

    history.forEach((h, i) => {
      console.log(
        `   Step ${i + 1}: ${h.fromStatus} -> ${h.toStatus} (Action: ${h.action})`,
      );
    });

    if (history.length === 3) {
      console.log('âœ… Workflow history correctly recorded all 3 transitions!');
    } else {
      console.error('âŒ Workflow history count mismatch!');
    }
  } catch (err: any) {
    console.error('Test failed:', err.message);
  } finally {
    await prisma.$disconnect();
    console.log('\n--- TEST COMPLETE ---');
  }
}

run();
