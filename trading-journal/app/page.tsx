"use client";

import {
  eachDayOfInterval,
  endOfMonth,
  format,
  getDay,
  parseISO,
  startOfMonth,
} from "date-fns";
import {
  ArrowUpRight,
  CalendarDays,
  ChevronDown,
  Crosshair,
  Flame,
  Gauge,
  LineChart,
  ListFilter,
  Search,
  Sparkles,
  Swords,
  Target,
  Trophy,
  WalletCards,
} from "lucide-react";
import { type CSSProperties, useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart as RechartsLineChart,
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
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import {
  buildDailyProfit,
  getTradeStats,
  sampleTrades,
  strategyWins,
  type Trade,
  type TradeOutcome,
} from "@/lib/trades";

const STORAGE_KEY = "trading-journal:march-2026";
const mainViews = ["Dashboard", "Journal", "Charts", "Calendar"] as const;
const journalTabs = ["List overview", "Wins Vs Losses", "Strategy overview"] as const;
const strategies = ["Strategy #1", "Strategy #2", "Strategy #3"] as const;

type MainView = (typeof mainViews)[number];
type JournalTab = (typeof journalTabs)[number];
type OutcomeFilter = "ALL" | TradeOutcome;

const moneyFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0,
});

function formatMoney(value: number) {
  const sign = value >= 0 ? "+" : "-";
  return `${sign}$${moneyFormatter.format(Math.abs(value))}`;
}

