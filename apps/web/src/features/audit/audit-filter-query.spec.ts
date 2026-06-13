import { describe, expect, it } from 'vitest';
import { parseAuditFilterQuery } from './audit-filter-query';

describe('parseAuditFilterQuery', () => {
  it('parses ACL-scoped audit evidence deep links', () => {
    expect(
      parseAuditFilterQuery(
        'documentId=doc-secret-board&aclId=acl-all-download&action=DOCUMENT_ACL_UPDATED',
      ),
    ).toEqual({
      action: 'DOCUMENT_ACL_UPDATED',
      documentId: 'doc-secret-board',
      aclId: 'acl-all-download',
    });
  });
});
