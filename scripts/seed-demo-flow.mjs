import process from "node:process";
import { HeadObjectCommand, S3Client } from "@aws-sdk/client-s3";

const KEYCLOAK_BASE_URL =
  process.env.KEYCLOAK_BASE_URL ?? "http://localhost:8080";
const KEYCLOAK_REALM = process.env.KEYCLOAK_REALM ?? "docvault";
const GATEWAY_URL = process.env.GATEWAY_URL ?? "http://localhost:3000";
const CLIENT_ID = process.env.KEYCLOAK_CLIENT_ID ?? "docvault-gateway";
const CLIENT_SECRET =
  process.env.KEYCLOAK_CLIENT_SECRET ?? "dev-gateway-secret";
const PASSWORD =
  process.env.DOCVAULT_DEMO_PASSWORD ??
  process.env.KEYCLOAK_PASSWORD ??
  "Passw0rd!";

const S3_ENDPOINT = process.env.S3_ENDPOINT ?? "http://localhost:9000";
const S3_REGION = process.env.S3_REGION ?? "us-east-1";
const S3_ACCESS_KEY = process.env.S3_ACCESS_KEY ?? "minioadmin";
const S3_SECRET_KEY = process.env.S3_SECRET_KEY ?? "minioadminpw";
const S3_BUCKET = process.env.S3_BUCKET ?? "docvault";

const RUN_ID = normalizeRunId(process.env.DOCVAULT_DEMO_SEED_RUN_ID ?? "local");
const INCLUDE_MALWARE_PROBE =
  process.env.DOCVAULT_SEED_INCLUDE_MALWARE_PROBE?.toLowerCase() === "true";
const VERIFY_S3 =
  process.env.DOCVAULT_SEED_VERIFY_S3?.toLowerCase() !== "false";

const LOCAL_GATEWAY_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "::1",
  "gateway",
  "docvault-gateway",
  "host.docker.internal",
]);

const s3Client = new S3Client({
  region: S3_REGION,
  endpoint: S3_ENDPOINT,
  forcePathStyle: true,
  credentials: {
    accessKeyId: S3_ACCESS_KEY,
    secretAccessKey: S3_SECRET_KEY,
  },
});

function log(message) {
  process.stdout.write(`${message}\n`);
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function normalizeRunId(value) {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "local"
  );
}

function title(name) {
  return `Seed Demo ${RUN_ID} - ${name}`;
}

function assertSafeTarget() {
  const gateway = new URL(GATEWAY_URL);
  const host = gateway.hostname.toLowerCase();
  const remoteAllowed =
    process.env.DOCVAULT_ALLOW_REMOTE_DEMO_SEED?.toLowerCase() === "true";

  if (!LOCAL_GATEWAY_HOSTS.has(host) && !remoteAllowed) {
    throw new Error(
      `Refusing demo seed against non-local gateway host: ${host}. ` +
        "Set DOCVAULT_ALLOW_REMOTE_DEMO_SEED=true if this is an intentional demo target.",
    );
  }
}

function authHeaders(token, extra = {}) {
  return {
    Authorization: `Bearer ${token}`,
    ...extra,
  };
}

function jsonHeaders(token) {
  return authHeaders(token, { "content-type": "application/json" });
}

function decodeJwtPayload(token) {
  const payload = token.split(".")[1];
  if (!payload) return {};
  return JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
}

function normalizeGroups(groups) {
  return [
    ...new Set(
      (Array.isArray(groups) ? groups : [])
        .map((group) => group.trim().replace(/^\/+/, ""))
        .filter(Boolean),
    ),
  ];
}

async function getToken(username) {
  const response = await fetch(
    `${KEYCLOAK_BASE_URL}/realms/${KEYCLOAK_REALM}/protocol/openid-connect/token`,
    {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        grant_type: "password",
        username,
        password: PASSWORD,
      }),
    },
  );

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(
      `Could not get token for ${username}: ${JSON.stringify(payload)}`,
    );
  }

  return payload.access_token;
}

async function call(path, options = {}) {
  const response = await fetch(`${GATEWAY_URL}${path}`, options);
  const contentType = response.headers.get("content-type") ?? "";
  const body = contentType.includes("application/json")
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

function normalizeDocumentArray(value) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.data)) return value.data;
  return [];
}

async function findDocumentByTitle(token, documentTitle) {
  const body = await expectStatus(
    `list documents for ${documentTitle}`,
    "/api/metadata/documents",
    200,
    { headers: authHeaders(token) },
  );

  return (
    normalizeDocumentArray(body).find((doc) => doc.title === documentTitle) ??
    null
  );
}

