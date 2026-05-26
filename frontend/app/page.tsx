"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowUpRight,
  Bot,
  Coins,
  GitBranch,
  MessagesSquare,
  PlayCircle,
  Workflow,
  Zap,
} from "lucide-react";

import { Avatar } from "@/components/ui/avatar";
import { Badge, statusTone } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Stats,
  StatsAgentRun,
  StatsWorkflowRun,
  api,
} from "@/lib/api";
import { formatCost } from "@/lib/pricing";
import { relativeTime } from "@/lib/time";

export default function HomePage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    try {
      setStats(await api.getStats());
      setError(null);
    } catch (e) {
      setError(String(e));
    }
  }

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 4000);
    return () => clearInterval(t);
  }, []);

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border/60">
        <div className="max-w-6xl mx-auto px-8 pt-14 pb-12">
          <div className="flex items-center gap-2 mb-4">
            <span className="live-dot" />
            <span className="text-xs uppercase tracking-wider text-fg-muted font-medium">
              Live
            </span>
            <span className="text-fg-subtle">·</span>
            <span className="text-xs text-fg-muted">
              Updates every 4 seconds
            </span>
          </div>

          <h1 className="text-display text-fg">
            Your{" "}
            <span className="text-gradient-brand">agent fleet</span>
          </h1>
          <p className="mt-3 text-base text-fg-muted max-w-2xl">
            Real-time view of agents, workflows, and conversations running on the
            platform — token usage and dollar cost included.
          </p>

          {error && (
            <div className="mt-6 rounded-lg border border-danger/40 bg-danger-subtle/20 p-3 text-sm text-danger">
              {error}
            </div>
          )}

          <div className="mt-10 grid lg:grid-cols-[1.4fr_1fr] gap-6">
            <HeroCost stats={stats} />
            <ActivityPulse stats={stats} />
          </div>
        </div>
      </section>

      {/* Supporting metrics */}
      <section className="max-w-6xl mx-auto px-8 py-10">
        <div className="flex items-end justify-between mb-4">
          <h2 className="text-sm font-semibold text-fg uppercase tracking-wider">
            Workspace
          </h2>
          <span className="text-xs text-fg-subtle font-mono">
            model · {stats?.default_model || "—"}
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <MetricTile
            icon={Bot}
            label="Agents"
            value={stats?.totals.agents}
            href="/agents"
          />
          <MetricTile
            icon={Workflow}
            label="Workflows"
            value={stats?.totals.workflows}
            href="/workflows"
          />
          <MetricTile
            icon={MessagesSquare}
            label="Conversations"
            value={stats?.totals.conversations}
            href="/conversations"
          />
          <MetricTile
            icon={PlayCircle}
            label="Agent runs"
            value={stats?.totals.agent_runs}
          />
          <MetricTile
            icon={GitBranch}
            label="Workflow runs"
            value={stats?.totals.workflow_runs}
          />
        </div>
      </section>

      {/* Activity feeds */}
      <section className="max-w-6xl mx-auto px-8 pb-16 grid lg:grid-cols-2 gap-6">
        <ActivityFeed
          title="Recent agent runs"
          icon={PlayCircle}
          href="/agents"
          empty={
            <EmptyState
              icon={PlayCircle}
              title="No agent runs yet"
              description="Create an agent and run it — its activity will land here."
            />
          }
          items={
            stats?.recent_agent_runs
              ? stats.recent_agent_runs.map((r) => (
                  <AgentRunItem key={r.id} run={r} />
                ))
              : null
          }
        />
        <ActivityFeed
          title="Recent workflow runs"
          icon={GitBranch}
          href="/workflows"
          empty={
            <EmptyState
              icon={GitBranch}
              title="No workflow runs yet"
              description="Pick a template on the Workflows page and run it."
            />
          }
          items={
            stats?.recent_workflow_runs
              ? stats.recent_workflow_runs.map((r) => (
                  <WorkflowRunItem key={r.id} run={r} />
                ))
              : null
          }
        />
      </section>
    </div>
  );
}

/* ---------- Hero pieces ---------- */

function HeroCost({ stats }: { stats: Stats | null }) {
  if (!stats) {
    return (
      <Card className="p-7 relative overflow-hidden">
        <Skeleton className="h-3 w-24 mb-4" />
        <Skeleton className="h-14 w-48 mb-3" />
        <Skeleton className="h-3 w-40" />
      </Card>
    );
  }
  return (
    <Card className="p-7 relative overflow-hidden">
      <div className="absolute -top-20 -right-20 h-60 w-60 rounded-full bg-brand/15 blur-3xl pointer-events-none" />
      <div className="relative flex items-center gap-2 text-xs uppercase tracking-wider text-fg-muted">
        <Coins className="h-3.5 w-3.5 text-brand" />
        Cumulative spend
      </div>
      <div className="relative mt-3 flex items-baseline gap-3">
        <span className="text-display-lg text-gradient-brand tabular-nums">
          {formatCost(stats.totals.cost_usd)}
        </span>
      </div>
      <div className="relative mt-3 flex items-center gap-4 text-xs text-fg-muted">
        <span className="inline-flex items-center gap-1">
          <span className="text-fg font-mono">
            {stats.totals.input_tokens.toLocaleString()}
          </span>{" "}
          input
        </span>
        <span className="text-fg-subtle">·</span>
        <span className="inline-flex items-center gap-1">
          <span className="text-fg font-mono">
            {stats.totals.output_tokens.toLocaleString()}
          </span>{" "}
          output tokens
        </span>
      </div>
    </Card>
  );
}

