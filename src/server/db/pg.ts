import { Pool } from "pg";

export const pool = new Pool({
  connectionString: (() => {
    const raw = process.env.POSTGRES_URL ?? "";
    const [base, query] = raw.split("?");
    const params = new URLSearchParams(query);
    params.delete("sslmode");
    const qs = params.toString();
    return qs ? `${base}?${qs}` : base;
  })(),
  ssl: { rejectUnauthorized: false },
});
