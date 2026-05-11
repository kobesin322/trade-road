# AGENTS.md

## Cursor Cloud specific instructions

### Project overview

This is a **Trading Journal Dashboard** — a single-page Next.js 15 app (TypeScript, Tailwind CSS v4, Recharts) located in `/workspace/trading-journal/`. It is entirely client-side with no backend, database, or external API dependencies. Trade data is hardcoded in `trading-journal/lib/trades.ts` and persisted via browser `localStorage`.

### Development commands

All commands run from the `trading-journal/` directory:

| Task | Command |
|------|---------|
| Install deps | `npm install` |
| Dev server | `npm run dev` (serves on port 3000) |
| Lint | `npm run lint` |
| Build | `npm run build` |

### Notes for future agents

- Node.js 20+ is required (installed via nodesource).
- The package manager is **npm** (`package-lock.json` is committed).
- There are no automated tests (no test script in `package.json`). Validation relies on lint + build + manual browser testing.
- The dev server starts quickly (~5s) and is available at `http://localhost:3000`.
- No environment variables or secrets are required.