function ActivityPulse({ stats }: { stats: Stats | null }) {
  const totalRuns =
    (stats?.totals.agent_runs ?? 0) + (stats?.totals.workflow_runs ?? 0);
  return (
    <Card className="p-7 relative overflow-hidden">
      <div className="absolute -bottom-16 -left-16 h-60 w-60 rounded-full bg-accent/10 blur-3xl pointer-events-none" />
      <div className="relative flex items-center gap-2 text-xs uppercase tracking-wider text-fg-muted">
        <Zap className="h-3.5 w-3.5 text-accent" />
        Activity
      </div>
      <div className="relative mt-3 flex items-baseline gap-3">
        <span className="text-4xl font-bold tabular-nums text-fg">
          {totalRuns.toLocaleString()}
        </span>
        <span className="text-sm text-fg-muted">total runs</span>
      </div>
      <div className="relative mt-3 grid grid-cols-2 gap-3 text-xs">
        <div className="rounded-lg bg-bg-subtle/60 px-3 py-2 border border-border">
          <div className="text-[10px] uppercase tracking-wider text-fg-subtle">
            Agent runs
          </div>
          <div className="text-base font-semibold text-fg mt-0.5 tabular-nums">
            {stats?.totals.agent_runs ?? "—"}
          </div>
        </div>
        <div className="rounded-lg bg-bg-subtle/60 px-3 py-2 border border-border">
          <div className="text-[10px] uppercase tracking-wider text-fg-subtle">
            Workflow runs
          </div>
          <div className="text-base font-semibold text-fg mt-0.5 tabular-nums">
            {stats?.totals.workflow_runs ?? "—"}
          </div>
        </div>
      </div>
    </Card>
  );
}

/* ---------- Metric tile ---------- */

function MetricTile({
  icon: Icon,
  label,
  value,
  href,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number | undefined;
  href?: string;
}) {
  const body = (
    <Card
      interactive={!!href}
      className="p-4 transition-transform hover:-translate-y-0.5"
    >
      <div className="flex items-center justify-between mb-2">
        <Icon className="h-4 w-4 text-fg-subtle" />
        {href && <ArrowUpRight className="h-3.5 w-3.5 text-fg-subtle" />}
      </div>
      <div className="text-2xl font-semibold tabular-nums text-fg">
        {value === undefined ? <Skeleton className="h-7 w-12" /> : value}
      </div>
      <div className="text-[11px] text-fg-muted uppercase tracking-wider mt-1">
        {label}
      </div>
    </Card>
  );
  return href ? (
    <Link href={href} className="block">
      {body}
    </Link>
  ) : (
    body
  );
}

/* ---------- Activity feed ---------- */

function ActivityFeed({
  title,
  icon: Icon,
  href,
  items,
  empty,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  items: React.ReactNode[] | null;
  empty: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-fg">
          <Icon className="h-4 w-4 text-fg-subtle" />
          {title}
        </div>
        <Link
          href={href}
          className="text-xs text-brand hover:text-brand-hover inline-flex items-center gap-0.5"
        >
          View all <ArrowUpRight className="h-3 w-3" />
        </Link>
      </div>
      {items === null ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <Card key={i} className="p-3.5">
              <Skeleton className="h-3 w-1/2 mb-2" />
              <Skeleton className="h-3 w-3/4" />
            </Card>
          ))}
        </div>
      ) : items.length === 0 ? (
        empty
      ) : (
        <div className="space-y-2">{items}</div>
      )}
    </div>
  );
}

function AgentRunItem({ run }: { run: StatsAgentRun }) {
  return (
    <Link href={`/agents/${run.agent_id}/run`} className="block animate-fade-in">
      <Card interactive className="p-3.5">
        <div className="flex items-center gap-3">
          <Avatar name={run.agent_name || "?"} size="md" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <div className="font-medium text-sm text-fg truncate">
                {run.agent_name || "(deleted)"}
              </div>
              <Badge tone={statusTone(run.status)}>{run.status}</Badge>
            </div>
            <div className="text-xs text-fg-muted truncate mt-0.5">
              {run.input}
            </div>
            <div className="flex items-center gap-3 text-[11px] text-fg-subtle mt-1.5">
              <span>{relativeTime(run.created_at)}</span>
              <span className="text-fg-subtle">·</span>
              <span className="font-mono">
                {run.input_tokens}↓ {run.output_tokens}↑
              </span>
              <span className="text-fg-subtle">·</span>
              <span className="text-success">{formatCost(run.cost_usd)}</span>
            </div>
          </div>
        </div>
      </Card>
    </Link>
  );
}

function WorkflowRunItem({ run }: { run: StatsWorkflowRun }) {
  return (
    <Link href={`/workflow-runs/${run.id}`} className="block animate-fade-in">
      <Card interactive className="p-3.5">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-brand-subtle border border-brand/20 flex items-center justify-center shrink-0">
            <GitBranch className="h-4 w-4 text-brand" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <div className="font-medium text-sm text-fg truncate">
                {run.workflow_name || "(deleted)"}
              </div>
              <Badge tone={statusTone(run.status)}>{run.status}</Badge>
            </div>
            <div className="text-xs text-fg-muted truncate mt-0.5">
              {run.input}
            </div>
            <div className="flex items-center gap-3 text-[11px] text-fg-subtle mt-1.5">
              <span>{relativeTime(run.created_at)}</span>
              <span className="text-fg-subtle">·</span>
              <span className="font-mono">
                {run.input_tokens}↓ {run.output_tokens}↑
              </span>
              <span className="text-fg-subtle">·</span>
              <span className="text-success">{formatCost(run.cost_usd)}</span>
            </div>
          </div>
        </div>
      </Card>
    </Link>
  );
}
