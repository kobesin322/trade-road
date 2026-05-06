import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "@/db/schema";

const globalForDb = globalThis as unknown as {
  queryClient?: ReturnType<typeof postgres>;
};

function getQueryClient() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set (Supabase → Connect → URI, transaction pooler).");
  }
  if (!globalForDb.queryClient) {
    globalForDb.queryClient = postgres(url, { max: 1, prepare: false });
  }
  return globalForDb.queryClient;
}

export function getDb() {
  return drizzle(getQueryClient(), { schema });
}
