export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";

export type Agent = {
  id: string;
  name: string;
  role: string;
  system_prompt: string;
  model: string;
  temperature: number;
  max_tokens: number;
  tools: string[];
  channels: string[];
  memory_config: Record<string, unknown>;
  guardrails: Record<string, unknown>;
  limits: Record<string, unknown>;
  schedule_cron: string | null;
  created_at: string;
  updated_at: string;
};

export type ModelInfo = {
  name: string;
  provider: "groq" | "anthropic" | "ollama" | string;
  label: string;
  input_per_1m: number;
  output_per_1m: number;
  notes?: string;
};

export type ModelCatalog = {
  active_provider: string;
  default_model: string;
  models: ModelInfo[];
};

export type AgentCreate = {
  name: string;
  role?: string;
  system_prompt?: string;
  model?: string;
  temperature?: number;
  max_tokens?: number;
  tools?: string[];
  channels?: string[];
};

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status} ${res.statusText}: ${text}`);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  async listAgents(): Promise<Agent[]> {
    return handle(await fetch(`${API_BASE}/agents`, { cache: "no-store" }));
  },
  async createAgent(payload: AgentCreate): Promise<Agent> {
    return handle(
      await fetch(`${API_BASE}/agents`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      }),
    );
  },
  async deleteAgent(id: string): Promise<void> {
    return handle(
      await fetch(`${API_BASE}/agents/${id}`, { method: "DELETE" }),
    );
  },
  async updateAgent(id: string, payload: Partial<AgentCreate>): Promise<Agent> {
    return handle(
      await fetch(`${API_BASE}/agents/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      }),
    );
  },
  async health(): Promise<{ status: string; db: boolean; redis: boolean }> {
    return handle(await fetch(`${API_BASE}/health`, { cache: "no-store" }));
  },
  async listTools(): Promise<{ tools: string[] }> {
    return handle(await fetch(`${API_BASE}/tools`, { cache: "no-store" }));
  },
  async listModels(): Promise<ModelCatalog> {
    return handle(await fetch(`${API_BASE}/models`, { cache: "no-store" }));
  },
  async createRun(agentId: string, prompt: string): Promise<Run> {
    return handle(
      await fetch(`${API_BASE}/agents/${agentId}/runs`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt }),
      }),
    );
  },
  async getRun(runId: string): Promise<Run> {
    return handle(await fetch(`${API_BASE}/runs/${runId}`, { cache: "no-store" }));
  },
  async listConversations(): Promise<Conversation[]> {
    return handle(await fetch(`${API_BASE}/conversations`, { cache: "no-store" }));
  },
  async getConversation(id: string): Promise<Conversation> {
    return handle(await fetch(`${API_BASE}/conversations/${id}`, { cache: "no-store" }));
  },
  async listConversationMessages(id: string): Promise<ConversationMessage[]> {
    return handle(
      await fetch(`${API_BASE}/conversations/${id}/messages`, { cache: "no-store" }),
    );
  },
  async getStats(): Promise<Stats> {
    return handle(await fetch(`${API_BASE}/stats`, { cache: "no-store" }));
  },
};

export type StatsTotals = {
  agents: number;
  workflows: number;
  agent_runs: number;
  workflow_runs: number;
  conversations: number;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
};

export type StatsAgentRun = {
  id: string;
  agent_id: string;
  agent_name: string | null;
  status: string;
  input: string;
  output: string | null;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
  created_at: string | null;
};

export type StatsWorkflowRun = {
  id: string;
  workflow_id: string;
  workflow_name: string | null;
  status: string;
  input: string;
  output: string | null;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
  created_at: string | null;
};

export type Stats = {
  totals: StatsTotals;
  recent_agent_runs: StatsAgentRun[];
  recent_workflow_runs: StatsWorkflowRun[];
  default_model: string;
};

export type Conversation = {
  id: string;
  channel: string;
  external_id: string;
  agent_id: string;
  title: string | null;
  created_at: string;
  last_activity_at: string;
};

export type ConversationMessage = {
  id: string;
  conversation_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  run_id: string | null;
  created_at: string;
};

export type WorkflowNode = {
  id: string;
  type: "start" | "agent" | "end";
  position: { x: number; y: number };
  data: Record<string, unknown>;
};

export type WorkflowEdge = {
  id: string;
  source: string;
  target: string;
  label?: string | null;
};

export type WorkflowGraph = {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
};

export type Workflow = {
  id: string;
  name: string;
  description: string;
  graph: WorkflowGraph;
  version: number;
  is_template: boolean;
  created_at: string;
  updated_at: string;
};

export const workflowsApi = {
  list: async (): Promise<Workflow[]> =>
    handle(await fetch(`${API_BASE}/workflows`, { cache: "no-store" })),
  get: async (id: string): Promise<Workflow> =>
    handle(await fetch(`${API_BASE}/workflows/${id}`, { cache: "no-store" })),
  create: async (payload: {
    name: string;
    description?: string;
    graph?: WorkflowGraph;
  }): Promise<Workflow> =>
    handle(
      await fetch(`${API_BASE}/workflows`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          graph: { nodes: [], edges: [] },
          ...payload,
        }),
      }),
    ),
  update: async (
    id: string,
    payload: Partial<Pick<Workflow, "name" | "description" | "graph" | "is_template">>,
  ): Promise<Workflow> =>
    handle(
      await fetch(`${API_BASE}/workflows/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      }),
    ),
  remove: async (id: string): Promise<void> =>
    handle(await fetch(`${API_BASE}/workflows/${id}`, { method: "DELETE" })),
  createRun: async (id: string, input: string): Promise<WorkflowRun> =>
    handle(
      await fetch(`${API_BASE}/workflows/${id}/runs`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ input }),
      }),
    ),
  listRuns: async (id: string): Promise<WorkflowRun[]> =>
    handle(await fetch(`${API_BASE}/workflows/${id}/runs`, { cache: "no-store" })),
  getRun: async (runId: string): Promise<WorkflowRun> =>
    handle(await fetch(`${API_BASE}/workflow-runs/${runId}`, { cache: "no-store" })),
  instantiate: async (id: string): Promise<Workflow> =>
    handle(
      await fetch(`${API_BASE}/workflows/${id}/instantiate`, { method: "POST" }),
    ),
};

export type WorkflowRun = {
  id: string;
  workflow_id: string;
  status: "pending" | "running" | "succeeded" | "failed";
  input: string;
  output: string | null;
  error: string | null;
  total_input_tokens: number;
  total_output_tokens: number;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
};

export type WorkflowRunEvent = {
  seq?: number;
  type: string;
  node_id?: string;
  [key: string]: unknown;
};

export function workflowRunWsUrl(runId: string): string {
  const base = API_BASE.replace(/^http/, "ws");
  return `${base}/ws/workflow-runs/${runId}`;
}

export type Run = {
  id: string;
  agent_id: string;
  status: "pending" | "running" | "succeeded" | "failed";
  input: string;
  output: string | null;
  error: string | null;
  total_input_tokens: number;
  total_output_tokens: number;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
};

export type RunEvent = {
  seq?: number;
  type: string;
  [key: string]: unknown;
};

export function runEventsWsUrl(runId: string): string {
  const base = API_BASE.replace(/^http/, "ws");
  return `${base}/ws/runs/${runId}`;
}
