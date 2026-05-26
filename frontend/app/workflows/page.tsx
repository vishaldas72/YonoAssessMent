"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Eye, Plus, Sparkles, Trash2, Workflow as WorkflowIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { PageBody, PageHeader } from "@/components/page-header";
import { Workflow, workflowsApi } from "@/lib/api";

export default function WorkflowsPage() {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function refresh() {
    try {
      setWorkflows(await workflowsApi.list());
      setError(null);
    } catch (e) {
      setError(String(e));
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    try {
      const wf = await workflowsApi.create({ name });
      router.push(`/workflows/${wf.id}/edit`);
    } catch (e) {
      setError(String(e));
    } finally {
      setCreating(false);
    }
  }

  async function onDelete(id: string) {
    if (!confirm("Delete this workflow?")) return;
    try {
      await workflowsApi.remove(id);
      await refresh();
    } catch (e) {
      setError(String(e));
    }
  }

  async function onUseTemplate(id: string) {
    setBusyId(id);
    try {
      const clone = await workflowsApi.instantiate(id);
      router.push(`/workflows/${clone.id}/edit`);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusyId(null);
    }
  }

  const templates = workflows.filter((w) => w.is_template);
  const userWorkflows = workflows.filter((w) => !w.is_template);

  return (
    <>
      <PageHeader title="Workflows" description="Wire agents into collaborative graphs." />
      <PageBody>
        {error && (
          <Card className="p-4 border-danger/40 text-danger text-sm mb-6">{error}</Card>
        )}

        {templates.length > 0 && (
          <section className="mb-10">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="h-4 w-4 text-success" />
              <h2 className="text-sm font-semibold text-fg">Templates</h2>
              <span className="text-xs text-fg-muted">
                · ready to run, click "Use" to customize
              </span>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {templates.map((wf) => (
                <Card
                  key={wf.id}
                  className="p-5 border-dashed border-success/40 bg-success-subtle/20"
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2">
                      <Badge tone="success">template</Badge>
                      <span className="font-semibold text-sm">{wf.name}</span>
                    </div>
                  </div>
                  {wf.description && (
                    <p className="text-xs text-fg-muted mb-3 leading-relaxed">
                      {wf.description}
                    </p>
                  )}
                  <div className="text-xs text-fg-subtle mb-4">
                    {wf.graph.nodes.length} nodes · {wf.graph.edges.length} edges
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => onUseTemplate(wf.id)}
                      disabled={busyId === wf.id}
                      size="sm"
                    >
                      {busyId === wf.id ? "Cloning…" : "Use template"}
                    </Button>
                    <Link href={`/workflows/${wf.id}/edit`}>
                      <Button variant="secondary" size="sm">
                        <Eye className="h-3.5 w-3.5" /> Preview
                      </Button>
                    </Link>
                  </div>
                </Card>
              ))}
            </div>
          </section>
        )}

        <section>
          <h2 className="text-sm font-semibold text-fg mb-3">Your workflows</h2>

          <Card className="p-4 mb-4">
            <form onSubmit={onCreate} className="flex gap-2">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="New workflow name"
              />
              <Button type="submit" disabled={creating || !name.trim()}>
                <Plus className="h-4 w-4" />
                {creating ? "Creating…" : "Create blank"}
              </Button>
            </form>
          </Card>

          <div className="space-y-2">
            {userWorkflows.length === 0 && (
              <EmptyState
                icon={WorkflowIcon}
                title="No workflows yet"
                description="Pick a template above or create a blank one and start dragging nodes onto the canvas."
              />
            )}
            {userWorkflows.map((wf) => (
              <Card key={wf.id} className="p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <Link
                      href={`/workflows/${wf.id}/edit`}
                      className="font-semibold text-sm text-brand hover:text-brand-hover"
                    >
                      {wf.name}
                    </Link>
                    <div className="text-xs text-fg-muted mt-1">
                      {wf.graph.nodes.length} nodes · {wf.graph.edges.length} edges · v
                      {wf.version}
                    </div>
                  </div>
                  <Button variant="danger" size="sm" onClick={() => onDelete(wf.id)}>
                    <Trash2 className="h-3.5 w-3.5" /> Delete
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </section>
      </PageBody>
    </>
  );
}