function formatPercent(value: number) {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

function ChartTooltip({
  active,
  payload,
  label,
  prefix = "$",
}: {
  active?: boolean;
  payload?: { value?: number }[];
  label?: string;
  prefix?: string;
}) {
  if (!active || !payload?.length) {
    return null;
  }

  const value = Number(payload[0]?.value ?? 0);

  return (
    <div className="rounded-2xl border border-white/10 bg-zinc-950/95 px-3 py-2 text-xs text-zinc-200 shadow-2xl">
      <div className="font-semibold text-white">{label}</div>
      <div className={cn("mt-1", value >= 0 ? "text-emerald-300" : "text-rose-300")}>
        {prefix}
        {moneyFormatter.format(value)}
      </div>
    </div>
  );
}

function ConfettiBurst({ active }: { active: boolean }) {
  if (!active) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-50 mx-auto h-44 max-w-5xl overflow-hidden">
      {Array.from({ length: 28 }).map((_, index) => (
        <span
          key={index}
          className="confetti-piece"
          style={
            {
              "--x": `${(index * 37) % 100}%`,
              "--delay": `${(index % 9) * 65}ms`,
              "--hue": `${(index * 29) % 360}`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}

function ChartPlaceholder({ label = "Loading chart" }: { label?: string }) {
  return (
    <div className="flex h-full min-h-28 items-center justify-center rounded-3xl border border-white/10 bg-white/[0.03] text-xs font-bold uppercase tracking-[0.22em] text-zinc-500">
      {label}
    </div>
  );
}

export default function Home() {
  const [trades, setTrades] = useState<Trade[]>(sampleTrades);
  const [activeView, setActiveView] = useState<MainView>("Dashboard");
  const [journalTab, setJournalTab] = useState<JournalTab>("List overview");
  const [query, setQuery] = useState("");
  const [outcomeFilter, setOutcomeFilter] = useState<OutcomeFilter>("ALL");
  const [strategyFilter, setStrategyFilter] = useState<"ALL" | Trade["strategy"]>("ALL");
  const [selectedTrade, setSelectedTrade] = useState<Trade>(sampleTrades[0]);
  const [confetti, setConfetti] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);
  const [chartsReady, setChartsReady] = useState(false);

  useEffect(() => {
    try {
      const storedTrades = window.localStorage.getItem(STORAGE_KEY);

      if (storedTrades) {
        const parsedTrades = JSON.parse(storedTrades) as Trade[];
        if (Array.isArray(parsedTrades) && parsedTrades.length > 0) {
          setTrades(parsedTrades);
          setSelectedTrade(parsedTrades[0]);
          setIsHydrated(true);
          return;
        }
      }

      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sampleTrades));
    } catch {
      setTrades(sampleTrades);
    }

    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(trades));
    } catch {
      // Local storage can be disabled in private browsing; the app still runs in memory.
    }
  }, [isHydrated, trades]);

  useEffect(() => {
    setChartsReady(true);
  }, []);

  const stats = useMemo(() => getTradeStats(trades), [trades]);
  const dailyProfit = useMemo(() => buildDailyProfit(trades), [trades]);
  const tradesByDate = useMemo(
    () =>
      trades.reduce<Record<string, Trade[]>>((days, trade) => {
        days[trade.date] = [...(days[trade.date] ?? []), trade];
        return days;
      }, {}),
    [trades],
  );
  const filteredTrades = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return trades.filter((trade) => {
      const matchesQuery =
        normalizedQuery.length === 0 ||
        trade.pair.toLowerCase().includes(normalizedQuery) ||
        trade.strategy.toLowerCase().includes(normalizedQuery) ||
        trade.position.toLowerCase().includes(normalizedQuery);
      const matchesOutcome = outcomeFilter === "ALL" || trade.outcome === outcomeFilter;
      const matchesStrategy =
        strategyFilter === "ALL" || trade.strategy === strategyFilter;

      return matchesQuery && matchesOutcome && matchesStrategy;
    });
  }, [outcomeFilter, query, strategyFilter, trades]);
  const bestWin = stats.biggestWin ?? trades[0];
  const calendarStart = startOfMonth(new Date(2026, 2, 1));
  const calendarDays = eachDayOfInterval({
    start: calendarStart,
    end: endOfMonth(calendarStart),
  });
  const calendarOffset = getDay(calendarStart);
  const maxDailyAbs = Math.max(
    1,
    ...dailyProfit.map((day) => Math.abs(day.profit)),
  );
  const strategySummary = strategies.map((strategy) => {
    const strategyTrades = trades.filter((trade) => trade.strategy === strategy);
    const strategyWinsCount = strategyTrades.filter((trade) => trade.outcome === "WIN").length;
    const total = strategyTrades.reduce((sum, trade) => sum + trade.profitAmount, 0);

    return {
      strategy,
      trades: strategyTrades.length,
      wins: strategyWinsCount,
      winRate: strategyTrades.length
        ? Math.round((strategyWinsCount / strategyTrades.length) * 100)
        : 0,
      total,
    };
  });

  function selectTrade(trade: Trade) {
    setSelectedTrade(trade);

    if (trade.outcome === "WIN" && trade.profitAmount >= 50) {
      setConfetti(true);
      window.setTimeout(() => setConfetti(false), 1300);
    }
  }

  return (
    <main className="min-h-screen overflow-hidden bg-[#05070d] text-white">
      <ConfettiBurst active={confetti} />
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.18),transparent_34%),radial-gradient(circle_at_80%_0%,rgba(250,204,21,0.12),transparent_28%),linear-gradient(180deg,rgba(15,23,42,0.72),rgba(3,7,18,0.95))]" />
      <div className="relative mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-5 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 rounded-[2rem] border border-white/10 bg-white/[0.04] p-4 shadow-2xl shadow-black/40 backdrop-blur md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.35em] text-cyan-200/80">
              <Sparkles className="h-4 w-4" />
              Level 26 journal quest
            </div>
            <h1 className="mt-3 text-3xl font-black tracking-tight text-white sm:text-5xl">
              Trading Journal
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-zinc-400 sm:text-base">
              Stack clean entries, protect streaks, and turn every March 2026 setup
              into scoreable feedback.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button className="justify-between bg-cyan-300/10 text-cyan-100">
              March 2026 <ChevronDown className="h-4 w-4" />
            </Button>
            <Button
              onClick={() => {
                setActiveView("Charts");
                selectTrade(bestWin);
              }}
              className="bg-gradient-to-r from-yellow-400 to-amber-500 text-black hover:bg-yellow-300"
            >
              <Trophy className="h-4 w-4" />
              Replay best win
            </Button>
          </div>
        </header>

        <nav className="grid grid-cols-2 gap-2 rounded-[1.5rem] border border-white/10 bg-black/30 p-2 backdrop-blur md:grid-cols-4">
          {mainViews.map((view) => (
            <button
              key={view}
              type="button"
              onClick={() => setActiveView(view)}
              className={cn(
                "rounded-2xl px-3 py-3 text-sm font-bold text-zinc-400 transition-all hover:bg-white/10 hover:text-white",
                activeView === view &&
                  "bg-cyan-300 text-slate-950 shadow-[0_0_22px_rgba(34,211,238,0.35)]",
              )}
            >
              {view}
            </button>
          ))}
        </nav>

        {activeView === "Dashboard" && (
          <DashboardView
            bestWin={bestWin}
            chartsReady={chartsReady}
            dailyProfit={dailyProfit}
            maxDailyAbs={maxDailyAbs}
            setActiveView={setActiveView}
            stats={stats}
          />
        )}

        {activeView === "Journal" && (
          <JournalView
            filteredTrades={filteredTrades}
            journalTab={journalTab}
            outcomeFilter={outcomeFilter}
            query={query}
            selectedTrade={selectedTrade}
            setJournalTab={setJournalTab}
            setOutcomeFilter={setOutcomeFilter}
            setQuery={setQuery}
            setStrategyFilter={setStrategyFilter}
            stats={stats}
            strategyFilter={strategyFilter}
            strategySummary={strategySummary}
            trades={trades}
            onSelectTrade={selectTrade}
            chartsReady={chartsReady}
          />
        )}

        {activeView === "Charts" && (
          <ChartsView
            chartsReady={chartsReady}
            selectedTrade={selectedTrade}
            trades={trades}
            onSelectTrade={selectTrade}
          />
        )}

        {activeView === "Calendar" && (
          <CalendarView
            calendarDays={calendarDays}
            calendarOffset={calendarOffset}
            tradesByDate={tradesByDate}
            onSelectTrade={(trade) => {
              selectTrade(trade);
              setActiveView("Journal");
            }}
          />
        )}
      </div>
    </main>
  );
}

