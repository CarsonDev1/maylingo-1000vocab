// Apply supabase/schema.sql to the Supabase Postgres via a direct connection.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";
import { loadEnv, ROOT } from "./_supabase.mjs";

loadEnv();
const host = process.env.SUPABASE_DB_HOST;
const password = process.env.SUPABASE_DB_PASSWORD;
if (!host || !password) {
  console.error("Missing SUPABASE_DB_HOST / SUPABASE_DB_PASSWORD in .env.local");
  process.exit(1);
}

const sql = readFileSync(join(ROOT, "supabase", "schema.sql"), "utf8");

const client = new pg.Client({
  host,
  port: 5432,
  user: "postgres",
  password,
  database: "postgres",
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 15000,
});

try {
  await client.connect();
  console.error("Connected to Postgres:", host);
  await client.query(sql);
  await client.query("NOTIFY pgrst, 'reload schema';");
  console.error("Schema applied + PostgREST reload requested.");
  const { rows } = await client.query(
    "select table_name from information_schema.tables where table_schema='public' order by table_name",
  );
  console.error("public tables:", rows.map((r) => r.table_name).join(", "));
  await client.end();
  process.exit(0);
} catch (e) {
  console.error("MIGRATE ERROR:", e.message);
  console.error("(If this is a network/IPv6 timeout, the direct host may be IPv6-only — we'll use the pooler instead.)");
  await client.end().catch(() => {});
  process.exit(2);
}
