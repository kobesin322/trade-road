"use client";

import { format } from "date-fns";
import { Plus, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DecimalInput } from "@/components/ui/decimal-input";
import { Input } from "@/components/ui/input";
import type { TradeLevelPushInput } from "@/lib/journal-constants";

export type LevelPushFormRow = Omit<TradeLevelPushInput, "price"> & { price: string };

type JournalLevelPushesEditorProps = {
  pushes: LevelPushFormRow[];
  onChange: (pushes: LevelPushFormRow[]) => void;
};

function defaultPush(levelType: LevelPushFormRow["levelType"] = "SL"): LevelPushFormRow {
  return {
    clientId: crypto.randomUUID(),
    levelType,
    price: "",
    pushedAt: new Date().toISOString(),
    note: "",
  };
}

function toLocalDateTimeValue(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return format(new Date(), "yyyy-MM-dd'T'HH:mm");
  }
  return format(date, "yyyy-MM-dd'T'HH:mm");
}

export function JournalLevelPushesEditor({ pushes, onChange }: JournalLevelPushesEditorProps) {
  function updatePush(index: number, patch: Partial<LevelPushFormRow>) {
    onChange(
      pushes.map((push, pushIndex) => (pushIndex === index ? { ...push, ...patch } : push)),
    );
  }

  function removePush(index: number) {
    onChange(pushes.filter((_, pushIndex) => pushIndex !== index));
  }

  function addPush(levelType: LevelPushFormRow["levelType"]) {
    onChange([...pushes, defaultPush(levelType)]);
  }

  return (
    <div className="grid gap-3 rounded-2xl border border-white/10 bg-black/25 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-sm font-semibold text-zinc-300">SL / TP push records</div>
          <p className="text-xs text-zinc-500">Track each time you moved stop loss or take profit.</p>
        </div>
        <Badge tone="neutral">{pushes.length}</Badge>
      </div>

      {pushes.length ? (
        <div className="grid gap-3">
          {pushes.map((push, index) => (
            <div
              key={push.id ?? push.clientId ?? `${push.levelType}-${index}`}
              className="grid gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3"
            >
              <div className="flex items-center justify-between gap-2">
                <Badge tone={push.levelType === "SL" ? "loss" : "win"}>{push.levelType}</Badge>
                <Button
                  type="button"
                  onClick={() => removePush(index)}
                  className="h-8 w-8 bg-white/5 p-0 text-zinc-300 hover:bg-rose-500/20 hover:text-rose-100"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <label className="grid gap-1 text-xs font-semibold text-zinc-400">
                  Type
                  <select
                    value={push.levelType}
                    onChange={(event) =>
                      updatePush(index, {
                        levelType: event.target.value as LevelPushFormRow["levelType"],
                      })
                    }
                    className="h-10 rounded-xl border border-white/10 bg-zinc-950 px-3 text-sm font-semibold text-white outline-none focus:border-cyan-300/60"
                  >
                    <option value="SL">SL</option>
                    <option value="TP">TP</option>
                  </select>
                </label>
                <label className="grid gap-1 text-xs font-semibold text-zinc-400">
                  Price
                  <DecimalInput
                    value={push.price}
                    onChange={(event) => updatePush(index, { price: event.target.value })}
                    className="bg-zinc-950"
                  />
                </label>
                <label className="grid gap-1 text-xs font-semibold text-zinc-400">
                  Pushed at
                  <Input
                    type="datetime-local"
                    value={toLocalDateTimeValue(push.pushedAt)}
                    onChange={(event) =>
                      updatePush(index, {
                        pushedAt: new Date(event.target.value).toISOString(),
                      })
                    }
                    className="bg-zinc-950"
                  />
                </label>
              </div>

              <label className="grid gap-1 text-xs font-semibold text-zinc-400">
                Note (optional)
                <Input
                  value={push.note ?? ""}
                  onChange={(event) => updatePush(index, { note: event.target.value })}
                  placeholder="Why you moved the level..."
                  className="bg-zinc-950"
                />
              </label>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-zinc-500">No push records yet.</p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={() => addPush("SL")} className="bg-white/5 text-zinc-100">
          <Plus className="h-4 w-4" />
          Add SL push
        </Button>
        <Button type="button" onClick={() => addPush("TP")} className="bg-white/5 text-zinc-100">
          <Plus className="h-4 w-4" />
          Add TP push
        </Button>
      </div>
    </div>
  );
}
