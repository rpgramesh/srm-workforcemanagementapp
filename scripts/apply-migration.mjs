import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";
import { Client } from "pg";
import { fileURLToPath } from "node:url";

dotenv.config({ path: ".env.local", override: true });

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");

const migrationFile = process.argv[2] ?? "supabase/migrations/002_patch_pgcrypto_and_pin_hashes.sql";
const abs = path.resolve(projectRoot, migrationFile);

if (!process.env.DATABASE_URL) {
  console.error("❌ DATABASE_URL missing in .env.local");
  process.exit(1);
}

if (!fs.existsSync(abs)) {
  console.error("❌ Migration file not found:", abs);
  process.exit(1);
}

const sql = fs.readFileSync(abs, "utf8");
const client = new Client({ connectionString: process.env.DATABASE_URL });

console.log(`🗄️  Connecting Postgres via DATABASE_URL`);
console.log(`📄 Applying migration: ${migrationFile} (${sql.length.toLocaleString()} bytes)`);

try {
  await client.connect();
  await client.query(sql);
  console.log("✅ Migration applied successfully.");
} catch (err) {
  console.error("❌ Migration failed:\n", err?.message ?? err);
  process.exit(1);
} finally {
  await client.end().catch(() => {});
}
