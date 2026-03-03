# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start dev server (Next.js with Turbo)
npm run build        # Production build
npm run lint         # ESLint check
npm run lint:fix     # ESLint with auto-fix
npm run typecheck    # TypeScript type check (tsc --noEmit)
npm run check        # Lint + typecheck combined
npm run format:check # Prettier check
npm run format:write # Prettier auto-format
```

No test framework is currently configured.

## Architecture

This is a **T3 Stack** app: Next.js 15 (App Router) + tRPC 11 + Better Auth + Supabase (PostgreSQL).

### Key Layers

- **`src/app/`** — Next.js App Router pages and components. Server Components by default; client components use `"use client"` directive.
- **`src/server/api/`** — tRPC routers. Add new routers in `routers/` and register them in `root.ts`. All procedures currently use `publicProcedure` (no auth guard).
- **`src/server/db/supabase.ts`** — Supabase client. No ORM; uses Supabase JS client for queries.
- **`src/server/lib/auth.ts`** — Better Auth server config (email/password, PostgreSQL via `pg` Pool).
- **`src/server/lib/auth-client.ts`** — Better Auth React client (`authClient.useSession()` for session hooks).
- **`src/trpc/`** — tRPC wiring: `react.tsx` (client provider + hooks), `server.ts` (RSC caller + `HydrateClient`), `query-client.ts` (TanStack Query config).
- **`src/env.js`** — Type-safe env validation via `@t3-oss/env-nextjs` + Zod. All env vars must be declared here.

### Data Flow

Server Components call tRPC via `src/trpc/server.ts` (direct caller). Client Components use `api.router.procedure.useQuery()` from `src/trpc/react.tsx`. Both share the same router type (`AppRouter` from `src/server/api/root.ts`).

### Auth Integration

Better Auth handles auth at `/api/auth/[...all]` (catch-all route). The server config is in `src/server/lib/auth.ts`; the React client in `src/server/lib/auth-client.ts`. Session data is accessed client-side via `authClient.useSession()`.

## Conventions

- **Path alias:** `~/` maps to `src/` (e.g., `import { env } from "~/env.js"`)
- **Type imports:** Use inline type imports (`import { type Foo }`) — enforced by ESLint
- **Unused vars:** Prefix with `_` to suppress warnings
- **Styling:** CSS Modules (no Tailwind)
- **Serialization:** SuperJSON is the tRPC transformer — handles Dates, Maps, etc. automatically

## Environment Variables

Defined in `.env` (see `.env.example`). All must be registered in `src/env.js`. Set `SKIP_ENV_VALIDATION=true` to bypass validation (e.g., Docker builds).

Required: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `POSTGRES_URL`, `BETTER_AUTH_URL`, `BETTER_AUTH_SECRET` (min 32 chars). Optional: `SUPABASE_SERVICE_ROLE_KEY`.