function DashboardView({
  bestWin,
  chartsReady,
  dailyProfit,
  maxDailyAbs,
  setActiveView,
  stats,
}: {
  bestWin: Trade;
  chartsReady: boolean;
  dailyProfit: ReturnType<typeof buildDailyProfit>;
  maxDailyAbs: number;
  setActiveView: (view: MainView) => void;
  stats: ReturnType<typeof getTradeStats>;
}) {
  const metricCards = [
    {
      title: "Total Profit",
      value: `$${moneyFormatter.format(stats.totalProfit)}`,
      helper: "March bankroll boost",
      icon: ArrowUpRight,
      tone: "from-emerald-400/20 to-cyan-400/10",
    },
    {
      title: "Win Rate",
      value: `${stats.winRate}%`,
      helper: `${stats.wins} wins / ${stats.losses} losses`,
      icon: Target,
      tone: "from-cyan-400/20 to-blue-500/10",
    },
    {
      title: "Total Trades",
      value: `${stats.totalTrades}`,
      helper: "Quest entries logged",
      icon: WalletCards,
      tone: "from-violet-400/20 to-fuchsia-500/10",
    },
    {
      title: "Win/Loss streak",
      value: stats.currentStreak,
      helper: "Current momentum chain",
      icon: Flame,
      tone: "from-amber-300/20 to-rose-500/10",
    },
  ];

  return (
    <section className="grid gap-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {metricCards.map((metric) => (
          <Card
            key={metric.title}
            className={cn(
              "group overflow-hidden bg-gradient-to-br transition hover:-translate-y-1 hover:border-cyan-300/40",
              metric.tone,
            )}
          >
            <CardContent className="relative">
              <div className="absolute right-4 top-4 rounded-2xl border border-white/10 bg-black/25 p-3 text-cyan-100">
                <metric.icon className="h-5 w-5" />
              </div>
              <div className="text-sm font-semibold uppercase tracking-[0.22em] text-zinc-400">
                {metric.title}
              </div>
              <div className="mt-4 flex items-end gap-2">
                <span className="text-4xl font-black">{metric.value}</span>
                {metric.title === "Total Profit" && (
                  <span className="pb-2 text-emerald-300">▲</span>
                )}
              </div>
              <p className="mt-2 text-sm text-zinc-400">{metric.helper}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.4fr]">
        <Card className="overflow-hidden">
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle>Win by Strategy</CardTitle>
                <p className="mt-1 text-sm text-zinc-400">
                  Power-ups ranked by captured profit.
                </p>
              </div>
              <Badge tone="blue">Boss chart</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              {chartsReady ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={strategyWins} margin={{ left: -24, right: 12, top: 20 }}>
                    <CartesianGrid stroke="rgba(255,255,255,0.07)" vertical={false} />
                    <XAxis dataKey="name" tick={{ fill: "#a1a1aa", fontSize: 12 }} tickLine={false} />
                    <YAxis tick={{ fill: "#71717a", fontSize: 12 }} tickLine={false} axisLine={false} />
                    <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
                    <Bar dataKey="profit" radius={[16, 16, 6, 6]} barSize={58}>
                      {strategyWins.map((entry) => (
                        <Cell key={entry.name} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <ChartPlaceholder label="Loading strategy chart" />
              )}
            </div>
            <div className="mt-4 grid gap-3">
              {strategyWins.map((strategy) => (
                <div key={strategy.name} className="flex items-center justify-between rounded-2xl bg-white/[0.04] px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="h-3 w-3 rounded-full" style={{ background: strategy.fill }} />
                    <span className="font-semibold">{strategy.name}</span>
                  </div>
                  <span className="font-black text-white">${strategy.profit}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle>Profit per Day</CardTitle>
                <p className="mt-1 text-sm text-zinc-400">
                  Every March candle gets a scorecard: green claims, red lessons.
                </p>
              </div>
              <Badge tone="gold">31 days</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-[760px]">
              {chartsReady ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={dailyProfit}
                    layout="vertical"
                    margin={{ bottom: 8, left: 0, right: 20, top: 8 }}
                  >
                    <CartesianGrid stroke="rgba(255,255,255,0.06)" horizontal={false} />
                    <XAxis
                      type="number"
                      domain={[-maxDailyAbs, maxDailyAbs]}
                      tick={{ fill: "#71717a", fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      dataKey="label"
                      type="category"
                      width={58}
                      tick={{ fill: "#a1a1aa", fontSize: 12 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
                    <ReferenceLine x={0} stroke="rgba(255,255,255,0.28)" />
                    <Bar dataKey="profit" radius={10} barSize={14}>
                      {dailyProfit.map((day) => (
                        <Cell
                          key={day.date}
                          fill={
                            day.profit > 0
                              ? "#22c55e"
                              : day.profit < 0
                                ? "#fb7185"
                                : "rgba(255,255,255,0.12)"
                          }
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <ChartPlaceholder label="Loading daily chart" />
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="overflow-hidden border-emerald-300/20 bg-gradient-to-r from-emerald-400/15 via-cyan-400/10 to-yellow-300/10">
        <CardContent className="grid gap-6 md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <Badge tone="win">Monthly clear</Badge>
            <h2 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">
              ${moneyFormatter.format(stats.totalProfit)} total profit
            </h2>
            <p className="mt-2 max-w-2xl text-zinc-300">
              Best loot drop: {bestWin.pair} on {format(parseISO(bestWin.date), "MMM d")} for{" "}
              {formatMoney(bestWin.profitAmount)}. Keep farming the clean A+ setups.
            </p>
          </div>
          <Button onClick={() => setActiveView("Journal")} className="bg-white text-slate-950 hover:bg-cyan-100">
            <ListFilter className="h-4 w-4" />
            Open journal
          </Button>
        </CardContent>
      </Card>
    </section>
  );
}

function JournalView({
  chartsReady,
  filteredTrades,
  journalTab,
  outcomeFilter,
  query,
  selectedTrade,
  setJournalTab,
  setOutcomeFilter,
  setQuery,
  setStrategyFilter,
  stats,
  strategyFilter,
  strategySummary,
  trades,
  onSelectTrade,
}: {
  chartsReady: boolean;
  filteredTrades: Trade[];
  journalTab: JournalTab;
  outcomeFilter: OutcomeFilter;
  query: string;
  selectedTrade: Trade;
  setJournalTab: (tab: JournalTab) => void;
  setOutcomeFilter: (filter: OutcomeFilter) => void;
  setQuery: (query: string) => void;
  setStrategyFilter: (filter: "ALL" | Trade["strategy"]) => void;
  stats: ReturnType<typeof getTradeStats>;
  strategyFilter: "ALL" | Trade["strategy"];
  strategySummary: {
    strategy: Trade["strategy"];
    trades: number;
    wins: number;
    winRate: number;
    total: number;
  }[];
  trades: Trade[];
  onSelectTrade: (trade: Trade) => void;
}) {
  return (
    <section className="grid gap-6 xl:grid-cols-[1.45fr_0.75fr]">
      <Card className="overflow-hidden">
        <CardHeader>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle>Trade List / Journal</CardTitle>
              <p className="mt-1 text-sm text-zinc-400">
                Search, filter, and click a row to inspect the setup.
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              <label className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  className="pl-9"
                  placeholder="Search pair..."
                />
              </label>
              <select
                value={outcomeFilter}
                onChange={(event) => setOutcomeFilter(event.target.value as OutcomeFilter)}
                className="h-11 rounded-2xl border border-white/10 bg-zinc-950 px-3 text-sm font-semibold text-white outline-none focus:border-cyan-300/60"
              >
                <option value="ALL">All outcomes</option>
                <option value="WIN">Wins</option>
                <option value="LOSS">Losses</option>
              </select>
              <select
                value={strategyFilter}
                onChange={(event) =>
                  setStrategyFilter(event.target.value as "ALL" | Trade["strategy"])
                }
                className="h-11 rounded-2xl border border-white/10 bg-zinc-950 px-3 text-sm font-semibold text-white outline-none focus:border-cyan-300/60"
              >
                <option value="ALL">All strategies</option>
                {strategies.map((strategy) => (
                  <option key={strategy} value={strategy}>
                    {strategy}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {journalTabs.map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setJournalTab(tab)}
                className={cn(
                  "rounded-full border border-white/10 px-4 py-2 text-sm font-bold text-zinc-400 transition hover:bg-white/10 hover:text-white",
                  journalTab === tab && "border-cyan-300/50 bg-cyan-300/15 text-cyan-100",
                )}
              >
                {tab}
              </button>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          {journalTab === "List overview" && (
            <div className="overflow-hidden rounded-3xl border border-white/10">
              <div className="grid grid-cols-[1.2fr_0.8fr_0.9fr_0.8fr_0.9fr] bg-white/[0.06] px-4 py-3 text-xs font-bold uppercase tracking-[0.18em] text-zinc-500 max-lg:hidden">
                <span>Pair</span>
                <span>Outcome</span>
                <span>Date</span>
                <span>Profit %</span>
                <span>Strategy</span>
              </div>
              <div className="divide-y divide-white/10">
                {filteredTrades.map((trade) => (
                  <button
                    key={trade.id}
                    type="button"
                    onClick={() => onSelectTrade(trade)}
                    className={cn(
                      "grid w-full gap-3 px-4 py-4 text-left transition hover:bg-cyan-300/10 lg:grid-cols-[1.2fr_0.8fr_0.9fr_0.8fr_0.9fr] lg:items-center",
                      selectedTrade.id === trade.id && "bg-cyan-300/10",
                    )}
                  >
                    <div>
                      <div className="font-black text-white">{trade.pair}</div>
                      <div className="text-xs font-semibold text-zinc-500">{trade.position}</div>
                    </div>
                    <Badge tone={trade.outcome === "WIN" ? "win" : "loss"}>{trade.outcome}</Badge>
                    <span className="text-sm text-zinc-300">
                      {format(parseISO(trade.date), "MMM d, yyyy")}
                    </span>
                    <span
                      className={cn(
                        "text-sm font-black",
                        trade.profitPercent >= 0 ? "text-emerald-300" : "text-rose-300",
                      )}
                    >
                      {formatPercent(trade.profitPercent)}
                    </span>
                    <span className="text-sm font-semibold text-cyan-100">{trade.strategy}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {journalTab === "Wins Vs Losses" && (
            <div className="grid gap-4 lg:grid-cols-2">
              <OutcomePanel
                title="Wins"
                tone="win"
                trades={trades.filter((trade) => trade.outcome === "WIN")}
                total={stats.wins}
              />
              <OutcomePanel
                title="Losses"
                tone="loss"
                trades={trades.filter((trade) => trade.outcome === "LOSS")}
                total={stats.losses}
              />
            </div>
          )}

          {journalTab === "Strategy overview" && (
            <div className="grid gap-4">
              {strategySummary.map((summary) => (
                <div key={summary.strategy} className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="text-xl font-black">{summary.strategy}</div>
                      <div className="text-sm text-zinc-400">
                        {summary.trades} trades · {summary.wins} wins · {formatMoney(summary.total)}
                      </div>
                    </div>
                    <Badge tone={summary.total >= 0 ? "win" : "loss"}>{summary.winRate}% win rate</Badge>
                  </div>
                  <Progress value={summary.winRate} className="mt-4" />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <TradeDetail chartsReady={chartsReady} trade={selectedTrade} />
    </section>
  );
}

function OutcomePanel({
  title,
  tone,
  total,
  trades,
}: {
  title: string;
  tone: "win" | "loss";
  total: number;
  trades: Trade[];
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-2xl font-black">{title}</h3>
        <Badge tone={tone}>{total}</Badge>
      </div>
      <div className="mt-4 grid gap-3">
        {trades.map((trade) => (
          <div key={trade.id} className="flex items-center justify-between rounded-2xl bg-black/25 px-4 py-3">
            <div>
              <div className="font-bold">{trade.pair}</div>
              <div className="text-xs text-zinc-500">{format(parseISO(trade.date), "MMM d")}</div>
            </div>
            <div className={cn("font-black", tone === "win" ? "text-emerald-300" : "text-rose-300")}>
              {formatMoney(trade.profitAmount)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TradeDetail({ chartsReady, trade }: { chartsReady: boolean; trade: Trade }) {
  return (
    <Card className="sticky top-4 h-fit overflow-hidden border-cyan-300/20">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle>{trade.pair}</CardTitle>
            <p className="mt-1 text-sm text-zinc-400">
              {format(parseISO(trade.date), "EEEE, MMM d")} · {trade.position}
            </p>
          </div>
          <Badge tone={trade.outcome === "WIN" ? "win" : "loss"}>{trade.outcome}</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-3xl border border-white/10 bg-black/25 p-4">
          <div className="h-56">
            {chartsReady ? (
              <ResponsiveContainer width="100%" height="100%">
                <RechartsLineChart data={trade.chartData}>
                  <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                  <XAxis dataKey="time" hide />
                  <YAxis hide domain={["dataMin", "dataMax"]} />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) {
                        return null;
                      }
                      return (
                        <div className="rounded-xl border border-white/10 bg-zinc-950 px-3 py-2 text-xs text-white">
                          Price {Number(payload[0].value).toFixed(4)}
                        </div>
                      );
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="price"
                    stroke={trade.outcome === "WIN" ? "#22c55e" : "#fb7185"}
                    strokeWidth={3}
                    dot={false}
                  />
                </RechartsLineChart>
              </ResponsiveContainer>
            ) : (
              <ChartPlaceholder label="Loading replay" />
            )}
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-white/[0.05] p-4">
            <div className="text-xs font-bold uppercase tracking-[0.18em] text-zinc-500">Return</div>
            <div className={cn("mt-2 text-2xl font-black", trade.profitPercent >= 0 ? "text-emerald-300" : "text-rose-300")}>
              {formatPercent(trade.profitPercent)}
            </div>
          </div>
          <div className="rounded-2xl bg-white/[0.05] p-4">
            <div className="text-xs font-bold uppercase tracking-[0.18em] text-zinc-500">Profit</div>
            <div className={cn("mt-2 text-2xl font-black", trade.profitAmount >= 0 ? "text-emerald-300" : "text-rose-300")}>
              {formatMoney(trade.profitAmount)}
            </div>
          </div>
        </div>
        <div className="mt-4 rounded-2xl border border-cyan-300/20 bg-cyan-300/10 p-4 text-sm text-cyan-50">
          <div className="mb-1 flex items-center gap-2 font-black">
            <Crosshair className="h-4 w-4" />
            Coach note
          </div>
          {trade.outcome === "WIN"
            ? "Great execution. Screenshot the setup and tag the trigger so this edge becomes repeatable."
            : "Small tuition paid. Identify the invalidation miss and keep the loss inside the planned box."}
        </div>
      </CardContent>
    </Card>
  );
}

function ChartsView({
  chartsReady,
  selectedTrade,
  trades,
  onSelectTrade,
}: {
  chartsReady: boolean;
  selectedTrade: Trade;
  trades: Trade[];
  onSelectTrade: (trade: Trade) => void;
}) {
  return (
    <section className="grid gap-6">
      <Card className="overflow-hidden bg-gradient-to-br from-cyan-400/10 to-fuchsia-500/10">
        <CardHeader>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Chart Overview</CardTitle>
              <p className="mt-1 text-sm text-zinc-400">
                Mini trade cards with realistic fake market paths for fast visual replay.
              </p>
            </div>
            <Badge tone={selectedTrade.outcome === "WIN" ? "win" : "loss"}>
              Selected: {selectedTrade.pair}
            </Badge>
          </div>
        </CardHeader>
      </Card>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {trades.map((trade) => (
          <button
            key={trade.id}
            type="button"
            onClick={() => onSelectTrade(trade)}
            className={cn(
              "group rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-4 text-left shadow-2xl shadow-black/20 transition hover:-translate-y-1 hover:border-cyan-300/50",
              selectedTrade.id === trade.id && "border-cyan-300/60 bg-cyan-300/10",
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xl font-black text-white">{trade.pair}</div>
                <div className="text-sm text-zinc-500">{format(parseISO(trade.date), "MMM d, yyyy")}</div>
              </div>
              <Badge tone={trade.outcome === "WIN" ? "win" : "loss"}>{trade.outcome}</Badge>
            </div>
            <div className="mt-4 h-32 rounded-3xl border border-white/10 bg-black/30 p-3">
              {chartsReady ? (
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsLineChart data={trade.chartData}>
                    <XAxis dataKey="time" hide />
                    <YAxis hide domain={["dataMin", "dataMax"]} />
                    <Line
                      type="monotone"
                      dataKey="price"
                      stroke={trade.outcome === "WIN" ? "#22c55e" : "#fb7185"}
                      strokeWidth={3}
                      dot={false}
                    />
                  </RechartsLineChart>
                </ResponsiveContainer>
              ) : (
                <ChartPlaceholder label="Replay loading" />
              )}
            </div>
            <div className="mt-4 flex items-center justify-between">
              <div>
                <div className={cn("text-3xl font-black", trade.profitPercent >= 0 ? "text-emerald-300" : "text-rose-300")}>
                  {formatPercent(trade.profitPercent)}
                </div>
                <div className="text-xs font-bold uppercase tracking-[0.18em] text-zinc-500">
                  {trade.strategy}
                </div>
              </div>
              <LineChart className="h-8 w-8 text-cyan-200 opacity-70 transition group-hover:scale-110" />
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}

function CalendarView({
  calendarDays,
  calendarOffset,
  tradesByDate,
  onSelectTrade,
}: {
  calendarDays: Date[];
  calendarOffset: number;
  tradesByDate: Record<string, Trade[]>;
  onSelectTrade: (trade: Trade) => void;
}) {
  return (
    <section className="grid gap-6">
      <Card className="overflow-hidden">
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Calendar View</CardTitle>
              <p className="mt-1 text-sm text-zinc-400">
                Month tab · March 2026 daily trades with return badges.
              </p>
            </div>
            <Badge tone="blue">
              <CalendarDays className="h-3.5 w-3.5" /> Month
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-2 text-center text-xs font-black uppercase tracking-[0.2em] text-zinc-500">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
              <div key={day} className="py-2">
                {day}
              </div>
            ))}
          </div>
          <div className="mt-2 grid grid-cols-7 gap-2">
            {Array.from({ length: calendarOffset }).map((_, index) => (
              <div key={`blank-${index}`} className="min-h-28 rounded-3xl border border-white/5 bg-white/[0.02]" />
            ))}
            {calendarDays.map((day) => {
              const dateKey = format(day, "yyyy-MM-dd");
              const dayTrades = tradesByDate[dateKey] ?? [];

              return (
                <div
                  key={dateKey}
                  className="min-h-28 rounded-3xl border border-white/10 bg-white/[0.04] p-2 transition hover:border-cyan-300/40 hover:bg-cyan-300/10 sm:p-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-black text-white">{format(day, "d")}</span>
                    {dayTrades.length > 0 && (
                      <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold text-zinc-300">
                        {dayTrades.length}
                      </span>
                    )}
                  </div>
                  <div className="mt-2 grid gap-1.5">
                    {dayTrades.map((trade) => (
                      <button
                        key={trade.id}
                        type="button"
                        onClick={() => onSelectTrade(trade)}
                        className={cn(
                          "rounded-2xl border px-2 py-1.5 text-left text-[10px] font-black uppercase leading-tight transition hover:scale-[1.02]",
                          trade.outcome === "WIN"
                            ? "border-emerald-400/30 bg-emerald-400/15 text-emerald-100"
                            : "border-rose-400/30 bg-rose-500/15 text-rose-100",
                        )}
                      >
                        <div className="truncate">{trade.pair}</div>
                        <div>{trade.outcome} · {formatPercent(trade.profitPercent)}</div>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card className="border-yellow-300/20 bg-yellow-300/10">
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.2em] text-yellow-100">
              <Gauge className="h-4 w-4" />
              Consistency XP
            </div>
            <p className="mt-2 text-zinc-300">
              Empty cells are rest days. Mark them intentionally so your edge has room to recharge.
            </p>
          </div>
          <Badge tone="gold">
            <Swords className="h-3.5 w-3.5" /> 23 trades
          </Badge>
        </CardContent>
      </Card>
    </section>
  );
}
