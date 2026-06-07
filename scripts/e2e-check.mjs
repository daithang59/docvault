import process from 'node:process';
import { S3Client, HeadObjectCommand } from '@aws-sdk/client-s3';

const KEYCLOAK_BASE_URL = process.env.KEYCLOAK_BASE_URL ?? 'http://localhost:8080';
const KEYCLOAK_REALM = process.env.KEYCLOAK_REALM ?? 'docvault';
const GATEWAY_URL = process.env.GATEWAY_URL ?? 'http://localhost:3000';
const CLIENT_ID = process.env.KEYCLOAK_CLIENT_ID ?? 'docvault-gateway';
const CLIENT_SECRET = process.env.KEYCLOAK_CLIENT_SECRET ?? 'dev-gateway-secret';
const PASSWORD = process.env.KEYCLOAK_PASSWORD ?? 'Passw0rd!';
const S3_ENDPOINT = process.env.S3_ENDPOINT ?? 'http://localhost:9000';
const S3_REGION = process.env.S3_REGION ?? 'us-east-1';
const S3_ACCESS_KEY = process.env.S3_ACCESS_KEY ?? 'minioadmin';
const S3_SECRET_KEY = process.env.S3_SECRET_KEY ?? 'minioadminpw';
const S3_BUCKET = process.env.S3_BUCKET ?? 'docvault';

function log(message) {
  process.stdout.write(`${message}\n`);
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getToken(username) {
  const response = await fetch(
    `${KEYCLOAK_BASE_URL}/realms/${KEYCLOAK_REALM}/protocol/openid-connect/token`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        grant_type: 'password',
        username,
        password: PASSWORD,
      }),
    },
  );

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(`Could not get token for ${username}: ${JSON.stringify(payload)}`);
  }

  return payload.access_token;
}

async function call(path, options = {}) {
  const response = await fetch(`${GATEWAY_URL}${path}`, options);
  const contentType = response.headers.get('content-type') ?? '';
  const body = contentType.includes('application/json')
    ? await response.json().catch(() => null)
    : await response.text();

  return { response, body };
}

async function expectStatus(label, path, expectedStatus, options = {}) {
  const { response, body } = await call(path, options);
  assert(
    response.status === expectedStatus,
    `${label}: expected ${expectedStatus}, got ${response.status} with body ${JSON.stringify(body)}`,
  );
  log(`PASS ${label}: ${expectedStatus}`);
  return body;
}

async function expectAuditQueryContains(
  label,
  path,
  token,
  predicate,
  message,
) {
  let lastStatus = 0;
  let lastBody = null;

  for (let attempt = 1; attempt <= 6; attempt++) {
    const { response, body } = await call(path, {
      headers: authHeaders(token),
    });
    lastStatus = response.status;
    lastBody = body;

    if (response.status === 200 && body?.data?.some(predicate)) {
      log(`PASS ${label}: 200`);
      return body;
    }

    if (attempt < 6) {
      await sleep(500);
    }
  }

  throw new Error(
    `${message}; last status=${lastStatus}; last body=${JSON.stringify(lastBody)}`,
  );
}

function authHeaders(token, extra = {}) {
  return {
    Authorization: `Bearer ${token}`,
    ...extra,
  };
}

function makeExpiredLikeToken() {
  const header = Buffer.from(
    JSON.stringify({ alg: 'RS256', typ: 'JWT' }),
  ).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({
      sub: 'expired-user',
      preferred_username: 'expired-user',
      aud: CLIENT_ID,
      iss: `${KEYCLOAK_BASE_URL}/realms/${KEYCLOAK_REALM}`,
      exp: 1,
      realm_access: { roles: ['viewer'] },
    }),
  ).toString('base64url');
  return `${header}.${payload}.expired-signature`;
}

function decodeJwtPayload(token) {
  const payload = token.split('.')[1];
  if (!payload) {
    return {};
  }
  return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
}

function normalizeGroups(groups) {
  return [
    ...new Set(
      (Array.isArray(groups) ? groups : [])
        .map((group) => group.trim().replace(/^\/+/, ''))
        .filter(Boolean),
    ),
  ];
}

async function verifyObjectExists(objectKey) {
  const client = new S3Client({
    region: S3_REGION,
    endpoint: S3_ENDPOINT,
    forcePathStyle: true,
    credentials: {
      accessKeyId: S3_ACCESS_KEY,
      secretAccessKey: S3_SECRET_KEY,
    },
  });

  await client.send(
    new HeadObjectCommand({
      Bucket: S3_BUCKET,
      Key: objectKey,
    }),
  );
}

