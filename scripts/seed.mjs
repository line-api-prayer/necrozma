#!/usr/bin/env node
// scripts/seed.mjs
// Creates test accounts directly in the database.
// Uses the exact same hashing algorithm as Better Auth:
//   @noble/hashes scrypt — N=16384, r=16, p=1, dkLen=64
//   stored as "{saltHex}:{keyHex}"
//
// Usage: node scripts/seed.mjs

import pg from "pg";
import { readFileSync } from "fs";
import { scryptSync, randomBytes } from "crypto";

const { Pool } = pg;

// Load env vars from .env.local (same pattern as migrate.mjs)
const envFile = readFileSync(".env.local", "utf-8");
const env = Object.fromEntries(
  envFile
    .split("\n")
    .filter((line) => line.includes("=") && !line.startsWith("#"))
    .map((line) => {
      const idx = line.indexOf("=");
      return [
        line.slice(0, idx).trim(),
        line.slice(idx + 1).trim().replace(/^"|"$/g, ""),
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

// Mirror Better Auth's hashPassword from better-auth/dist/crypto/password.mjs
// scryptAsync(password.normalize("NFKC"), saltHex, { N, r, p, dkLen })
// Both password and saltHex are passed as strings → UTF-8 bytes used internally
function hashPassword(password) {
  const saltHex = randomBytes(16).toString("hex");
  const key = scryptSync(
    password.normalize("NFKC"),
    saltHex,
    64, // dkLen
    { N: 16384, r: 16, p: 1, maxmem: 128 * 16384 * 16 * 2 },
  );
  return `${saltHex}:${key.toString("hex")}`;
}

const accounts = [
  {
    email: "admin@test.com",
    password: "password123",
    name: "Admin",
    role: "admin",
  },
  {
    email: "staff@test.com",
    password: "password123",
    name: "Staff",
    role: "user",
  },
];

const client = await pool.connect();
try {
  for (const acct of accounts) {
    // Check if user already exists
    const existing = await client.query(
      'SELECT id FROM "user" WHERE email = $1',
      [acct.email],
    );

    if (existing.rows.length > 0) {
      const userId = existing.rows[0].id;
      await client.query(
        'UPDATE "user" SET role = $1, "updatedAt" = now() WHERE id = $2',
        [acct.role, userId],
      );
      console.log(
        `↻  ${acct.email} already exists — role updated to "${acct.role}"`,
      );
      continue;
    }

    const userId = crypto.randomUUID();
    const now = new Date();

    await client.query(
      `INSERT INTO "user" (id, name, email, "emailVerified", role, "createdAt", "updatedAt")
       VALUES ($1, $2, $3, true, $4, $5, $5)`,
      [userId, acct.name, acct.email, acct.role, now],
    );

    await client.query(
      `INSERT INTO "account" (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt")
       VALUES ($1, $2, 'credential', $3, $4, $5, $5)`,
      [crypto.randomUUID(), acct.email, userId, hashPassword(acct.password), now],
    );

    console.log(`✓  Created ${acct.role}: ${acct.email}  /  ${acct.password}`);
  }
} finally {
  client.release();
  await pool.end();
}
