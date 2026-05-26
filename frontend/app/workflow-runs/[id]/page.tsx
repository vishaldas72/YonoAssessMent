"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  CheckCircle,
  CircleDot,
  Flag,
  Play,
  Sparkles,
  Wrench,
  XCircle,
} from "lucide-react";

import { Badge, statusTone } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { PageBody, PageHeader } from "@/components/page-header";
import {
  Stats,
  WorkflowRun,
  WorkflowRunEvent,
  api,
  workflowsApi,
  workflowRunWsUrl,
} from "@/lib/api";
import { calculateCost, formatCost } from "@/lib/pricing";

export default function WorkflowRunPage() {
  const params = useParams<{ id: string }>();
  const runId = params.id;

  const [run, setRun] = useState<WorkflowRun | null>(null);
  const [events, setEvents] = useState<WorkflowRunEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [defaultModel, setDefaultModel] = useState<string>("");
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    workflowsApi.getRun(runId).then(setRun).catch((e) => setError(String(e)));
    api
      .getStats()
      .then((s: Stats) => setDefaultModel(s.default_model))
      .catch(() => {});

    const ws = new WebSocket(workflowRunWsUrl(runId));
    wsRef.current = ws;
    ws.onmessage = (msg) => {
      try {
        const ev = JSON.parse(msg.data) as WorkflowRunEvent;
        setEvents((prev) => [...prev, ev]);
        if (
          ev.type === "workflow_finished" ||
          ev.type === "error" ||
          ev.type === "run_closed"
        ) {
          workflowsApi.getRun(runId).then(setRun).catch(() => {});
        }
      } catch {}
    };
    ws.onerror = () => setError("WebSocket error");
    return () => ws.close();
  }, [runId]);

  const byNode = new Map<string, WorkflowRunEvent[]>();
  const top: WorkflowRunEvent[] = [];
  for (const ev of events) {
    const nid = (ev.node_id as string | undefined) || "";
    if (nid) {
      const arr = byNode.get(nid) || [];
      arr.push(ev);
      byNode.set(nid, arr);
    } else {
      top.push(ev);
    }
  }

  return (
    <>
      <PageHeader
        title={
          <div className="flex items-center gap-3">
            <Link
              href="/workflows"
              className="text-fg-muted hover:text-fg transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            Workflow run
          </div>
        }
        description={<span className="font-mono text-xs">{runId}</span>}
      />
      <PageBody className="max-w-4xl">
        {error && (
          <Card className="p-4 border-danger/40 text-danger text-sm mb-6">{error}</Card>
        )}

        {run && (
          <Card className="p-5 mb-6">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div className="min-w-0 flex-1">
                <div className="text-[11px] text-fg-muted uppercase tracking-wider">
                  Input
                </div>
                <div className="text-sm mt-1">{run.input}</div>
              </div>
              <Badge tone={statusTone(run.status)}>{run.status}</Badge>
            </div>
            <div className="flex items-center gap-5 text-xs text-fg-muted">
              <span>
                in: <span className="text-fg font-mono">{run.total_input_tokens}</span>
              </span>
              <span>
                out: <span className="text-fg font-mono">{run.total_output_tokens}</span>
              </span>
              <span className="text-success">
                {formatCost(
                  calculateCost(
                    defaultModel,
                    run.total_input_tokens,
                    run.total_output_tokens,
                  ),
                )}
              </span>
            </div>
          </Card>
        )}

        <h2 className="text-sm font-semibold text-fg-muted uppercase tracking-wider mb-3">
          Timeline
        </h2>

        {top.map((ev, i) => (
          <TopEvent ev={ev} key={`top-${i}`} />
        ))}
        <div className="space-y-3">
          {[...byNode.entries()].map(([nodeId, evs]) => (
            <NodeBlock key={nodeId} nodeId={nodeId} events={evs} />
          ))}
        </div>

        {run?.output && (
          <div className="mt-6">
            <h2 className="text-sm font-semibold text-fg-muted uppercase tracking-wider mb-3">
              Final output
            </h2>
            <Card className="p-5">
              <pre className="whitespace-pre-wrap text-sm font-sans">{run.output}</pre>
            </Card>
          </div>
        )}
        {run?.error && (
          <div className="mt-6">
            <h2 className="text-sm font-semibold text-danger uppercase tracking-wider mb-3">
              Error
            </h2>
            <Card className="p-5 border-danger/40">
              <pre className="whitespace-pre-wrap text-sm font-mono text-danger">{run.error}</pre>
            </Card>
          </div>
        )}
      </PageBody>
    </>
  );
}

