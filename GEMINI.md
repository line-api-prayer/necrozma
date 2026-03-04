# Project Overview

`necrozma` is a high-performance full-stack application built with the **T3 Stack** (Next.js 15, tRPC, TypeScript, Zod, and TanStack Query). It serves as an integration hub between **LINE Shop (MyShop)**, **LINE Messaging API**, and **Supabase**, specifically focused on sales reporting and order fulfillment.

## Key Features

- **LINE Shop Integration:** Synchronizes orders, status, and transaction data from LINE MyShop.
- **Automated Messaging:** Uses LINE Messaging API to interact with customers, send notifications, and handle webhooks.
- **Fulfillment System:** Staff and Admin portals for managing evidence (videos/images) and approving orders.
- **Authentication:** Robust identity management using **Better Auth** with Email/Password support.
- **Database:** **Supabase** (Postgres) for data persistence and real-time capabilities.
- **PDF Generation & QR Scanning:** Built-in support for generating certificates/reports with `pdfmake` and scanning with `html5-qrcode`.

## Key Technologies

- **Framework:** Next.js 15 (App Router)
- **Language:** TypeScript
- **API:** tRPC (v11) + Next.js API Routes (for webhooks)
- **Database:** Supabase (@supabase/supabase-js) + pg (direct access for Auth)
- **Auth:** Better Auth (v1.4+)
- **Integration:** @line/bot-sdk (v10.6+)
- **Tools:** Zod, TanStack Query, pdfmake, html5-qrcode

## Project Structure

- `src/app/`: App Router pages.
  - `admin/`: Dashboard for reviews, approvals, and reporting.
  - `staff/`: Portal for fulfillment tasks (proof upload).
  - `api/line/webhook/`: Entry point for LINE platform events.
- `src/server/`: Backend architecture.
  - `api/routers/`: tRPC routers (`order`, `review`, `evidence`, `report`).
  - `lib/line/`: Dedicated clients for LINE Messaging and MyShop APIs.
  - `db/`: Supabase client and connection pooling.
- `prototype/`: A standalone Vite-based React project for UI/UX exploration.
- `scope/`: Business requirement documents and CSV datasets.

## Building and Running

### Main Application (`necrozma`)

```bash
# Install dependencies
npm install

# Run the development server
npm run dev

# Build for production
npm run build

# Type-check and lint
npm run check
```

### Prototype (`prototype/`)

```bash
cd prototype
npm install
npm run dev
```

## Environment Variables

Defined and validated in `src/env.js`:

- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`: Supabase credentials.
- `POSTGRES_URL`: Direct DB connection for Better Auth.
- `BETTER_AUTH_URL`, `BETTER_AUTH_SECRET`: Auth configuration.
- `LINE_LOGIN_CHANNEL_ID`, `LINE_LOGIN_CHANNEL_SECRET`: LINE Login credentials.
- `LINE_ADMIN_BOT_CHANNEL_SECRET`, `LINE_ADMIN_BOT_CHANNEL_ACCESS_TOKEN`: Messaging API credentials.
- `OA_PLUS_API_KEY`: MyShop API authentication.
- `ADMIN_LINE_UID`: LINE user ID for receiving daily reports.
- `CRON_SECRET`: Security key for cron job endpoints.

## Development Conventions

- **Surgical Updates:** Maintain the tRPC + App Router pattern.
- **Validation:** Always define input schemas using Zod.
- **LINE Webhooks:** Handle signature verification (see `src/app/api/line/webhook/route.ts`).
- **Styles:** Use CSS Modules or `styles/globals.css` for consistent UI.

## Lessons Learned & Best Practices

- **Build Hygiene:** Always exclude one-off test scripts (`test-*.ts`) from `tsconfig.json` to prevent build failures due to missing dev dependencies in the production pipeline.
- **Type-Safe Errors:** Use `unknown` for error variables in `catch` blocks and perform type checks (e.g., `error instanceof Error`) before accessing properties like `message`.
- **Nullish Coalescing:** Favor `??` over `||` for default values to avoid bugs when dealing with empty strings or zero, unless specifically intending to catch all falsy values.
- **Fixed-Size Arrays:** When indexing into an array with a known small number of elements (e.g., index 0 or 1), use TypeScript **Tuple types** (e.g., `[Type, Type]`) to satisfy "possibly undefined" checks.
- **Regex Hygiene:** Prefer `RegExp#exec()` and optional chaining for complex pattern matching to ensure cleaner and safer code.
