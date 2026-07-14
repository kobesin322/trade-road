"use client";

import { Loader2, Plus, Search, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCustomWatchlist } from "@/lib/hooks/use-custom-watchlist";
import { isBuiltInWatchlistItem } from "@/lib/market-data/custom-watchlist";
import { findWatchlistItemBySymbol, type WatchlistItem } from "@/lib/market-data/symbols";
import { cn } from "@/lib/utils";

type SearchResult = WatchlistItem & {
  quoteType?: string | null;
  exchange?: string | null;
};

type TickerSearchPanelProps = {
  selectedId?: string;
  onSelect?: (id: string) => void;
  className?: string;
};

export function TickerSearchPanel({ selectedId, onSelect, className }: TickerSearchPanelProps) {
  const { items: customItems, addItem, removeItem, loading, error, storageMode } = useCustomWatchlist();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setSearchError(null);
      return;
    }

    const timeout = window.setTimeout(async () => {
      setSearching(true);
      setSearchError(null);

      try {
        const response = await fetch(`/api/market-data/search?q=${encodeURIComponent(trimmed)}`, {
          cache: "no-store",
        });
        const body: unknown = await response.json();

        if (!response.ok) {
          const errorMessage =
            body && typeof body === "object" && "error" in body
              ? String((body as { error: unknown }).error)
              : "Unable to search symbols.";
          throw new Error(errorMessage);
        }

        setResults((body as { items: SearchResult[] }).items ?? []);
      } catch (error) {
        setResults([]);
        setSearchError(error instanceof Error ? error.message : "Unable to search symbols.");
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => window.clearTimeout(timeout);
  }, [query]);

  const customIds = useMemo(() => new Set(customItems.map((item) => item.id)), [customItems]);

  async function handleAdd(item: SearchResult) {
    const builtIn = findWatchlistItemBySymbol(item.yahooSymbol);
    if (builtIn) {
      onSelect?.(builtIn.id);
      setMessage(`${item.yahooSymbol} is already in the default watchlist.`);
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const saved = await addItem(item, {
        quoteType: item.quoteType ?? null,
        exchange: item.exchange ?? null,
      });

      if (saved) {
        onSelect?.(saved.id);
        setMessage(`${item.yahooSymbol} added to your watchlist.`);
        setQuery("");
        setResults([]);
      }
    } catch (saveError) {
      setMessage(saveError instanceof Error ? saveError.message : "Unable to save ticker.");
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove(id: string) {
    setSaving(true);
    setMessage(null);

    try {
      await removeItem(id);
      setMessage("Removed from your watchlist.");
    } catch (deleteError) {
      setMessage(deleteError instanceof Error ? deleteError.message : "Unable to remove ticker.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={cn("grid gap-4 rounded-[1.75rem] border border-white/10 bg-black/30 p-4", className)}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-sm font-black text-white">Search tickers</div>
          <p className="text-xs text-zinc-500">
            Find any Yahoo Finance symbol and add it to your permanent dashboard list.
          </p>
        </div>
        <Badge tone="neutral">{customItems.length} saved</Badge>
        <Badge tone={storageMode === "supabase" ? "win" : "neutral"}>
          {storageMode === "supabase" ? "Supabase" : "Local preview"}
        </Badge>
      </div>

      <label className="relative block">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search PLTR, DOGE-USD, SOFI..."
          className="bg-zinc-950 pl-9 font-mono"
        />
        {searching ? (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-cyan-200" />
        ) : null}
      </label>

      {searchError ? <p className="text-sm text-rose-200">{searchError}</p> : null}
      {error ? <p className="text-sm text-rose-200">{error}</p> : null}
      {message ? <p className="text-sm text-amber-200">{message}</p> : null}

      {results.length ? (
        <div className="grid gap-2 rounded-2xl border border-white/10 bg-zinc-950/70 p-2">
          {results.map((item) => {
            const alreadySaved = customIds.has(item.id) || isBuiltInWatchlistItem(item);

            return (
              <div
                key={`${item.id}-${item.yahooSymbol}`}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/5 bg-white/[0.03] px-3 py-2"
              >
                <div>
                  <div className="font-mono text-sm font-black text-white">{item.yahooSymbol}</div>
                  <div className="text-xs text-zinc-500">{item.label}</div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={item.assetClass === "crypto" ? "blue" : "neutral"}>
                    {item.assetClass === "crypto" ? "Crypto" : "US Stock"}
                  </Badge>
                  <Button
                    type="button"
                    disabled={alreadySaved || saving || loading}
                    onClick={() => void handleAdd(item)}
                    className="h-8 px-3 text-xs"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    {alreadySaved ? "In list" : "Add"}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      {customItems.length ? (
        <div className="grid gap-2">
          <div className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500">
            Your watchlist
          </div>
          <div className="flex flex-wrap gap-2">
            {customItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelect?.(item.id)}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold transition",
                  selectedId === item.id
                    ? "border-cyan-300/50 bg-cyan-300/15 text-cyan-100"
                    : "border-white/10 bg-white/[0.04] text-zinc-200 hover:border-cyan-300/30",
                )}
              >
                <span className="font-mono">{item.yahooSymbol}</span>
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(event) => {
                    event.stopPropagation();
                    void handleRemove(item.id);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      event.stopPropagation();
                      void handleRemove(item.id);
                    }
                  }}
                  className="rounded-full p-0.5 text-zinc-500 hover:bg-white/10 hover:text-white"
                  aria-label={`Remove ${item.yahooSymbol}`}
                >
                  <X className="h-3 w-3" />
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-xs text-zinc-500">No custom tickers yet. Search above to add your first symbol.</p>
      )}
    </div>
  );
}
