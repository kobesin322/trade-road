# AGENTS.md

## Cursor Cloud specific instructions

### Project overview

This is **TradeRoad** — a **Trading Journal Dashboard** (Next.js 15, TypeScript, Tailwind CSS v4, Recharts) in `/workspace/trading-journal/`. It uses Supabase Auth, PostgreSQL (Drizzle ORM), and Supabase Storage for persistence. Without Supabase env vars, the app runs in **admin demo mode** with hardcoded demo trades (`lib/demo-trades.ts`).

### Development commands

All commands run from the `trading-journal/` directory:

| Task | Command |
|------|---------|
| Install deps | `npm install` |
| Dev server | `npm run dev` (port 3000) |
| Lint | `npm run lint` |
| Build | `npm run build` |
| DB schema push | `npm run db:push` (requires `DATABASE_URL`) |

### Running the app

**Admin demo (no env vars):** Start the dev server, open `http://localhost:3000`, click **Login as admin**. Dashboard, journal, charts, and calendar work with demo data; database writes are blocked.

**Full E2E (auth + persistence):** Copy `env.example` to `.env.local` and set Supabase/Postgres vars. Apply SQL in `supabase/migrations/`, then sign in with a real Supabase account.

### Notes for future agents

- Node.js 20+ is required.
- Package manager is **npm** (`package-lock.json` is committed).
- No automated tests; validate with lint + build + manual browser testing.
- Dev server starts in ~5s at `http://localhost:3000`.
- No secrets required for admin demo. Full mode needs `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`, and `NEXT_PUBLIC_SITE_URL` (see `env.example`).
- External APIs used at runtime: Yahoo Finance, Stooq, TradingView embeds, Binance (order-flow tool).
