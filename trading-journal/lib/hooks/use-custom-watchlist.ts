"use client";

import { useCallback, useEffect, useState } from "react";

import {
  CUSTOM_WATCHLIST_CHANGED_EVENT,
  addLocalCustomWatchlistItem,
  clearLocalCustomWatchlist,
  dispatchCustomWatchlistChanged,
  readLocalCustomWatchlist,
  removeLocalCustomWatchlistItem,
  watchlistItemToInput,
  writeLocalCustomWatchlist,
} from "@/lib/market-data/custom-watchlist";
import type { WatchlistItem } from "@/lib/market-data/symbols";

type WatchlistStorageMode = "supabase" | "local";

type SearchResultExtras = {
  quoteType?: string | null;
  exchange?: string | null;
};

async function fetchRemoteWatchlist() {
  const response = await fetch("/api/watchlist-tickers", { cache: "no-store" });
  const body: unknown = await response.json();

  if (!response.ok) {
    const message =
      body && typeof body === "object" && "error" in body
        ? String((body as { error: unknown }).error)
        : "Unable to load watchlist.";
    throw Object.assign(new Error(message), { status: response.status });
  }

  return (body as { items: WatchlistItem[] }).items ?? [];
}

async function createRemoteWatchlistItem(
  item: WatchlistItem,
  extras: SearchResultExtras = {},
) {
  const response = await fetch("/api/watchlist-tickers", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(watchlistItemToInput(item, extras)),
  });
  const body: unknown = await response.json();

  if (!response.ok) {
    const message =
      body && typeof body === "object" && "error" in body
        ? String((body as { error: unknown }).error)
        : "Unable to save watchlist ticker.";
    throw Object.assign(new Error(message), { status: response.status });
  }

  return (body as { item: WatchlistItem }).item;
}

async function updateRemoteWatchlistItem(
  id: string,
  patch: { label?: string; sortOrder?: number },
) {
  const response = await fetch(`/api/watchlist-tickers/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  const body: unknown = await response.json();

  if (!response.ok) {
    const message =
      body && typeof body === "object" && "error" in body
        ? String((body as { error: unknown }).error)
        : "Unable to update watchlist ticker.";
    throw Object.assign(new Error(message), { status: response.status });
  }

  return (body as { item: WatchlistItem }).item;
}

async function deleteRemoteWatchlistItem(id: string) {
  const response = await fetch(`/api/watchlist-tickers/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  const body: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      body && typeof body === "object" && "error" in body
        ? String((body as { error: unknown }).error)
        : "Unable to delete watchlist ticker.";
    throw Object.assign(new Error(message), { status: response.status });
  }
}

async function migrateLocalWatchlistToSupabase(localItems: WatchlistItem[]) {
  const saved: WatchlistItem[] = [];

  for (const item of localItems) {
    try {
      const created = await createRemoteWatchlistItem(item);
      saved.push(created);
    } catch {
      // Ignore duplicates or invalid legacy rows during one-time migration.
    }
  }

  clearLocalCustomWatchlist();
  return saved;
}

export function useCustomWatchlist() {
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [storageMode, setStorageMode] = useState<WatchlistStorageMode>("local");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const remoteItems = await fetchRemoteWatchlist();
      const localItems = readLocalCustomWatchlist();

      if (!remoteItems.length && localItems.length) {
        const migrated = await migrateLocalWatchlistToSupabase(localItems);
        setItems(migrated.length ? migrated : remoteItems);
      } else {
        setItems(remoteItems);
      }

      setStorageMode("supabase");
    } catch (loadError) {
      const status =
        loadError && typeof loadError === "object" && "status" in loadError
          ? Number((loadError as { status: unknown }).status)
          : 500;

      if (status === 401 || status === 403 || status === 503) {
        setItems(readLocalCustomWatchlist());
        setStorageMode("local");
        setError(null);
      } else {
        setError(loadError instanceof Error ? loadError.message : "Unable to load watchlist.");
      }
    } finally {
      setHydrated(true);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const onChange = () => {
      if (storageMode === "local") {
        setItems(readLocalCustomWatchlist());
        return;
      }

      void refresh();
    };

    window.addEventListener(CUSTOM_WATCHLIST_CHANGED_EVENT, onChange);
    window.addEventListener("storage", onChange);

    return () => {
      window.removeEventListener(CUSTOM_WATCHLIST_CHANGED_EVENT, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, [refresh, storageMode]);

  const addItem = useCallback(
    async (item: WatchlistItem, extras: SearchResultExtras = {}) => {
      setError(null);

      if (storageMode === "local") {
        const next = addLocalCustomWatchlistItem(item);
        setItems(next);
        return next.find(
          (entry) => entry.yahooSymbol.toUpperCase() === item.yahooSymbol.toUpperCase(),
        ) ?? item;
      }

      try {
        const saved = await createRemoteWatchlistItem(item, extras);
        setItems((current) => {
          const exists = current.some((entry) => entry.id === saved.id);
          if (exists) {
            return current.map((entry) => (entry.id === saved.id ? saved : entry));
          }
          return [...current, saved];
        });
        dispatchCustomWatchlistChanged();
        return saved;
      } catch (saveError) {
        const message =
          saveError instanceof Error ? saveError.message : "Unable to save watchlist ticker.";
        setError(message);
        throw saveError;
      }
    },
    [storageMode],
  );

  const updateItem = useCallback(
    async (id: string, patch: { label?: string; sortOrder?: number }) => {
      setError(null);

      if (storageMode === "local") {
        const next = readLocalCustomWatchlist().map((entry) =>
          entry.id === id
            ? {
                ...entry,
                ...(patch.label !== undefined ? { label: patch.label } : {}),
              }
            : entry,
        );
        writeLocalCustomWatchlist(next);
        setItems(next);
        return next.find((entry) => entry.id === id) ?? null;
      }

      try {
        const saved = await updateRemoteWatchlistItem(id, patch);
        setItems((current) => current.map((entry) => (entry.id === saved.id ? saved : entry)));
        dispatchCustomWatchlistChanged();
        return saved;
      } catch (updateError) {
        const message =
          updateError instanceof Error ? updateError.message : "Unable to update watchlist ticker.";
        setError(message);
        throw updateError;
      }
    },
    [storageMode],
  );

  const removeItem = useCallback(
    async (id: string) => {
      setError(null);

      if (storageMode === "local") {
        const next = removeLocalCustomWatchlistItem(id);
        setItems(next);
        return next;
      }

      try {
        await deleteRemoteWatchlistItem(id);
        let nextItems: WatchlistItem[] = [];
        setItems((current) => {
          nextItems = current.filter((entry) => entry.id !== id);
          return nextItems;
        });
        dispatchCustomWatchlistChanged();
        return nextItems;
      } catch (deleteError) {
        const message =
          deleteError instanceof Error ? deleteError.message : "Unable to delete watchlist ticker.";
        setError(message);
        throw deleteError;
      }
    },
    [storageMode],
  );

  return {
    items,
    hydrated,
    loading,
    error,
    storageMode,
    addItem,
    updateItem,
    removeItem,
    refresh,
  };
}
