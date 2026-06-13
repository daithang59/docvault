import { AuditService } from './audit.service';

describe('AuditService query filters', () => {
  function makeAuditModel(data: unknown[] = [], total = data.length) {
    const lean = jest.fn().mockResolvedValue(data);
    const limit = jest.fn().mockReturnValue({ lean });
    const skip = jest.fn().mockReturnValue({ limit });
    const sort = jest.fn().mockReturnValue({ skip });
    const find = jest.fn().mockReturnValue({ sort });
    const countDocuments = jest.fn().mockResolvedValue(total);

    return {
      model: { find, countDocuments },
      find,
      countDocuments,
      sort,
      skip,
      limit,
      lean,
    };
  }

  it('matches direct document events and related events carrying metadata.docId', async () => {
    const auditModel = makeAuditModel(
      [
        {
          eventId: 'event-1',
          resourceType: 'DOCUMENT',
          resourceId: 'doc-1',
        },
      ],
      2,
    );
    const service = new AuditService(auditModel.model as any);

    await expect(
      service.query({ documentId: 'doc-1', pageSize: 50 } as any),
    ).resolves.toMatchObject({
      total: 2,
      page: 1,
      pageSize: 50,
    });

    const expectedFilter = {
      $or: [
        { resourceType: 'DOCUMENT', resourceId: 'doc-1' },
        { 'metadata.docId': 'doc-1' },
      ],
    };
    expect(auditModel.find).toHaveBeenCalledWith(expectedFilter, { _id: 0 });
    expect(auditModel.countDocuments).toHaveBeenCalledWith(expectedFilter);
  });

  it('matches ACL-level audit events by created or removed ACL id', async () => {
    const auditModel = makeAuditModel([], 0);
    const service = new AuditService(auditModel.model as any);

    await service.query({
      action: 'DOCUMENT_ACL_UPDATED',
      documentId: 'doc-1',
      aclId: 'acl-1',
      pageSize: 50,
    } as any);

    const expectedFilter = {
      action: 'DOCUMENT_ACL_UPDATED',
      $and: [
        {
          $or: [
            { resourceType: 'DOCUMENT', resourceId: 'doc-1' },
            { 'metadata.docId': 'doc-1' },
          ],
        },
        {
          $or: [
            { 'metadata.aclId': 'acl-1' },
            { 'metadata.removedAclId': 'acl-1' },
          ],
        },
      ],
    };
    expect(auditModel.find).toHaveBeenCalledWith(expectedFilter, { _id: 0 });
    expect(auditModel.countDocuments).toHaveBeenCalledWith(expectedFilter);
  });

  it('matches recommendation workflow audit events without matching recommendation list views', async () => {
    const auditModel = makeAuditModel([], 0);
    const service = new AuditService(auditModel.model as any);

    await service.query({
      recommendationId: 'actor-access-review:DENY_BURST:viewer-1',
      pageSize: 50,
    } as any);

    const expectedFilter = {
      $and: [
        {
          $or: [
            {
              resourceType: 'SECURITY_RECOMMENDATION',
              resourceId: 'actor-access-review:DENY_BURST:viewer-1',
            },
            {
              'metadata.recommendationId':
                'actor-access-review:DENY_BURST:viewer-1',
            },
          ],
        },
      ],
    };
    expect(auditModel.find).toHaveBeenCalledWith(expectedFilter, { _id: 0 });
    expect(auditModel.countDocuments).toHaveBeenCalledWith(expectedFilter);
  });
});
