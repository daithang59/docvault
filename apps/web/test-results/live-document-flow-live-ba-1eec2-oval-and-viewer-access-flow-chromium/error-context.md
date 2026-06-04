# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: live-document-flow.spec.ts >> live backend document upload, approval, and viewer access flow
- Location: e2e\live-document-flow.spec.ts:34:5

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByText('Live Playwright Contract 1780587498747')
Expected: visible
Timeout: 10000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 10000ms
  - waiting for getByText('Live Playwright Contract 1780587498747')

```

```yaml
- complementary:
  - heading "DocVault" [level=1]
  - paragraph: Document System
  - navigation:
    - paragraph: Navigation
    - link "Dashboard":
      - /url: /dashboard
    - link "Documents":
      - /url: /documents
    - link "Notifications":
      - /url: /notifications
  - text: VO
  - paragraph: Viewer One
  - paragraph: viewer
- banner:
  - text: Viewer
  - button "Switch to dark mode"
  - button "Notifications"
  - button "VO Viewer One"
- main:
  - heading "Documents" [level=1]
  - text: 1 filter
  - paragraph: Manage and review secure documents across their lifecycle.
  - paragraph: Document filters
  - paragraph: Showing 0 of 3 documents
  - paragraph: Saved views
  - textbox "Saved view name":
    - /placeholder: Name current view...
  - button "Save" [disabled]
  - button "Pending review 0"
  - button "Sensitive attention 0"
  - button "Draft handoff 0"
  - button "Recently published 1"
  - button "Confidential library 0"
  - tablist "Document quick views":
    - tab "All 3" [selected]
    - tab "Needs action 0"
    - tab "Drafts 0"
    - tab "Pending review 0"
    - tab "Published 1"
    - tab "Sensitive 0"
  - textbox "Search documents":
    - /placeholder: Search documents...
    - text: file:live-contract-1780587498747.txt
  - text: Search syntax
  - combobox "Filter by status":
    - option "All Status" [selected]
    - option "Draft"
    - option "Pending"
    - option "Published"
    - option "Archived"
    - option "Deleted"
  - combobox "Filter by classification":
    - option "All Classifications" [selected]
    - option "Public"
    - option "Internal"
    - option "Confidential"
    - option "Secret"
  - combobox "Filter by owner":
    - option "All Owners" [selected]
    - option "9dc88534-75ee-469a-b8ed-27c7a3707451"
    - option "8c5c10f1-187f-4f21-9430-76c6a852f9e1"
  - combobox "Filter by tag":
    - option "All Tags" [selected]
    - option "hr"
    - option "live-e2e"
    - option "meeting"
    - option "policy"
  - combobox "Sort documents":
    - option "Sort by"
    - option "Recently updated" [selected]
    - option "Oldest updated"
    - option "Newest created"
    - option "Title A-Z"
    - option "Title Z-A"
    - option "Status A-Z"
    - option "Classification A-Z"
    - option "Owner A-Z"
  - button "Reset"
  - paragraph: Smart folders
  - 'button "Folder: hr 1"'
  - 'button "Folder: live-e2e 1"'
  - 'button "Folder: meeting 1"'
  - 'button "Folder: policy 1"'
  - 'button "Search: file:live-contract-1780587498747.txt"'
  - heading "No documents found" [level=3]
  - paragraph: "No documents match Search: file:live-contract-1780587498747.txt."
- region "Notifications alt+T"
- button "Open Tanstack query devtools":
  - img
