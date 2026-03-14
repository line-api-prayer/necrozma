import { betterAuth } from "better-auth";
import { admin } from "better-auth/plugins";
import { pool } from "~/server/db/pg";

export const auth = betterAuth({
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined),
  database: pool,
  emailAndPassword: {
    enabled: true,
  },
  socialProviders: {
    line: {
      clientId: process.env.LINE_LOGIN_CHANNEL_ID!,
      clientSecret: process.env.LINE_LOGIN_CHANNEL_SECRET!,
    },
  },
  plugins: [admin()],
  trustedOrigins: [
    "https://*.vercel.app",
    "https://*.ngrok-free.dev",
    "http://localhost:3000"
  ],
});
