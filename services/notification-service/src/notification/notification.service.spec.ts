import { NotificationService } from './notification.service';
import { NotifyType } from './dto/notify.dto';

describe('NotificationService', () => {
  it('stores timeline metadata without exposing file content or grant data', () => {
    const service = new NotificationService();

    service.notify({
      type: NotifyType.REJECTED,
      docId: 'doc-1',
      recipientId: 'editor-1',
      docTitle: 'Board Report',
      reason: 'Missing retention evidence',
      metadata: {
        workflow: {
          action: 'REJECT',
          fromStatus: 'PENDING',
          toStatus: 'DRAFT',
          actorId: 'approver-1',
        },
        objectKey: 'documents/doc-1/v1/board.pdf',
        grantToken: 'download-grant-token',
        nested: {
          fileContent: 'raw document bytes',
          kept: 'visible workflow context',
        },
      },
    } as any);

    const page = service.getForUser('editor-1');

    expect(page.total).toBe(1);
    expect(page.records[0]).toMatchObject({
      type: NotifyType.REJECTED,
      docId: 'doc-1',
      recipientId: 'editor-1',
      reason: 'Missing retention evidence',
      metadata: {
        workflow: {
          action: 'REJECT',
          fromStatus: 'PENDING',
          toStatus: 'DRAFT',
          actorId: 'approver-1',
        },
        nested: {
          kept: 'visible workflow context',
        },
      },
    });
    expect(JSON.stringify(page.records[0])).not.toContain(
      'documents/doc-1/v1/board.pdf',
    );
    expect(JSON.stringify(page.records[0])).not.toContain(
      'download-grant-token',
    );
    expect(JSON.stringify(page.records[0])).not.toContain('raw document bytes');
  });
});
