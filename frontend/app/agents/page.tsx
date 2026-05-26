"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Bot, ChevronDown, Play, Plus, Trash2 } from "lucide-react";

import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input, Label, Textarea } from "@/components/ui/input";
import { ModelSelect } from "@/components/ui/model-select";
import { Skeleton } from "@/components/ui/skeleton";
import { TogglePill } from "@/components/ui/toggle-pill";
import { PageBody, PageHeader } from "@/components/page-header";
import { Agent, AgentCreate, ModelCatalog, api } from "@/lib/api";

const AVAILABLE_CHANNELS = ["telegram"];

const emptyForm: AgentCreate = {
  name: "",
  role: "",
  system_prompt: "",
  model: "llama-3.3-70b-versatile",
  temperature: 0.7,
  max_tokens: 1024,
  tools: [],
  channels: [],
};

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [tools, setTools] = useState<string[]>([]);
  const [catalog, setCatalog] = useState<ModelCatalog | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<AgentCreate>(emptyForm);
  const [submitting, setSubmitting] = useState(false);

  async function refresh() {
    setLoading(true);
    try {
      const [list, toolList, modelCatalog] = await Promise.all([
        api.listAgents(),
        api.listTools(),
        api.listModels(),
      ]);
      setAgents(list);
      setTools(toolList.tools);
      setCatalog(modelCatalog);
      setError(null);
      // Default the form's model to the active provider's default if not yet set
      setForm((f) =>
        f.model && f.model !== "llama-3.3-70b-versatile"
          ? f
          : { ...f, model: modelCatalog.default_model || f.model },
      );
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);


  function toggleTool(name: string) {
    const current = new Set(form.tools || []);
    current.has(name) ? current.delete(name) : current.add(name);
    setForm({ ...form, tools: Array.from(current) });
  }

  function toggleChannel(name: string) {
    const current = new Set(form.channels || []);
    current.has(name) ? current.delete(name) : current.add(name);
    setForm({ ...form, channels: Array.from(current) });
  }

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSubmitting(true);
    try {
      await api.createAgent(form);
      setForm(emptyForm);
      await refresh();
    } catch (e) {
      setError(String(e));
    } finally {
      setSubmitting(false);
    }
  }

  async function onDelete(id: string) {
    if (!confirm("Delete this agent?")) return;
    try {
      await api.deleteAgent(id);
      await refresh();
    } catch (e) {
      setError(String(e));
    }
  }

  return (
    <>
      <PageHeader
        title="Agents"
        description={`Configure AI agents — ${agents.length} total`}
      />
      <PageBody>
        {error && (
          <Card className="p-4 border-danger/40 text-danger text-sm mb-6">
            {error}
          </Card>
        )}

        <div className="grid lg:grid-cols-[420px_1fr] gap-6 items-start">
          <Card>
            <div className="px-5 pt-5 pb-3 border-b border-border">
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <Plus className="h-4 w-4 text-brand" /> New agent
              </h2>
            </div>
            <form onSubmit={onCreate} className="px-5 py-5 space-y-4">
              <div>
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Researcher"
                />
              </div>

              <div>
                <Label htmlFor="role">Role</Label>
                <Input
                  id="role"
                  value={form.role || ""}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                  placeholder="Web research and summarization"
                />
              </div>

              <div>
                <Label htmlFor="prompt">System prompt</Label>
                <Textarea
                  id="prompt"
                  rows={4}
                  value={form.system_prompt || ""}
                  onChange={(e) => setForm({ ...form, system_prompt: e.target.value })}
                  placeholder="You are a meticulous research assistant…"
                />
              </div>

              <div>
                <Label htmlFor="model">Model</Label>
                <ModelSelect
                  catalog={catalog}
                  value={form.model || ""}
                  onChange={(name) => setForm({ ...form, model: name })}
                />
                {catalog && form.model && (
                  <ModelNotes catalog={catalog} model={form.model} />
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Temperature</Label>
                  <Input
                    type="number"
                    step={0.05}
                    min={0}
                    max={2}
                    value={form.temperature ?? 0.7}
                    onChange={(e) => setForm({ ...form, temperature: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <Label>Max tokens</Label>
                  <Input
                    type="number"
                    min={1}
                    value={form.max_tokens ?? 1024}
                    onChange={(e) => setForm({ ...form, max_tokens: Number(e.target.value) })}
                  />
                </div>
              </div>

              <div>
                <Label>Channels</Label>
                <div className="flex flex-wrap gap-1.5">
                  {AVAILABLE_CHANNELS.map((c) => (
                    <TogglePill
                      key={c}
                      on={(form.channels || []).includes(c)}
                      onClick={() => toggleChannel(c)}
                      tone="success"
                    >
                      {c}
                    </TogglePill>
                  ))}
                </div>
                <p className="text-xs text-fg-subtle mt-2">
                  Only one agent should bind to <code>telegram</code> at a time.
                </p>
              </div>

              <div>
                <Label>Tools</Label>
                <div className="flex flex-wrap gap-1.5">
                  {tools.length === 0 && (
                    <span className="text-xs text-fg-subtle">Loading tools…</span>
                  )}
                  {tools.map((t) => (
                    <TogglePill
                      key={t}
                      on={(form.tools || []).includes(t)}
                      onClick={() => toggleTool(t)}
                    >
                      {t}
                    </TogglePill>
                  ))}
                </div>
              </div>

              <Button type="submit" disabled={submitting || !form.name.trim()} className="w-full">
                {submitting ? "Creating…" : "Create agent"}
              </Button>
            </form>
          </Card>

          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-fg-muted uppercase tracking-wider">
              Existing agents
            </h2>
            {loading && (
              <div className="space-y-3">
                {[0, 1, 2].map((i) => (
                  <Card key={i} className="p-5">
                    <Skeleton className="h-4 w-32 mb-2" />
                    <Skeleton className="h-3 w-48" />
                  </Card>
                ))}
              </div>
            )}
            {!loading && agents.length === 0 && (
              <EmptyState
                icon={Bot}
                title="No agents yet"
                description="Create your first one on the left — give it a name, a system prompt, and pick a few tools."
              />
            )}
            {agents.map((a) => (
              <Card key={a.id} className="p-5 animate-fade-in">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <Avatar name={a.name} size="lg" />
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-fg">{a.name}</div>
                      {a.role && (
                        <div className="text-sm text-fg-muted mt-0.5">{a.role}</div>
                      )}
                      <div className="text-xs text-fg-subtle font-mono mt-2">
                        {a.model || "(no model)"} · temp {a.temperature} · max {a.max_tokens}
                      </div>
                      {(a.channels.length > 0 || a.tools.length > 0) && (
                        <div className="flex flex-wrap gap-1.5 mt-3">
                          {a.channels.map((c) => (
                            <Badge key={`c-${c}`} tone="success">
                              {c}
                            </Badge>
                          ))}
                          {a.tools.map((t) => (
                            <Badge key={`t-${t}`} tone="brand">
                              {t}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 shrink-0">
                    <Link href={`/agents/${a.id}/run`}>
                      <Button variant="secondary" size="sm" className="w-full">
                        <Play className="h-3.5 w-3.5" /> Run
                      </Button>
                    </Link>
                    <Button variant="danger" size="sm" onClick={() => onDelete(a.id)}>
                      <Trash2 className="h-3.5 w-3.5" /> Delete
                    </Button>
                  </div>
                </div>
                {a.system_prompt && (
                  <details className="mt-3 group">
                    <summary className="text-xs text-fg-muted cursor-pointer flex items-center gap-1 hover:text-fg list-none">
                      <ChevronDown className="h-3 w-3 transition-transform group-open:rotate-180" />
                      System prompt
                    </summary>
                    <pre className="text-xs text-fg whitespace-pre-wrap font-mono bg-bg-subtle rounded-md p-3 mt-2 border border-border">
                      {a.system_prompt}
                    </pre>
                  </details>
                )}
              </Card>
            ))}
          </div>
        </div>
      </PageBody>
    </>
  );
}

function ModelNotes({ catalog, model }: { catalog: ModelCatalog; model: string }) {
  const info = catalog.models.find((m) => m.name === model);
  if (!info) return null;
  const mismatch = info.provider !== catalog.active_provider;
  return (
    <div
      className={`mt-1.5 text-xs ${mismatch ? "text-warning" : "text-fg-subtle"} flex items-start gap-1.5`}
    >
      {mismatch && <span aria-hidden>⚠</span>}
      <span>
        {mismatch
          ? `Provider mismatch — set LLM_PROVIDER=${info.provider} in .env before running this agent.`
          : info.notes || `${info.provider} · ready to run`}
      </span>
    </div>
  );
}