async function getDocument(token, docId, expectedStatus = 200) {
  return expectStatus(
    `get document ${docId}`,
    `/api/metadata/documents/${docId}`,
    expectedStatus,
    { headers: authHeaders(token) },
  );
}

async function ensureDocument({
  lookupToken,
  ownerToken,
  ownerLabel,
  documentTitle,
  description,
  classification,
  tags,
}) {
  const existing = await findDocumentByTitle(lookupToken, documentTitle);
  if (existing) {
    log(`SKIP create ${documentTitle}: already exists (${existing.id})`);
    return getDocument(lookupToken, existing.id);
  }

  log(`Creating ${documentTitle} as ${ownerLabel}`);
  return expectStatus("create document", "/api/metadata/documents", 201, {
    method: "POST",
    headers: jsonHeaders(ownerToken),
    body: JSON.stringify({
      title: documentTitle,
      description,
      classification,
      tags,
    }),
  });
}

async function verifyObjectExists(objectKey) {
  if (!VERIFY_S3) return;

  await s3Client.send(
    new HeadObjectCommand({
      Bucket: S3_BUCKET,
      Key: objectKey,
    }),
  );
  log(`PASS object exists in MinIO: ${objectKey}`);
}

async function uploadIfNeeded({
  doc,
  ownerToken,
  filename,
  contentType = "text/plain",
  content,
}) {
  const detail = await getDocument(ownerToken, doc.id);
  if (Number(detail.currentVersion ?? 0) > 0) {
    log(`SKIP upload ${detail.title}: currentVersion=${detail.currentVersion}`);
    return {
      document: detail,
      upload: Array.isArray(detail.versions) ? detail.versions[0] : null,
    };
  }

  const form = new FormData();
  form.append(
    "file",
    new Blob([Buffer.from(content, "utf8")], { type: contentType }),
    filename,
  );

  const upload = await expectStatus(
    `upload ${doc.title}`,
    `/api/documents/${doc.id}/upload`,
    201,
    {
      method: "POST",
      headers: authHeaders(ownerToken),
      body: form,
    },
  );

  await verifyObjectExists(upload.objectKey);
  return { document: await getDocument(ownerToken, doc.id), upload };
}

async function submitIfDraft(doc, token) {
  if (doc.status !== "DRAFT") {
    log(`SKIP submit ${doc.title}: status=${doc.status}`);
    return doc;
  }

  return expectStatus(
    `submit ${doc.title}`,
    `/api/workflow/${doc.id}/submit`,
    201,
    {
      method: "POST",
      headers: authHeaders(token),
    },
  );
}

async function approveIfPending(doc, token) {
  if (doc.status !== "PENDING") {
    log(`SKIP approve ${doc.title}: status=${doc.status}`);
    return doc;
  }

  return expectStatus(
    `approve ${doc.title}`,
    `/api/workflow/${doc.id}/approve`,
    201,
    {
      method: "POST",
      headers: authHeaders(token),
    },
  );
}

async function publishDocument({ doc, ownerToken, approverToken }) {
  const afterSubmit = await submitIfDraft(doc, ownerToken);
  const afterApprove = await approveIfPending(afterSubmit, approverToken);
  assert(
    afterApprove.status === "PUBLISHED",
    `${doc.title} should end as PUBLISHED, got ${afterApprove.status}`,
  );
  return afterApprove;
}

async function ensureAcl(token, docId, entry) {
  const acl = await expectStatus(
    `list ACL ${docId}`,
    `/api/metadata/documents/${docId}/acl`,
    200,
    { headers: authHeaders(token) },
  );

  const exists = Array.isArray(acl)
    ? acl.some(
        (item) =>
          item.subjectType === entry.subjectType &&
          (item.subjectId ?? null) === (entry.subjectId ?? null) &&
          item.permission === entry.permission &&
          item.effect === entry.effect,
      )
    : false;

  if (exists) {
    log(
      `SKIP ACL ${entry.subjectType}:${entry.subjectId ?? "ALL"} ${entry.permission} ${entry.effect}: already exists`,
    );
    return;
  }

  await expectStatus(
    `add ACL ${entry.subjectType}:${entry.subjectId ?? "ALL"}`,
    `/api/metadata/documents/${docId}/acl`,
    201,
    {
      method: "POST",
      headers: jsonHeaders(token),
      body: JSON.stringify(entry),
    },
  );
}

async function ensureComment(token, docId, content) {
  const comments = await expectStatus(
    `list comments ${docId}`,
    `/api/metadata/documents/${docId}/comments`,
    200,
    { headers: authHeaders(token) },
  );

  if (
    Array.isArray(comments) &&
    comments.some((comment) => comment.content === content)
  ) {
    log("SKIP comment: already exists");
    return;
  }

  await expectStatus(
    "add comment",
    `/api/metadata/documents/${docId}/comments`,
    201,
    {
      method: "POST",
      headers: jsonHeaders(token),
      body: JSON.stringify({ content }),
    },
  );
}

