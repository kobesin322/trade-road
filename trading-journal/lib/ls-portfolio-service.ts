import { getSessionUser, isAdminDemoUser } from "@/lib/auth";
import {
  clearDailySnapshot,
  copySnapshotFromPrevious,
  getOrCreateDailySnapshot,
  getPortfolioSnapshot,
  insertPosition,
  logPortfolioEvent,
  updatePortfolio,
} from "@/lib/ls-portfolio-db";
import { DEMO_LS_PORTFOLIO, DEMO_LS_POSITIONS } from "@/lib/ls-portfolio-seed";
import { computePools } from "@/lib/ls-portfolio";

export class LSPortfolioServiceError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export function normalizeSnapshotDate(date?: string | null) {
  if (date?.trim()) {
    return date.trim().slice(0, 10);
  }
  return new Date().toISOString().slice(0, 10);
}

export async function requirePortfolioUser() {
  const user = await getSessionUser();
  if (!user) {
    throw new LSPortfolioServiceError("Unauthorized", 401);
  }
  if (isAdminDemoUser(user)) {
    throw new LSPortfolioServiceError(
      "Daily portfolio snapshots require a Supabase account. Sign in with your real account.",
      403,
    );
  }
  if (!process.env.DATABASE_URL) {
    throw new LSPortfolioServiceError("Database is not configured.", 503);
  }
  return user;
}

export async function loadPortfolioForUser(userId: string, date?: string) {
  return getPortfolioSnapshot(userId, normalizeSnapshotDate(date));
}

export async function seedDemoPortfolio(userId: string, date?: string) {
  const snapshotDate = normalizeSnapshotDate(date);
  await clearDailySnapshot(userId, snapshotDate);
  const portfolio = await getOrCreateDailySnapshot(userId, snapshotDate);

  await updatePortfolio(userId, portfolio.id, {
    ...DEMO_LS_PORTFOLIO,
    notes: `Demo snapshot for ${snapshotDate} — 6:4 long/short book.`,
  });

  for (const seed of DEMO_LS_POSITIONS) {
    const position = await insertPosition(portfolio.id, {
      ...seed,
      stop_loss_price: seed.stop_loss_price ?? null,
      target_price: null,
      notes: null,
    });
    if (position) {
      await logPortfolioEvent(portfolio.id, {
        event_type: "ADD_POSITION",
        position_id: position.id,
        payload: {
          symbol: position.symbol,
          side: position.side,
          quantity: position.quantity,
          avg_entry_price: position.avg_entry_price,
        },
      });
    }
  }

  const snapshot = await getPortfolioSnapshot(userId, snapshotDate);
  const pools = computePools(snapshot.positions, snapshot.portfolio);
  await logPortfolioEvent(portfolio.id, {
    event_type: "MANUAL_EDIT",
    payload: {
      action: "SEED_DEMO",
      snapshot_date: snapshotDate,
      long_pool: pools.long_pool,
      short_pool: pools.short_pool,
    },
  });

  return snapshot;
}

export { copySnapshotFromPrevious };
