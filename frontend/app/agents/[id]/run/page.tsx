"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, MessageCircle, Play, Sparkles, Wrench } from "lucide-react";

import { Badge, statusTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/input";
import { PageBody, PageHeader } from "@/components/page-header";
import { api, Agent, Run, RunEvent, runEventsWsUrl } from "@/lib/api";
import { calculateCost, formatCost } from "@/lib/pricing";

export default function RunPage() {
  const params = useParams<{ id: string }>();
  const agentId = params.id;

  const [prompt, setPrompt] = useState("");
  const [run, setRun] = useState<Run | null>(null);
  const [events, setEvents] = useState<RunEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [agent, setAgent] = useState<Agent | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    api
      .listAgents()
      .then((agents) => setAgent(agents.find((a) => a.id === agentId) || null))
      .catch(() => {});
    return () => {
      wsRef.current?.close();
    };
  }, [agentId]);

  async function startRun(e: React.FormEvent) {
    e.preventDefault();
    if (!prompt.trim()) return;
    setSubmitting(true);
    setEvents([]);
    setError(null);
    try {
      const created = await api.createRun(agentId, prompt);
      setRun(created);
      const ws = new WebSocket(runEventsWsUrl(created.id));
      wsRef.current?.close();
      wsRef.current = ws;
      ws.onmessage = (msg) => {
        try {
          const ev = JSON.parse(msg.data) as RunEvent;
          setEvents((prev) => [...prev, ev]);
          if (ev.type === "run_finished" || ev.type === "error" || ev.type === "run_closed") {
            api.getRun(created.id).then(setRun).catch(() => {});
          }
        } catch {}
      };
      ws.onerror = () => setError("WebSocket error");
    } catch (e) {
      setError(String(e));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <PageHeader
        title={
          <div className="flex items-center gap-3">
            <Link
              href="/agents"
              className="text-fg-muted hover:text-fg transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            {agent?.name || "Run agent"}
          </div>
        }
        description={
          <span className="font-mono text-xs">agent {agentId}</span>
        }
      />
      <PageBody className="max-w-4xl">
        <Card className="p-5">
          <form onSubmit={startRun} className="space-y-3">
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="What's the current UTC time?  Or:  Compute (12 * 7) + 5"
              rows={3}
            />
            <div className="flex justify-end">
              <Button type="submit" disabled={submitting || !prompt.trim()}>
                <Play className="h-4 w-4" />
                {submitting ? "Starting…" : "Run"}
              </Button>
            </div>
          </form>
        </Card>

        {error && (
          <Card className="p-4 mt-4 border-danger/40 text-danger text-sm">{error}</Card>
        )}

        {run && (
          <>
            <Card className="p-5 mt-6">
              <div className="flex items-center justify-between gap-3 mb-4">
                <div className="min-w-0">
                  <div className="text-[11px] text-fg-muted uppercase tracking-wider">
                    Run id
                  </div>
                  <code className="text-xs font-mono">{run.id}</code>
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
                      agent?.model,
                      run.total_input_tokens,
                      run.total_output_tokens,
                    ),
                  )}
                </span>
              </div>
            </Card>

            <div className="mt-6">
              <h2 className="text-sm font-semibold text-fg-muted uppercase tracking-wider mb-3">
                Events
              </h2>
              {events.length === 0 && (
                <Card className="p-6 text-center text-sm text-fg-muted">
                  Waiting for events…
                </Card>
              )}
              <div className="space-y-2">
                {events.map((ev, i) => (
                  <EventCard key={i} ev={ev} />
                ))}
              </div>
            </div>

            {run.output && (
              <div className="mt-6">
                <h2 className="text-sm font-semibold text-fg-muted uppercase tracking-wider mb-3">
                  Final output
                </h2>
                <Card className="p-5">
                  <pre className="whitespace-pre-wrap text-sm font-sans">{run.output}</pre>
                </Card>
              </div>
            )}
            {run.error && (
              <div className="mt-6">
                <h2 className="text-sm font-semibold text-danger uppercase tracking-wider mb-3">
                  Error
                </h2>
                <Card className="p-5 border-danger/40">
                  <pre className="whitespace-pre-wrap text-sm font-mono text-danger">
                    {run.error}
                  </pre>
                </Card>
              </div>
            )}
          </>
        )}
      </PageBody>
    </>
  );
}

function EventCard({ ev }: { ev: RunEvent }) {
  if (ev.type === "run_started") {
    return (
      <div className="text-xs text-fg-muted px-3 py-1.5">
        <Play className="inline h-3 w-3 mr-1.5" /> Run started
      </div>
    );
  }
  if (ev.type === "run_finished" || ev.type === "run_closed") {
    return (
      <div className="text-xs text-success px-3 py-1.5">
        ✓ Run finished
      </div>
    );
  }
  if (ev.type === "assistant_message") {
    const tcs = (ev.tool_calls as Array<{ name: string; args: Record<string, unknown> }>) || [];
    return (
      <Card className="p-3.5 border-brand/30">
        <div className="flex items-center gap-2 text-[11px] text-brand mb-1.5">
          <Sparkles className="h-3 w-3" />
          {ev.seq !== undefined ? `#${ev.seq} ` : ""}assistant
        </div>
        {ev.content ? (
          <div className="text-sm whitespace-pre-wrap">{String(ev.content)}</div>
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
      </Card>
    );
  }
  if (ev.type === "tool_result") {
    return (
      <Card className="p-3.5 border-success/30">
        <div className="flex items-center gap-2 text-[11px] text-success mb-1.5">
          <Wrench className="h-3 w-3" />
          {String(ev.name)}
        </div>
        <pre className="text-xs whitespace-pre-wrap font-mono">{String(ev.content)}</pre>
      </Card>
    );
  }
  if (ev.type === "error") {
    return (
      <Card className="p-3.5 border-danger/40">
        <div className="text-[11px] text-danger mb-1.5">error</div>
        <div className="text-sm text-danger">{String(ev.error)}</div>
      </Card>
    );
  }
  return (
    <Card className="p-3.5">
      <div className="text-[11px] text-fg-muted mb-1">
        <MessageCircle className="inline h-3 w-3 mr-1" /> {ev.type}
      </div>
    </Card>
  );
}
