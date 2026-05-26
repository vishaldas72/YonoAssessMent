"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft } from "lucide-react";

import { Card } from "@/components/ui/card";
import { PageBody, PageHeader } from "@/components/page-header";
import { Conversation, ConversationMessage, api } from "@/lib/api";

export default function ConversationDetailPage() {
  const params = useParams<{ id: string }>();
  const convId = params.id;

  const [conv, setConv] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [c, m] = await Promise.all([
        api.getConversation(convId),
        api.listConversationMessages(convId),
      ]);
      setConv(c);
      setMessages(m);
      setError(null);
    } catch (e) {
      setError(String(e));
    }
  }, [convId]);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 3000);
    return () => clearInterval(t);
  }, [refresh]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  return (
    <>
      <PageHeader
        title={
          <div className="flex items-center gap-3">
            <Link
              href="/conversations"
              className="text-fg-muted hover:text-fg transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            {conv?.title || (conv ? `${conv.channel}:${conv.external_id}` : "…")}
          </div>
        }
        description={
          conv ? (
            <span className="font-mono text-xs">
              channel {conv.channel} · chat {conv.external_id}
            </span>
          ) : (
            "Loading…"
          )
        }
      />
      <PageBody className="max-w-3xl">
        {error && (
          <Card className="p-4 border-danger/40 text-danger text-sm mb-6">{error}</Card>
        )}

        <div className="space-y-3">
          {messages.length === 0 && (
            <Card className="p-8 text-center text-sm text-fg-muted">
              No messages yet.
            </Card>
          )}
          {messages.map((m) => {
            const isUser = m.role === "user";
            return (
              <div
                key={m.id}
                className={`flex ${isUser ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[78%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap ${
                    isUser
                      ? "bg-brand-subtle border border-brand/30 rounded-br-sm"
                      : "bg-bg-card border border-border rounded-bl-sm"
                  }`}
                >
                  <div
                    className={`text-[10px] uppercase tracking-wider mb-1 font-semibold ${
                      isUser ? "text-brand" : "text-success"
                    }`}
                  >
                    {m.role}
                  </div>
                  {m.content}
                </div>
              </div>
            );
          })}
          <div ref={endRef} />
        </div>
      </PageBody>
    </>
  );
}
