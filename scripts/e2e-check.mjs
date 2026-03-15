import { readFileSync } from 'node:fs';
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

async function main() {
  log('Getting access tokens');
  const editorToken = await getToken('editor1');
  const approverToken = await getToken('approver1');
  const viewerToken = await getToken('viewer1');
  const complianceToken = await getToken('co1');

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

  const fileBuffer = readFileSync('./README.md');
  const form = new FormData();
  form.append(
    'file',
    new Blob([fileBuffer], { type: 'text/markdown' }),
    'README.md',
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
  log('PASS approve status=PUBLISHED');

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

  await expectStatus('compliance officer audit query', '/api/audit/query', 200, {
    headers: authHeaders(complianceToken),
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