function TopEvent({ ev }: { ev: WorkflowRunEvent }) {
  if (ev.type === "workflow_started") {
    return (
      <div className="text-xs text-fg-muted px-1 py-1.5 flex items-center gap-1.5">
        <Play className="h-3 w-3" /> Workflow started
      </div>
    );
  }
  if (ev.type === "workflow_finished") {
    return (
      <div className="text-xs text-success px-1 py-1.5 flex items-center gap-1.5">
        <CheckCircle className="h-3 w-3" /> Workflow finished
      </div>
    );
  }
  if (ev.type === "error") {
    return (
      <div className="text-xs text-danger px-1 py-1.5 flex items-center gap-1.5">
        <XCircle className="h-3 w-3" /> {String(ev.error)}
      </div>
    );
  }
  return null;
}

function NodeBlock({ nodeId, events }: { nodeId: string; events: WorkflowRunEvent[] }) {
  const start = events.find((e) => e.type === "node_started");
  const end = events.find((e) => e.type === "node_finished");
  const errored = events.some((e) => e.type === "error");
  const nodeType = (start?.node_type as string | undefined) || "node";
  const agentName = (start?.agent_name as string | undefined) || null;

  const tone =
    nodeType === "start"
      ? "border-success/40"
      : nodeType === "end"
        ? "border-danger/40"
        : errored
          ? "border-danger/40"
          : "border-brand/30";

  const Icon =
    nodeType === "start"
      ? CircleDot
      : nodeType === "end"
        ? Flag
        : Sparkles;
  const iconClass =
    nodeType === "start"
      ? "text-success"
      : nodeType === "end"
        ? "text-danger"
        : "text-brand";

  return (
    <Card className={`p-4 ${tone}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Icon className={`h-3.5 w-3.5 ${iconClass}`} />
          <span className={`text-[10px] uppercase tracking-wider font-semibold ${iconClass}`}>
            {nodeType}
          </span>
          <code className="text-[11px] text-fg-subtle font-mono">{nodeId}</code>
          {agentName && (
            <span className="text-sm font-semibold text-fg ml-1">{agentName}</span>
          )}
        </div>
        {end && (
          <span className="text-[11px] text-fg-muted font-mono">
            {(end.input_tokens as number) || 0}↓ / {(end.output_tokens as number) || 0}↑
          </span>
        )}
      </div>

      <div className="space-y-2">
        {events
          .filter(
            (e) =>
              e.type === "assistant_message" ||
              e.type === "tool_result" ||
              e.type === "error",
          )
          .map((ev, i) => (
            <SubEvent ev={ev} key={i} />
          ))}
      </div>

      {end?.output ? (
        <details className="mt-3 group">
          <summary className="text-xs text-fg-muted cursor-pointer hover:text-fg list-none">
            output ({String(end.output).length} chars) ▾
          </summary>
          <pre className="text-xs whitespace-pre-wrap font-mono bg-bg-subtle border border-border rounded-md p-3 mt-2">
            {String(end.output)}
          </pre>
        </details>
      ) : null}
    </Card>
  );
}

function SubEvent({ ev }: { ev: WorkflowRunEvent }) {
  if (ev.type === "assistant_message") {
    const tcs = (ev.tool_calls as Array<{ name: string; args: Record<string, unknown> }>) || [];
    return (
      <div className="rounded-md bg-bg-subtle border border-border p-3 text-sm">
        {ev.content ? (
          <div className="whitespace-pre-wrap">{String(ev.content)}</div>
        ) : null}
        {tcs.length > 0 && (
          <div className="mt-2 text-xs text-fg-muted font-mono">
            calls:{" "}
            {tcs.map((t, i) => (
              <code key={i} className="text-fg mr-2">
                {t.name}({JSON.stringify(t.args)})
              </code>
            ))}
          </div>
        )}
      </div>
    );
  }
  if (ev.type === "tool_result") {
    return (
      <div className="rounded-md bg-bg-subtle border border-success/30 p-3 text-xs">
        <div className="flex items-center gap-1.5 text-success font-medium mb-1.5">
          <Wrench className="h-3 w-3" /> {String(ev.name)}
        </div>
        <pre className="font-mono whitespace-pre-wrap text-fg">
          {String(ev.content).slice(0, 600)}
          {String(ev.content).length > 600 ? "…" : ""}
        </pre>
      </div>
    );
  }
  if (ev.type === "error") {
    return (
      <div className="rounded-md border border-danger/40 bg-danger-subtle/30 p-3 text-sm text-danger">
        {String(ev.error)}
      </div>
    );
  }
  return null;
}
