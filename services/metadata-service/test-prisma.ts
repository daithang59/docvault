import { PrismaClient } from '@prisma/client';
import fs from 'fs';
try {
  const prisma = new PrismaClient();
  console.log("Prisma instantiated successfully");
} catch (e) {
  fs.writeFileSync('prisma-error.txt', String(e));
}
