import pg from "pg";
import { readdirSync, readFileSync } from "fs";
import path from "path";

const { Pool } = pg;

// Load env from .env.local manually
const envFile = readFileSync(".env.local", "utf-8");
const env = Object.fromEntries(
  envFile
    .split("\n")
    .filter((line) => line.includes("=") && !line.startsWith("#"))
    .map((line) => {
      const idx = line.indexOf("=");
      return [
        line.slice(0, idx).trim(),
        line
          .slice(idx + 1)
          .trim()
          .replace(/^"|"$/g, ""),
      ];
    }),
);

const raw = env.POSTGRES_URL ?? "";
const [base, query] = raw.split("?");
const params = new URLSearchParams(query);
params.delete("sslmode");
const qs = params.toString();
const connectionString = qs ? `${base}?${qs}` : base;

const pool = new Pool({ connectionString, ssl: { rejectUnauthorized: false } });

function getMigrationFiles() {
  const migrationsDir = path.resolve("supabase", "migrations");
  return readdirSync(migrationsDir)
    .filter((file) => file.endsWith(".sql"))
    .sort()
    .map((file) => ({
      file,
      version: file.split("_")[0],
      name: file.replace(/\.sql$/u, ""),
      sql: readFileSync(path.join(migrationsDir, file), "utf-8"),
    }));
}

async function getMigrationStore(client) {
  const { rows } = await client.query(`
    select exists (
      select 1
      from information_schema.tables
      where table_schema = 'supabase_migrations'
        and table_name = 'schema_migrations'
    ) as exists
  `);

  if (rows[0]?.exists) {
    return {
      isSupabaseStore: true,
      selectSql: "select version from supabase_migrations.schema_migrations",
      insert: async (version, name, sql) => {
        await client.query(
          `
            insert into supabase_migrations.schema_migrations (version, name, statements)
            values ($1, $2, $3::text[])
            on conflict (version) do nothing
          `,
          [version, name, [sql]],
        );
      },
    };
  }

  await client.query(`
    create table if not exists public.app_schema_migrations (
      version text primary key,
      name text not null,
      applied_at timestamptz not null default now()
    )
  `);

  return {
    isSupabaseStore: false,
    selectSql: "select version from public.app_schema_migrations",
    insert: async (version, name) => {
      await client.query(
        `
          insert into public.app_schema_migrations (version, name)
          values ($1, $2)
          on conflict (version) do nothing
        `,
        [version, name],
      );
    },
  };
}

async function applySqlMigrations(client) {
  const migrations = getMigrationFiles();
  if (migrations.length === 0) {
    console.log("• No SQL migrations found in supabase/migrations");
    return;
  }

  const store = await getMigrationStore(client);
  const applied = await client.query(store.selectSql);
  const appliedVersions = new Set(applied.rows.map((row) => String(row.version)));

  for (const migration of migrations) {
    if (!migration.version) {
      throw new Error(`Invalid migration filename: ${migration.file}`);
    }

    if (appliedVersions.has(migration.version)) {
      console.log(`↻  Skipping ${migration.file} (already applied)`);
      continue;
    }

    console.log(`→ Applying ${migration.file}`);
    await client.query("begin");
    try {
      await client.query(migration.sql);
      await store.insert(migration.version, migration.name, migration.sql);
      await client.query("commit");
      console.log(`✓ Applied ${migration.file}`);
    } catch (error) {
      await client.query("rollback");
      throw error;
    }
  }

  console.log(
    `✓ SQL migrations processed using ${
      store.isSupabaseStore ? "supabase_migrations.schema_migrations" : "public.app_schema_migrations"
    }`,
  );
}

const sql = `
CREATE TABLE IF NOT EXISTS "user" (
  "id"            text      NOT NULL PRIMARY KEY,
  "name"          text      NOT NULL,
  "email"         text      NOT NULL UNIQUE,
  "emailVerified" boolean   NOT NULL DEFAULT false,
  "image"         text,
  "createdAt"     timestamp NOT NULL DEFAULT now(),
  "updatedAt"     timestamp NOT NULL DEFAULT now(),
  "role"          text,
  "banned"        boolean,
  "banReason"     text,
  "banExpires"    timestamp
);

CREATE TABLE IF NOT EXISTS "session" (
  "id"         text      NOT NULL PRIMARY KEY,
  "expiresAt"  timestamp NOT NULL,
  "token"      text      NOT NULL UNIQUE,
  "createdAt"  timestamp NOT NULL DEFAULT now(),
  "updatedAt"  timestamp NOT NULL DEFAULT now(),
  "ipAddress"  text,
  "userAgent"  text,
  "userId"     text      NOT NULL REFERENCES "user"("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "account" (
  "id"                   text      NOT NULL PRIMARY KEY,
  "accountId"            text      NOT NULL,
  "providerId"           text      NOT NULL,
  "userId"               text      NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "accessToken"          text,
  "refreshToken"         text,
  "idToken"              text,
  "accessTokenExpiresAt" timestamp,
  "refreshTokenExpiresAt" timestamp,
  "scope"                text,
  "password"             text,
  "createdAt"            timestamp NOT NULL DEFAULT now(),
  "updatedAt"            timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "verification" (
  "id"         text      NOT NULL PRIMARY KEY,
  "identifier" text      NOT NULL,
  "value"      text      NOT NULL,
  "expiresAt"  timestamp NOT NULL,
  "createdAt"  timestamp,
  "updatedAt"  timestamp
);
`;

const client = await pool.connect();
try {
  await applySqlMigrations(client);
  await client.query(sql);
  console.log("✓ Better Auth tables ensured successfully");
} finally {
  client.release();
  await pool.end();
}
