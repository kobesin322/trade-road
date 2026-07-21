"use client";

import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  format,
  getDay,
  isToday,
  parseISO,
  startOfMonth,
  subMonths,
} from "date-fns";
import {
  ArrowUpRight,
  BookOpen,
  Calculator,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Crosshair,
  FlaskConical,
  Flame,
  Gauge,
  LayoutDashboard,
  LineChart,
  ListFilter,
  LogOut,
  MoreHorizontal,
  Scale,
  Search,
  Settings2,
  Sparkles,
  Swords,
  Target,
  Trophy,
  WalletCards,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ChangeEvent, type CSSProperties, useEffect, useMemo, useState, useTransition } from "react";
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

import { buildTradesCsv } from "@/app/actions/trades";
import { signOut } from "@/app/actions/auth";
import { MarketChartsView } from "@/components/charts/market-charts-view";
import { LSPortfolioDashboard } from "@/components/ls-portfolio/ls-portfolio-dashboard";
import { OrderFlowBacktester } from "@/components/tools/order-flow-backtester";
import { RiskCalculatorUtility } from "@/components/tools/risk-calculator-utility";
import { DailyOverviewPanel } from "@/components/journal/daily-overview-panel";
import { ScreenshotGallery } from "@/components/journal/screenshot-gallery";
import { formatOverviewDayLabel } from "@/components/journal/overview-date-picker";
import { JournalEntryForm } from "@/components/journal/journal-entry-form";
import { JournalPdfExportButton } from "@/components/journal/journal-pdf-export-button";
import { StrategySettingsPanel } from "@/components/journal/strategy-settings-panel";
import { MobileBottomNav } from "@/components/mobile/mobile-bottom-nav";
import { MobileMoreSheet } from "@/components/mobile/mobile-more-sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  getJournalStrategyColor,
  SYSTEM_JOURNAL_STRATEGIES,
  buildCustomStrategyColorMap,
} from "@/lib/journal-constants";
import { useJournalStrategies } from "@/lib/hooks/use-journal-strategies";
import { MAX_PDF_EXPORT_TRADES } from "@/lib/journal-pdf-export";
import { useIsMobile } from "@/lib/hooks/use-is-mobile";
import type { MobilePrimaryView } from "@/lib/mobile";
import { createClient, hasSupabaseBrowserConfig } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { buildDailyProfit, getTradeStats, type Trade, type TradeOutcome } from "@/lib/trades";
import type { DailyOverview } from "@/lib/daily-overview-types";
import { buildOverviewsByDate, overviewHasContent } from "@/lib/daily-overview-utils";
import { countMistakes } from "@/lib/trading-mistakes";

const mainViews = [
  "Dashboard",
  "Journal",
  "Portfolio",
  "Charts",
  "Strategy Settings",
  "Strategy Lab",
  "Utilities",
  "Calendar",
] as const;

const toolLinks: Array<{
  href: string;
  title: string;
  description: string;
  icon: LucideIcon;
}> = [
  {
    href: "/?view=Utilities",
    title: "Risk Calculator",
    description: "Size, R:R, journal link",
    icon: Calculator,
  },
  {
    href: "/?view=Strategy%20Lab",
    title: "Strategy Lab",
    description: "CVD bounce backtester",
    icon: FlaskConical,
  },
  {
    href: "/tools/correlation",
    title: "Correlation Matrix",
    description: "Pearson pair selection",
    icon: Scale,
  },
  {
    href: "/tools/orderflow",
    title: "Order Flow",
    description: "Market microstructure",
    icon: Gauge,
  },
];
const journalTabs = ["List overview", "Wins Vs Losses", "Strategy overview"] as const;

function buildStrategyChartData(
  tradeList: Trade[],
  strategyNames: string[],
  customColors: Record<string, string>,
) {
  return strategyNames.map((strategy) => ({
    name: strategy,
    profit: tradeList
      .filter((trade) => trade.strategy === strategy)
      .reduce((sum, trade) => sum + trade.profitAmount, 0),
    fill: getJournalStrategyColor(strategy, customColors),
  }));
}

type MainView = (typeof mainViews)[number];
type JournalTab = (typeof journalTabs)[number];
type OutcomeFilter = "ALL" | TradeOutcome;

const mainViewConfig: Record<
  MainView,
  { icon: LucideIcon; description: string }
> = {
  Dashboard: { icon: LayoutDashboard, description: "Performance at a glance" },
  Journal: { icon: BookOpen, description: "Log and review every setup" },
  Portfolio: { icon: WalletCards, description: "Long / short book tracking" },
  Charts: { icon: LineChart, description: "Multi-timeframe market view" },
  "Strategy Settings": { icon: Settings2, description: "System and custom journal strategies" },
  "Strategy Lab": { icon: FlaskConical, description: "CVD bounce backtester" },
  Utilities: { icon: Calculator, description: "Risk sizing and R:R tools" },
  Calendar: { icon: CalendarDays, description: "Trades, overviews, snapshots" },
};

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

