"use client";

import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { buildProfile, listSessionKeys } from "@/lib/orderflow/engine";
import type {
  OHLCVBar,
  ProfileMode,
  SessionPreset,
  VolumeDistributionModel,
  VolumeProfileParams,
} from "@/lib/orderflow/types";
import { DEFAULT_VOLUME_PROFILE_PARAMS } from "@/lib/orderflow/types";
import { cn } from "@/lib/utils";

type VolumeProfilePanelProps = {
  bars: OHLCVBar[];
  onOpenFaq: () => void;
};

const modes: { id: ProfileMode; label: string }[] = [
  { id: "developing", label: "Developing" },
  { id: "fixed_range", label: "Fixed range" },
  { id: "session", label: "Session" },
  { id: "composite", label: "Composite" },
];

function formatNum(n: number, digits = 2) {
  if (!Number.isFinite(n)) {
    return "—";
  }
  return n.toLocaleString(undefined, {
    maximumFractionDigits: digits,
    minimumFractionDigits: 0,
  });
}

export function VolumeProfilePanel({ bars, onOpenFaq }: VolumeProfilePanelProps) {
  const [mode, setMode] = useState<ProfileMode>("developing");
  const [tickSize, setTickSize] = useState(String(DEFAULT_VOLUME_PROFILE_PARAMS.tickSize));
  const [vaPercent, setVaPercent] = useState(
    String(Math.round(DEFAULT_VOLUME_PROFILE_PARAMS.valueAreaPercent * 100)),
  );
  const [ibMinutes, setIbMinutes] = useState(
    String(DEFAULT_VOLUME_PROFILE_PARAMS.initialBalanceMinutes),
  );
  const [sessionPreset, setSessionPreset] = useState<SessionPreset>(
    DEFAULT_VOLUME_PROFILE_PARAMS.sessionPreset,
  );
  const [distribution, setDistribution] = useState<VolumeDistributionModel>("uniform");
  const [rangeStart, setRangeStart] = useState("0");
  const [rangeEnd, setRangeEnd] = useState(String(Math.max(0, bars.length - 1)));
  const [sessionKey, setSessionKey] = useState<string>("");

  const sessionKeys = useMemo(
    () => listSessionKeys(bars, sessionPreset),
    [bars, sessionPreset],
  );

  const activeSessionKey = sessionKey || sessionKeys[sessionKeys.length - 1] || "";

  const params: Partial<VolumeProfileParams> = useMemo(() => {
    const tick = Number(tickSize);
    const va = Number(vaPercent) / 100;
    const ib = Number(ibMinutes);
    return {
      tickSize: Number.isFinite(tick) && tick > 0 ? tick : 0.25,
      valueAreaPercent: Number.isFinite(va) && va > 0 && va <= 1 ? va : 0.7,
      initialBalanceMinutes: Number.isFinite(ib) && ib > 0 ? ib : 60,
      sessionPreset,
      distribution,
    };
  }, [distribution, ibMinutes, sessionPreset, tickSize, vaPercent]);

  const profile = useMemo(() => {
    if (!bars.length) {
      return null;
    }
    const startIndex = Math.max(0, Number(rangeStart) || 0);
    const endIndex = Math.min(
      bars.length - 1,
      Number.isFinite(Number(rangeEnd)) ? Number(rangeEnd) : bars.length - 1,
    );
    return buildProfile(bars, mode, params, {
      startIndex,
      endIndex,
      sessionKey: activeSessionKey,
      sessionKeys: mode === "composite" ? sessionKeys : undefined,
    });
  }, [activeSessionKey, bars, mode, params, rangeEnd, rangeStart, sessionKeys]);

  const chartRows = useMemo(() => {
    if (!profile?.bins.length) {
      return [];
    }
    return profile.bins.map((bin) => ({
      price: bin.mid,
      volume: bin.volume,
      label: formatNum(bin.mid, 4),
    }));
  }, [profile]);

  const maxVol = Math.max(...chartRows.map((r) => r.volume), 1);

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(260px,320px)]">
      <Card className="overflow-hidden">
        <CardHeader className="space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>Volume profile</CardTitle>
              <p className="mt-1 max-w-[50ch] text-sm text-zinc-500">
                OHLCV-based histogram with POC, value area, HVN/LVN, and initial balance.
              </p>
            </div>
            <Button type="button" onClick={onOpenFaq} className="bg-white/5 text-xs text-zinc-100">
              FAQ and diagrams
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {modes.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setMode(item.id)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-semibold transition",
                  mode === item.id
                    ? "border-cyan-300/50 bg-cyan-300/15 text-cyan-100"
                    : "border-white/10 text-zinc-400 hover:bg-white/5 hover:text-white",
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          {!bars.length || !profile || !profile.bins.length ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-12 text-center">
              <p className="text-lg font-semibold text-white">0 volume bins</p>
              <p className="mt-2 text-sm text-zinc-500">
                Load market data or a CSV with volume, then pick a profile mode.
              </p>
            </div>
          ) : (
            <div className="h-[min(420px,55vh)] min-h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartRows}
                  layout="vertical"
                  margin={{ top: 8, right: 16, left: 8, bottom: 8 }}
                >
                  <XAxis type="number" tick={{ fill: "#71717a", fontSize: 11 }} />
                  <YAxis
                    type="category"
                    dataKey="label"
                    width={64}
                    tick={{ fill: "#a1a1aa", fontSize: 10 }}
                    interval="preserveStartEnd"
                  />
                  <Tooltip
                    contentStyle={{
                      background: "#09090b",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 12,
                    }}
                    formatter={(value) => [formatNum(Number(value), 2), "Volume"]}
                    labelFormatter={(label) => `Price ${label}`}
                  />
                  {profile.levels ? (
                    <>
                      <ReferenceLine
                        y={formatNum(profile.levels.poc, 4)}
                        stroke="#fbbf24"
                        strokeDasharray="4 3"
                      />
                    </>
                  ) : null}
                  <Bar dataKey="volume" radius={[0, 4, 4, 0]} barSize={10}>
                    {chartRows.map((row) => {
                      const isPoc =
                        profile.levels &&
                        Math.abs(row.price - profile.levels.poc) < (params.tickSize ?? 0.25) / 2;
                      const inVa =
                        profile.levels &&
                        row.price >= profile.levels.val &&
                        row.price <= profile.levels.vah;
                      return (
                        <Cell
                          key={row.price}
                          fill={
                            isPoc
                              ? "#22d3ee"
                              : inVa
                                ? "rgba(52,211,153,0.55)"
                                : "rgba(34,211,238,0.28)"
                          }
                          opacity={0.45 + 0.55 * (row.volume / maxVol)}
                        />
                      );
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 content-start">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Profile controls</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            <label className="grid gap-1 text-xs font-semibold text-zinc-400">
              Tick / bin size
              <Input value={tickSize} onChange={(e) => setTickSize(e.target.value)} />
            </label>
            <label className="grid gap-1 text-xs font-semibold text-zinc-400">
              Value area %
              <Input value={vaPercent} onChange={(e) => setVaPercent(e.target.value)} />
            </label>
            <label className="grid gap-1 text-xs font-semibold text-zinc-400">
              Initial balance (minutes)
              <Input value={ibMinutes} onChange={(e) => setIbMinutes(e.target.value)} />
            </label>
            <label className="grid gap-1 text-xs font-semibold text-zinc-400">
              Session preset
              <select
                value={sessionPreset}
                onChange={(e) => setSessionPreset(e.target.value as SessionPreset)}
                className="h-11 rounded-xl border border-white/10 bg-zinc-950 px-3 text-sm text-white"
              >
                <option value="america_new_york_day">America/New_York day</option>
                <option value="utc_day">UTC day</option>
                <option value="rth_us_equities">US equities RTH</option>
              </select>
            </label>
            <label className="grid gap-1 text-xs font-semibold text-zinc-400">
              Volume distribution
              <select
                value={distribution}
                onChange={(e) => setDistribution(e.target.value as VolumeDistributionModel)}
                className="h-11 rounded-xl border border-white/10 bg-zinc-950 px-3 text-sm text-white"
              >
                <option value="uniform">Uniform across bar range</option>
                <option value="close_weighted">Close-weighted</option>
              </select>
            </label>
            {mode === "fixed_range" ? (
              <div className="grid grid-cols-2 gap-2">
                <label className="grid gap-1 text-xs font-semibold text-zinc-400">
                  Start index
                  <Input value={rangeStart} onChange={(e) => setRangeStart(e.target.value)} />
                </label>
                <label className="grid gap-1 text-xs font-semibold text-zinc-400">
                  End index
                  <Input value={rangeEnd} onChange={(e) => setRangeEnd(e.target.value)} />
                </label>
              </div>
            ) : null}
            {mode === "session" && sessionKeys.length ? (
              <label className="grid gap-1 text-xs font-semibold text-zinc-400">
                Session
                <select
                  value={activeSessionKey}
                  onChange={(e) => setSessionKey(e.target.value)}
                  className="h-11 rounded-xl border border-white/10 bg-zinc-950 px-3 text-sm text-white"
                >
                  {sessionKeys.map((key) => (
                    <option key={key} value={key}>
                      {key}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Levels</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm">
            {!profile?.levels ? (
              <p className="text-zinc-500">No levels yet.</p>
            ) : (
              <>
                <LevelRow label="POC" value={formatNum(profile.levels.poc, 4)} tone="gold" />
                <LevelRow label="VAH" value={formatNum(profile.levels.vah, 4)} tone="win" />
                <LevelRow label="VAL" value={formatNum(profile.levels.val, 4)} tone="win" />
                <LevelRow
                  label="VA %"
                  value={`${Math.round(profile.levels.valueAreaPercent * 100)}%`}
                  tone="blue"
                />
                <LevelRow label="Total vol" value={formatNum(profile.totalVolume, 0)} tone="neutral" />
              </>
            )}
            {profile?.initialBalance ? (
              <div className="mt-2 space-y-2 border-t border-white/10 pt-3">
                <p className="text-xs font-semibold text-zinc-500">Initial balance</p>
                <LevelRow label="IB high" value={formatNum(profile.initialBalance.high, 4)} tone="gold" />
                <LevelRow label="IB low" value={formatNum(profile.initialBalance.low, 4)} tone="gold" />
                <LevelRow label="IB mid" value={formatNum(profile.initialBalance.mid, 4)} tone="neutral" />
              </div>
            ) : null}
            {profile?.nodes?.length ? (
              <div className="mt-2 space-y-2 border-t border-white/10 pt-3">
                <p className="text-xs font-semibold text-zinc-500">Volume nodes</p>
                {profile.nodes.slice(0, 8).map((node) => (
                  <div
                    key={`${node.kind}-${node.price}`}
                    className="flex items-center justify-between gap-2"
                  >
                    <Badge tone={node.kind === "hvn" ? "win" : "loss"}>
                      {node.kind.toUpperCase()}
                    </Badge>
                    <span className="font-mono tabular-nums text-zinc-200">
                      {formatNum(node.price, 4)}
                    </span>
                  </div>
                ))}
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function LevelRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "gold" | "win" | "blue" | "neutral" | "loss";
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <Badge tone={tone}>{label}</Badge>
      <span className="font-mono text-sm font-semibold tabular-nums text-white">{value}</span>
    </div>
  );
}
