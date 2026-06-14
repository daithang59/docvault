const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const orgs = await prisma.organization.findMany({ include: { members: true } });
  console.log(JSON.stringify(orgs, null, 2));
}

async function run() {
  try {
    await main();
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  } finally {
    try {
      await prisma.$disconnect();
    } catch (error) {
      console.error(error);
      process.exitCode = 1;
    }
  }
}

void run();
