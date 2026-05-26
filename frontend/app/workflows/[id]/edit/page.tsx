"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Bot,
  Circle,
  CircleDot,
  Flag,
  Play,
  Save,
  Trash2,
} from "lucide-react";
import ReactFlow, {
  addEdge,
  Background,
  Connection,
  Controls,
  Edge,
  Handle,
  MiniMap,
  Node,
  NodeProps,
  Position,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
} from "reactflow";
import "reactflow/dist/style.css";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label, Select, Textarea } from "@/components/ui/input";
import { Agent, Workflow, api, workflowsApi } from "@/lib/api";

type NodeData = {
  label?: string;
  agent_id?: string;
};

function StartNode({ data }: NodeProps<NodeData>) {
  return (
    <div className="flex items-center gap-2 rounded-full border border-success/60 bg-success-subtle px-3 py-1.5 text-xs font-semibold text-success shadow-card">
      <CircleDot className="h-3 w-3" />
      {data.label || "start"}
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

function EndNode({ data }: NodeProps<NodeData>) {
  return (
    <div className="flex items-center gap-2 rounded-full border border-danger/60 bg-danger-subtle px-3 py-1.5 text-xs font-semibold text-danger shadow-card">
      <Handle type="target" position={Position.Left} />
      <Flag className="h-3 w-3" />
      {data.label || "end"}
    </div>
  );
}

function AgentNode({ data }: NodeProps<NodeData>) {
  return (
    <div className="rounded-lg border border-brand/40 bg-bg-card px-3.5 py-2.5 text-xs shadow-card min-w-[150px]">
      <Handle type="target" position={Position.Left} />
      <div className="flex items-center gap-1.5 text-brand text-[10px] font-semibold uppercase tracking-wider mb-1">
        <Bot className="h-3 w-3" />
        Agent
      </div>
      <div className="font-semibold text-fg">{data.label || "Unbound"}</div>
      {!data.agent_id && (
        <div className="text-fg-subtle text-[10px] mt-1">(click to bind)</div>
      )}
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

const NODE_TYPES = { start: StartNode, end: EndNode, agent: AgentNode };

export default function WorkflowEditPage() {
  return (
    <ReactFlowProvider>
      <Editor />
    </ReactFlowProvider>
  );
}

function Editor() {
  const params = useParams<{ id: string }>();
  const workflowId = params.id;
  const router = useRouter();

  const [wf, setWf] = useState<Workflow | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selected, setSelected] = useState<Node<NodeData> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [runInput, setRunInput] = useState("");
  const [starting, setStarting] = useState(false);

  const [nodes, setNodes, onNodesChange] = useNodesState<NodeData>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const counter = useRef(1);

  useEffect(() => {
    (async () => {
      try {
        const [w, a] = await Promise.all([
          workflowsApi.get(workflowId),
          api.listAgents(),
        ]);
        setWf(w);
        setAgents(a);
        setNodes(
          w.graph.nodes.map((n) => ({
            id: n.id,
            type: n.type,
            position: n.position,
            data: n.data as NodeData,
          })),
        );
        setEdges(
          w.graph.edges.map((e) => ({
            id: e.id,
            source: e.source,
            target: e.target,
            label: e.label ?? undefined,
          })),
        );
        let max = 0;
        for (const n of w.graph.nodes) {
          const m = /^n(\d+)$/.exec(n.id);
          if (m) max = Math.max(max, Number(m[1]));
        }
        counter.current = max + 1;
      } catch (e) {
        setError(String(e));
      }
    })();
  }, [workflowId, setNodes, setEdges]);

  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) => addEdge({ ...connection, id: `e${eds.length + 1}` }, eds));
      setDirty(true);
    },
    [setEdges],
  );

  function addNode(type: "start" | "agent" | "end") {
    const id = `n${counter.current++}`;
    const labels = { start: "start", end: "end", agent: "Unbound" };
    setNodes((ns) => [
      ...ns,
      {
        id,
        type,
        position: { x: 200 + ns.length * 60, y: 100 + (ns.length % 4) * 80 },
        data: { label: labels[type] },
      },
    ]);
    setDirty(true);
  }

  function deleteSelected() {
    if (!selected) return;
    setNodes((ns) => ns.filter((n) => n.id !== selected.id));
    setEdges((es) => es.filter((e) => e.source !== selected.id && e.target !== selected.id));
    setSelected(null);
    setDirty(true);
  }

  function bindAgent(agentId: string) {
    if (!selected) return;
    const agent = agents.find((a) => a.id === agentId);
    if (!agent) return;
    setNodes((ns) =>
      ns.map((n) =>
        n.id === selected.id
          ? { ...n, data: { ...n.data, agent_id: agent.id, label: agent.name } }
          : n,
      ),
    );
    setSelected((s) =>
      s ? { ...s, data: { ...s.data, agent_id: agent.id, label: agent.name } } : s,
    );
    setDirty(true);
  }

  async function save() {
    if (!wf) return;
    setSaving(true);
    try {
      const graph = {
        nodes: nodes.map((n) => ({
          id: n.id,
          type: (n.type as "start" | "agent" | "end") || "agent",
          position: n.position,
          data: n.data,
        })),
        edges: edges.map((e) => ({
          id: e.id,
          source: e.source,
          target: e.target,
          label: e.label ? String(e.label) : null,
        })),
      };
      const updated = await workflowsApi.update(wf.id, { graph });
      setWf(updated);
      setDirty(false);
      setError(null);
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  }

  async function startRun() {
    if (!wf || !runInput.trim()) return;
    setStarting(true);
    try {
      if (dirty) await save();
      const run = await workflowsApi.createRun(wf.id, runInput);
      router.push(`/workflow-runs/${run.id}`);
    } catch (e) {
      setError(String(e));
    } finally {
      setStarting(false);
    }
  }

  const agentsById = useMemo(() => {
    const m: Record<string, Agent> = {};
    for (const a of agents) m[a.id] = a;
    return m;
  }, [agents]);

  return (
    <div className="flex h-screen w-screen">
      <aside className="w-80 shrink-0 border-r border-border bg-bg-subtle flex flex-col">
        <div className="px-5 py-4 border-b border-border">
          <Link
            href="/workflows"
            className="inline-flex items-center gap-1.5 text-xs text-fg-muted hover:text-fg"
          >
            <ArrowLeft className="h-3 w-3" /> Workflows
          </Link>
          <h2 className="mt-2 text-base font-semibold truncate">{wf?.name || "…"}</h2>
          <div className="flex items-center gap-2 mt-1">
            {wf && <Badge tone="neutral">v{wf.version}</Badge>}
            {dirty && <Badge tone="warning">unsaved</Badge>}
            {wf?.is_template && <Badge tone="success">template</Badge>}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
          {error && (
            <div className="rounded-md border border-danger/40 bg-danger-subtle/30 p-3 text-xs text-danger">
              {error}
            </div>
          )}

          <section>
            <Label>Palette</Label>
            <div className="grid gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => addNode("start")}
                className="justify-start"
              >
                <CircleDot className="h-3.5 w-3.5 text-success" /> Add start
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => addNode("agent")}
                className="justify-start"
              >
                <Bot className="h-3.5 w-3.5 text-brand" /> Add agent
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => addNode("end")}
                className="justify-start"
              >
                <Flag className="h-3.5 w-3.5 text-danger" /> Add end
              </Button>
            </div>
          </section>

          <section>
            <Label>Selection</Label>
            {!selected && (
              <p className="text-xs text-fg-subtle">
                Click a node on the canvas to inspect it.
              </p>
            )}
            {selected && (
              <div className="space-y-3">
                <div className="text-xs text-fg-muted space-y-0.5">
                  <div>
                    <span className="text-fg-subtle">id: </span>
                    <code className="text-fg">{selected.id}</code>
                  </div>
                  <div>
                    <span className="text-fg-subtle">type: </span>
                    <code className="text-fg">{selected.type}</code>
                  </div>
                </div>

                {selected.type === "agent" && (
                  <div>
                    <Label>Bind agent</Label>
                    <Select
                      value={(selected.data.agent_id as string) || ""}
                      onChange={(e) => bindAgent(e.target.value)}
                    >
                      <option value="">— select —</option>
                      {agents.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                    </Select>
                    {selected.data.agent_id &&
                      agentsById[selected.data.agent_id as string] && (
                        <div className="text-xs text-fg-subtle mt-2 font-mono">
                          {agentsById[selected.data.agent_id as string].model}
                        </div>
                      )}
                  </div>
                )}

                <Button variant="danger" size="sm" onClick={deleteSelected} className="w-full">
                  <Trash2 className="h-3.5 w-3.5" /> Delete node
                </Button>
              </div>
            )}
          </section>

          <section>
            <Button
              onClick={save}
              disabled={saving || !dirty}
              className="w-full"
              variant={dirty ? "primary" : "secondary"}
            >
              <Save className="h-4 w-4" /> {saving ? "Saving…" : dirty ? "Save" : "Saved"}
            </Button>
          </section>

          <section>
            <Label>Run</Label>
            <Textarea
              value={runInput}
              onChange={(e) => setRunInput(e.target.value)}
              placeholder="Workflow input (passed to the first agent)"
              rows={3}
            />
            <Button
              onClick={startRun}
              disabled={starting || !runInput.trim()}
              variant="success"
              className="w-full mt-2"
            >
              <Play className="h-4 w-4" /> {starting ? "Starting…" : "Run workflow"}
            </Button>
          </section>
        </div>
      </aside>

      <div className="flex-1 relative">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={NODE_TYPES}
          onNodesChange={(c) => {
            onNodesChange(c);
            if (c.some((x) => x.type === "position" || x.type === "remove")) setDirty(true);
          }}
          onEdgesChange={(c) => {
            onEdgesChange(c);
            if (c.length) setDirty(true);
          }}
          onConnect={onConnect}
          onNodeClick={(_, n) => setSelected(n as Node<NodeData>)}
          onPaneClick={() => setSelected(null)}
          fitView
        >
          <Background color="#1f242e" gap={20} />
          <Controls />
          <MiniMap
            nodeColor={(n) =>
              n.type === "start" ? "#9ece6a" : n.type === "end" ? "#f7768e" : "#7aa2f7"
            }
          />
        </ReactFlow>
      </div>
    </div>
  );
}