- alert
```

# Test source

```ts
  1   | import { expect, test, type Page } from '@playwright/test';
  2   | 
  3   | type LiveUser = 'editor1' | 'approver1' | 'viewer1';
  4   | 
  5   | type JwtPayload = {
  6   |   sub?: string;
  7   |   preferred_username?: string;
  8   |   username?: string;
  9   |   name?: string;
  10  |   email?: string;
  11  |   given_name?: string;
  12  |   family_name?: string;
  13  |   groups?: string[];
  14  |   realm_access?: { roles?: string[] };
  15  |   resource_access?: Record<string, { roles?: string[] }>;
  16  |   roles?: string[];
  17  | };
  18  | 
  19  | const LIVE_E2E_ENABLED = process.env.DOCVAULT_LIVE_E2E === '1';
  20  | const KEYCLOAK_TOKEN_URL =
  21  |   process.env.DOCVAULT_KEYCLOAK_TOKEN_URL ??
  22  |   'http://localhost:8080/realms/docvault/protocol/openid-connect/token';
  23  | const KEYCLOAK_CLIENT_ID =
  24  |   process.env.DOCVAULT_KEYCLOAK_CLIENT_ID ?? 'docvault-gateway';
  25  | const KEYCLOAK_CLIENT_SECRET =
  26  |   process.env.DOCVAULT_KEYCLOAK_CLIENT_SECRET ?? 'dev-gateway-secret';
  27  | const DEMO_PASSWORD = process.env.DOCVAULT_DEMO_PASSWORD ?? 'Passw0rd!';
  28  | 
  29  | test.skip(
  30  |   !LIVE_E2E_ENABLED,
  31  |   'Set DOCVAULT_LIVE_E2E=1 and run the local backend stack to execute live DocVault UI E2E.',
  32  | );
  33  | 
  34  | test('live backend document upload, approval, and viewer access flow', async ({
  35  |   page,
  36  |   request,
  37  | }) => {
  38  |   test.setTimeout(90_000);
  39  | 
  40  |   const runId = Date.now();
  41  |   const title = `Live Playwright Contract ${runId}`;
  42  |   const filename = `live-contract-${runId}.txt`;
  43  | 
  44  |   const editorSession = await buildSession('editor1');
  45  |   const approverSession = await buildSession('approver1');
  46  |   const viewerSession = await buildSession('viewer1');
  47  | 
  48  |   await installSession(page, editorSession);
  49  |   await page.goto('/documents/new');
  50  | 
  51  |   await page.getByPlaceholder('Enter document title').fill(title);
  52  |   await page
  53  |     .getByPlaceholder('Brief description of this document...')
  54  |     .fill('Live Playwright proof for upload, approval, and viewer access.');
  55  |   await page.getByRole('button', { name: 'Internal' }).click();
  56  |   await page
  57  |     .getByPlaceholder('Type and press Enter to add tags...')
  58  |     .fill('live-e2e');
  59  |   await page.keyboard.press('Enter');
  60  |   await page.locator('input[type="file"]').setInputFiles({
  61  |     name: filename,
  62  |     mimeType: 'text/plain',
  63  |     buffer: Buffer.from(`DocVault live E2E ${runId}`),
  64  |   });
  65  | 
  66  |   await page.getByRole('button', { name: 'Save Draft' }).click();
  67  |   await expectCreatedDocumentDetailUrl(page);
  68  |   const docId = getCurrentDocumentId(page);
  69  |   if (!docId) throw new Error('Created document id was not present in URL.');
  70  | 
  71  |   await expect(page.getByText(title)).toBeVisible();
  72  |   await expect(page.getByText(filename)).toBeVisible();
  73  |   await page.getByRole('button', { name: 'Submit for Approval' }).click();
  74  |   await page.getByRole('button', { name: /^Submit$/ }).click();
  75  |   await expectDocumentStatus(page, 'Pending');
  76  | 
  77  |   await installSession(page, approverSession);
  78  |   await page.goto(`/documents/${docId}`);
  79  |   await page.getByRole('button', { name: 'Approve Document' }).click();
  80  |   await page.getByRole('button', { name: /^Approve$/ }).click();
  81  |   await expectDocumentStatus(page, 'Published');
  82  | 
  83  |   await installSession(page, viewerSession);
  84  |   await page.goto('/documents');
  85  |   await page.getByLabel('Search documents').fill(`file:${filename}`);
> 86  |   await expect(page.getByText(title)).toBeVisible();
      |                                       ^ Error: expect(locator).toBeVisible() failed
  87  |   await page.getByRole('link', { name: title }).click();
  88  |   await expect(page).toHaveURL(new RegExp(`/documents/${docId}$`));
  89  |   await expect(page.getByRole('button', { name: /^Download$/ })).toBeVisible();
  90  | 
  91  |   const restricted = await request.post('/api/metadata/documents', {
  92  |     headers: {
  93  |       Authorization: `Bearer ${editorSession.accessToken}`,
  94  |     },
  95  |     data: {
  96  |       title: `Restricted Playwright ${runId}`,
  97  |       description: 'Confidential metadata should not be visible to viewer.',
  98  |       classification: 'CONFIDENTIAL',
  99  |       tags: ['restricted-live-e2e'],
  100 |     },
  101 |   });
  102 |   expect(restricted.status()).toBe(201);
  103 |   const restrictedDocument = (await restricted.json()) as { id: string };
  104 | 
  105 |   await installSession(page, viewerSession);
  106 |   await page.goto(`/documents/${restrictedDocument.id}`);
  107 |   await expect(page.getByText('Failed to load document.')).toBeVisible();
  108 | });
  109 | 
  110 | async function buildSession(username: LiveUser) {
  111 |   const accessToken = await getAccessToken(username);
  112 |   const payload = parseJwt(accessToken);
  113 |   if (!payload) throw new Error(`Could not parse JWT for ${username}.`);
  114 | 
  115 |   const normalizedRoles = normalizeRoles([
  116 |     ...(payload.realm_access?.roles ?? []),
  117 |     ...(Array.isArray(payload.roles) ? payload.roles : []),
  118 |     ...Object.values(payload.resource_access ?? {}).flatMap(
  119 |       (entry) => entry.roles ?? [],
  120 |     ),
  121 |   ]);
  122 |   const preferredUsername =
  123 |     payload.preferred_username ??
  124 |     payload.username ??
  125 |     payload.name ??
  126 |     payload.email ??
  127 |     payload.sub ??
  128 |     username;
  129 | 
  130 |   return {
  131 |     accessToken,
  132 |     user: {
  133 |       sub: payload.sub ?? username,
  134 |       username: preferredUsername,
  135 |       preferred_username: preferredUsername,
  136 |       name: payload.name,
  137 |       email: payload.email,
  138 |       firstName: payload.given_name,
  139 |       lastName: payload.family_name,
  140 |       displayName:
  141 |         payload.name ??
  142 |         [payload.given_name, payload.family_name].filter(Boolean).join(' ') ??
  143 |         undefined,
  144 |       roles: normalizedRoles,
  145 |       groups: normalizeGroups(payload.groups),
  146 |     },
  147 |   };
  148 | }
  149 | 
  150 | async function getAccessToken(username: LiveUser): Promise<string> {
  151 |   const body = new URLSearchParams({
  152 |     client_id: KEYCLOAK_CLIENT_ID,
  153 |     client_secret: KEYCLOAK_CLIENT_SECRET,
  154 |     grant_type: 'password',
  155 |     username,
  156 |     password: DEMO_PASSWORD,
  157 |   });
  158 | 
  159 |   const response = await fetch(KEYCLOAK_TOKEN_URL, {
  160 |     method: 'POST',
  161 |     headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  162 |     body,
  163 |   });
  164 | 
  165 |   if (!response.ok) {
  166 |     throw new Error(
  167 |       `Token request failed for ${username}: ${response.status} ${await response.text()}`,
  168 |     );
  169 |   }
  170 | 
  171 |   const data = (await response.json()) as { access_token?: string };
  172 |   if (!data.access_token) {
  173 |     throw new Error(`Token response for ${username} did not include access_token.`);
  174 |   }
  175 |   return data.access_token;
  176 | }
  177 | 
  178 | async function installSession(
  179 |   page: Page,
  180 |   session: Awaited<ReturnType<typeof buildSession>>,
  181 | ) {
  182 |   await page.goto('/login');
  183 |   await page.evaluate((nextSession) => {
  184 |     window.localStorage.setItem('docvault_session', JSON.stringify(nextSession));
  185 |   }, session);
  186 | }
```