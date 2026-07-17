"use client";

import { Ellipsis } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { MOBILE_PRIMARY_VIEWS, type MobilePrimaryView } from "@/lib/mobile";
import { cn } from "@/lib/utils";

type MobileBottomNavProps = {
  activeView: string;
  viewIcons: Record<MobilePrimaryView, LucideIcon>;
  onNavigate: (view: MobilePrimaryView) => void;
  onOpenMore: () => void;
  moreActive?: boolean;
};

export function MobileBottomNav({
  activeView,
  viewIcons,
  onNavigate,
  onOpenMore,
  moreActive = false,
}: MobileBottomNavProps) {
  const isPrimaryActive = MOBILE_PRIMARY_VIEWS.includes(
    activeView as MobilePrimaryView,
  );

  return (
    <nav
      aria-label="Mobile navigation"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[#05070d]/95 backdrop-blur-xl lg:hidden"
      style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}
    >
      <div className="mx-auto grid max-w-[390px] grid-cols-5 gap-1 px-1 pt-1.5">
        {MOBILE_PRIMARY_VIEWS.map((view) => {
          const Icon = viewIcons[view];
          const isActive = activeView === view;
          return (
            <button
              key={view}
              type="button"
              onClick={() => onNavigate(view)}
              className={cn(
                "flex min-h-[52px] flex-col items-center justify-center gap-1 rounded-2xl px-1 text-[10px] font-bold tracking-wide transition duration-200 touch-manipulation",
                isActive
                  ? "bg-cyan-300/15 text-cyan-100"
                  : "text-zinc-500 active:bg-white/[0.06] active:text-zinc-200",
              )}
            >
              <Icon className="h-5 w-5 shrink-0" aria-hidden />
              <span className="truncate">{view === "Dashboard" ? "Home" : view}</span>
            </button>
          );
        })}
        <button
          type="button"
          onClick={onOpenMore}
          className={cn(
            "flex min-h-[52px] flex-col items-center justify-center gap-1 rounded-2xl px-1 text-[10px] font-bold tracking-wide transition duration-200 touch-manipulation",
            moreActive || !isPrimaryActive
              ? "bg-cyan-300/15 text-cyan-100"
              : "text-zinc-500 active:bg-white/[0.06] active:text-zinc-200",
          )}
        >
          <Ellipsis className="h-5 w-5 shrink-0" aria-hidden />
          <span>More</span>
        </button>
      </div>
    </nav>
  );
}
