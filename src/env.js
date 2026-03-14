import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  /**
   * Specify your server-side environment variables schema here. This way you can ensure the app
   * isn't built with invalid env vars.
   */
  server: {
    NODE_ENV: z.enum(["development", "test", "production"]),
    SUPABASE_ANON_KEY: z.string().min(1),
    SUPABASE_URL: z.string().url(),
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
    POSTGRES_URL: z.string().min(1),
    BETTER_AUTH_URL: z.string().min(1).optional(),
    BETTER_AUTH_SECRET: z.string().min(32),
    LINE_LOGIN_CHANNEL_ID: z.string().min(1),
    LINE_LOGIN_CHANNEL_SECRET: z.string().min(1),
    OA_PLUS_API_KEY: z.string().min(1),
    LINE_ADMIN_BOT_CHANNEL_ACCESS_TOKEN: z.string().min(1),
    LINE_ADMIN_BOT_CHANNEL_SECRET: z.string().min(1),
    LINE_CUSTOMER_PROD_BOT_CHANNEL_ACCESS_TOKEN: z.string().min(1),
    LINE_CUSTOMER_PROD_BOT_CHANNEL_SECRET: z.string().min(1),
    LINE_CUSTOMER_TEST_BOT_CHANNEL_ACCESS_TOKEN: z.string().min(1),
    LINE_CUSTOMER_TEST_BOT_CHANNEL_SECRET: z.string().min(1),
    ENABLE_TEST_MODE: z.enum(["true", "false"]).default("false"),
    DEV_TEST_USER_ID: z.string().optional(),
    ADMIN_LINE_UID: z.string().optional().transform((val) => val ? val.split(",") : []),
    CRON_SECRET: z.string().min(1),
  },

  /**
   * Specify your client-side environment variables schema here. This way you can ensure the app
   * isn't built with invalid env vars. To expose them to the client, prefix them with
   * `NEXT_PUBLIC_`.
   */
  client: {
    NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
    NEXT_PUBLIC_VERCEL_ENV: z.enum(["production", "preview", "development"]).default("development"),
  },

  /**
   * You can't destruct `process.env` as a regular object in the Next.js edge runtimes (e.g.
   * middlewares) or client-side so we need to destruct manually.
   */
  runtimeEnv: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_VERCEL_ENV: process.env.NEXT_PUBLIC_VERCEL_ENV,
    NODE_ENV: process.env.NODE_ENV,
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    POSTGRES_URL: process.env.POSTGRES_URL,
    BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
    LINE_LOGIN_CHANNEL_ID: process.env.LINE_LOGIN_CHANNEL_ID,
    LINE_LOGIN_CHANNEL_SECRET: process.env.LINE_LOGIN_CHANNEL_SECRET,
    OA_PLUS_API_KEY: process.env.OA_PLUS_API_KEY,
    LINE_ADMIN_BOT_CHANNEL_ACCESS_TOKEN: process.env.LINE_ADMIN_BOT_CHANNEL_ACCESS_TOKEN,
    LINE_ADMIN_BOT_CHANNEL_SECRET: process.env.LINE_ADMIN_BOT_CHANNEL_SECRET,
    LINE_CUSTOMER_PROD_BOT_CHANNEL_ACCESS_TOKEN: process.env.LINE_CUSTOMER_PROD_BOT_CHANNEL_ACCESS_TOKEN,
    LINE_CUSTOMER_PROD_BOT_CHANNEL_SECRET: process.env.LINE_CUSTOMER_PROD_BOT_CHANNEL_SECRET,
    LINE_CUSTOMER_TEST_BOT_CHANNEL_ACCESS_TOKEN: process.env.LINE_CUSTOMER_TEST_BOT_CHANNEL_ACCESS_TOKEN,
    LINE_CUSTOMER_TEST_BOT_CHANNEL_SECRET: process.env.LINE_CUSTOMER_TEST_BOT_CHANNEL_SECRET,
    ENABLE_TEST_MODE: process.env.ENABLE_TEST_MODE,
    DEV_TEST_USER_ID: process.env.DEV_TEST_USER_ID,
    ADMIN_LINE_UID: process.env.ADMIN_LINE_UID,
    CRON_SECRET: process.env.CRON_SECRET,
  },
  /**
   * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially
   * useful for Docker builds.
   */
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  /**
   * Makes it so that empty strings are treated as undefined. `SOME_VAR: z.string()` and
   * `SOME_VAR=''` will throw an error.
   */
  emptyStringAsUndefined: true,
});
