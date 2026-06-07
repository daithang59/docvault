import { NotificationService } from './notification.service';
import { NotifyType } from './dto/notify.dto';

/**
 * Unit tests for NotificationService backed by a mock Mongoose model.
 * The in-memory mock implements just the methods the service uses
 * (create/find/countDocuments/updateOne/updateMany/deleteMany) so the
 * persistence logic can be verified without a live MongoDB.
 */
function makeMockModel() {
  const docs: any[] = [];

  const applyFilter = (filter: Record<string, any>) =>
    docs.filter((d) => {
      if (
        filter.recipientId !== undefined &&
        d.recipientId !== filter.recipientId
      ) {
        return false;
      }
      if (filter.read !== undefined && d.read !== filter.read) return false;
      if (filter.id !== undefined) {
        if (typeof filter.id === 'object' && filter.id.$in) {
          if (!filter.id.$in.includes(d.id)) return false;
        } else if (d.id !== filter.id) {
          return false;
        }
      }
      return true;
    });

  const makeQuery = (rows: any[]) => {
    let result = [...rows];
    const q: any = {
      sort: () => {
        result.sort((a, b) => {
          const ad = new Date(a.createdAt).getTime();
          const bd = new Date(b.createdAt).getTime();
          return bd - ad;
        });
        return q;
      },
      skip: (n: number) => {
        result = result.slice(n);
        return q;
      },
      limit: (n: number) => {
        result = result.slice(0, n);
        return q;
      },
      lean: async () => result,
    };
    return q;
  };

  return {
    _docs: docs,
    create: jest.fn(async (data: any) => {
      docs.push({ ...data });
      return { ...data };
    }),
    find: jest.fn((filter: Record<string, any> = {}) =>
      makeQuery(applyFilter(filter)),
    ),
    countDocuments: jest.fn(
      async (filter: Record<string, any> = {}) => applyFilter(filter).length,
    ),
    updateOne: jest.fn(async (filter: Record<string, any>, update: any) => {
      const target = applyFilter(filter)[0];
      if (!target) return { modifiedCount: 0 };
      Object.assign(target, update.$set ?? {});
      return { modifiedCount: 1 };
    }),
    updateMany: jest.fn(async (filter: Record<string, any>, update: any) => {
      const targets = applyFilter(filter);
      targets.forEach((t) => Object.assign(t, update.$set ?? {}));
      return { modifiedCount: targets.length };
    }),
    deleteMany: jest.fn(async (filter: Record<string, any>) => {
      const toDelete = new Set(applyFilter(filter));
      for (let i = docs.length - 1; i >= 0; i--) {
        if (toDelete.has(docs[i])) docs.splice(i, 1);
      }
      return { deletedCount: toDelete.size };
    }),
  };
}

describe('NotificationService', () => {
  it('persists timeline metadata without exposing file content or grant data', async () => {
    const model = makeMockModel();
    const service = new NotificationService(
      model as any,
      { isEnabled: () => false, send: jest.fn() } as any,
      { isEnabled: () => false, resolveEmail: jest.fn() } as any,
    );

    await service.notify({
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

    const page = await service.getForUser('editor-1');

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
    const serialized = JSON.stringify(page.records[0]);
    expect(serialized).not.toContain('documents/doc-1/v1/board.pdf');
    expect(serialized).not.toContain('download-grant-token');
    expect(serialized).not.toContain('raw document bytes');
  });

  it('fans out one record per unique recipient', async () => {
    const model = makeMockModel();
    const service = new NotificationService(
      model as any,
      { isEnabled: () => false, send: jest.fn() } as any,
      { isEnabled: () => false, resolveEmail: jest.fn() } as any,
    );

    await service.notify({
      type: NotifyType.SUBMITTED,
      docId: 'doc-2',
      recipientIds: ['a', 'b', 'a'], // duplicate a
    } as any);

    expect(await service.getUnreadCount('a')).toBe(1);
    expect(await service.getUnreadCount('b')).toBe(1);
    expect(model.create).toHaveBeenCalledTimes(2);
  });

  it('marks a single notification as read by id', async () => {
    const model = makeMockModel();
    const service = new NotificationService(
      model as any,
      { isEnabled: () => false, send: jest.fn() } as any,
      { isEnabled: () => false, resolveEmail: jest.fn() } as any,
    );

    await service.notify({
      type: NotifyType.APPROVED,
      docId: 'doc-3',
      recipientId: 'user-1',
    } as any);

    const page = await service.getForUser('user-1');
    const id = page.records[0].id;

    expect(await service.markAsRead(id)).toBe(true);
    expect(await service.getUnreadCount('user-1')).toBe(0);
    expect(await service.markAsRead('non-existent')).toBe(false);
  });

  it('marks all notifications read for a user', async () => {
    const model = makeMockModel();
    const service = new NotificationService(
      model as any,
      { isEnabled: () => false, send: jest.fn() } as any,
      { isEnabled: () => false, resolveEmail: jest.fn() } as any,
    );

    await service.notify({
      type: NotifyType.SUBMITTED,
      docId: 'doc-4',
      recipientId: 'user-2',
    } as any);
    await service.notify({
      type: NotifyType.APPROVED,
      docId: 'doc-5',
      recipientId: 'user-2',
    } as any);

    expect(await service.getUnreadCount('user-2')).toBe(2);
    await service.markAllRead('user-2');
    expect(await service.getUnreadCount('user-2')).toBe(0);
  });

  it('sends email for REJECTED and resolves recipient address', async () => {
    const model = makeMockModel();
    const send = jest.fn().mockResolvedValue(true);
    const resolveEmail = jest.fn().mockResolvedValue('editor-1@docvault.local');
    const service = new NotificationService(
      model as any,
      { isEnabled: () => true, send } as any,
      { isEnabled: () => true, resolveEmail } as any,
    );

    await service.notify({
      type: NotifyType.REJECTED,
      docId: 'doc-9',
      recipientId: 'editor-1',
      docTitle: 'Board Report',
      reason: 'Missing evidence',
    } as any);

    // Email send is fire-and-forget; allow the microtask queue to drain.
    await new Promise((r) => setTimeout(r, 0));

    expect(resolveEmail).toHaveBeenCalledWith('editor-1');
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0]).toMatchObject({
      to: 'editor-1@docvault.local',
    });
  });

  it('does NOT send email for non-trigger types (e.g. SUBMITTED)', async () => {
    const model = makeMockModel();
    const send = jest.fn().mockResolvedValue(true);
    const service = new NotificationService(
      model as any,
      { isEnabled: () => true, send } as any,
      { isEnabled: () => true, resolveEmail: jest.fn().mockResolvedValue('x@y.z') } as any,
    );

    await service.notify({
      type: NotifyType.SUBMITTED,
      docId: 'doc-10',
      recipientId: 'approver-1',
    } as any);
    await new Promise((r) => setTimeout(r, 0));

    expect(send).not.toHaveBeenCalled();
  });
});
