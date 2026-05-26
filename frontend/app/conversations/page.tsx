"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { MessagesSquare } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { PageBody, PageHeader } from "@/components/page-header";
import { Agent, Conversation, api } from "@/lib/api";

export default function ConversationsPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [agentsById, setAgentsById] = useState<Record<string, Agent>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    setLoading(true);
    try {
      const [convs, agents] = await Promise.all([
        api.listConversations(),
        api.listAgents(),
      ]);
      setConversations(convs);
      const map: Record<string, Agent> = {};
      for (const a of agents) map[a.id] = a;
      setAgentsById(map);
      setError(null);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 5000);
    return () => clearInterval(t);
  }, []);

  return (
    <>
      <PageHeader
        title="Conversations"
        description="Persisted chat history. Telegram messages appear here automatically."
      />
      <PageBody className="max-w-3xl">
        {error && (
          <Card className="p-4 border-danger/40 text-danger text-sm mb-6">{error}</Card>
        )}
        {loading && conversations.length === 0 && (
          <Card className="p-6 text-sm text-fg-muted">Loading…</Card>
        )}
        {!loading && conversations.length === 0 && (
          <Card className="p-10 text-center">
            <MessagesSquare className="h-8 w-8 text-fg-subtle mx-auto mb-3" />
            <div className="text-sm text-fg-muted">
              No conversations yet. Message your Telegram bot to start one.
            </div>
          </Card>
        )}

        <div className="space-y-2">
          {conversations.map((c) => {
            const agent = agentsById[c.agent_id];
            return (
              <Link key={c.id} href={`/conversations/${c.id}`} className="block">
                <Card interactive className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-semibold text-sm">
                        {c.title || `${c.channel}:${c.external_id}`}
                      </div>
                      <div className="text-xs text-fg-muted mt-1">
                        → {agent ? agent.name : "(deleted agent)"}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <Badge tone="success">{c.channel}</Badge>
                      <div className="text-[11px] text-fg-subtle mt-1.5">
                        {new Date(c.last_activity_at).toLocaleString()}
                      </div>
                    </div>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      </PageBody>
    </>
  );
}
