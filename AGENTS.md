# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Commands

Prefer Bun for install and script execution. `packageManager` is pinned to `bun@1.3.8`.

```bash
bun install         # Install dependencies
bun dev             # Start Next.js dev server with Turbopack
bun run build       # Production build (SKIP_ENV_VALIDATION=true)
bun start           # Start production server
bun run preview     # Build and start locally

bun run lint        # ESLint check
bun run lint:fix    # ESLint auto-fix
bun run typecheck   # TypeScript check (tsc --noEmit)
bun run check       # Lint + typecheck
bun run format:check
bun run format:write

bun run test        # Vitest
bun run test:watch  # Vitest watch mode

bun run db:migrate  # Run migration script
bun run db:seed     # Seed data
```

## Architecture

This is a Next.js 15 App Router app built on the T3 stack shape, with tRPC 11, Better Auth, Supabase, and direct PostgreSQL access via `pg`.

### Key Layers

- **`src/app/`** — App Router pages, layouts, and route handlers.
- **`src/app/api/auth/[...all]/route.ts`** — Better Auth handler.
- **`src/app/api/trpc/[trpc]/route.ts`** — tRPC HTTP endpoint.
- **`src/app/api/line/webhook/route.ts`** — LINE Messaging webhook entrypoint with signature validation and bot-type routing.
- **`src/app/api/cron/*`** — Cron endpoints for cleanup, daily summaries, and order sync; secured with `CRON_SECRET`.
- **`src/app/api/openapi.json/route.ts`** + **`src/app/api-docs/page.tsx`** — OpenAPI JSON and Swagger UI.
- **`src/server/api/`** — tRPC root and routers.
- **`src/server/lib/line/`** — LINE Messaging/MyShop clients, types, webhook handling, and tests.
- **`src/server/lib/`** — Auth, reporting, daily summary, and order sync logic.
- **`src/server/db/`** — Supabase client plus shared `pg.Pool`.
- **`src/trpc/`** — React client/provider, query client, and server caller wiring.
- **`prototype/`** — Excluded experimental UI project; do not assume it is part of the main app build.
- **`scope/`** — Business docs and datasets.

### Domain Areas

The app is an operations hub for LINE Shop / MyShop order intake, fulfillment evidence review, reporting, admin user management, and automated customer/admin messaging.

Primary tRPC routers in `src/server/api/root.ts`:

- `order`
- `review`
- `evidence`
- `report`
- `mapping`
- `user`
- `notes`
- `post`

### Data Flow

Server Components call tRPC through `src/trpc/server.ts`. Client Components use hooks from `src/trpc/react.tsx`. Shared router types come from `src/server/api/root.ts`.

For database access:

- Use `src/server/db/supabase.ts` for Supabase-backed app data.
- Use the shared pool in `src/server/db/pg.ts` for Better Auth and any direct SQL management flows.

## Auth And Integrations

- Better Auth uses email/password and LINE social login.
- Better Auth is backed by the shared `pg` pool, not Supabase JS.
- The `admin()` plugin is enabled.
- New social-login users are banned by default in `src/server/lib/auth.ts` until admin approval.
- `trustedOrigins` already includes localhost, Vercel, and ngrok patterns; preserve that behavior when changing auth config.

LINE integration conventions:

- There are distinct admin and customer bot credentials.
- Customer webhook secrets/tokens switch between prod and test credentials based on `NODE_ENV`.
- `ENABLE_TEST_MODE=true` redirects outbound bot behavior to `DEV_TEST_USER_ID`; prefer this over ad hoc production checks.
- Preserve LINE signature validation and bot routing when editing webhook code.

## Conventions

- **Package manager/runtime:** Prefer Bun commands over npm.
- **Path alias:** `~/` maps to `src/`.
- **Type imports:** Use inline `type` imports where applicable.
- **Strict TS:** `strict` and `noUncheckedIndexedAccess` are enabled.
- **Validation:** Use Zod for input/env validation.
- **Styling:** CSS Modules plus `src/styles/globals.css`.
- **Serialization:** SuperJSON is the tRPC transformer.
- **OpenAPI:** Route handlers may carry `@openapi` JSDoc annotations; preserve them when changing documented endpoints.

## Testing

Testing is present, but split across tools:

- **Vitest** is configured for unit-style tests.
- **Playwright** is installed and there is at least one E2E spec in `e2e/login.spec.ts`.
- `scripts/` and `prototype/` are excluded from `tsconfig.json`; keep one-off utilities out of the main TypeScript build unless they are intended to be typechecked.

## Environment Variables

All env vars must be registered in `src/env.js`. `SKIP_ENV_VALIDATION=true` bypasses validation for builds.

Core server variables currently include:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (optional)
- `POSTGRES_URL`
- `BETTER_AUTH_URL` (optional in code; derived from `VERCEL_URL` when absent)
- `BETTER_AUTH_SECRET`
- `LINE_LOGIN_CHANNEL_ID`
- `LINE_LOGIN_CHANNEL_SECRET`
- `OA_PLUS_API_KEY`
- `LINE_ADMIN_BOT_CHANNEL_ACCESS_TOKEN`
- `LINE_ADMIN_BOT_CHANNEL_SECRET`
- `LINE_CUSTOMER_PROD_BOT_CHANNEL_ACCESS_TOKEN` (optional)
- `LINE_CUSTOMER_PROD_BOT_CHANNEL_SECRET` (optional)
- `LINE_CUSTOMER_TEST_BOT_CHANNEL_ACCESS_TOKEN` (optional)
- `LINE_CUSTOMER_TEST_BOT_CHANNEL_SECRET` (optional)
- `ENABLE_TEST_MODE`
- `DEV_TEST_USER_ID`
- `ADMIN_LINE_UID`
- `CRON_SECRET`

Client variables:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_VERCEL_ENV`

## Repo-Specific Guidance

- Prefer surgical changes that preserve the existing App Router + tRPC structure.
- When adding a new tRPC router, register it in `src/server/api/root.ts`.
- When adding new env vars, update both `.env.example` and `src/env.js`.
- When changing auth or webhook behavior, verify interactions across Better Auth, LINE bot credentials, and test mode.
- When changing reporting or PDF flows, check `src/server/lib/report-generator.ts` and any related assets/scripts in the repo root.
- Be careful with uncommitted user changes in files like `package.json`, `tsconfig.json`, or lockfiles; this repo is actively being modified.

## Ongoing Workflow Notes

- When committing and pushing work, update this `AGENTS.md` file with any repo workflow changes, deployment findings, or new project-specific gotchas discovered during the task.
- `bun run db:migrate` now applies SQL files from `supabase/migrations/`, records versions in `supabase_migrations.schema_migrations`, and then ensures Better Auth tables. Use it instead of assuming app schema changes are covered elsewhere.
- Daily summary, staff views, and service-request flows now depend on `orders.requested_service_date`, `orders.prayer_text`, `orders.service_request_prompt_sent_at`, and `orders.service_request_completed_at`. Apply the corresponding Supabase migration before testing those flows.
- For the service-request rollout, historical orders before the customer bot launch were marked as completed in the prompt flow. Missing-service-request queries should ignore rows where `service_request_completed_at` is already set.
- Customer bot deep links depend on `BETTER_AUTH_URL` being a live public URL. Stale ngrok domains will break LINE links even if the token itself is valid.
- When a Next.js page uses `useSearchParams()`, isolate it behind a `Suspense` boundary or read `searchParams` in the server page and pass the value down. `bun run build` will fail otherwise.
- Before committing, run `bun run build` and verify the linked Vercel project still deploys successfully after the push.
