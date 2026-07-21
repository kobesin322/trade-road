"use client";

import { ArrowUpRight, LogOut, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";

import { signOut } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type ToolLink = {
  href: string;
  title: string;
  description: string;
  icon: LucideIcon;
};

type MoreView = {
  id: string;
  label: string;
  description: string;
  icon: LucideIcon;
};

type MobileMoreSheetProps = {
  open: boolean;
  onClose: () => void;
  activeView: string;
  moreViews: MoreView[];
  toolLinks: ToolLink[];
  userEmail: string;
  tradeCount: number;
  onNavigate: (view: string) => void;
};

export function MobileMoreSheet({
  open,
  onClose,
  activeView,
  moreViews,
  toolLinks,
  userEmail,
  tradeCount,
  onNavigate,
}: MobileMoreSheetProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <button
        type="button"
        aria-label="Close menu"
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="More"
        className="absolute inset-x-0 bottom-0 max-h-[min(88dvh,720px)] overflow-y-auto rounded-t-[1.75rem] border border-white/10 bg-[#070b14] shadow-2xl"
        style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/10 bg-[#070b14]/95 px-5 py-4 backdrop-blur-xl">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-cyan-200/80">
              Trade Road
            </p>
            <p className="mt-1 text-lg font-black text-white">More</p>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-2xl border border-white/10 text-zinc-400 transition active:bg-white/10 active:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-6 px-4 py-5">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
            <p className="truncate text-sm font-semibold text-zinc-200">{userEmail}</p>
            <div className="mt-2">
              <Badge tone="blue">
                {tradeCount === 0 ? "0 trades" : `${tradeCount} trades`}
              </Badge>
            </div>
          </div>

          <section className="space-y-2">
            <p className="px-1 text-[10px] font-black uppercase tracking-[0.24em] text-zinc-600">
              Workspace
            </p>
            {moreViews.map((view) => {
              const Icon = view.icon;
              const isActive = activeView === view.id;
              return (
                <button
                  key={view.id}
                  type="button"
                  onClick={() => {
                    onNavigate(view.id);
                    onClose();
                  }}
                  className={cn(
                    "flex min-h-14 w-full items-center gap-3 rounded-2xl px-4 py-3 text-left transition touch-manipulation",
                    isActive
                      ? "bg-cyan-300 text-slate-950"
                      : "border border-white/10 bg-white/[0.03] text-zinc-300 active:bg-white/[0.08]",
                  )}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  <div className="min-w-0">
                    <div className="text-sm font-bold">{view.label}</div>
                    <div
                      className={cn(
                        "mt-0.5 text-xs",
                        isActive ? "text-slate-700" : "text-zinc-500",
                      )}
                    >
                      {view.description}
                    </div>
                  </div>
                </button>
              );
            })}
          </section>

          <section className="space-y-2">
            <p className="px-1 text-[10px] font-black uppercase tracking-[0.24em] text-zinc-600">
              Tools
            </p>
            {toolLinks.map((tool) => {
              const ToolIcon = tool.icon;
              return (
                <Link
                  key={tool.href}
                  href={tool.href}
                  onClick={onClose}
                  className="group flex min-h-14 items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 transition active:border-cyan-300/40 active:bg-cyan-300/[0.07]"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <ToolIcon className="h-5 w-5 shrink-0 text-cyan-200/80" />
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-white">{tool.title}</div>
                      <div className="mt-0.5 truncate text-xs text-zinc-500">
                        {tool.description}
                      </div>
                    </div>
                  </div>
                  <ArrowUpRight className="h-4 w-4 shrink-0 text-cyan-200/70" />
                </Link>
              );
            })}
          </section>

          <section className="space-y-3">
            <p className="px-1 text-[10px] font-black uppercase tracking-[0.24em] text-zinc-600">
              Account
            </p>
            <form action={signOut}>
              <Button
                type="submit"
                className="min-h-11 w-full bg-rose-500/10 text-rose-100 hover:bg-rose-500/20"
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </Button>
            </form>
          </section>
        </div>
      </div>
    </div>
  );
}
