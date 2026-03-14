# Necrozma 🌌

Necrozma is a high-performance integration hub designed to bridge **LINE Shop (MyShop)**, **LINE Messaging API**, and **Supabase**. It automates sales reporting, order fulfillment workflows, and customer notifications for the "ฝากใส่บาตร" (Fark-Sai-Bat) service.

## 🚀 Tech Stack

- **Framework:** [Next.js 15](https://nextjs.org/) (App Router)
- **Runtime:** [Bun](https://bun.sh/) (Fast package manager & runner)
- **API:** [tRPC v11](https://trpc.io/) + Next.js API Routes (for webhooks)
- **Authentication:** [Better Auth](https://www.better-auth.com/) (Email/Password + LINE Social Login)
- **Database:** [Supabase](https://supabase.com/) (PostgreSQL) + direct `pg` pool for management
- **Integrations:** LINE Messaging API & MyShop API
- **Documentation:** Interactive [Swagger UI](https://swagger.io/) at `/api-docs`

## ✨ Key Features

- **Automated Fulfillment:** Staff portal for uploading proof (images/videos) and Admin portal for review and approval.
- **LINE Integration:** Automatic push notifications to customers upon order approval/rejection.
- **Reporting:** Generate daily PDF summaries and CSV reports powered by `pdfmake`.
- **User Management:** Full Admin CRUD for managing system users and roles.
- **Developer Friendly:** Built-in "Test Mode" to safely debug bot logic in production environments without affecting real users.

## 🛠 Getting Started

### Prerequisites

Ensure you have [Bun](https://bun.sh/) installed on your machine.

### Installation

```bash
bun install
```

### Development

Start the development server with Turbopack:

```bash
bun dev
```

The app will be available at `http://localhost:3000`.

### Building for Production

```bash
bun run build
bun start
```

## 📖 Documentation

Detailed API documentation is generated using OpenAPI 3.0. You can explore the endpoints via the interactive Swagger UI by navigating to:

`GET /api-docs`

For more in-depth architectural details, best practices, and lessons learned during development, please refer to [GEMINI.md](./GEMINI.md).

## 🔐 Environment Variables

A `.env.example` file is provided. Key variables include:

- `DATABASE_URL`: Your Supabase PostgreSQL connection string.
- `ENABLE_TEST_MODE`: Set to `true` to redirect all bot messages to `DEV_TEST_USER_ID`.
- `LINE_ADMIN_BOT_CHANNEL_ACCESS_TOKEN`: For the admin notification bot.
- `LINE_CUSTOMER_PROD_BOT_CHANNEL_ACCESS_TOKEN`: For the customer-facing bot.

## 📄 License

This project is private and confidential.
