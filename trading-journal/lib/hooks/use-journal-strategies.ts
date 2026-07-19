"use client";

import { useCallback, useEffect, useState } from "react";

import {
  SYSTEM_JOURNAL_STRATEGIES,
  type UserJournalStrategy,
} from "@/lib/journal-constants";

type AvailableStrategies = {
  system: string[];
  custom: UserJournalStrategy[];
  all: string[];
};

type JournalStrategiesResponse = {
  items: UserJournalStrategy[];
  available: AvailableStrategies;
};

async function fetchJournalStrategies() {
  const response = await fetch("/api/journal-strategies", { cache: "no-store" });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error ?? "Unable to load journal strategies.");
  }
  return (await response.json()) as JournalStrategiesResponse;
}

export function useJournalStrategies(enabled = true) {
  const [customStrategies, setCustomStrategies] = useState<UserJournalStrategy[]>([]);
  const [availableStrategies, setAvailableStrategies] = useState<string[]>([
    ...SYSTEM_JOURNAL_STRATEGIES,
  ]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!enabled) {
      setCustomStrategies([]);
      setAvailableStrategies([...SYSTEM_JOURNAL_STRATEGIES]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const payload = await fetchJournalStrategies();
      setCustomStrategies(payload.items);
      setAvailableStrategies(payload.available.all);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load journal strategies.");
      setCustomStrategies([]);
      setAvailableStrategies([...SYSTEM_JOURNAL_STRATEGIES]);
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    customStrategies,
    availableStrategies,
    systemStrategies: [...SYSTEM_JOURNAL_STRATEGIES],
    loading,
    error,
    refresh,
  };
}

export async function createJournalStrategy(input: {
  name: string;
  description?: string | null;
  color?: string | null;
}) {
  const response = await fetch("/api/journal-strategies", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const payload = (await response.json().catch(() => null)) as
    | { item?: UserJournalStrategy; error?: string }
    | null;
  if (!response.ok || !payload?.item) {
    throw new Error(payload?.error ?? "Unable to create strategy.");
  }
  return payload.item;
}

export async function updateJournalStrategy(
  id: string,
  patch: {
    name?: string;
    description?: string | null;
    color?: string | null;
  },
) {
  const response = await fetch(`/api/journal-strategies/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  const payload = (await response.json().catch(() => null)) as
    | { item?: UserJournalStrategy; error?: string }
    | null;
  if (!response.ok || !payload?.item) {
    throw new Error(payload?.error ?? "Unable to update strategy.");
  }
  return payload.item;
}

export async function deleteJournalStrategy(id: string) {
  const response = await fetch(`/api/journal-strategies/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error ?? "Unable to delete strategy.");
  }
}
