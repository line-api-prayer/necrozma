import pg from "pg";
import { readFileSync } from "fs";

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
  await client.query(sql);
  console.log("✓ Better Auth tables created successfully");
} finally {
  client.release();
  await pool.end();
}
