import { and, asc, eq } from "drizzle-orm";

import { userJournalStrategies, type UserJournalStrategyRow } from "@/db/schema";
import { getSessionUser, isAdminDemoUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import {
  isSystemJournalStrategy,
  SYSTEM_JOURNAL_STRATEGIES,
  type UserJournalStrategy,
  type UserJournalStrategyInput,
  type UserJournalStrategyPatch,
  normalizeJournalStrategy,
} from "@/lib/journal-constants";

export class UserJournalStrategyServiceError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export async function requirePersonalJournalStrategyUser() {
  const user = await getSessionUser();
  if (!user) {
    throw new UserJournalStrategyServiceError("Unauthorized", 401);
  }
  if (isAdminDemoUser(user)) {
    throw new UserJournalStrategyServiceError(
      "Admin demo cannot access personal strategy settings. Sign in with a Supabase account.",
      403,
    );
  }
  if (!process.env.DATABASE_URL) {
    throw new UserJournalStrategyServiceError("Database is not configured.", 503);
  }
  return user;
}

function normalizeStrategyName(name: string) {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new UserJournalStrategyServiceError("Strategy name is required.");
  }
  if (trimmed.length > 80) {
    throw new UserJournalStrategyServiceError("Strategy name must be 80 characters or fewer.");
  }
  if (isSystemJournalStrategy(trimmed)) {
    throw new UserJournalStrategyServiceError(
      `"${trimmed}" is a system default strategy and cannot be used as a custom name.`,
      409,
    );
  }
  return trimmed;
}

function normalizeOptionalColor(color: string | null | undefined) {
  if (color === undefined || color === null || color === "") {
    return null;
  }
  const trimmed = color.trim();
  if (!/^#[0-9a-fA-F]{6}$/.test(trimmed)) {
    throw new UserJournalStrategyServiceError("color must be a hex value like #38bdf8.");
  }
  return trimmed;
}

export function rowToUserJournalStrategy(row: UserJournalStrategyRow): UserJournalStrategy {
  const createdAt =
    row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt);
  const updatedAt =
    row.updatedAt instanceof Date ? row.updatedAt.toISOString() : String(row.updatedAt);

  return {
    id: row.id,
    name: row.name,
    description: row.description ?? null,
    color: row.color ?? null,
    sortOrder: row.sortOrder,
    createdAt,
    updatedAt,
  };
}

export function parseUserJournalStrategyInput(body: unknown): UserJournalStrategyInput {
  if (!body || typeof body !== "object") {
    throw new UserJournalStrategyServiceError("Request body must be a JSON object.");
  }

  const candidate = body as Partial<UserJournalStrategyInput>;
  const name = normalizeStrategyName(candidate.name ?? "");
  const description = candidate.description?.trim() || null;
  const color = normalizeOptionalColor(candidate.color);
  const sortOrder =
    typeof candidate.sortOrder === "number" && Number.isFinite(candidate.sortOrder)
      ? Math.max(0, Math.floor(candidate.sortOrder))
      : 0;

  return { name, description, color, sortOrder };
}

export function parseUserJournalStrategyPatch(body: unknown): UserJournalStrategyPatch {
  if (!body || typeof body !== "object") {
    throw new UserJournalStrategyServiceError("Request body must be a JSON object.");
  }

  const candidate = body as Partial<UserJournalStrategyInput>;
  const patch: UserJournalStrategyPatch = {};

  if (candidate.name !== undefined) {
    patch.name = normalizeStrategyName(candidate.name);
  }
  if (candidate.description !== undefined) {
    patch.description = candidate.description?.trim() || null;
  }
  if (candidate.color !== undefined) {
    patch.color = normalizeOptionalColor(candidate.color);
  }
  if (candidate.sortOrder !== undefined) {
    if (typeof candidate.sortOrder !== "number" || !Number.isFinite(candidate.sortOrder)) {
      throw new UserJournalStrategyServiceError("sortOrder must be a number.");
    }
    patch.sortOrder = Math.max(0, Math.floor(candidate.sortOrder));
  }

  if (!Object.keys(patch).length) {
    throw new UserJournalStrategyServiceError("At least one field is required for update.");
  }

  return patch;
}

export async function listUserJournalStrategies(userId: string) {
  const db = getDb();
  const rows = await db
    .select()
    .from(userJournalStrategies)
    .where(eq(userJournalStrategies.userId, userId))
    .orderBy(asc(userJournalStrategies.sortOrder), asc(userJournalStrategies.name));

  return rows.map(rowToUserJournalStrategy);
}

export async function listUserJournalStrategyNames(userId: string) {
  const strategies = await listUserJournalStrategies(userId);
  return strategies.map((strategy) => strategy.name);
}

export async function getUserJournalStrategy(userId: string, strategyId: string) {
  const db = getDb();
  const [row] = await db
    .select()
    .from(userJournalStrategies)
    .where(and(eq(userJournalStrategies.id, strategyId), eq(userJournalStrategies.userId, userId)))
    .limit(1);

  return row ? rowToUserJournalStrategy(row) : null;
}

export async function createUserJournalStrategy(userId: string, input: UserJournalStrategyInput) {
  const db = getDb();
  const [row] = await db
    .insert(userJournalStrategies)
    .values({
      userId,
      name: input.name,
      description: input.description ?? null,
      color: input.color ?? null,
      sortOrder: input.sortOrder ?? 0,
    })
    .returning();

  if (!row) {
    return null;
  }

  return rowToUserJournalStrategy(row);
}

export async function updateUserJournalStrategy(
  userId: string,
  strategyId: string,
  patch: UserJournalStrategyPatch,
) {
  const db = getDb();
  const [row] = await db
    .update(userJournalStrategies)
    .set({
      ...(patch.name !== undefined ? { name: patch.name } : {}),
      ...(patch.description !== undefined ? { description: patch.description ?? null } : {}),
      ...(patch.color !== undefined ? { color: patch.color ?? null } : {}),
      ...(patch.sortOrder !== undefined ? { sortOrder: patch.sortOrder } : {}),
    })
    .where(and(eq(userJournalStrategies.id, strategyId), eq(userJournalStrategies.userId, userId)))
    .returning();

  return row ? rowToUserJournalStrategy(row) : null;
}

export async function deleteUserJournalStrategy(userId: string, strategyId: string) {
  const db = getDb();
  const deleted = await db
    .delete(userJournalStrategies)
    .where(and(eq(userJournalStrategies.id, strategyId), eq(userJournalStrategies.userId, userId)))
    .returning({ id: userJournalStrategies.id });

  return deleted.length > 0;
}

export async function assertValidJournalStrategyForUser(userId: string, strategy: string) {
  const normalized = normalizeJournalStrategy(strategy);
  if (!normalized.trim()) {
    throw new UserJournalStrategyServiceError("strategy is required.");
  }
  if (isSystemJournalStrategy(normalized)) {
    return normalized;
  }

  const names = await listUserJournalStrategyNames(userId);
  if (names.includes(normalized)) {
    return normalized;
  }

  throw new UserJournalStrategyServiceError(
    "strategy must be a system default or one of your custom strategies.",
  );
}

export function listSystemJournalStrategies() {
  return [...SYSTEM_JOURNAL_STRATEGIES];
}

export async function listAvailableJournalStrategiesForUser(userId: string) {
  const custom = await listUserJournalStrategies(userId);
  return {
    system: listSystemJournalStrategies(),
    custom,
    all: [...SYSTEM_JOURNAL_STRATEGIES, ...custom.map((strategy) => strategy.name)],
  };
}
