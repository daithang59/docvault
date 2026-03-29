import "dotenv/config";
import { defineConfig } from "prisma/config";
import path from "path";

// Load .env from project root (two levels up from this file)
const rootEnv = path.join(__dirname, "..", "..", ".env");
require("dotenv").config({ path: rootEnv });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env["DATABASE_URL"],
  },
});
