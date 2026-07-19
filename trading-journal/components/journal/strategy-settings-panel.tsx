"use client";

import { Loader2, Lock, Pencil, Plus, Trash2, X } from "lucide-react";
import { useMemo, useState, useTransition } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  JOURNAL_STRATEGY_COLORS,
  SYSTEM_JOURNAL_STRATEGIES,
  type UserJournalStrategy,
} from "@/lib/journal-constants";
import {
  createJournalStrategy,
  deleteJournalStrategy,
  updateJournalStrategy,
  useJournalStrategies,
} from "@/lib/hooks/use-journal-strategies";
import { cn } from "@/lib/utils";

type StrategySettingsPanelProps = {
  canUsePersonalJournal: boolean;
  demoTradesEnabled: boolean;
};

type EditorState =
  | { mode: "closed" }
  | { mode: "create" }
  | { mode: "edit"; strategy: UserJournalStrategy };

const DEFAULT_CUSTOM_COLOR = "#34d399";

function emptyEditorForm() {
  return {
    name: "",
    description: "",
    color: DEFAULT_CUSTOM_COLOR,
  };
}

export function StrategySettingsPanel({
  canUsePersonalJournal,
  demoTradesEnabled,
}: StrategySettingsPanelProps) {
  const enabled = canUsePersonalJournal && !demoTradesEnabled;
  const { customStrategies, loading, error, refresh } = useJournalStrategies(enabled);
  const [editor, setEditor] = useState<EditorState>({ mode: "closed" });
  const [form, setForm] = useState(emptyEditorForm);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const systemStrategies = useMemo(
    () =>
      SYSTEM_JOURNAL_STRATEGIES.map((name) => ({
        name,
        color: JOURNAL_STRATEGY_COLORS[name],
      })),
    [],
  );

  function openCreate() {
    setForm(emptyEditorForm());
    setMessage(null);
    setEditor({ mode: "create" });
  }

  function openEdit(strategy: UserJournalStrategy) {
    setForm({
      name: strategy.name,
      description: strategy.description ?? "",
      color: strategy.color ?? DEFAULT_CUSTOM_COLOR,
    });
    setMessage(null);
    setEditor({ mode: "edit", strategy });
  }

  function closeEditor() {
    setEditor({ mode: "closed" });
    setForm(emptyEditorForm());
  }

  function handleSave() {
    if (!enabled) {
      return;
    }

    setMessage(null);
    const name = form.name.trim();
    if (!name) {
      setMessage("Strategy name is required.");
      return;
    }

    startTransition(async () => {
      try {
        if (editor.mode === "create") {
          await createJournalStrategy({
            name,
            description: form.description.trim() || null,
            color: form.color,
          });
          setMessage("Strategy created.");
        } else if (editor.mode === "edit") {
          await updateJournalStrategy(editor.strategy.id, {
            name,
            description: form.description.trim() || null,
            color: form.color,
          });
          setMessage("Strategy updated.");
        }
        closeEditor();
        await refresh();
      } catch (caught) {
        setMessage(caught instanceof Error ? caught.message : "Unable to save strategy.");
      }
    });
  }

  function handleDelete(strategy: UserJournalStrategy) {
    if (!enabled) {
      return;
    }

    setMessage(null);
    startTransition(async () => {
      try {
        await deleteJournalStrategy(strategy.id);
        if (editor.mode === "edit" && editor.strategy.id === strategy.id) {
          closeEditor();
        }
        setMessage(`Deleted "${strategy.name}". Existing journal entries keep that label.`);
        await refresh();
      } catch (caught) {
        setMessage(caught instanceof Error ? caught.message : "Unable to delete strategy.");
      }
    });
  }

  if (!canUsePersonalJournal || demoTradesEnabled) {
    return (
      <Card className="overflow-hidden border-cyan-300/20">
        <CardHeader>
          <CardTitle>Strategy Settings</CardTitle>
          <p className="mt-1 text-sm text-zinc-400">
            Turn off demo mode and sign in with Supabase to manage your custom strategies.
          </p>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr] xl:gap-8">
      <Card className="overflow-hidden">
        <CardHeader className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle>Your strategies</CardTitle>
              <p className="mt-1 text-sm text-zinc-400">
                Custom strategies appear in journal entry dropdowns alongside system defaults.
              </p>
            </div>
            <Button
              type="button"
              onClick={openCreate}
              disabled={isPending}
              className="bg-cyan-300 text-slate-950 hover:bg-cyan-200"
            >
              <Plus className="h-4 w-4" />
              New strategy
            </Button>
          </div>
          {message ? (
            <p
              className={cn(
                "text-sm",
                message.includes("created") ||
                  message.includes("updated") ||
                  message.includes("Deleted")
                  ? "text-emerald-300"
                  : "text-amber-200",
              )}
            >
              {message}
            </p>
          ) : null}
          {error ? <p className="text-sm text-amber-200">{error}</p> : null}
        </CardHeader>
        <CardContent className="grid gap-3">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-zinc-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading your strategies...
            </div>
          ) : null}

          {!loading && customStrategies.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.03] px-4 py-8 text-center text-sm text-zinc-400">
              No custom strategies yet. Create one to tag journal entries with your own playbook
              names.
            </div>
          ) : null}

          {customStrategies.map((strategy) => (
            <div
              key={strategy.id}
              className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4 sm:flex-row sm:items-start sm:justify-between"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: strategy.color ?? DEFAULT_CUSTOM_COLOR }}
                  />
                  <div className="font-black text-white">{strategy.name}</div>
                  <Badge tone="blue">Custom</Badge>
                </div>
                {strategy.description ? (
                  <p className="mt-2 text-sm text-zinc-400">{strategy.description}</p>
                ) : (
                  <p className="mt-2 text-sm text-zinc-500">No description yet.</p>
                )}
              </div>
              <div className="flex shrink-0 gap-2">
                <Button
                  type="button"
                  disabled={isPending}
                  onClick={() => openEdit(strategy)}
                  className="bg-white/5 text-zinc-100"
                >
                  <Pencil className="h-4 w-4" />
                  Edit
                </Button>
                <Button
                  type="button"
                  disabled={isPending}
                  onClick={() => handleDelete(strategy)}
                  className="bg-rose-500/15 text-rose-100 hover:bg-rose-500/25"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-5">
        <Card className="overflow-hidden border-cyan-300/15">
          <CardHeader>
            <CardTitle>System defaults</CardTitle>
            <p className="mt-1 text-sm text-zinc-400">
              Shared across every account. Available in journals, locked here.
            </p>
          </CardHeader>
          <CardContent className="grid gap-3">
            {systemStrategies.map((strategy) => (
              <div
                key={strategy.name}
                className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: strategy.color }}
                  />
                  <span className="font-semibold text-white">{strategy.name}</span>
                </div>
                <Badge tone="neutral" className="gap-1">
                  <Lock className="h-3 w-3" />
                  System
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        {editor.mode !== "closed" ? (
          <Card className="overflow-hidden border-cyan-300/20">
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle>
                    {editor.mode === "create" ? "Create strategy" : "Edit strategy"}
                  </CardTitle>
                  <p className="mt-1 text-sm text-zinc-400">
                    Names must be unique and cannot match a system default.
                  </p>
                </div>
                <Button
                  type="button"
                  onClick={closeEditor}
                  className="h-9 w-9 bg-white/5 p-0 text-zinc-200"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="grid gap-4">
              <label className="grid gap-1 text-sm font-semibold text-zinc-300">
                Name
                <Input
                  value={form.name}
                  onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                  className="bg-zinc-950"
                  placeholder="Opening drive reclaim"
                />
              </label>
              <label className="grid gap-1 text-sm font-semibold text-zinc-300">
                Description (optional)
                <textarea
                  value={form.description}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, description: event.target.value }))
                  }
                  rows={3}
                  className="rounded-2xl border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300/60"
                  placeholder="When you take this setup, invalidation rules, etc."
                />
              </label>
              <label className="grid gap-1 text-sm font-semibold text-zinc-300">
                Chart color
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={form.color}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, color: event.target.value }))
                    }
                    className="h-11 w-16 cursor-pointer rounded-xl border border-white/10 bg-zinc-950"
                  />
                  <Input
                    value={form.color}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, color: event.target.value }))
                    }
                    className="bg-zinc-950 font-mono"
                  />
                </div>
              </label>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  disabled={isPending}
                  onClick={handleSave}
                  className="bg-cyan-300 text-slate-950 hover:bg-cyan-200"
                >
                  {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {editor.mode === "create" ? "Create strategy" : "Save changes"}
                </Button>
                <Button type="button" onClick={closeEditor} className="bg-white/5 text-zinc-100">
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
