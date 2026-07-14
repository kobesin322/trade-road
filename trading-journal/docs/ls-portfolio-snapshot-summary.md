# L/S Portfolio Snapshot — System Summary

> **Purpose:** End-of-day long/short book tracker with per-calendar-day snapshots, pool rebalancing, take-profit simulation, beta reference, and trading-day self-assessment.  
> **Stack:** Next.js 15 (App Router), React client components, Drizzle ORM → Supabase Postgres, Recharts.  
> **Entry point:** Main dashboard view `Portfolio` (`/?view=Portfolio`), not a standalone page.

---

## 1. What problem it solves

Traders maintain a **daily L/S book** — not live execution, but a **snapshot** of what they held at EOD:

- Long and short positions with qty, entry, current price, stop
- Separate **long pool** and **short pool** (market value + cash per side)
- A **target long/short ratio** that can change by market regime (e.g. 60/40)
- **Drift detection** when actual pool split diverges from target
- **Activity log** of edits, rebalances, take-profits
- **Day condition** flags (overtrading, emotional trading, confidence sliders)
- **Weighted beta vs SPY** (draft — static + partial Yahoo fetch)

Each calendar day = one isolated snapshot row. Days do not auto-sync; you copy from prior day or edit manually.

---

## 2. High-level architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  TradingDashboard (trading-dashboard.tsx)                       │
│  activeView === "Portfolio"                                     │
│  selectedCalendarDate shared with Journal + Calendar            │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  LSPortfolioDashboard (client)                                  │
│  - Date picker, tabs (L/S Book | Day condition)                 │
│  - KPIs, charts, positions table, modals                        │
│  - Client-side pool math via lib/ls-portfolio.ts                │
└───────────────────────────┬─────────────────────────────────────┘
                            │ fetch /api/ls-portfolio/*
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  API routes (Next.js Route Handlers)                            │
│  requirePortfolioUser() → auth + DB check                       │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  ls-portfolio-service.ts  →  ls-portfolio-db.ts  →  Drizzle    │
│  Supabase Postgres: portfolios, positions, portfolio_events      │
└─────────────────────────────────────────────────────────────────┘
```

**Routing note:** `app/tools/portfolio/page.tsx` only redirects to `/?view=Portfolio`. The real UI lives inside `TradingDashboard`.

---

## 3. Data model

### 3.1 Tables (Supabase / Drizzle)

| Table | Role |
|-------|------|
| `portfolios` | One row per **user + snapshot_date**. Holds target ratios, long/short cash, day-condition flags, confidence scores. |
| `positions` | Child rows linked to `portfolio_id`. Symbol, side (`long` \| `short`), qty, prices, optional stop/target. |
| `portfolio_events` | Append-only audit log (ADD_POSITION, TAKE_PROFIT, REBALANCE_CASH, etc.) with JSON payload. |

**Unique constraint:** `(user_id, snapshot_date)` — enforces one snapshot per day per user.

**Migrations evolution:**
1. `20260609120000_ls_portfolio.sql` — original single-portfolio-per-user schema
2. `20260610120000_portfolio_daily_snapshots.sql` — added `snapshot_date`, changed unique index to per-day
3. `20260611120000_portfolio_day_conditions.sql` — behavioral flags + confidence columns

### 3.2 TypeScript types (`lib/ls-portfolio-types.ts`)

```ts
PortfolioSnapshot = {
  portfolio: Portfolio;      // metadata + ratios + cash + day condition
  positions: Position[];
  events: PortfolioEvent[];  // last 20, desc
  snapshot_dates: string[];    // all dates user has snapshots (for calendar dots)
}
```

`ComputedPosition` and `PortfolioPools` are **derived in memory**, not stored in DB.

---

## 4. Snapshot lifecycle (core mechanism)

### 4.1 Load or create (`getOrCreateDailySnapshot`)

When user opens a date (e.g. `2026-07-10`):

1. `GET /api/ls-portfolio?date=2026-07-10`
2. `getPortfolioSnapshot(userId, date)`:
   - If row exists for that date → return it
   - If not → **auto-create empty snapshot**:
     - Inherits `target_long_ratio` / `target_short_ratio` from **latest prior date** (or defaults 0.6 / 0.4)
     - `long_cash` / `short_cash` start at **0**
     - No positions copied automatically
3. Returns full snapshot + `snapshot_dates[]` for date picker highlighting

### 4.2 Copy from previous day

`POST /api/ls-portfolio/copy-previous` with `{ date }`:

1. Find latest snapshot **before** target date
2. Delete target day's positions + events
3. Copy portfolio fields (ratios, cash, notes)
4. Clone all positions from prior day
5. Log `COPY_FROM_PREVIOUS` event

**Use case:** Start today's book from yesterday's close state.

### 4.3 Seed demo data

`POST /api/ls-portfolio/seed` — clears day, inserts demo book:

- Longs: TSLA, COIN, SCCO, CRCL, IREN
- Shorts: SNDK, EWY
- 60/40 ratio, long_cash=2500, short_cash=1400

Defined in `lib/ls-portfolio-seed.ts`.

---

## 5. Pool & ratio math (`lib/ls-portfolio.ts`)

This is the financial engine. All values computed client-side **and** server-side for mutations.

### 5.1 Definitions

```
long_mv  = Σ (qty × current_price) for long positions
short_mv = Σ (qty × current_price) for short positions

long_pool  = long_mv  + portfolio.long_cash
short_pool = short_mv + portfolio.short_cash
total_pool = long_pool + short_pool

current_long_pct = long_pool / total_pool   (if total_pool > 0)
target_long_pct  = portfolio.target_long_ratio
drift            = current_long_pct - target_long_pct
```

### 5.2 Per-position derived fields

```
market_value     = qty × current_price
unrealized_pnl   = long: (current - entry) × qty
                   short: (entry - current) × qty
pnl_percent      = % move from entry (side-aware)
percent_of_pool  = market_value / side_pool × 100
```

### 5.3 Rebalance (`calculateRebalancePreview`)

**Mechanism:** Cash transfer between long and short pools — **positions are NOT resized**.

1. Compute `targetLongPool = total_pool × target_long_ratio`
2. If `long_pool > targetLongPool` → transfer excess cash **long → short**
3. If `short_pool > targetShortPool` → transfer **short → long**
4. After transfer, recompute pools; drift should be ~0

`POST /api/ls-portfolio/rebalance` persists new `long_cash` / `short_cash` derived from preview.

### 5.4 Take profit (`calculateTakeProfitPreview`)

**Mechanism:** Partial close simulation.

1. User specifies `sell_qty` or `sell_pct` (default 30%)
2. Realized P&L computed on sold portion
3. Proceeds added to correct side's cash:
   - Long sell → `long_cash += qty × current_price`
   - Short cover → `short_cash += qty × current_price` (cash_delta is negative for short)
4. Remaining qty updated; full close deletes position row

### 5.5 Cash adjust

`POST /api/ls-portfolio/cash` — direct deposit/withdraw to long or short cash pool. Validates non-negative cash.

---

## 6. UI structure (`LSPortfolioDashboard`)

### 6.1 Tabs

| Tab | Content |
|-----|---------|
| **L/S Book** | Positions table, KPIs, allocation charts, rebalance/add/take-profit, activity log |
| **Day condition** | Behavioral flags + market/self confidence sliders (saved on same portfolio row) |

### 6.2 Key UI actions

| Action | API | Notes |
|--------|-----|-------|
| Change date | `GET /api/ls-portfolio?date=` | Triggers refresh |
| Edit target ratio | `PATCH /api/ls-portfolio` | `{ target_long_ratio }` auto-sets short = 1 - long |
| Inline edit qty/price/stop | `PATCH /api/ls-portfolio/positions/:id` | Optimistic UI update |
| Add position | `POST /api/ls-portfolio/positions` | Modal form |
| Delete position | `DELETE /api/ls-portfolio/positions/:id?date=` | Confirm dialog |
| Take profit | `POST /api/ls-portfolio/take-profit` | Modal with preview |
| Rebalance | `POST /api/ls-portfolio/rebalance` | Preview in modal |
| Adjust cash | `POST /api/ls-portfolio/cash` | Modal |
| Copy prior day | `POST /api/ls-portfolio/copy-previous` | |
| Seed demo | `POST /api/ls-portfolio/seed` | Empty state only |
| Day condition save | `PATCH /api/ls-portfolio` | Flags + confidence fields |
| Beta reference | `GET /api/ls-portfolio/beta-reference?date=` | Separate fetch |

### 6.3 Charts (Recharts)

- Pie: Long MV, Short MV, Long Cash, Short Cash
- Bar: Target vs actual % and pool size $
- Ratio bar with drift warning if `|drift| > 5%`

### 6.4 Shared date state

`selectedCalendarDate` is shared across:
- **Portfolio** view
- **Journal** (daily overview, trade entry)
- **Calendar** view (amber border = day has portfolio snapshot)

`onSnapshotDatesChange` feeds `portfolioSnapshotDates` back to Calendar for visual indicators.

---

## 7. API reference

All routes require authenticated Supabase user with `DATABASE_URL` configured. Demo/admin users are blocked (`requirePortfolioUser`).

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/ls-portfolio?date=` | Load/create snapshot |
| PATCH | `/api/ls-portfolio` | Update portfolio metadata, ratios, day condition |
| POST | `/api/ls-portfolio/positions` | Add position |
| PATCH | `/api/ls-portfolio/positions/:id` | Update position fields |
| DELETE | `/api/ls-portfolio/positions/:id?date=` | Remove position |
| POST | `/api/ls-portfolio/take-profit` | Partial close + cash update |
| GET | `/api/ls-portfolio/take-profit?...` | Preview only |
| POST | `/api/ls-portfolio/rebalance` | Cash rebalance to target ratio |
| GET | `/api/ls-portfolio/rebalance?date=` | Preview only |
| POST | `/api/ls-portfolio/cash` | Adjust long/short cash |
| POST | `/api/ls-portfolio/copy-previous` | Clone prior day |
| POST | `/api/ls-portfolio/seed` | Demo data |
| GET | `/api/ls-portfolio/beta-reference?date=` | Weighted beta summary |

**Request convention:** Most POST/PATCH bodies include `{ date: "YYYY-MM-DD", ... }`.

**Response convention:** Mutations return full updated `PortfolioSnapshot` JSON.

---

## 8. Auth & access control

```ts
requirePortfolioUser():
  1. getSessionUser() — must be logged in
  2. Reject isAdminDemoUser() — demo account cannot use personal snapshots
  3. Require process.env.DATABASE_URL
```

**RLS (Supabase):** Row-level security on all three tables — users only see own `user_id` portfolios and child rows.

**UI:** `canUsePersonalJournal` prop disables edits when not authenticated; shows sign-in prompt on load error.

---

## 9. Beta reference (draft feature)

**Files:** `lib/ls-portfolio-beta-reference.ts`, `components/ls-portfolio/beta-reference-modal.tsx`, `portfolio-weighted-beta-panel.tsx`

**Flow:**
1. For each position symbol, try Yahoo Finance `quoteSummary` API (beta, sector, market cap, volume, % from 52w high)
2. Fall back to `STATIC_BETA_REFERENCE` curated map (TSLA, COIN, etc.)
3. Compute weighted beta contributions:
   - `contribution = sign × (weight_pct/100) × beta_spy`
   - Long sign = +1, Short sign = -1
4. Sum → `net_beta`, `long_beta`, `short_beta`

**Limitations (explicit in disclaimer):**
- 60-day correlation is static, not live
- No live price sync on positions (TODO in `ls-portfolio.ts`)
- "Refresh prices" button is placeholder ("Coming soon")

---

## 10. Day condition panel

Stored on the same `portfolios` row as the snapshot.

| Field | Type | Purpose |
|-------|------|---------|
| `overtrading` | boolean | Flag |
| `over_focus` | boolean | Over-focus on 1–2 stocks |
| `over_position` | boolean | Oversized positions |
| `not_focusing` | boolean | Lack of focus |
| `emotional_trading` | boolean | Emotional decisions |
| `market_confidence` | 0–100 | Slider |
| `self_confidence` | 0–100 | Slider |

Mapped in DB as `flag_*` columns. Saved via `PATCH /api/ls-portfolio` with partial patch.

---

## 11. Event log

Event types written to `portfolio_events`:

| event_type | When |
|------------|------|
| `ADD_POSITION` | New position |
| `DELETE_POSITION` | Removed |
| `TAKE_PROFIT` | Partial/full close |
| `REBALANCE_CASH` | Pool rebalance |
| `CASH_ADJUST` | Manual cash change |
| `PRICE_UPDATE` | Only current_price changed |
| `MANUAL_EDIT` | Other edits, seed, copy |

Displayed in collapsible "Activity log" (last 20 events). Human-readable via `formatEventSummary()`.

---

## 12. File map

```
app/
  tools/portfolio/page.tsx          → redirect to /?view=Portfolio
  api/ls-portfolio/
    route.ts                        → GET load, PATCH portfolio
    positions/route.ts              → POST add
    positions/[id]/route.ts         → PATCH, DELETE
    take-profit/route.ts            → POST, GET preview
    rebalance/route.ts              → POST, GET preview
    cash/route.ts                   → POST adjust cash
    copy-previous/route.ts          → POST clone prior day
    seed/route.ts                   → POST demo seed
    beta-reference/route.ts         → GET beta summary

components/
  trading-dashboard.tsx             → hosts LSPortfolioDashboard
  ls-portfolio/
    ls-portfolio-dashboard.tsx      → main UI (~1200 lines)
    ls-portfolio-modals.tsx         → Add, Rebalance, TakeProfit modals
    beta-reference-modal.tsx
    portfolio-day-condition-panel.tsx
    portfolio-weighted-beta-panel.tsx
  journal/overview-date-picker.tsx  → shared date picker

lib/
  ls-portfolio.ts                   → pool math, previews, formatters
  ls-portfolio-types.ts             → TypeScript types
  ls-portfolio-db.ts                → Drizzle CRUD
  ls-portfolio-service.ts           → auth, seed, date normalize
  ls-portfolio-seed.ts              → demo positions
  ls-portfolio-beta-reference.ts    → beta fetch + static fallback
  portfolio-day-condition.ts        → flag helpers

db/schema.ts                        → Drizzle table definitions
supabase/migrations/                → SQL migrations
```

---

## 13. Design decisions & trade-offs

| Decision | Rationale |
|----------|-----------|
| **Per-day snapshots** vs single live portfolio | Supports historical review; each day is a frozen EOD state |
| **Cash-only rebalance** | Simple model — no auto qty resizing; user manually reflects real trades |
| **Auto-create empty day** | Low friction; user doesn't need explicit "create snapshot" |
| **Inherit ratios only** | New days start with regime targets but empty book unless copied |
| **Client + server math** | UI shows live KPIs without round-trip; server recomputes on mutations for consistency |
| **Manual current prices** | No live feed yet; user updates prices inline |
| **Separate long/short cash** | Models two-sided book capital allocation explicitly |

---

## 14. Known gaps / TODOs

1. **Live price sync** — `// TODO: live price sync via edge function + Polygon/Yahoo` in `ls-portfolio.ts`; Refresh button is stub
2. **Beta correlation** — static values; not computed from price series
3. **No position-level history** — only snapshot state + event log; no intraday ticks
4. **No cross-day P&L rollup** — each day is independent unless user copies forward
5. **AGENTS.md outdated** — still says "no backend/database"; app now uses Supabase + Drizzle for journal and portfolio

---

## 15. Example user workflow

1. Sign in with real Supabase account (not demo)
2. Open **Portfolio** view; pick today on date picker
3. If first time: click **Copy prior day** or **Seed demo data**
4. Set **target long/short ratio** for today's regime (e.g. 70/30)
5. Add/edit positions with current prices
6. Check drift bar — if >5%, run **Rebalance** (cash transfer)
7. Optionally take partial profit on a winner
8. Switch to **Day condition** tab — log behavioral flags
9. Open **Beta reference** to see weighted net beta vs SPY
10. Next day: new empty snapshot auto-created; copy prior day to roll forward

---

## 16. Questions for external review (Grok)

Use these when reviewing the setup:

1. Is **cash-only rebalance** sufficient for a L/S journal, or should qty-based rebalancing be added?
2. Should **auto-copy positions** on new day creation replace manual "Copy prior day"?
3. What's the best **live price source** (Yahoo, Polygon, IBKR) for EOD snapshot refresh?
4. Is the **beta model** (weight × beta × side sign) correct for a market-neutral book?
5. Should **day condition** integrate with Journal daily overview or stay separate?
6. Any **schema normalization** concerns with flags on `portfolios` vs separate `day_conditions` table?
7. Is **drift threshold 5%** reasonable, or should it be configurable per user?

---

## 17. Core vs Tactical + Portfolio Summary (added 2026-07-10)

### Schema
- `positions.book_type` enum: `core` | `tactical` (default `tactical` — backward compatible)
- Migration: `20260614120000_position_book_type.sql`

### Summary tab (`PortfolioSummaryPanel`)
- **Long/Short P&L attribution** — separate unrealized P&L per book side
- **Core vs Tactical** — MV and P&L breakdown (4 quadrants + totals)
- **Risk per trade** — `(entry − stop) × qty` per position; pool % and avg risk
- **Relative strength vs QQQ** — 1mo trailing return spread per symbol
- API: `GET /api/ls-portfolio/summary?date=&rs_range=1mo`

### L/S Book tab updates
- Book column (click to toggle Core ↔ Tactical)
- Risk $ column from stop distance
- Filters: side + book type

