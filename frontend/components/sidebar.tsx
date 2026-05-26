"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Bot,
  CircleDot,
  GitBranch,
  LayoutDashboard,
  MessagesSquare,
  Sparkles,
} from "lucide-react";

import { Stats, api } from "@/lib/api";
import { cn } from "@/lib/cn";

type NavCounts = {
  agents?: number;
  workflows?: number;
  conversations?: number;
};

const NAV = [
  {
    href: "/",
    label: "Dashboard",
    icon: LayoutDashboard,
    match: (p: string) => p === "/",
    countKey: null as keyof NavCounts | null,
  },
  {
    href: "/agents",
    label: "Agents",
    icon: Bot,
    match: (p: string) => p.startsWith("/agents"),
    countKey: "agents" as const,
  },
  {
    href: "/workflows",
    label: "Workflows",
    icon: GitBranch,
    match: (p: string) =>
      p.startsWith("/workflows") || p.startsWith("/workflow-runs"),
    countKey: "workflows" as const,
  },
  {
    href: "/conversations",
    label: "Conversations",
    icon: MessagesSquare,
    match: (p: string) => p.startsWith("/conversations"),
    countKey: "conversations" as const,
  },
];

export function Sidebar() {
  const pathname = usePathname() || "/";
  const [counts, setCounts] = useState<NavCounts>({});
  const [health, setHealth] = useState<{ db: boolean; redis: boolean } | null>(
    null,
  );
  const [model, setModel] = useState<string>("");

  useEffect(() => {
    let mounted = true;
    async function tick() {
      try {
        const [s, h]: [Stats, { db: boolean; redis: boolean }] =
          await Promise.all([api.getStats(), api.health()]);
        if (!mounted) return;
        setCounts({
          agents: s.totals.agents,
          workflows: s.totals.workflows,
          conversations: s.totals.conversations,
        });
        setModel(s.default_model);
        setHealth({ db: h.db, redis: h.redis });
      } catch {
        // silent — sidebar is decorative if backend is down
      }
    }
    tick();
    const t = setInterval(tick, 6000);
    return () => {
      mounted = false;
      clearInterval(t);
    };
  }, []);

  return (
    <aside className="h-screen w-64 shrink-0 border-r border-border bg-bg-subtle/80 backdrop-blur-xl flex flex-col">
      <div className="px-5 py-5 border-b border-border">
        <Link href="/" className="flex items-center gap-3 group">
          <div className="relative">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-brand to-accent flex items-center justify-center shadow-glow-sm">
              <Sparkles className="h-4 w-4 text-white" strokeWidth={2.5} />
            </div>
            <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-brand to-accent blur-xl opacity-30 -z-10" />
          </div>
          <div>
            <div className="text-sm font-semibold text-fg leading-tight tracking-tight">
              Yuno
            </div>
            <div className="text-[11px] text-fg-muted leading-tight">
              Agent Orchestrator
            </div>
          </div>
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        <div>
          <div className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-fg-subtle">
            Workspace
          </div>
          <div className="space-y-0.5">
            {NAV.map((item) => {
              const active = item.match(pathname);
              const Icon = item.icon;
              const count = item.countKey ? counts[item.countKey] : undefined;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors group relative",
                    active
                      ? "bg-brand-subtle text-brand"
                      : "text-fg-muted hover:bg-bg-card hover:text-fg",
                  )}
                >
                  {active && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-0.5 rounded-r-full bg-brand" />
                  )}
                  <Icon
                    className={cn(
                      "h-4 w-4 shrink-0",
                      active ? "text-brand" : "text-fg-subtle group-hover:text-fg",
                    )}
                  />
                  <span className="flex-1">{item.label}</span>
                  {count !== undefined && (
                    <span
                      className={cn(
                        "text-[11px] tabular-nums px-1.5 py-0.5 rounded-md",
                        active
                          ? "bg-brand/20 text-brand"
                          : "bg-bg-card text-fg-subtle group-hover:text-fg-muted",
                      )}
                    >
                      {count}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      </nav>

      <div className="px-4 py-4 border-t border-border space-y-3">
        {model && (
          <div className="rounded-lg bg-bg-card border border-border p-3">
            <div className="text-[10px] uppercase tracking-wider text-fg-subtle mb-1">
              Active model
            </div>
            <div className="text-xs font-mono text-fg truncate">{model}</div>
          </div>
        )}
        <div className="flex items-center justify-between text-[11px]">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 text-fg-muted">
              <CircleDot
                className={cn(
                  "h-2.5 w-2.5",
                  health?.db ? "text-success" : "text-danger",
                )}
                strokeWidth={3}
              />
              db
            </span>
            <span className="inline-flex items-center gap-1.5 text-fg-muted">
              <CircleDot
                className={cn(
                  "h-2.5 w-2.5",
                  health?.redis ? "text-success" : "text-danger",
                )}
                strokeWidth={3}
              />
              redis
            </span>
          </div>
          <span className="text-fg-subtle font-mono">v0.1</span>
        </div>
      </div>
    </aside>
  );
}
