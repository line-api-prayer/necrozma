import { betterAuth } from "better-auth";
import { admin } from "better-auth/plugins";
import { Pool } from "pg";

export const auth = betterAuth({
  secret: process.env.BETTER_AUTH_SECRET,
  database: new Pool({
    connectionString: (() => {
      const raw = process.env.POSTGRES_URL ?? "";
      const [base, query] = raw.split("?");
      const params = new URLSearchParams(query);
      params.delete("sslmode");
      const qs = params.toString();
      return qs ? `${base}?${qs}` : base;
    })(),
    ssl: { rejectUnauthorized: false },
  }),
  emailAndPassword: {
    enabled: true,
  },
  socialProviders: {
    line: {
      clientId: process.env.LINE_CLIENT_ID!,
      clientSecret: process.env.LINE_CLIENT_SECRET!,
    },
  },
  plugins: [admin()],
});
