import Link from "next/link";
import { redirect } from "next/navigation";
import { Activity, ArrowLeft, Boxes, Network, Scale } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { getSessionUser } from "@/lib/auth";

const tools = [
  {
    href: "/tools/portfolio",
    label: "L/S Portfolio",
    helper: "Long/short book editor",
    icon: Scale,
  },
  {
    href: "/tools/correlation",
    label: "Correlation Matrix",
    helper: "Pearson heatmap",
    icon: Network,
  },
  {
    href: "/tools/orderflow",
    label: "Order Flow",
    helper: "Level 3 liquidity",
    icon: Boxes,
  },
] as const;

export default async function ToolsLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }

  return (
    <main className="min-h-screen overflow-hidden bg-[#05070d] text-white">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.18),transparent_34%),radial-gradient(circle_at_82%_10%,rgba(16,185,129,0.12),transparent_30%),linear-gradient(180deg,rgba(15,23,42,0.72),rgba(3,7,18,0.95))]" />
      <div className="relative mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-5 sm:px-6 lg:px-8">
        <header className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-4 shadow-2xl shadow-black/40 backdrop-blur">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <Link
                href="/"
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-bold uppercase tracking-[0.18em] text-zinc-300 transition hover:border-cyan-300/50 hover:text-cyan-100"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Journal
              </Link>
              <div className="mt-5 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.35em] text-cyan-200/80">
                <Activity className="h-4 w-4" />
                Quant tools
              </div>
              <h1 className="mt-3 text-3xl font-black tracking-tight text-white sm:text-5xl">
                Trading Tools
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-zinc-400 sm:text-base">
                Dedicated analytics workspaces for pair selection and live market
                microstructure research.
              </p>
            </div>
            <Badge tone="blue">Step 1 scaffold</Badge>
          </div>
          <nav
            aria-label="Tools"
            className="mt-5 grid gap-2 rounded-[1.5rem] border border-white/10 bg-black/30 p-2 md:grid-cols-3"
          >
            {tools.map((tool) => (
              <Link
                key={tool.href}
                href={tool.href}
                className="group rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 transition hover:-translate-y-0.5 hover:border-cyan-300/50 hover:bg-cyan-300/10"
              >
                <div className="flex items-center gap-3">
                  <span className="rounded-2xl border border-cyan-300/20 bg-cyan-300/10 p-2 text-cyan-100">
                    <tool.icon className="h-4 w-4" />
                  </span>
                  <span>
                    <span className="block text-sm font-black text-white">{tool.label}</span>
                    <span className="mt-0.5 block text-xs font-semibold text-zinc-500">
                      {tool.helper}
                    </span>
                  </span>
                </div>
              </Link>
            ))}
          </nav>
        </header>
        {children}
      </div>
    </main>
  );
}