async function ensureSavedView(token) {
  const name = `Seed Demo ${RUN_ID} - Published controls`;
  const views = await expectStatus(
    "list saved views",
    "/api/metadata/document-saved-views",
    200,
    { headers: authHeaders(token) },
  );

  if (Array.isArray(views) && views.some((view) => view.name === name)) {
    log(`SKIP saved view ${name}: already exists`);
    return;
  }

  await expectStatus(
    "create team saved view",
    "/api/metadata/document-saved-views",
    201,
    {
      method: "POST",
      headers: jsonHeaders(token),
      body: JSON.stringify({
        name,
        description: "Seeded view for published compliance and access demos",
        scope: "TEAM",
        filters: {
          status: ["PUBLISHED"],
          tags: ["seed-demo", `seed-${RUN_ID}`],
        },
      }),
    },
  );
}

async function seedPublishedInternalDocument(tokens) {
  const documentTitle = title("Employee Handbook");
  const doc = await ensureDocument({
    lookupToken: tokens.admin,
    ownerToken: tokens.editor,
    ownerLabel: "editor1",
    documentTitle,
    description: "Seeded internal document with a real uploaded file.",
    classification: "INTERNAL",
    tags: ["seed-demo", `seed-${RUN_ID}`, "handbook", "internal"],
  });

  const { document, upload } = await uploadIfNeeded({
    doc,
    ownerToken: tokens.editor,
    filename: "employee-handbook.txt",
    content:
      "DocVault seed handbook. This file proves upload, versioning, checksum, and MinIO storage.",
  });

  const published = await publishDocument({
    doc: document,
    ownerToken: tokens.editor,
    approverToken: tokens.approver,
  });

  const version = upload?.version ?? published.currentVersion;
  await expectStatus(
    "editor presign internal document",
    `/api/documents/${published.id}/presign-download`,
    200,
    {
      method: "POST",
      headers: jsonHeaders(tokens.editor),
      body: JSON.stringify({ version }),
    },
  );
  await expectStatus(
    "viewer denied internal document download",
    `/api/documents/${published.id}/presign-download`,
    403,
    {
      method: "POST",
      headers: jsonHeaders(tokens.viewer),
      body: JSON.stringify({ version }),
    },
  );
  await ensureComment(
    tokens.approver,
    published.id,
    "Seed approval note: handbook is ready for controlled internal access.",
  );

  return published;
}

async function seedPublishedConfidentialDocument(tokens) {
  const documentTitle = title("Board Packet");
  const doc = await ensureDocument({
    lookupToken: tokens.admin,
    ownerToken: tokens.editor,
    ownerLabel: "editor1",
    documentTitle,
    description: "Seeded confidential document used to prove denied access.",
    classification: "CONFIDENTIAL",
    tags: ["seed-demo", `seed-${RUN_ID}`, "board", "confidential"],
  });

  const { document, upload } = await uploadIfNeeded({
    doc,
    ownerToken: tokens.editor,
    filename: "board-packet.txt",
    content:
      "Confidential board packet. Download must use controlled streaming and watermark policy.",
  });

  const published = await publishDocument({
    doc: document,
    ownerToken: tokens.editor,
    approverToken: tokens.approver,
  });

  await getDocument(tokens.viewer, published.id, 403);

  const version = upload?.version ?? published.currentVersion;
  const presign = await expectStatus(
    "editor confidential presign returns stream-only response",
    `/api/documents/${published.id}/presign-download`,
    200,
    {
      method: "POST",
      headers: jsonHeaders(tokens.editor),
      body: JSON.stringify({ version }),
    },
  );
  assert(
    presign.url === null && presign.watermarkRequired === true,
    "Confidential presign should withhold direct URL and require watermark streaming.",
  );

  return published;
}

async function seedGroupAclDocument(tokens, editorGroups) {
  const documentTitle = title("Finance Team Forecast");
  const doc = await ensureDocument({
    lookupToken: tokens.admin,
    ownerToken: tokens.admin,
    ownerLabel: "admin1",
    documentTitle,
    description:
      "Seeded confidential document granted to the finance-team group.",
    classification: "CONFIDENTIAL",
    tags: ["seed-demo", `seed-${RUN_ID}`, "finance", "group-acl"],
  });

  await ensureAcl(tokens.admin, doc.id, {
    subjectType: "GROUP",
    subjectId: "finance-team",
    permission: "READ",
    effect: "ALLOW",
  });

  const { document } = await uploadIfNeeded({
    doc,
    ownerToken: tokens.admin,
    filename: "finance-team-forecast.txt",
    content:
      "Finance-team forecast for group ACL demo. Access depends on Keycloak group claims.",
  });

  const published = await publishDocument({
    doc: document,
    ownerToken: tokens.admin,
    approverToken: tokens.approver,
  });

  if (editorGroups.includes("finance-team")) {
    await getDocument(tokens.editor, published.id, 200);
  } else {
    log(
      "SKIP finance-team access check: editor1 token does not include finance-team.",
    );
  }

  await getDocument(tokens.viewer, published.id, 403);
  return published;
}