function ClientMonthInput({
  value,
  onChange,
  className,
  "aria-label": ariaLabel,
}: {
  value: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  className?: string;
  "aria-label"?: string;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  return (
    <input
      type="month"
      value={value}
      onChange={onChange}
      className={className}
      aria-label={ariaLabel}
      autoComplete="off"
      data-1p-ignore="true"
      data-form-type="other"
      data-lpignore="true"
      name="calendar-month"
    />
  );
}

type JournalSection = "trades" | "daily-overview";

export type TradingDashboardProps = {
  personalTrades: Trade[];
  personalDailyOverviews: DailyOverview[];
  canUsePersonalJournal: boolean;
  userId: string;
  userEmail: string;
  initialView?: string;
  initialTradeId?: string;
};

export function TradingDashboard({
  personalTrades,
  personalDailyOverviews,
  canUsePersonalJournal,
  userId,
  userEmail,
  initialView,
  initialTradeId,
}: TradingDashboardProps) {
  const router = useRouter();
  const [trades, setTrades] = useState<Trade[]>(personalTrades);
  const [activeView, setActiveView] = useState<MainView>("Dashboard");
  const [journalTab, setJournalTab] = useState<JournalTab>("List overview");
  const [journalSection, setJournalSection] = useState<JournalSection>("trades");
  const [query, setQuery] = useState("");
  const [outcomeFilter, setOutcomeFilter] = useState<OutcomeFilter>("ALL");
  const [strategyFilter, setStrategyFilter] = useState<"ALL" | string>("ALL");
  const { availableStrategies, customStrategies } = useJournalStrategies(canUsePersonalJournal);
  const strategyColorMap = useMemo(
    () => buildCustomStrategyColorMap(customStrategies),
    [customStrategies],
  );
  const journalStrategyOptions = useMemo(() => {
    const names = new Set<string>([...SYSTEM_JOURNAL_STRATEGIES, ...availableStrategies]);
    for (const trade of trades) {
      names.add(trade.strategy);
    }
    return Array.from(names).sort((left, right) => left.localeCompare(right));
  }, [availableStrategies, trades]);
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(personalTrades[0] ?? null);
  const [confetti, setConfetti] = useState(false);
  const [chartsReady, setChartsReady] = useState(false);
  const [journalEditorMode, setJournalEditorMode] = useState<"closed" | "create" | "edit">("closed");
  const [calendarMonth, setCalendarMonth] = useState(() => startOfMonth(new Date()));
  const [selectedCalendarDate, setSelectedCalendarDate] = useState(() =>
    format(new Date(), "yyyy-MM-dd"),
  );
  const [portfolioSnapshotDates, setPortfolioSnapshotDates] = useState<string[]>([]);
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [, startTransition] = useTransition();
  const isMobile = useIsMobile();

  useEffect(() => {
    try {
      setSidebarCollapsed(localStorage.getItem("traderoad-sidebar-collapsed") === "true");
    } catch {
      // ignore storage errors
    }
  }, []);

  function toggleSidebar() {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("traderoad-sidebar-collapsed", String(next));
      } catch {
        // ignore storage errors
      }
      return next;
    });
  }

  useEffect(() => {
    setTrades(personalTrades);
    setSelectedTrade((prev) => {
      if (!personalTrades.length) {
        return null;
      }
      if (!prev) {
        return personalTrades[0];
      }
      return personalTrades.find((trade) => trade.id === prev.id) ?? personalTrades[0];
    });
  }, [personalTrades]);

  useEffect(() => {
    setChartsReady(true);
  }, []);

  useEffect(() => {
    if (initialView && mainViews.includes(initialView as MainView)) {
      setActiveView(initialView as MainView);
    }
    if (!initialTradeId) {
      return;
    }
    const trade = personalTrades.find((item) => item.id === initialTradeId);
    if (!trade) {
      return;
    }
    setActiveView("Journal");
    setJournalSection("trades");
    setJournalEditorMode("closed");
    setSelectedTrade(trade);
  }, [personalTrades, initialTradeId, initialView]);

  useEffect(() => {
    if (!canUsePersonalJournal || !hasSupabaseBrowserConfig()) {
      return;
    }

    const supabase = createClient();
    const channel = supabase
      .channel(`trades:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "trades",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          router.refresh();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [canUsePersonalJournal, router, userId]);

  const stats = useMemo(() => getTradeStats(trades), [trades]);
  const dailyProfit = useMemo(() => buildDailyProfit(trades, calendarMonth), [calendarMonth, trades]);
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
  const strategyChartData = useMemo(
    () => buildStrategyChartData(trades, journalStrategyOptions, strategyColorMap),
    [journalStrategyOptions, strategyColorMap, trades],
  );
  const bestWin = stats.biggestWin ?? trades[0];
  const calendarLabel = format(calendarMonth, "MMMM yyyy");
  const calendarDays = useMemo(
    () =>
      eachDayOfInterval({
        start: calendarMonth,
        end: endOfMonth(calendarMonth),
      }),
    [calendarMonth],
  );
  const calendarOffset = getDay(calendarMonth);
  const selectedDayTrades = tradesByDate[selectedCalendarDate] ?? [];
  const overviewsByDate = useMemo(
    () => buildOverviewsByDate(personalDailyOverviews),
    [personalDailyOverviews],
  );
  const selectedDayOverview = overviewsByDate[selectedCalendarDate] ?? null;
  const maxDailyAbs = Math.max(
    1,
    ...dailyProfit.map((day) => Math.abs(day.profit)),
  );
  const strategySummary = journalStrategyOptions.map((strategy) => {
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
  }).filter((summary) => summary.trades > 0);

  function navigateToView(view: MainView) {
    setActiveView(view);
    setMobileMoreOpen(false);
  }

  useEffect(() => {
    if (!isMobile) {
      setMobileMoreOpen(false);
    }
  }, [isMobile]);

  function selectTrade(trade: Trade) {
    setSelectedTrade(trade);

    if (trade.outcome === "WIN" && trade.profitAmount >= 50) {
      setConfetti(true);
      window.setTimeout(() => setConfetti(false), 1300);
    }
  }

  const ActiveViewIcon = mainViewConfig[activeView].icon;

  return (
    <main className="min-h-screen bg-[#05070d] text-white">
      <ConfettiBurst active={confetti} />
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.18),transparent_34%),radial-gradient(circle_at_80%_0%,rgba(250,204,21,0.12),transparent_28%),linear-gradient(180deg,rgba(15,23,42,0.72),rgba(3,7,18,0.95))]" />

      <div className="relative flex min-h-screen">
        {/* Desktop sidebar */}
        <aside
          className={cn(
            "sticky top-0 hidden h-screen shrink-0 flex-col border-r border-white/10 bg-black/20 backdrop-blur-xl transition-[width] duration-300 ease-out lg:flex",
            sidebarCollapsed ? "w-[4.75rem]" : "w-72 xl:w-80",
          )}
        >
          <div
            className={cn(
              "border-b border-white/10",
              sidebarCollapsed ? "flex flex-col items-center px-3 py-6" : "px-7 py-8",
            )}
          >
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.32em] text-cyan-200/80">
              <Sparkles className="h-3.5 w-3.5 shrink-0" />
              {!sidebarCollapsed ? "Trade Road" : null}
            </div>
            {!sidebarCollapsed ? (
              <>
                <h1 className="mt-3 text-2xl font-black tracking-tight text-white">Trading Journal</h1>
                <p className="mt-2 text-sm leading-relaxed text-zinc-500">
                  Clean entries, protected streaks, scoreable feedback.
                </p>
              </>
            ) : (
              <span className="sr-only">Trading Journal</span>
            )}
          </div>

          <nav
            aria-label="Main navigation"
            className={cn(
              "flex-1 space-y-8 overflow-y-auto py-8",
              sidebarCollapsed ? "px-2" : "px-5",
            )}
          >
            <div className="space-y-1.5">
              {!sidebarCollapsed ? (
                <p className="px-3 text-[10px] font-black uppercase tracking-[0.24em] text-zinc-600">
                  Workspace
                </p>
              ) : null}
              {mainViews.map((view) => {
                const Icon = mainViewConfig[view].icon;
                const isActive = activeView === view;
                return (
                  <button
                    key={view}
                    type="button"
                    title={sidebarCollapsed ? view : undefined}
                    onClick={() => navigateToView(view)}
                    className={cn(
                      "flex w-full items-center rounded-2xl text-left text-sm font-semibold transition-all duration-200",
                      sidebarCollapsed
                        ? "justify-center px-0 py-3.5"
                        : "gap-3 px-4 py-3.5",
                      isActive
                        ? "bg-cyan-300 text-slate-950 shadow-[0_0_24px_rgba(34,211,238,0.28)]"
                        : "text-zinc-400 hover:bg-white/[0.06] hover:text-white",
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {!sidebarCollapsed ? view : <span className="sr-only">{view}</span>}
                  </button>
                );
              })}
            </div>

            <div className="space-y-3">
              {!sidebarCollapsed ? (
                <p className="px-3 text-[10px] font-black uppercase tracking-[0.24em] text-zinc-600">
                  Tools
                </p>
              ) : null}
              <div className="space-y-2">
                {toolLinks.map((tool) => {
                  const ToolIcon = tool.icon;
                  return (
                  <Link
                    key={tool.href}
                    href={tool.href}
                    title={sidebarCollapsed ? tool.title : undefined}
                    className={cn(
                      "group flex items-center rounded-2xl border border-white/10 bg-white/[0.03] transition hover:border-cyan-300/40 hover:bg-cyan-300/[0.07]",
                      sidebarCollapsed
                        ? "justify-center px-0 py-3.5"
                        : "justify-between gap-3 px-4 py-3.5",
                    )}
                  >
                    {sidebarCollapsed ? (
                      <ToolIcon className="h-4 w-4 shrink-0 text-cyan-200/80" />
                    ) : (
                      <>
                        <div className="min-w-0">
                          <div className="text-sm font-bold text-white">{tool.title}</div>
                          <div className="mt-0.5 truncate text-xs text-zinc-500">{tool.description}</div>
                        </div>
                        <ArrowUpRight className="h-4 w-4 shrink-0 text-cyan-200/70 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                      </>
                    )}
                    {sidebarCollapsed ? <span className="sr-only">{tool.title}</span> : null}
                  </Link>
                  );
                })}
              </div>
            </div>
          </nav>

          <div className="border-t border-white/10 p-3">
            <button
              type="button"
              onClick={toggleSidebar}
              aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              className={cn(
                "flex w-full items-center rounded-2xl border border-white/10 bg-white/[0.04] text-zinc-400 transition hover:bg-white/[0.08] hover:text-white",
                sidebarCollapsed ? "justify-center px-0 py-3" : "gap-3 px-4 py-3",
              )}
            >
              {sidebarCollapsed ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <>
                  <ChevronLeft className="h-4 w-4 shrink-0" />
                  <span className="text-sm font-semibold">Collapse</span>
                </>
              )}
            </button>
          </div>
        </aside>

        {/* Mobile more sheet (secondary views + tools + account) */}
        <MobileMoreSheet
          open={mobileMoreOpen}
          onClose={() => setMobileMoreOpen(false)}
          activeView={activeView}
          moreViews={[
            {
              id: "Strategy Settings",
              label: "Strategy Settings",
              description: mainViewConfig["Strategy Settings"].description,
              icon: mainViewConfig["Strategy Settings"].icon,
            },
            {
              id: "Strategy Lab",
              label: "Strategy Lab",
              description: mainViewConfig["Strategy Lab"].description,
              icon: mainViewConfig["Strategy Lab"].icon,
            },
            {
              id: "Utilities",
              label: "Utilities",
              description: mainViewConfig.Utilities.description,
              icon: mainViewConfig.Utilities.icon,
            },
            {
              id: "Calendar",
              label: "Calendar",
              description: mainViewConfig.Calendar.description,
              icon: mainViewConfig.Calendar.icon,
            },
          ]}
          toolLinks={toolLinks}
          userEmail={userEmail}
          tradeCount={personalTrades.length}
          onNavigate={(view) => navigateToView(view as MainView)}
        />

        <MobileBottomNav
          activeView={activeView}
          viewIcons={{
            Dashboard: mainViewConfig.Dashboard.icon,
            Journal: mainViewConfig.Journal.icon,
            Portfolio: mainViewConfig.Portfolio.icon,
            Charts: mainViewConfig.Charts.icon,
          }}
          onNavigate={(view: MobilePrimaryView) => navigateToView(view)}
          onOpenMore={() => setMobileMoreOpen(true)}
          moreActive={mobileMoreOpen}
        />

        {/* Main content */}
        <div className="flex min-w-0 flex-1 flex-col">
          <header
            className="sticky top-0 z-30 border-b border-white/10 bg-[#05070d]/80 px-4 py-3 backdrop-blur-xl sm:px-6 lg:px-10 lg:py-7"
            style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}
          >
            {/* Mobile compact header */}
            <div className="flex items-center justify-between gap-3 lg:hidden">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.24em] text-cyan-200/70">
                  <ActiveViewIcon className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">Trade Road</span>
                </div>
                <h2 className="mt-1 truncate text-xl font-black tracking-tight text-white">
                  {activeView}
                </h2>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Badge tone="blue">{personalTrades.length}</Badge>
                <Button
                  type="button"
                  aria-label="Open more menu"
                  onClick={() => setMobileMoreOpen(true)}
                  className="min-h-11 min-w-11 bg-white/[0.05] px-0 text-zinc-100"
                >
                  <MoreHorizontal className="h-5 w-5" />
                </Button>
              </div>
            </div>

            {/* Desktop header */}
            <div className="hidden flex-col gap-5 lg:flex lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-start gap-4">
                <button
                  type="button"
                  aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                  onClick={toggleSidebar}
                  className="mt-0.5 hidden rounded-2xl border border-white/10 p-2.5 text-zinc-400 transition hover:bg-white/10 hover:text-white lg:inline-flex"
                >
                  {sidebarCollapsed ? (
                    <ChevronRight className="h-5 w-5" />
                  ) : (
                    <ChevronLeft className="h-5 w-5" />
                  )}
                </button>
                <div>
                  <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.24em] text-cyan-200/70">
                    <ActiveViewIcon className="h-3.5 w-3.5" />
                    {activeView}
                  </div>
                  <h2 className="mt-2 text-2xl font-black tracking-tight text-white sm:text-3xl">
                    {activeView}
                  </h2>
                  <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-zinc-500">
                    {mainViewConfig[activeView].description}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 lg:justify-end">
                <div className="hidden items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2 md:flex">
                  <span className="max-w-[160px] truncate text-xs font-semibold text-zinc-300">
                    {userEmail}
                  </span>
                  <Badge tone="blue">{personalTrades.length} trades</Badge>
                </div>

                <Button
                  type="button"
                  disabled={!canUsePersonalJournal || !personalTrades.length}
                  onClick={() => {
                    startTransition(async () => {
                      const csv = await buildTradesCsv();
                      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
                      const url = URL.createObjectURL(blob);
                      const anchor = document.createElement("a");
                      anchor.href = url;
                      anchor.download = "traderoad-trades.csv";
                      anchor.click();
                      URL.revokeObjectURL(url);
                    });
                  }}
                  className="bg-white/5 text-xs text-zinc-100"
                >
                  Export CSV
                </Button>
                <form action={signOut}>
                  <Button
                    type="submit"
                    className="bg-rose-500/10 text-xs text-rose-100 hover:bg-rose-500/20"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Sign out</span>
                  </Button>
                </form>

                <div className="relative">
                  <Button
                    type="button"
                    onClick={() => setActiveView("Calendar")}
                    className="bg-white/[0.05] text-zinc-100"
                  >
                    <CalendarDays className="h-4 w-4" />
                    {calendarLabel}
                    <ChevronDown className="h-4 w-4 opacity-60" />
                  </Button>
                  <ClientMonthInput
                    value={format(calendarMonth, "yyyy-MM")}
                    onChange={(event) => {
                      const [year, month] = event.target.value.split("-").map(Number);
                      if (!year || !month) {
                        return;
                      }
                      const nextMonth = startOfMonth(new Date(year, month - 1, 1));
                      setCalendarMonth(nextMonth);
                      setSelectedCalendarDate(format(nextMonth, "yyyy-MM-dd"));
                      setActiveView("Calendar");
                    }}
                    className="absolute inset-0 cursor-pointer opacity-0"
                    aria-label="Select calendar month"
                  />
                </div>
                <Button
                  type="button"
                  disabled={!bestWin}
                  onClick={() => {
                    if (!bestWin) {
                      return;
                    }
                    setActiveView("Charts");
                    selectTrade(bestWin);
                  }}
                  className="bg-gradient-to-r from-yellow-400 to-amber-500 text-black hover:from-yellow-300 hover:to-amber-400 disabled:opacity-40"
                >
                  <Trophy className="h-4 w-4" />
                  Best win
                </Button>
              </div>
            </div>

          </header>

          <div className="mobile-content-pad flex-1 space-y-6 px-4 py-5 sm:px-6 sm:py-8 lg:space-y-12 lg:px-10 lg:py-12">
            {activeView === "Dashboard" && (
              <DashboardView
                bestWin={bestWin}
                calendarLabel={calendarLabel}
                chartsReady={chartsReady}
                dailyProfit={dailyProfit}
                maxDailyAbs={maxDailyAbs}
                setActiveView={setActiveView}
                stats={stats}
                strategyChartData={strategyChartData}
              />
            )}

            {activeView === "Strategy Settings" && (
              <StrategySettingsPanel canUsePersonalJournal={canUsePersonalJournal} />
            )}

            {activeView === "Journal" && (
              <JournalView
                canUsePersonalJournal={canUsePersonalJournal}
                chartsReady={chartsReady}
                filteredTrades={filteredTrades}
                journalEditorMode={journalEditorMode}
                journalSection={journalSection}
                journalStrategyOptions={journalStrategyOptions}
                journalTab={journalTab}
                outcomeFilter={outcomeFilter}
                personalDailyOverviews={personalDailyOverviews}
                personalTrades={personalTrades}
                query={query}
                selectedCalendarDate={selectedCalendarDate}
                selectedTrade={selectedTrade}
                setJournalEditorMode={setJournalEditorMode}
                setJournalSection={setJournalSection}
                setJournalTab={setJournalTab}
                setSelectedCalendarDate={setSelectedCalendarDate}
                setOutcomeFilter={setOutcomeFilter}
                setQuery={setQuery}
                setStrategyFilter={setStrategyFilter}
                stats={stats}
                strategyFilter={strategyFilter}
                strategySummary={strategySummary}
                trades={trades}
                onJournalDeleted={() => {
                  setJournalEditorMode("closed");
                  setSelectedTrade(null);
                  router.refresh();
                }}
                onJournalSaved={(trade) => {
                  setJournalEditorMode("closed");
                  selectTrade(trade);
                  router.refresh();
                }}
                onSelectTrade={selectTrade}
                onDailyOverviewSaved={() => router.refresh()}
              />
            )}

            {activeView === "Portfolio" && (
              <LSPortfolioDashboard
                selectedDate={selectedCalendarDate}
                onDateChange={setSelectedCalendarDate}
                canUsePersonalJournal={canUsePersonalJournal}
                onSnapshotDatesChange={setPortfolioSnapshotDates}
              />
            )}

            {activeView === "Charts" && <MarketChartsView chartsReady={chartsReady} />}

            {activeView === "Strategy Lab" && <OrderFlowBacktester />}

            {activeView === "Utilities" && (
              <RiskCalculatorUtility
                canUsePersonalJournal={canUsePersonalJournal}
                onTradeCreated={(trade) => {
                  selectTrade(trade);
                  setActiveView("Journal");
                  setJournalSection("trades");
                  setJournalEditorMode("closed");
                  router.refresh();
                }}
              />
            )}

            {activeView === "Calendar" && (
              <CalendarView
                calendarDays={calendarDays}
                calendarLabel={calendarLabel}
                calendarMonth={calendarMonth}
                calendarOffset={calendarOffset}
                canUsePersonalJournal={canUsePersonalJournal}
                overviewsByDate={overviewsByDate}
                portfolioSnapshotDates={portfolioSnapshotDates}
                selectedCalendarDate={selectedCalendarDate}
                selectedDayOverview={selectedDayOverview}
                selectedDayTrades={selectedDayTrades}
                setCalendarMonth={setCalendarMonth}
                setSelectedCalendarDate={setSelectedCalendarDate}
                tradeCount={trades.length}
                tradesByDate={tradesByDate}
                onOpenDailyOverview={() => {
                  setJournalSection("daily-overview");
                  setActiveView("Journal");
                }}
                onOpenPortfolioSnapshot={() => setActiveView("Portfolio")}
                onSelectTrade={(trade) => {
                  selectTrade(trade);
                  setJournalSection("trades");
                  setActiveView("Journal");
                }}
              />
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

function DashboardView({
  bestWin,
  calendarLabel,
  chartsReady,
  dailyProfit,
  maxDailyAbs,
  setActiveView,
  stats,
  strategyChartData,
}: {
  bestWin: Trade | undefined;
  calendarLabel: string;
  chartsReady: boolean;
  dailyProfit: ReturnType<typeof buildDailyProfit>;
  maxDailyAbs: number;
  setActiveView: (view: MainView) => void;
  stats: ReturnType<typeof getTradeStats>;
  strategyChartData: { name: string; profit: number; fill: string }[];
}) {
  const metricCards = [
    {
      title: "Total Profit",
      value: `$${moneyFormatter.format(stats.totalProfit)}`,
      helper: `${calendarLabel} bankroll boost`,
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
    <section className="space-y-6 lg:space-y-12">
      {/* KPI strip */}
      <div className="space-y-3 lg:space-y-5">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-zinc-600">
            Overview
          </p>
          <h3 className="mt-1.5 text-base font-bold text-zinc-200 lg:mt-2 lg:text-lg">
            {calendarLabel} snapshot
          </h3>
        </div>
        <div className="grid grid-cols-2 gap-3 lg:gap-5 xl:grid-cols-4">
          {metricCards.map((metric) => (
            <Card
              key={metric.title}
              className={cn(
                "overflow-hidden bg-gradient-to-br transition duration-200 hover:border-cyan-300/30",
                metric.tone,
              )}
            >
              <CardContent className="relative p-4 lg:p-7">
                <div className="absolute right-3 top-3 rounded-xl border border-white/10 bg-black/25 p-2 text-cyan-100 lg:right-5 lg:top-5 lg:rounded-2xl lg:p-3">
                  <metric.icon className="h-4 w-4 lg:h-5 lg:w-5" />
                </div>
                <div className="pr-10 text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500 lg:text-xs lg:tracking-[0.2em]">
                  {metric.title}
                </div>
                <div className="mt-3 flex items-end gap-1.5 lg:mt-6 lg:gap-2">
                  <span className="text-2xl font-black tracking-tight lg:text-4xl">
                    {metric.value}
                  </span>
                  {metric.title === "Total Profit" && (
                    <span className="pb-1 text-emerald-300 lg:pb-1.5">▲</span>
                  )}
                </div>
                <p className="mt-2 text-xs leading-relaxed text-zinc-500 lg:mt-3 lg:text-sm">
                  {metric.helper}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Primary chart — daily P&L */}
      <div className="space-y-3 lg:space-y-5">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-zinc-600">
            Daily performance
          </p>
          <h3 className="mt-1.5 text-base font-bold text-zinc-200 lg:mt-2 lg:text-lg">
            Profit per day
          </h3>
        </div>
        <Card className="overflow-hidden">
          <CardHeader className="px-4 pt-4 lg:px-7 lg:pt-7">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs leading-relaxed text-zinc-500 lg:text-sm">
                Daily profit for {calendarLabel}.
              </p>
              <Badge tone="gold">{dailyProfit.length} days</Badge>
            </div>
          </CardHeader>
          <CardContent className="px-3 pb-5 lg:px-7 lg:pb-8">
            <div className="h-[min(360px,50vh)] min-h-56 lg:h-[min(520px,60vh)] lg:min-h-72">
              {chartsReady ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={dailyProfit}
                    layout="vertical"
                    margin={{ bottom: 8, left: 0, right: 12, top: 8 }}
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
                      width={44}
                      tick={{ fill: "#a1a1aa", fontSize: 11 }}
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

      {/* Secondary insights */}
      <div className="space-y-3 lg:space-y-5">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-zinc-600">
            Strategy breakdown
          </p>
          <h3 className="mt-1.5 text-base font-bold text-zinc-200 lg:mt-2 lg:text-lg">
            Where edge comes from
          </h3>
        </div>
        <div className="grid gap-5 xl:grid-cols-[1fr_1.1fr] xl:gap-8">
          <Card className="overflow-hidden">
            <CardHeader className="px-4 pt-4 lg:px-7 lg:pt-7">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle>Win by strategy</CardTitle>
                  <p className="mt-1.5 text-xs leading-relaxed text-zinc-500 lg:mt-2 lg:text-sm">
                    Setups ranked by captured profit.
                  </p>
                </div>
                <Badge tone="blue">Chart</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 px-4 pb-5 lg:space-y-6 lg:px-7 lg:pb-8">
              <div className="h-56 lg:h-72">
                {chartsReady ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={strategyChartData} margin={{ left: -24, right: 12, top: 12 }}>
                      <CartesianGrid stroke="rgba(255,255,255,0.07)" vertical={false} />
                      <XAxis dataKey="name" tick={{ fill: "#a1a1aa", fontSize: 12 }} tickLine={false} />
                      <YAxis tick={{ fill: "#71717a", fontSize: 12 }} tickLine={false} axisLine={false} />
                      <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
                      <Bar dataKey="profit" radius={[16, 16, 6, 6]} barSize={48}>
                        {strategyChartData.map((entry) => (
                          <Cell key={entry.name} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <ChartPlaceholder label="Loading strategy chart" />
                )}
              </div>
              <div className="grid gap-2 lg:gap-3">
                {strategyChartData.map((strategy) => (
                  <div
                    key={strategy.name}
                    className="flex items-center justify-between rounded-2xl bg-white/[0.04] px-4 py-3 lg:px-5 lg:py-4"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: strategy.fill }} />
                      <span className="truncate font-semibold">{strategy.name}</span>
                    </div>
                    <span className="shrink-0 font-black text-white">${strategy.profit}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="overflow-hidden border-emerald-300/20 bg-gradient-to-br from-emerald-400/10 via-cyan-400/[0.06] to-transparent">
            <CardContent className="flex h-full flex-col justify-between gap-6 p-5 lg:gap-8 lg:p-8">
              <div>
                <Badge tone="win">Monthly summary</Badge>
                <h2 className="mt-4 text-3xl font-black tracking-tight lg:mt-6 lg:text-4xl">
                  ${moneyFormatter.format(stats.totalProfit)}
                </h2>
                <p className="mt-3 max-w-md text-sm leading-relaxed text-zinc-400 lg:mt-4">
                  {bestWin ? (
                    <>
                      Best trade: {bestWin.pair} on {format(parseISO(bestWin.date), "MMM d")} for{" "}
                      {formatMoney(bestWin.profitAmount)}. Keep farming the clean A+ setups.
                    </>
                  ) : (
                    <>
                      You have 0 trades so far — that&apos;s fine. Head to Journal to log your first
                      entry and start building your record.
                    </>
                  )}
                </p>
              </div>
              <Button
                onClick={() => setActiveView("Journal")}
                className="min-h-11 w-full bg-white text-slate-950 hover:bg-cyan-100 sm:w-auto"
              >
                <ListFilter className="h-4 w-4" />
                {bestWin ? "Open journal" : "Go to Journal"}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}

function JournalView({
  canUsePersonalJournal,
  chartsReady,
  filteredTrades,
  journalEditorMode,
  journalSection,
  journalStrategyOptions,
  journalTab,
  outcomeFilter,
  personalDailyOverviews,
  personalTrades,
  query,
  selectedCalendarDate,
  selectedTrade,
  setJournalEditorMode,
  setJournalSection,
  setJournalTab,
  setSelectedCalendarDate,
  setOutcomeFilter,
  setQuery,
  setStrategyFilter,
  stats,
  strategyFilter,
  strategySummary,
  trades,
  onJournalDeleted,
  onJournalSaved,
  onSelectTrade,
  onDailyOverviewSaved,
}: {
  canUsePersonalJournal: boolean;
  chartsReady: boolean;
  filteredTrades: Trade[];
  journalEditorMode: "closed" | "create" | "edit";
  journalSection: JournalSection;
  journalStrategyOptions: string[];
  journalTab: JournalTab;
  outcomeFilter: OutcomeFilter;
  personalDailyOverviews: DailyOverview[];
  personalTrades: Trade[];
  query: string;
  selectedCalendarDate: string;
  selectedTrade: Trade | null;
  setJournalEditorMode: (mode: "closed" | "create" | "edit") => void;
  setJournalSection: (section: JournalSection) => void;
  setJournalTab: (tab: JournalTab) => void;
  setSelectedCalendarDate: (date: string) => void;
  setOutcomeFilter: (filter: OutcomeFilter) => void;
  setQuery: (query: string) => void;
  setStrategyFilter: (filter: "ALL" | string) => void;
  stats: ReturnType<typeof getTradeStats>;
  strategyFilter: "ALL" | string;
  strategySummary: {
    strategy: string;
    trades: number;
    wins: number;
    winRate: number;
    total: number;
  }[];
  trades: Trade[];
  onJournalDeleted: () => void;
  onJournalSaved: (trade: Trade) => void;
  onSelectTrade: (trade: Trade) => void;
  onDailyOverviewSaved: () => void;
}) {
  const [pdfSelectedIds, setPdfSelectedIds] = useState<Set<string>>(new Set());
  const [pdfExportMessage, setPdfExportMessage] = useState<string | null>(null);

  const pdfSelectedTrades = useMemo(
    () =>
      filteredTrades.filter((trade) => pdfSelectedIds.has(trade.id)).slice(0, MAX_PDF_EXPORT_TRADES),
    [filteredTrades, pdfSelectedIds],
  );

  const togglePdfSelection = (tradeId: string) => {
    setPdfExportMessage(null);
    setPdfSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(tradeId)) {
        next.delete(tradeId);
        return next;
      }
      if (next.size >= MAX_PDF_EXPORT_TRADES) {
        setPdfExportMessage(`You can export up to ${MAX_PDF_EXPORT_TRADES} trade journals at once.`);
        return current;
      }
      next.add(tradeId);
      return next;
    });
  };

  const clearPdfSelection = () => {
    setPdfExportMessage(null);
    setPdfSelectedIds(new Set());
  };

  if (journalSection === "daily-overview") {
    return (
      <section className="space-y-5 lg:space-y-8">
        <div className="grid grid-cols-2 gap-2 lg:flex lg:flex-wrap lg:gap-3">
          {(
            [
              { id: "trades" as const, label: "Trades" },
              { id: "daily-overview" as const, label: "Daily Overview" },
            ] as const
          ).map((section) => (
            <button
              key={section.id}
              type="button"
              onClick={() => setJournalSection(section.id)}
              className={cn(
                "min-h-11 rounded-2xl border border-white/10 px-3 py-2.5 text-sm font-bold text-zinc-400 transition active:bg-white/10 hover:bg-white/10 hover:text-white lg:rounded-full lg:px-4",
                journalSection === section.id && "border-cyan-300/50 bg-cyan-300/15 text-cyan-100",
              )}
            >
              {section.label}
            </button>
          ))}
        </div>
        <DailyOverviewPanel
          canUsePersonalJournal={canUsePersonalJournal}
          dailyOverviews={personalDailyOverviews}
          initialDate={selectedCalendarDate}
          personalTrades={personalTrades}
          onDateChange={setSelectedCalendarDate}
          onSaved={onDailyOverviewSaved}
        />
      </section>
    );
  }

  return (
    <section className="space-y-5 lg:space-y-8">
      <div className="grid grid-cols-2 gap-2 lg:flex lg:flex-wrap lg:gap-3">
        {(
          [
            { id: "trades" as const, label: "Trades" },
            { id: "daily-overview" as const, label: "Daily Overview" },
          ] as const
        ).map((section) => (
          <button
            key={section.id}
            type="button"
            onClick={() => setJournalSection(section.id)}
            className={cn(
              "min-h-11 rounded-2xl border border-white/10 px-3 py-2.5 text-sm font-bold text-zinc-400 transition active:bg-white/10 hover:bg-white/10 hover:text-white lg:rounded-full lg:px-4",
              journalSection === section.id && "border-cyan-300/50 bg-cyan-300/15 text-cyan-100",
            )}
          >
            {section.label}
          </button>
        ))}
      </div>
      <div className="grid gap-5 lg:grid-cols-2 lg:items-stretch lg:gap-6 lg:h-[calc(100dvh-13.5rem)]">
      <Card className="flex min-h-0 flex-col overflow-hidden lg:max-h-full">
        <CardHeader className="shrink-0 space-y-4 px-4 pt-4 lg:px-6 lg:pt-6">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-3">
              <div>
                <CardTitle>Trade List / Journal</CardTitle>
                <p className="mt-1 text-sm text-zinc-400">
                  Search, filter, and tap a trade to inspect.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  disabled={!canUsePersonalJournal}
                  onClick={() => setJournalEditorMode("create")}
                  className="min-h-11 flex-1 bg-cyan-300 text-slate-950 hover:bg-cyan-200 disabled:opacity-40 sm:flex-none"
                >
                  Create journal
                </Button>
                {selectedTrade && canUsePersonalJournal ? (
                  <Button
                    type="button"
                    onClick={() => setJournalEditorMode("edit")}
                    className="min-h-11 bg-white/5 text-zinc-100"
                  >
                    Edit selected
                  </Button>
                ) : null}
                {pdfSelectedTrades.length > 0 ? (
                  <JournalPdfExportButton
                    trades={pdfSelectedTrades}
                    onError={setPdfExportMessage}
                  />
                ) : null}
                {pdfSelectedIds.size > 0 ? (
                  <Button
                    type="button"
                    onClick={clearPdfSelection}
                    className="min-h-11 bg-white/5 text-xs text-zinc-300"
                  >
                    Clear ({pdfSelectedIds.size})
                  </Button>
                ) : null}
              </div>
            </div>
            <div className="grid gap-2">
              <label className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  className="min-h-11 pl-9"
                  placeholder="Search pair..."
                />
              </label>
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={outcomeFilter}
                  onChange={(event) => setOutcomeFilter(event.target.value as OutcomeFilter)}
                  className="min-h-11 rounded-2xl border border-white/10 bg-zinc-950 px-3 text-sm font-semibold text-white outline-none focus:border-cyan-300/60"
                >
                  <option value="ALL">All outcomes</option>
                  <option value="WIN">Wins</option>
                  <option value="LOSS">Losses</option>
                </select>
                <select
                  value={strategyFilter}
                  onChange={(event) => setStrategyFilter(event.target.value)}
                  className="min-h-11 rounded-2xl border border-white/10 bg-zinc-950 px-3 text-sm font-semibold text-white outline-none focus:border-cyan-300/60"
                >
                  <option value="ALL">All strategies</option>
                  {journalStrategyOptions.map((strategy) => (
                    <option key={strategy} value={strategy}>
                      {strategy}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {journalTabs.map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setJournalTab(tab)}
                className={cn(
                  "min-h-10 shrink-0 rounded-full border border-white/10 px-4 py-2 text-sm font-bold text-zinc-400 transition hover:bg-white/10 hover:text-white",
                  journalTab === tab && "border-cyan-300/50 bg-cyan-300/15 text-cyan-100",
                )}
              >
                {tab}
              </button>
            ))}
          </div>
          {journalTab === "List overview" ? (
            <p className="text-xs text-zinc-500">
              Select up to {MAX_PDF_EXPORT_TRADES} trades to export a combined PDF.
            </p>
          ) : null}
          {pdfExportMessage ? <p className="text-xs text-amber-200">{pdfExportMessage}</p> : null}
        </CardHeader>
        <CardContent className="min-h-0 flex-1 overflow-y-auto px-3 pb-4 lg:px-6 lg:pb-6">
          {journalTab === "List overview" && (
            <div className="overflow-hidden rounded-3xl border border-white/10">
              {filteredTrades.length === 0 ? (
                <div className="space-y-3 px-5 py-10 text-center">
                  <p className="text-2xl font-black text-white">0 trades</p>
                  <p className="mx-auto max-w-sm text-sm leading-relaxed text-zinc-400">
                    {trades.length === 0
                      ? "Nothing logged yet. Tap Create journal above to record your first trade — pair, outcome, and a short note is enough to start."
                      : "No trades match your current filters. Clear search or filters to see your list again."}
                  </p>
                  {trades.length === 0 && canUsePersonalJournal ? (
                    <Button
                      type="button"
                      onClick={() => setJournalEditorMode("create")}
                      className="mt-1 bg-cyan-300 text-slate-950 hover:bg-cyan-200"
                    >
                      Create your first entry
                    </Button>
                  ) : null}
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-[auto_1.2fr_0.8fr_0.9fr_0.8fr_0.9fr] bg-white/[0.06] px-4 py-3 text-xs font-bold uppercase tracking-[0.18em] text-zinc-500 max-lg:hidden">
                    <span className="sr-only">Export</span>
                    <span>Pair</span>
                    <span>Outcome</span>
                    <span>Date</span>
                    <span>Profit %</span>
                    <span>Strategy</span>
                  </div>
                  <div className="divide-y divide-white/10">
                    {filteredTrades.map((trade) => {
                      const isPdfSelected = pdfSelectedIds.has(trade.id);
                      const pdfSelectionDisabled =
                        !isPdfSelected && pdfSelectedIds.size >= MAX_PDF_EXPORT_TRADES;

                      return (
                        <div
                          key={trade.id}
                          className={cn(
                            "grid w-full gap-3 px-3 py-3.5 transition hover:bg-cyan-300/10 lg:grid-cols-[auto_1.2fr_0.8fr_0.9fr_0.8fr_0.9fr] lg:items-center lg:px-4 lg:py-4",
                            selectedTrade?.id === trade.id && "bg-cyan-300/10",
                          )}
                        >
                          <label className="flex min-h-11 min-w-11 items-center justify-center lg:min-h-0 lg:min-w-0">
                            <input
                              type="checkbox"
                              checked={isPdfSelected}
                              disabled={pdfSelectionDisabled}
                              onChange={() => togglePdfSelection(trade.id)}
                              className="h-5 w-5 rounded border-white/20 bg-zinc-950 text-cyan-300 focus:ring-cyan-300/40 lg:h-4 lg:w-4"
                              aria-label={`Select ${trade.pair} for PDF export`}
                            />
                          </label>
                          <button
                            type="button"
                            onClick={() => onSelectTrade(trade)}
                            className="grid w-full gap-2 text-left touch-manipulation lg:col-span-5 lg:grid-cols-[1.2fr_0.8fr_0.9fr_0.8fr_0.9fr] lg:items-center lg:gap-3"
                          >
                            {/* Mobile card row */}
                            <div className="flex items-start justify-between gap-3 lg:contents">
                              <div className="min-w-0">
                                <div className="font-black text-white">{trade.pair}</div>
                                <div className="text-xs font-semibold text-zinc-500">
                                  {trade.position}
                                </div>
                                <div className="mt-1 text-xs text-zinc-400 lg:hidden">
                                  {format(parseISO(trade.date), "MMM d, yyyy")} · {trade.strategy}
                                </div>
                              </div>
                              <div className="flex shrink-0 flex-col items-end gap-1.5 lg:contents">
                                <Badge tone={trade.outcome === "WIN" ? "win" : "loss"}>
                                  {trade.outcome}
                                </Badge>
                                <span className="hidden text-sm text-zinc-300 lg:inline">
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
                                <span className="hidden text-sm font-semibold text-cyan-100 lg:inline">
                                  {trade.strategy}
                                </span>
                              </div>
                            </div>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
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
                <div key={summary.strategy} className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 lg:p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="text-lg font-black lg:text-xl">{summary.strategy}</div>
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

      <div className="min-h-0 overflow-y-auto lg:max-h-full lg:pr-1">
      {journalEditorMode === "closed" ? (
        selectedTrade ? (
          <TradeDetail
            chartsReady={chartsReady}
            canEdit={canUsePersonalJournal}
            trade={selectedTrade}
            onEdit={() => setJournalEditorMode("edit")}
          />
        ) : (
          <Card className="overflow-hidden border-cyan-300/20">
            <CardContent className="flex h-full min-h-[220px] flex-col justify-center gap-3 p-6 text-center">
              <p className="text-2xl font-black text-white">0 trades</p>
              <p className="text-sm leading-relaxed text-zinc-400">
                Your journal is empty for now. Use Create journal to log a trade — ticker, win/loss,
                and a quick note go a long way.
              </p>
              {canUsePersonalJournal ? (
                <Button
                  type="button"
                  onClick={() => setJournalEditorMode("create")}
                  className="mx-auto mt-1 bg-cyan-300 text-slate-950 hover:bg-cyan-200"
                >
                  Create journal
                </Button>
              ) : null}
            </CardContent>
          </Card>
        )
      ) : (
        <JournalEntryForm
          mode={journalEditorMode}
          trade={journalEditorMode === "edit" ? selectedTrade : null}
          canUsePersonalJournal={canUsePersonalJournal}
          onCancel={() => setJournalEditorMode("closed")}
          onDeleted={onJournalDeleted}
          onSaved={onJournalSaved}
        />
      )}
      </div>
      </div>
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

function TradeDetail({
  chartsReady,
  canEdit,
  trade,
  onEdit,
}: {
  chartsReady: boolean;
  canEdit: boolean;
  trade: Trade | null;
  onEdit: () => void;
}) {
  if (!trade) {
    return (
      <Card className="sticky top-4 h-fit overflow-hidden border-cyan-300/20 lg:static lg:h-auto">
        <CardHeader>
          <CardTitle>No trade selected</CardTitle>
          <p className="mt-1 text-sm text-zinc-400">Pick a row from the journal list to inspect a setup.</p>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="sticky top-4 h-fit overflow-hidden border-cyan-300/20 lg:static lg:h-auto">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle>{trade.pair}</CardTitle>
            <p className="mt-1 text-sm text-zinc-400">
              {format(parseISO(trade.date), "EEEE, MMM d")} · {trade.position} ·{" "}
              {trade.species ?? "Stocks"}
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <Badge tone={trade.outcome === "WIN" ? "win" : "loss"}>{trade.outcome}</Badge>
            <div className="flex flex-wrap justify-end gap-2">
              <JournalPdfExportButton trades={[trade]} label="Export PDF" />
              {canEdit ? (
                <Button type="button" onClick={onEdit} className="bg-white/5 text-zinc-100">
                  Edit
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
          <div className="text-xs font-bold uppercase tracking-[0.18em] text-zinc-500">Strategy</div>
          <div className="mt-1 text-sm font-semibold text-cyan-100">{trade.strategy}</div>
        </div>

        {trade.entryPoint != null ||
        trade.stopLoss != null ||
        trade.takeProfit != null ||
        trade.riskRewardRatio != null ? (
          <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
              <div className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500">EP</div>
              <div className="mt-1 font-mono text-sm font-black text-sky-200">
                {trade.entryPoint != null ? trade.entryPoint : "—"}
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
              <div className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500">SL</div>
              <div className="mt-1 font-mono text-sm font-black text-rose-200">
                {trade.stopLoss != null ? trade.stopLoss : "—"}
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
              <div className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500">TP</div>
              <div className="mt-1 font-mono text-sm font-black text-emerald-200">
                {trade.takeProfit != null ? trade.takeProfit : "—"}
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
              <div className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500">RR</div>
              <div className="mt-1 font-mono text-sm font-black text-cyan-100">
                {trade.riskRewardRatio != null ? `${trade.riskRewardRatio}R` : "—"}
              </div>
            </div>
          </div>
        ) : null}

        {(trade.levelPushes?.length ?? 0) > 0 ? (
          <div className="mt-4 grid gap-2">
            <div className="text-xs font-bold uppercase tracking-[0.18em] text-zinc-500">
              SL / TP push history
            </div>
            <div className="grid gap-2">
              {trade.levelPushes?.map((push) => (
                <div
                  key={push.id}
                  className="rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-sm"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Badge tone={push.levelType === "SL" ? "loss" : "win"}>{push.levelType}</Badge>
                    <span className="font-mono font-black text-white">{push.price}</span>
                  </div>
                  <div className="mt-1 text-xs text-zinc-500">
                    {format(parseISO(push.pushedAt), "MMM d, yyyy HH:mm")}
                  </div>
                  {push.note ? <div className="mt-1 text-xs text-zinc-400">{push.note}</div> : null}
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {(trade.screenshots?.length ?? 0) > 0 ? (
          <div className="mt-4 grid gap-2">
            <div className="text-xs font-bold uppercase tracking-[0.18em] text-zinc-500">Screenshots</div>
            <ScreenshotGallery
              items={
                trade.screenshots?.map((shot) => ({
                  key: shot.url,
                  url: shot.url,
                  name: shot.name,
                })) ?? []
              }
            />
          </div>
        ) : null}

        {trade.journalHtml ? (
          <div className="mt-4 rounded-2xl border border-white/10 bg-black/25 p-4">
            <div className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-zinc-500">
              Journal
            </div>
            <div
              className="prose prose-invert max-w-none text-sm leading-relaxed text-zinc-200 prose-p:my-2 prose-ul:my-2"
              dangerouslySetInnerHTML={{ __html: trade.journalHtml }}
            />
          </div>
        ) : null}

        {trade.chartData.length > 0 ? (
        <div className="mt-4 rounded-3xl border border-white/10 bg-black/25 p-4">
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
        ) : null}
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
          {trade.journalHtml
            ? "Review your journal entry and keep refining the playbook."
            : trade.outcome === "WIN"
              ? "Great execution. Add screenshots and journal notes so this edge becomes repeatable."
              : "Small tuition paid. Document the invalidation miss and keep the loss inside the planned box."}
        </div>
      </CardContent>
    </Card>
  );
}

function CalendarView({
  calendarDays,
  calendarLabel,
  calendarMonth,
  calendarOffset,
  canUsePersonalJournal,
  overviewsByDate,
  portfolioSnapshotDates,
  selectedCalendarDate,
  selectedDayOverview,
  selectedDayTrades,
  setCalendarMonth,
  setSelectedCalendarDate,
  tradeCount,
  tradesByDate,
  onOpenDailyOverview,
  onOpenPortfolioSnapshot,
  onSelectTrade,
}: {
  calendarDays: Date[];
  calendarLabel: string;
  calendarMonth: Date;
  calendarOffset: number;
  canUsePersonalJournal: boolean;
  overviewsByDate: Record<string, DailyOverview>;
  portfolioSnapshotDates: string[];
  selectedCalendarDate: string;
  selectedDayOverview: DailyOverview | null;
  selectedDayTrades: Trade[];
  setCalendarMonth: (month: Date) => void;
  setSelectedCalendarDate: (date: string) => void;
  tradeCount: number;
  tradesByDate: Record<string, Trade[]>;
  onOpenDailyOverview: () => void;
  onOpenPortfolioSnapshot: () => void;
  onSelectTrade: (trade: Trade) => void;
}) {
  function shiftMonth(delta: number) {
    const nextMonth = delta > 0 ? addMonths(calendarMonth, 1) : subMonths(calendarMonth, 1);
    setCalendarMonth(startOfMonth(nextMonth));
    setSelectedCalendarDate(format(startOfMonth(nextMonth), "yyyy-MM-dd"));
  }

  function goToToday() {
    const today = new Date();
    setCalendarMonth(startOfMonth(today));
    setSelectedCalendarDate(format(today, "yyyy-MM-dd"));
  }

  return (
    <section className="space-y-6 lg:space-y-10">
      <Card className="overflow-hidden">
        <CardHeader className="px-4 pt-4 lg:px-6 lg:pt-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Calendar View</CardTitle>
              <p className="mt-1 text-sm text-zinc-400">
                {calendarLabel} — trades, overviews, snapshots.
              </p>
            </div>
            <div className="grid grid-cols-4 gap-2 sm:flex sm:flex-wrap sm:items-center">
              <Button
                type="button"
                onClick={() => shiftMonth(-1)}
                className="min-h-11 bg-white/5 text-zinc-100"
              >
                Prev
              </Button>
              <div className="relative col-span-2 sm:col-span-1">
                <Badge tone="blue" className="flex min-h-11 w-full items-center justify-center gap-2 px-3 py-2 sm:w-auto">
                  <CalendarDays className="h-3.5 w-3.5" />
                  {calendarLabel}
                </Badge>
                <ClientMonthInput
                  value={format(calendarMonth, "yyyy-MM")}
                  onChange={(event) => {
                    const [year, month] = event.target.value.split("-").map(Number);
                    if (!year || !month) {
                      return;
                    }
                    const nextMonth = startOfMonth(new Date(year, month - 1, 1));
                    setCalendarMonth(nextMonth);
                    setSelectedCalendarDate(format(nextMonth, "yyyy-MM-dd"));
                  }}
                  className="absolute inset-0 cursor-pointer opacity-0"
                  aria-label="Select month"
                />
              </div>
              <Button
                type="button"
                onClick={() => shiftMonth(1)}
                className="min-h-11 bg-white/5 text-zinc-100"
              >
                Next
              </Button>
              <Button
                type="button"
                onClick={goToToday}
                className="col-span-4 min-h-11 bg-cyan-300/10 text-cyan-100 sm:col-span-1"
              >
                Today
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-2 pb-4 sm:px-4 lg:px-6 lg:pb-6">
          <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-black uppercase tracking-[0.12em] text-zinc-500 sm:gap-2 sm:text-xs sm:tracking-[0.2em]">
            {["S", "M", "T", "W", "T", "F", "S"].map((day, index) => (
              <div key={`${day}-${index}`} className="py-1.5 sm:py-2">
                <span className="sm:hidden">{day}</span>
                <span className="hidden sm:inline">
                  {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][index]}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-1 grid grid-cols-7 gap-1 sm:mt-2 sm:gap-2">
            {Array.from({ length: calendarOffset }).map((_, index) => (
              <div
                key={`blank-${index}`}
                className="min-h-12 rounded-2xl border border-white/5 bg-white/[0.02] sm:min-h-28 sm:rounded-3xl"
              />
            ))}
            {calendarDays.map((day) => {
              const dateKey = format(day, "yyyy-MM-dd");
              const dayTrades = tradesByDate[dateKey] ?? [];
              const dayOverview = overviewsByDate[dateKey];
              const hasOverview = Boolean(dayOverview && overviewHasContent(dayOverview));
              const hasPortfolioSnapshot = portfolioSnapshotDates.includes(dateKey);
              const isSelected = selectedCalendarDate === dateKey;

              return (
                <button
                  key={dateKey}
                  type="button"
                  onClick={() => setSelectedCalendarDate(dateKey)}
                  className={cn(
                    "min-h-12 rounded-2xl border p-1.5 text-left transition touch-manipulation sm:min-h-28 sm:rounded-3xl sm:p-3",
                    isSelected
                      ? "border-cyan-300/70 bg-cyan-300/15 shadow-[0_0_24px_rgba(34,211,238,0.18)]"
                      : "border-white/10 bg-white/[0.04] hover:border-cyan-300/40 hover:bg-cyan-300/10",
                    isToday(day) && !isSelected && "border-cyan-300/30",
                    hasOverview && !isSelected && "border-violet-400/25",
                    hasPortfolioSnapshot && !isSelected && "border-amber-400/25",
                  )}
                >
                  <div className="flex items-center justify-between gap-0.5">
                    <span
                      className={cn(
                        "text-sm font-black sm:text-base",
                        isSelected ? "text-cyan-100" : "text-white",
                        isToday(day) && "text-cyan-200",
                      )}
                    >
                      {format(day, "d")}
                    </span>
                    <div className="flex items-center gap-0.5 sm:gap-1">
                      {hasOverview ? (
                        <span
                          className="hidden rounded-full bg-violet-400/20 px-1.5 py-0.5 text-[9px] font-black uppercase text-violet-200 sm:inline"
                          title="Daily overview saved"
                        >
                          OV
                        </span>
                      ) : null}
                      {hasPortfolioSnapshot ? (
                        <span
                          className="hidden rounded-full bg-amber-400/20 px-1.5 py-0.5 text-[9px] font-black uppercase text-amber-200 sm:inline"
                          title="Portfolio snapshot saved"
                        >
                          PS
                        </span>
                      ) : null}
                      {(dayTrades.length > 0 || hasOverview || hasPortfolioSnapshot) && (
                        <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[9px] font-bold text-zinc-300 sm:px-2 sm:text-[10px]">
                          {dayTrades.length > 0 ? dayTrades.length : "·"}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="mt-2 hidden gap-1.5 sm:grid">
                    {dayTrades.map((trade) => (
                      <span
                        key={trade.id}
                        role="button"
                        tabIndex={0}
                        onClick={(event) => {
                          event.stopPropagation();
                          onSelectTrade(trade);
                        }}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            event.stopPropagation();
                            onSelectTrade(trade);
                          }
                        }}
                        className={cn(
                          "block rounded-2xl border px-2 py-1.5 text-[10px] font-black uppercase leading-tight transition hover:scale-[1.02]",
                          trade.outcome === "WIN"
                            ? "border-emerald-400/30 bg-emerald-400/15 text-emerald-100"
                            : "border-rose-400/30 bg-rose-500/15 text-rose-100",
                        )}
                      >
                        <div className="truncate">{trade.pair}</div>
                        <div>
                          {trade.outcome} · {formatPercent(trade.profitPercent)}
                        </div>
                      </span>
                    ))}
                  </div>
                </button>
              );
            })}
          </div>
          <div className="mt-4 flex flex-wrap gap-3 border-t border-white/10 pt-4 text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500 sm:gap-4">
            <span className="inline-flex items-center gap-1.5">
              <span className="rounded-full bg-violet-400/20 px-1.5 py-0.5 text-[9px] font-black text-violet-200">
                OV
              </span>
              Daily overview
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="rounded-full bg-amber-400/20 px-1.5 py-0.5 text-[9px] font-black text-amber-200">
                PS
              </span>
              Portfolio snapshot
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold text-zinc-300">
                #
              </span>
              Trade count
            </span>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3 lg:gap-8">
        <Card className="border-amber-300/25 bg-gradient-to-br from-amber-500/10 to-transparent">
          <CardContent className="grid gap-3 pt-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-amber-200">
                  <Scale className="h-4 w-4" />
                  Portfolio snapshot
                </div>
                <div className="mt-1 text-lg font-black text-white">
                  {formatOverviewDayLabel(selectedCalendarDate)}
                </div>
              </div>
              <Badge tone={portfolioSnapshotDates.includes(selectedCalendarDate) ? "blue" : "neutral"}>
                {portfolioSnapshotDates.includes(selectedCalendarDate) ? "Saved" : "Empty"}
              </Badge>
            </div>
            <p className="text-sm text-zinc-400">
              {canUsePersonalJournal
                ? portfolioSnapshotDates.includes(selectedCalendarDate)
                  ? "Review long/short book and target ratio for this day."
                  : "No snapshot yet — open the editor to log positions and regime target."
                : "Sign in with a Supabase account to save daily portfolio snapshots."}
            </p>
            <Button
              type="button"
              disabled={!canUsePersonalJournal}
              onClick={onOpenPortfolioSnapshot}
              className="bg-amber-400/20 text-amber-100 hover:bg-amber-400/30 disabled:opacity-40"
            >
              {portfolioSnapshotDates.includes(selectedCalendarDate)
                ? "Open portfolio snapshot"
                : "Create portfolio snapshot"}
            </Button>
          </CardContent>
        </Card>

        <Card className="border-violet-300/25 bg-gradient-to-br from-violet-500/10 to-transparent">
          <CardContent className="grid gap-3 pt-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-violet-200">
                  <BookOpen className="h-4 w-4" />
                  Daily overview
                </div>
                <div className="mt-1 text-lg font-black text-white">
                  {formatOverviewDayLabel(selectedCalendarDate)}
                </div>
              </div>
              <Badge tone={selectedDayOverview ? "blue" : "neutral"}>
                {selectedDayOverview ? "Saved" : "Not written"}
              </Badge>
            </div>

            {selectedDayOverview && overviewHasContent(selectedDayOverview) ? (
              <div className="grid gap-2 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-zinc-300">
                {selectedDayOverview.tradePerformanceHtml ? (
                  <p>
                    <span className="font-bold text-violet-200">Performance · </span>
                    Preview available
                  </p>
                ) : null}
                {selectedDayOverview.preTradeListHtml ? (
                  <p>
                    <span className="font-bold text-violet-200">Pre-trade · </span>
                    {selectedDayOverview.preTradeListScreenshots.length} screenshot
                    {selectedDayOverview.preTradeListScreenshots.length === 1 ? "" : "s"}
                  </p>
                ) : null}
                {selectedDayOverview.marketAnalysisHtml ? (
                  <p>
                    <span className="font-bold text-violet-200">Market · </span>
                    {selectedDayOverview.marketAnalysisScreenshots.length} screenshot
                    {selectedDayOverview.marketAnalysisScreenshots.length === 1 ? "" : "s"}
                  </p>
                ) : null}
                {selectedDayOverview.mistakeFlags.length > 0 ? (
                  <p>
                    <span className="font-bold text-rose-200">Mistakes · </span>
                    {countMistakes(selectedDayOverview.mistakeFlags)} flagged
                  </p>
                ) : null}
                {selectedDayOverview.linkedTradeIds.length > 0 ? (
                  <p className="text-zinc-400">
                    {selectedDayOverview.linkedTradeIds.length} linked trade
                    {selectedDayOverview.linkedTradeIds.length === 1 ? "" : "s"}
                  </p>
                ) : null}
              </div>
            ) : (
              <p className="text-sm text-zinc-400">
                {canUsePersonalJournal
                  ? "No overview for this day yet. Open the editor to capture your plan and recap."
                  : "Sign in with a Supabase account to write daily overviews."}
              </p>
            )}

            <Button
              type="button"
              disabled={!canUsePersonalJournal}
              onClick={onOpenDailyOverview}
              className="bg-violet-400/20 text-violet-100 hover:bg-violet-400/30 disabled:opacity-40"
            >
              {selectedDayOverview ? "Open daily overview" : "Write daily overview"}
            </Button>
          </CardContent>
        </Card>

        <Card className="border-cyan-300/20 bg-cyan-300/10">
          <CardContent className="grid gap-3 pt-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-xs font-black uppercase tracking-[0.2em] text-cyan-100">
                  Trades
                </div>
                <div className="mt-1 text-lg font-black text-white">
                  {formatOverviewDayLabel(selectedCalendarDate)}
                </div>
              </div>
              <Badge tone={selectedDayTrades.length ? "blue" : "neutral"}>
                {selectedDayTrades.length} trade{selectedDayTrades.length === 1 ? "" : "s"}
              </Badge>
            </div>
            {selectedDayTrades.length ? (
              <div className="grid gap-2">
                {selectedDayTrades.map((trade) => (
                  <button
                    key={trade.id}
                    type="button"
                    onClick={() => onSelectTrade(trade)}
                    className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-left transition hover:border-cyan-300/40"
                  >
                    <div className="font-black text-white">{trade.pair}</div>
                    <div className="mt-1 text-sm text-zinc-400">
                      {trade.strategy} · {trade.outcome} · {formatPercent(trade.profitPercent)}
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-sm text-zinc-300">No trades logged for this day.</p>
            )}
          </CardContent>
        </Card>
      </div>

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
            <Swords className="h-3.5 w-3.5" /> {tradeCount} trades
          </Badge>
        </CardContent>
      </Card>
    </section>
  );
}
