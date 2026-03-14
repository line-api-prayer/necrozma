# Project Overview

`necrozma` is a high-performance full-stack application built with the **T3 Stack** (Next.js 15, tRPC, TypeScript, Zod, and TanStack Query). It serves as an integration hub between **LINE Shop (MyShop)**, **LINE Messaging API**, and **Supabase**, specifically focused on sales reporting and order fulfillment.

## Key Features

- **LINE Shop Integration:** Synchronizes orders, status, and transaction data from LINE MyShop.
- **Automated Messaging:** Uses LINE Messaging API to interact with customers, send notifications, and handle webhooks.
- **Fulfillment System:** Staff and Admin portals for managing evidence (videos/images) and approving orders.
- **Authentication:** Robust identity management using **Better Auth** with Email/Password and LINE Social support.
- **Database:** **Supabase** (Postgres) for data persistence and a direct **pg pool** for auth/management.
- **PDF Generation & QR Scanning:** Built-in support for generating certificates/reports with `pdfmake` and scanning with `html5-qrcode`.
- **API Documentation:** Interactive **Swagger UI** available at `/api-docs`.

## Key Technologies

- **Framework:** Next.js 15 (App Router)
- **Runtime:** **Bun** (Fast package manager and executor)
- **Language:** TypeScript
- **API:** tRPC (v11) + Next.js API Routes (for webhooks)
- **Database:** Supabase (@supabase/supabase-js) + pg (direct access for Auth/Management)
- **Auth:** Better Auth (v1.4+)
- **Integration:** @line/bot-sdk (v10.6+)
- **Tools:** Zod, TanStack Query, pdfmake, html5-qrcode, swagger-jsdoc

## Project Structure

- `src/app/`: App Router pages.
  - `admin/`: Dashboard for reviews, approvals, and reporting.
  - `admin/users/`: User management (Role/Name/Delete).
  - `staff/`: Portal for fulfillment tasks (proof upload).
  - `api/line/webhook/`: Entry point for LINE platform events.
  - `api-docs/`: Swagger UI documentation.
- `src/server/`: Backend architecture.
  - `api/routers/`: tRPC routers (`order`, `review`, `evidence`, `report`, `user`).
  - `lib/line/`: Dedicated clients for LINE Messaging and MyShop APIs.
  - `db/`: Database clients (Supabase and PG Pool).
- `prototype/`: A standalone Vite-based React project for UI/UX exploration.
- `scope/`: Business requirement documents and CSV datasets.

## Building and Running

### Main Application (`necrozma`)

```bash
# Install dependencies
bun install

# Run the development server
bun dev

# Build for production
bun run build

# Type-check and lint
bun run check
```

## Environment Variables

Defined and validated in `src/env.js`:

- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`: Supabase credentials.
- `POSTGRES_URL`: Direct DB connection for Better Auth and User Management.
- `BETTER_AUTH_URL`, `BETTER_AUTH_SECRET`: Auth configuration.
- `LINE_LOGIN_CHANNEL_ID`, `LINE_LOGIN_CHANNEL_SECRET`: LINE Login credentials.
- `LINE_ADMIN_BOT_CHANNEL_SECRET`, `LINE_ADMIN_BOT_CHANNEL_ACCESS_TOKEN`: Messaging API credentials.
- `ENABLE_TEST_MODE`: Set to `true` to redirect all bot messages to a test user.
- `DEV_TEST_USER_ID`: The LINE UID that receives all messages when `ENABLE_TEST_MODE` is active.
- `NEXT_PUBLIC_VERCEL_ENV`: Used to hide test buttons in production.

## Development Conventions

- **Surgical Updates:** Maintain the tRPC + App Router pattern.
- **Validation:** Always define input schemas using Zod.
- **LINE Webhooks:** Handle signature verification and bot-type routing (see `src/app/api/line/webhook/route.ts`).
- **Styles:** Use CSS Modules or `styles/globals.css` for consistent UI.

## Lessons Learned & Best Practices

- **Runtime Migration:** Migrating from `npm` to **Bun** significantly improves install speeds and script execution. Use `bun.lockb` and ensure Vercel is configured to use Bun.
- **SWC Compatibility:** When using Next.js Turbopack (`--turbo`), ensure the `next` package version exactly matches the installed `@next/swc` binary version to avoid compilation warnings.
- **Safe Production Testing:** Use an explicit `ENABLE_TEST_MODE` flag instead of relying solely on `NODE_ENV`. This allows testing bot logic on Vercel "Production" or "Preview" environments without affecting real customers.
- **Auth CSRF:** When testing via tunnels like **ngrok**, always add the tunnel domain (e.g., `*.ngrok-free.dev`) to `trustedOrigins` in Better Auth config to avoid 403 Forbidden errors.
- **Database Pooling:** Export a shared `pg.Pool` from a central file (`src/server/db/pg.ts`) to be used by both Better Auth and custom tRPC routers (like `userRouter`) to ensure efficient connection management.
- **LINE ID Recovery:** Implement a simple "my id" command in the webhook handler to allow developers to quickly retrieve their LINE UID by messaging the bot.
- **Build Hygiene:** Always exclude one-off test scripts (`scripts/`) from `tsconfig.json` to prevent build failures due to missing dev dependencies in the production pipeline.