async function seedDlpDocument(tokens) {
  const documentTitle = title("DLP Contact Sheet");
  const doc = await ensureDocument({
    lookupToken: tokens.admin,
    ownerToken: tokens.editor,
    ownerLabel: "editor1",
    documentTitle,
    description: "Seeded document containing sensitive text to trigger DLP.",
    classification: "INTERNAL",
    tags: ["seed-demo", `seed-${RUN_ID}`, "dlp"],
  });

  const detail = await getDocument(tokens.editor, doc.id);
  if (Number(detail.currentVersion ?? 0) === 0) {
    await uploadIfNeeded({
      doc,
      ownerToken: tokens.editor,
      filename: "dlp-contact-sheet.txt",
      content:
        "Internal contact sheet. Email security@example.com or call 0901234567 for escalation.",
    });
  } else {
    log(
      `SKIP DLP upload ${detail.title}: currentVersion=${detail.currentVersion}`,
    );
  }

  const updated = await getDocument(tokens.editor, doc.id);
  assert(updated.dlpStatus === "DETECTED", "DLP document should be DETECTED.");
  assert(
    updated.classification === "CONFIDENTIAL",
    "DLP document should escalate to CONFIDENTIAL.",
  );

  return updated;
}

async function seedMalwareProbe(tokens) {
  const documentTitle = title("EICAR Upload Probe");
  const doc = await ensureDocument({
    lookupToken: tokens.admin,
    ownerToken: tokens.editor,
    ownerLabel: "editor1",
    documentTitle,
    description: "Optional seeded malware probe. Upload should be blocked.",
    classification: "INTERNAL",
    tags: ["seed-demo", `seed-${RUN_ID}`, "malware-probe"],
  });

  const detail = await getDocument(tokens.editor, doc.id);
  if (Number(detail.currentVersion ?? 0) > 0) {
    log(`SKIP malware probe upload: ${detail.title} already has a version.`);
    return detail;
  }

  const form = new FormData();
  form.append(
    "file",
    new Blob(
      [
        Buffer.from(
          "X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*",
          "ascii",
        ),
      ],
      { type: "text/plain" },
    ),
    "eicar.txt",
  );

  await expectStatus(
    "EICAR upload blocked",
    `/api/documents/${doc.id}/upload`,
    400,
    {
      method: "POST",
      headers: authHeaders(tokens.editor),
      body: form,
    },
  );

  return getDocument(tokens.editor, doc.id);
}

async function verifyAuditEvidence(tokens, docId) {
  await expectStatus("compliance audit query", "/api/audit/query", 200, {
    headers: authHeaders(tokens.compliance),
  });
  await expectStatus(
    "compliance security summary",
    "/api/audit/security-summary",
    200,
    { headers: authHeaders(tokens.compliance) },
  );
  await expectStatus(
    "compliance retention evidence",
    "/api/metadata/retention/documents",
    200,
    { headers: authHeaders(tokens.compliance) },
  );
  await getDocument(tokens.compliance, docId, 200);
}

async function main() {
  assertSafeTarget();
  log(`Seeding demo flow through Gateway: ${GATEWAY_URL}`);
  log(`Run id: ${RUN_ID}`);

  const [editor, approver, viewer, compliance, admin] = await Promise.all([
    getToken("editor1"),
    getToken("approver1"),
    getToken("viewer1"),
    getToken("co1"),
    getToken("admin1"),
  ]);
  const tokens = { editor, approver, viewer, compliance, admin };
  const editorGroups = normalizeGroups(decodeJwtPayload(editor).groups);

  const internalDoc = await seedPublishedInternalDocument(tokens);
  await seedPublishedConfidentialDocument(tokens);
  await seedGroupAclDocument(tokens, editorGroups);
  await seedDlpDocument(tokens);
  await ensureSavedView(tokens.admin);

  if (INCLUDE_MALWARE_PROBE) {
    await seedMalwareProbe(tokens);
  } else {
    log(
      "SKIP malware probe. Set DOCVAULT_SEED_INCLUDE_MALWARE_PROBE=true to enable it.",
    );
  }

  await verifyAuditEvidence(tokens, internalDoc.id);

  log("Demo seed complete.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