async function verifyObjectMissing(objectKey) {
  const client = new S3Client({
    region: S3_REGION,
    endpoint: S3_ENDPOINT,
    forcePathStyle: true,
    credentials: {
      accessKeyId: S3_ACCESS_KEY,
      secretAccessKey: S3_SECRET_KEY,
    },
  });

  try {
    await client.send(
      new HeadObjectCommand({
        Bucket: S3_BUCKET,
        Key: objectKey,
      }),
    );
  } catch (error) {
    const statusCode = error?.$metadata?.httpStatusCode;
    if (statusCode === 404 || error?.name === 'NotFound') {
      return;
    }
    throw error;
  }

  throw new Error(`Expected object to be absent from MinIO: ${objectKey}`);
}

async function main() {
  log('Getting access tokens');
  const editorToken = await getToken('editor1');
  const approverToken = await getToken('approver1');
  const viewerToken = await getToken('viewer1');
  const complianceToken = await getToken('co1');
  const adminToken = await getToken('admin1');
  const editorGroups = normalizeGroups(decodeJwtPayload(editorToken).groups);

  await expectStatus('no token metadata list', '/api/metadata/documents', 401);

  const expiredToken = process.env.EXPIRED_ACCESS_TOKEN ?? makeExpiredLikeToken();
  await expectStatus('expired token metadata list', '/api/metadata/documents', 401, {
    headers: authHeaders(expiredToken),
  });

  await expectStatus('viewer create document denied', '/api/metadata/documents', 403, {
    method: 'POST',
    headers: {
      ...authHeaders(viewerToken),
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      title: 'Viewer should not create',
      classification: 'INTERNAL',
    }),
  });

  const createdDocument = await expectStatus(
    'editor create document',
    '/api/metadata/documents',
    201,
    {
      method: 'POST',
      headers: {
        ...authHeaders(editorToken),
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        title: 'DocVault MVP refactor document',
        description: 'E2E verification document',
        classification: 'INTERNAL',
      }),
    },
  );
  const docId = createdDocument.id;

  const confidentialDocument = await expectStatus(
    'editor create confidential document',
    '/api/metadata/documents',
    201,
    {
      method: 'POST',
      headers: {
        ...authHeaders(editorToken),
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        title: 'Confidential policy probe',
        description: 'Document used to prove guessed metadata is denied',
        classification: 'CONFIDENTIAL',
      }),
    },
  );
  const confidentialDocId = confidentialDocument.id;

  await expectStatus(
    'viewer guessed confidential metadata denied',
    `/api/metadata/documents/${confidentialDocId}`,
    403,
    {
      headers: authHeaders(viewerToken),
    },
  );

  await expectStatus(
    'viewer guessed confidential workflow history denied',
    `/api/metadata/documents/${confidentialDocId}/workflow-history`,
    403,
    {
      headers: authHeaders(viewerToken),
    },
  );

  await expectStatus(
    'viewer guessed confidential comments denied',
    `/api/metadata/documents/${confidentialDocId}/comments`,
    403,
    {
      headers: authHeaders(viewerToken),
    },
  );

  await expectStatus(
    'viewer guessed confidential ACL denied',
    `/api/metadata/documents/${confidentialDocId}/acl`,
    403,
    {
      headers: authHeaders(viewerToken),
    },
  );

  const confidentialFileBuffer = Buffer.from(
    'Board packet for protected download posture evidence.',
    'utf8',
  );
  const confidentialForm = new FormData();
  confidentialForm.append(
    'file',
    new Blob([confidentialFileBuffer], { type: 'text/plain' }),
    'protected.txt',
  );

  const confidentialUpload = await expectStatus(
    'editor upload confidential posture document',
    `/api/documents/${confidentialDocId}/upload`,
    201,
    {
      method: 'POST',
      headers: authHeaders(editorToken),
      body: confidentialForm,
    },
  );
  await verifyObjectExists(confidentialUpload.objectKey);
  log('PASS confidential upload stored in MinIO');

  const confidentialPending = await expectStatus(
    'editor submit confidential posture document',
    `/api/workflow/${confidentialDocId}/submit`,
    201,
    {
      method: 'POST',
      headers: authHeaders(editorToken),
    },
  );
  assert(
    confidentialPending.status === 'PENDING',
    'confidential submit should set status=PENDING',
  );

  const confidentialPublished = await expectStatus(
    'approver approve confidential posture document',
    `/api/workflow/${confidentialDocId}/approve`,
    201,
    {
      method: 'POST',
      headers: authHeaders(approverToken),
    },
  );
  assert(
    confidentialPublished.status === 'PUBLISHED',
    'confidential approve should set status=PUBLISHED',
  );

  await expectStatus(
    'viewer confidential presign denied',
    `/api/documents/${confidentialDocId}/presign-download`,
    403,
    {
      method: 'POST',
      headers: {
        ...authHeaders(viewerToken),
        'content-type': 'application/json',
      },
      body: JSON.stringify({ version: confidentialUpload.version }),
    },
  );

  const confidentialPresign = await expectStatus(
    'editor confidential presign returns stream-only response',
    `/api/documents/${confidentialDocId}/presign-download`,
    200,
    {
      method: 'POST',
      headers: {
        ...authHeaders(editorToken),
        'content-type': 'application/json',
      },
      body: JSON.stringify({ version: confidentialUpload.version }),
    },
  );
  assert(
    confidentialPresign.url === null,
    'confidential presign should not expose a direct URL',
  );
  assert(
    confidentialPresign.watermarkRequired === true,
    'confidential presign should require watermark streaming',
  );
  assert(
    typeof confidentialPresign.streamingEndpoint === 'string',
    'confidential presign should expose a streaming endpoint',
  );
  log('PASS confidential presign withheld direct URL');

  await expectStatus(
    'editor confidential stream download',
    `/api/documents/${confidentialDocId}/versions/${confidentialUpload.version}/stream`,
    200,
    {
      headers: authHeaders(editorToken),
    },
  );
  log('PASS confidential stream download uses controlled path');

  if (editorGroups.includes('finance-team')) {
    const groupAclDocument = await expectStatus(
      'admin create group ACL confidential document',
      '/api/metadata/documents',
      201,
      {
        method: 'POST',
        headers: {
          ...authHeaders(adminToken),
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          title: 'Group ACL confidential probe',
          description: 'Document used to prove GROUP ACL metadata access',
          classification: 'CONFIDENTIAL',
        }),
      },
    );
    const groupAclDocId = groupAclDocument.id;

    await expectStatus(
      'editor group ACL metadata denied before grant',
      `/api/metadata/documents/${groupAclDocId}`,
      403,
      {
        headers: authHeaders(editorToken),
      },
    );

    const groupAclEntry = await expectStatus(
      'admin add GROUP READ ACL',
      `/api/metadata/documents/${groupAclDocId}/acl`,
      201,
      {
        method: 'POST',
        headers: {
          ...authHeaders(adminToken),
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          subjectType: 'GROUP',
          subjectId: 'finance-team',
          permission: 'READ',
          effect: 'ALLOW',
        }),
      },
    );
    assert(groupAclEntry.subjectType === 'GROUP', 'ACL subjectType should be GROUP');
    assert(groupAclEntry.subjectId === 'finance-team', 'GROUP ACL subjectId should be normalized group name');
    log('PASS GROUP ACL stored with normalized group name');

    await expectStatus(
      'editor GROUP READ ACL metadata access',
      `/api/metadata/documents/${groupAclDocId}`,
      200,
      {
        headers: authHeaders(editorToken),
      },
    );

    await expectStatus(
      'viewer GROUP ACL metadata denied',
      `/api/metadata/documents/${groupAclDocId}`,
      403,
      {
        headers: authHeaders(viewerToken),
      },
    );
  } else {
    log(
      'SKIP GROUP ACL live evidence: editor1 token does not include finance-team; reimport Keycloak realm to enable this probe.',
    );
  }

  const malwareDocument = await expectStatus(
    'editor create malware scan probe',
    '/api/metadata/documents',
    201,
    {
      method: 'POST',
      headers: {
        ...authHeaders(editorToken),
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        title: 'Malware scan probe',
        description: 'Document used to prove EICAR upload is blocked',
        classification: 'INTERNAL',
      }),
    },
  );
  const eicarForm = new FormData();
  eicarForm.append(
    'file',
    new Blob(
      [
        Buffer.from(
          'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*',
          'ascii',
        ),
      ],
      { type: 'text/plain' },
    ),
    'eicar.txt',
  );

  await expectStatus(
    'editor EICAR upload blocked',
    `/api/documents/${malwareDocument.id}/upload`,
    400,
    {
      method: 'POST',
      headers: authHeaders(editorToken),
      body: eicarForm,
    },
  );
  await verifyObjectMissing(`doc/${malwareDocument.id}/v1/eicar.txt`);
  log('PASS EICAR upload not stored in MinIO');
  const malwareMetadata = await expectStatus(
    'malware blocked document has no version',
    `/api/metadata/documents/${malwareDocument.id}`,
    200,
    {
      headers: authHeaders(editorToken),
    },
  );
  assert(
    malwareMetadata.currentVersion === 0,
    'malware blocked document should not create a version',
  );
  log('PASS EICAR upload created no version');

  const dlpDocument = await expectStatus(
    'editor create DLP scan probe',
    '/api/metadata/documents',
    201,
    {
      method: 'POST',
      headers: {
        ...authHeaders(editorToken),
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        title: 'DLP scan probe',
        description: 'Document used to prove sensitive text is detected',
        classification: 'INTERNAL',
      }),
    },
  );
  const dlpForm = new FormData();
  dlpForm.append(
    'file',
    new Blob(
      [
        Buffer.from(
          'Internal only file. Contact ceo@example.com or 0901234567.',
          'utf8',
        ),
      ],
      { type: 'text/plain' },
    ),
    'sensitive.txt',
  );
  await expectStatus(
    'editor upload sensitive DLP document',
    `/api/documents/${dlpDocument.id}/upload`,
    201,
    {
      method: 'POST',
      headers: authHeaders(editorToken),
      body: dlpForm,
    },
  );
  const dlpMetadata = await expectStatus(
    'editor DLP metadata escalated',
    `/api/metadata/documents/${dlpDocument.id}`,
    200,
    {
      headers: authHeaders(editorToken),
    },
  );
  assert(dlpMetadata.dlpStatus === 'DETECTED', 'DLP status should be DETECTED');
  assert(
    dlpMetadata.classification === 'CONFIDENTIAL',
    'DLP detection should escalate classification to CONFIDENTIAL',
  );
  log('PASS DLP upload escalated classification');

  await expectStatus(
    'editor downgrade DLP document denied',
    `/api/metadata/documents/${dlpDocument.id}`,
    403,
    {
      method: 'PATCH',
      headers: {
        ...authHeaders(editorToken),
        'content-type': 'application/json',
      },
      body: JSON.stringify({ classification: 'PUBLIC' }),
    },
  );

  const fileBuffer = Buffer.from(
    'Regular project handbook for review and approval.',
    'utf8',
  );
  const form = new FormData();
  form.append(
    'file',
    new Blob([fileBuffer], { type: 'text/plain' }),
    'regular.txt',
  );

  const uploadResult = await expectStatus(
    'editor upload document',
    `/api/documents/${docId}/upload`,
    201,
    {
      method: 'POST',
      headers: authHeaders(editorToken),
      body: form,
    },
  );
  await verifyObjectExists(uploadResult.objectKey);
  log('PASS upload stored in MinIO');

  await expectStatus(
    'viewer download draft denied',
    `/api/documents/${docId}/presign-download`,
    403,
    {
      method: 'POST',
      headers: {
        ...authHeaders(viewerToken),
        'content-type': 'application/json',
      },
      body: JSON.stringify({ version: uploadResult.version }),
    },
  );

  const pendingDocument = await expectStatus(
    'editor submit document',
    `/api/workflow/${docId}/submit`,
    201,
    {
      method: 'POST',
      headers: authHeaders(editorToken),
    },
  );
  assert(pendingDocument.status === 'PENDING', 'submit should set status=PENDING');
  log('PASS submit status=PENDING');

  const publishedDocument = await expectStatus(
    'approver approve document',
    `/api/workflow/${docId}/approve`,
    201,
    {
      method: 'POST',
      headers: authHeaders(approverToken),
    },
  );
  assert(
    publishedDocument.status === 'PUBLISHED',
    'approve should set status=PUBLISHED',
  );
  assert(
    typeof publishedDocument.retentionClass === 'string',
    'approve should set retentionClass',
  );
  assert(
    typeof publishedDocument.retentionUntil === 'string',
    'approve should set retentionUntil',
  );
  log('PASS approve status=PUBLISHED');
  log('PASS approve stamped retention evidence');

  await expectStatus(
    'approve same document twice conflict',
    `/api/workflow/${docId}/approve`,
    409,
    {
      method: 'POST',
      headers: authHeaders(approverToken),
    },
  );

  const viewerDownload = await expectStatus(
    'viewer download published document',
    `/api/documents/${docId}/presign-download`,
    200,
    {
      method: 'POST',
      headers: {
        ...authHeaders(viewerToken),
        'content-type': 'application/json',
      },
      body: JSON.stringify({ version: uploadResult.version }),
    },
  );
  assert(typeof viewerDownload.url === 'string', 'viewer presign should return URL');
  log('PASS viewer presign-download returns URL');

  await expectStatus(
    'viewer stream published document',
    `/api/documents/${docId}/versions/${uploadResult.version}/stream`,
    200,
    {
      headers: authHeaders(viewerToken),
    },
  );

  await expectStatus(
    'compliance officer metadata access',
    `/api/metadata/documents/${docId}`,
    200,
    {
      headers: authHeaders(complianceToken),
    },
  );

  const retentionEvidence = await expectStatus(
    'compliance officer retention evidence',
    '/api/metadata/retention/documents',
    200,
    {
      headers: authHeaders(complianceToken),
    },
  );
  const retentionRecord = retentionEvidence.records?.find(
    (record) => record.docId === docId,
  );
  assert(retentionRecord, 'retention evidence should include published document');
  assert(
    retentionRecord.retentionClass === publishedDocument.retentionClass,
    'retention evidence should expose retentionClass',
  );
  assert(
    retentionRecord.retentionUntil === publishedDocument.retentionUntil,
    'retention evidence should expose retentionUntil',
  );
  log('PASS retention evidence includes published record');

  await expectStatus(
    'compliance officer preview denied',
    `/api/metadata/documents/${docId}/preview-authorize`,
    403,
    {
      method: 'POST',
      headers: {
        ...authHeaders(complianceToken),
        'content-type': 'application/json',
      },
      body: JSON.stringify({ version: uploadResult.version }),
    },
  );

  await expectStatus(
    'compliance officer direct preview denied',
    `/api/documents/${docId}/preview?version=${uploadResult.version}`,
    403,
    {
      headers: authHeaders(complianceToken),
    },
  );

  await expectStatus(
    'compliance officer download denied',
    `/api/documents/${docId}/presign-download`,
    403,
    {
      method: 'POST',
      headers: {
        ...authHeaders(complianceToken),
        'content-type': 'application/json',
      },
      body: JSON.stringify({ version: uploadResult.version }),
    },
  );

  await expectStatus(
    'compliance officer direct download denied',
    `/api/documents/${docId}/versions/${uploadResult.version}/stream`,
    403,
    {
      headers: authHeaders(complianceToken),
    },
  );

  const futureAsOf = '2030-01-01T00:00:00.000Z';
  // run-retention is a sensitive action: obtain a step-up proof first.
  const retentionProof = await expectStatus(
    'admin issue run-retention proof',
    '/api/metadata/sensitive-actions/proof',
    200,
    {
      method: 'POST',
      headers: {
        ...authHeaders(adminToken),
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        action: 'run-retention',
        challengePhrase: 'RUN RETENTION',
      }),
    },
  );
  const retentionRun = await expectStatus(
    'admin run retention future clock',
    `/api/metadata/retention/run?asOf=${encodeURIComponent(futureAsOf)}`,
    200,
    {
      method: 'POST',
      headers: authHeaders(adminToken, {
        'x-docvault-step-up-proof': retentionProof.proof,
      }),
    },
  );
  assert(
    retentionRun.archived >= 1,
    'future retention run should archive at least one due record',
  );
  log('PASS retention run archived due records');

  const archivedMetadata = await expectStatus(
    'retention archived document metadata',
    `/api/metadata/documents/${docId}`,
    200,
    {
      headers: authHeaders(complianceToken),
    },
  );
  assert(
    archivedMetadata.status === 'ARCHIVED',
    'retention run should archive the published document',
  );
  log('PASS retention run sets status=ARCHIVED');

  const retentionHistory = await expectStatus(
    'retention workflow history',
    `/api/metadata/documents/${docId}/workflow-history`,
    200,
    {
      headers: authHeaders(complianceToken),
    },
  );
  assert(
    retentionHistory.some(
      (entry) =>
        entry.action === 'RETENTION' && entry.actorId === 'system:retention',
    ),
    'workflow history should include RETENTION by system:retention',
  );
  log('PASS retention workflow history actor=system:retention');

  await expectStatus('compliance officer audit query', '/api/audit/query', 200, {
    headers: authHeaders(complianceToken),
  });

  await expectAuditQueryContains(
    'compliance officer retention audit query',
    `/api/audit/query?action=DOCUMENT_AUTO_ARCHIVED&resourceId=${docId}`,
    complianceToken,
    (event) =>
      event.action === 'DOCUMENT_AUTO_ARCHIVED' && event.resourceId === docId,
    'audit query should include DOCUMENT_AUTO_ARCHIVED for retained document',
  );
  log('PASS retention audit event DOCUMENT_AUTO_ARCHIVED');

  const chainStatus = await expectStatus(
    'compliance officer audit verify-chain',
    '/api/audit/verify-chain',
    200,
    {
      headers: authHeaders(complianceToken),
    },
  );
  assert(
    typeof chainStatus.valid === 'boolean',
    'verify-chain should return a boolean valid field',
  );
  log(`PASS audit verify-chain valid=${chainStatus.valid}`);

  const evidenceProof = await expectStatus(
    'compliance officer issue evidence-packet proof',
    '/api/metadata/sensitive-actions/proof',
    200,
    {
      method: 'POST',
      headers: {
        ...authHeaders(complianceToken),
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        action: 'export-evidence-packet',
        challengePhrase: 'EXPORT EVIDENCE',
      }),
    },
  );
  const evidencePacket = await expectStatus(
    'compliance officer evidence packet',
    `/api/metadata/documents/${docId}/evidence-packet`,
    200,
    {
      headers: authHeaders(complianceToken, {
        'x-docvault-step-up-proof': evidenceProof.proof,
      }),
    },
  );
  assert(
    evidencePacket.scope?.documentId === docId,
    'evidence packet should be scoped to the requested document',
  );
  assert(
    evidencePacket.document?.id === docId,
    'evidence packet should include document metadata',
  );
  assert(
    evidencePacket.versions?.some(
      (version) => version.checksum === uploadResult.checksum,
    ),
    'evidence packet should include version checksums',
  );
  assert(
    evidencePacket.workflowHistory?.some(
      (entry) => entry.action === 'RETENTION',
    ),
    'evidence packet should include workflow history',
  );
  assert(
    evidencePacket.retention?.record?.docId === docId,
    'evidence packet should include retention evidence',
  );
  assert(
    typeof evidencePacket.audit?.chain?.valid === 'boolean',
    'evidence packet should include audit hash-chain status',
  );
  assert(
    Array.isArray(evidencePacket.audit?.events),
    'evidence packet should include related audit events',
  );
  assert(
    !JSON.stringify(evidencePacket).includes('grantToken'),
    'evidence packet must not include file grant tokens',
  );
  log('PASS evidence packet includes metadata/version/workflow/retention/audit evidence');

  await expectStatus(
    'viewer evidence packet denied',
    `/api/metadata/documents/${docId}/evidence-packet`,
    403,
    {
      headers: authHeaders(viewerToken),
    },
  );

  const securitySummary = await expectStatus(
    'compliance officer security summary',
    '/api/audit/security-summary',
    200,
    {
      headers: authHeaders(complianceToken),
    },
  );
  assert(
    securitySummary.totals?.malwareBlocked >= 1,
    'security summary should include malware blocked counter',
  );
  assert(
    securitySummary.totals?.dlpDetections >= 1,
    'security summary should include DLP detection counter',
  );
  assert(
    securitySummary.totals?.deniedEvents >= 1,
    'security summary should include denied event counter',
  );
  assert(
    securitySummary.totals?.downloadDenied >= 1,
    'security summary should include download denied counter',
  );
  log('PASS security summary includes malware/DLP/deny evidence');

  await expectStatus('viewer audit ingest denied', '/api/audit/events', 403, {
    method: 'POST',
    headers: {
      ...authHeaders(viewerToken),
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      actorId: 'viewer1',
      action: 'FAKE_EVENT',
      resourceType: 'DOCUMENT',
      resourceId: docId,
      result: 'SUCCESS',
    }),
  });

  await expectStatus('viewer audit query denied', '/api/audit/query', 403, {
    headers: authHeaders(viewerToken),
  });

  log('All required E2E checks passed.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
