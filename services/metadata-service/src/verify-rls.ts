import { config } from 'dotenv';
import * as path from 'path';
// Load root .env (three levels up: src → metadata-service → services → root).
config({
  path: path.join(__dirname, '..', '..', '..', '.env'),
});

import { PrismaService } from './prisma/prisma.service';

/**
 * End-to-end RLS verification through the REAL PrismaService.
 *
 * Requires:
 *   - Postgres running with enable-rls.sql + enable-rls-force.sql applied
 *   - create-app-role.sql applied (docvault_app role)
 *   - DATABASE_URL_RUNTIME pointing at docvault_app
 *
 * Proves that withOrgContext() sets app.current_org so RLS scopes queries:
 *   correct org → sees rows, wrong org → sees 0 (isolation enforced).
 */
async function main() {
  const prisma = new PrismaService();
  await prisma.onModuleInit();

  const REAL_ORG = '00000000-0000-0000-0000-000000000001';
  const FAKE_ORG = '99999999-9999-9999-9999-999999999999';

  // Baseline: no context (NULL) — policy allows, so this reflects total rows
  // visible to the app role without an org set.
  const noCtx = await prisma.document.count();

  const correct = await prisma.withOrgContext(REAL_ORG, (tx) =>
    tx.document.count(),
  );
  const wrong = await prisma.withOrgContext(FAKE_ORG, (tx) =>
    tx.document.count(),
  );

  console.log(
    JSON.stringify({ noContext: noCtx, correctOrg: correct, wrongOrg: wrong }),
  );

  await prisma.$disconnect();

  // Assertions: correct org must see rows; wrong org must see zero.
  if (wrong !== 0) {
    console.error(
      `FAIL: wrong-org query returned ${wrong}, expected 0 (RLS not enforced)`,
    );
    process.exit(1);
  }
  if (correct <= 0) {
    console.error(`FAIL: correct-org query returned ${correct}, expected > 0`);
    process.exit(1);
  }
  console.log(
    'PASS: RLS isolation enforced via withOrgContext through real Prisma + docvault_app',
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
