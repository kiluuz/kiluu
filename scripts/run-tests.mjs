import { readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

const schemaPath = path.resolve("prisma/schema.prisma");
const testSchemaPath = path.resolve("prisma/schema.test.prisma");
const postgresSchema = readFileSync(schemaPath, "utf8");
const sqliteSchema = postgresSchema
  .replace('provider  = "postgresql"', 'provider  = "sqlite"')
  .replace(/^\s*directUrl = env\("DIRECT_URL"\)\r?\n/m, "");

if (sqliteSchema === postgresSchema || !postgresSchema.includes('directUrl = env("DIRECT_URL")')) {
  throw new Error("Could not derive the SQLite test schema from the PostgreSQL Prisma schema");
}

const env = {
  ...process.env,
  DATABASE_URL: "postgresql://test:test@localhost:5432/dubanix?sslmode=disable",
  DIRECT_URL: "postgresql://test:test@localhost:5432/dubanix?sslmode=disable",
};
const run = (args) => spawnSync("npx", args, { cwd: process.cwd(), env, stdio: "inherit" });
let exitCode = 1;

try {
  writeFileSync(testSchemaPath, sqliteSchema);
  const generated = run(["prisma", "generate", "--schema", testSchemaPath]);
  if (generated.status === 0) {
    const testFiles = readdirSync("src/lib")
      .filter((name) => name.endsWith(".test.ts"))
      .map((name) => path.join("src/lib", name));
    testFiles.push("cloudflare/r2-media-worker.test.mjs");
    const tests = run(["tsx", "--test", ...testFiles]);
    exitCode = tests.status ?? 1;
  } else {
    exitCode = generated.status ?? 1;
  }
} finally {
  rmSync(testSchemaPath, { force: true });
  const restored = run(["prisma", "generate", "--schema", schemaPath]);
  if (restored.status !== 0) {
    console.error("Failed to restore the PostgreSQL Prisma client after tests.");
    exitCode = 1;
  }
}

process.exitCode = exitCode;
