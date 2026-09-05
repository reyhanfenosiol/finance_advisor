"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles, Send, X, Wallet, TrendingUp, MessageSquarePlus, Eraser } from "lucide-react";
import type { AdvisorType } from "@/types";

type ChatMessage = { id: string; role: "user" | "assistant"; content: string };

const ADVISOR_META: Record<AdvisorType, { title: string; icon: typeof Wallet; placeholder: string }> = {
  cashflow: {
    title: "Cashflow Advisor",
    icon: Wallet,
    placeholder: "Tanya soal pengeluaran, kategori, atau anggaran Anda...",
  },
  investment: {
    title: "Investment Advisor",
    icon: TrendingUp,
    placeholder: "Tanya soal alokasi aset, return, atau diversifikasi...",
  },
};

export function ChatWidget({
  advisorType,
  open,
  onOpenChange,
}: {
  advisorType: AdvisorType;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const loadedRef = useRef(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const meta = ADVISOR_META[advisorType];
  const Icon = meta.icon;

  useEffect(() => {
    if (!open || loadedRef.current) return;
    loadedRef.current = true;

    (async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: conversation } = await supabase
        .from("ai_conversations")
        .select("id")
        .eq("user_id", user.id)
        .eq("advisor_type", advisorType)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (conversation) {
        setConversationId(conversation.id);
        const { data: history } = await supabase
          .from("ai_messages")
          .select("id, role, content")
          .eq("conversation_id", conversation.id)
          .order("created_at", { ascending: true });
        setMessages(history ?? []);
      }
    })();
  }, [open, advisorType]);

  function scrollToBottom() {
    requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }));
  }

  function handleNewChat() {
    if (sending) return;
    setMessages([]);
    setConversationId(null);
  }

  function handleClearChat() {
    if (sending) return;
    setMessages([]);
  }

  async function sendMessage() {
    const text = input.trim();
    if (!text || sending) return;

    setInput("");
    setSending(true);

    const userMsg: ChatMessage = { id: crypto.randomUUID(), role: "user", content: text };
    const assistantId = crypto.randomUUID();
    setMessages((prev) => [...prev, userMsg, { id: assistantId, role: "assistant", content: "" }]);
    scrollToBottom();

    try {
      const res = await fetch(`/api/ai/${advisorType}-advisor`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId, message: text }),
      });

      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({ error: "Terjadi kesalahan." }));
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, content: `⚠️ ${err.error ?? "Gagal mendapat respons."}` } : m
          )
        );
        return;
      }

      const newConversationId = res.headers.get("X-Conversation-Id");
      if (newConversationId) setConversationId(newConversationId);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, content: acc } : m)));
        scrollToBottom();
      }
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId ? { ...m, content: "⚠️ Gagal terhubung ke server." } : m
        )
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => onOpenChange(!open)}
        aria-label={`Buka ${meta.title}`}
        className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105"
      >
        {open ? <X className="h-5 w-5" /> : <Sparkles className="h-5 w-5" />}
      </button>

      <div
        className={cn(
          "fixed top-0 right-0 z-50 flex h-screen w-full max-w-[400px] flex-col bg-card shadow-2xl transition-transform duration-300 ease-out",
          open ? "translate-x-0" : "translate-x-full"
        )}
      >
        <div className="flex items-center gap-3 bg-primary px-5 py-4 text-primary-foreground">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-warning">
            <Icon className="h-4 w-4 text-primary" />
          </div>
          <div className="flex-1">
            <div className="text-sm font-semibold">{meta.title}</div>
            <div className="flex items-center gap-1.5 text-[11.5px] text-primary-foreground/70">
              <span className="h-1.5 w-1.5 rounded-full bg-success" />
              Online
            </div>
          </div>
          <button
            type="button"
            onClick={handleNewChat}
            title="Percakapan baru"
            aria-label="Percakapan baru"
            className="text-primary-foreground/70 hover:text-primary-foreground"
          >
            <MessageSquarePlus className="h-4.5 w-4.5" />
          </button>
          <button
            type="button"
            onClick={handleClearChat}
            title="Bersihkan tampilan chat"
            aria-label="Bersihkan tampilan chat"
            className="text-primary-foreground/70 hover:text-primary-foreground"
          >
            <Eraser className="h-4.5 w-4.5" />
          </button>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="text-primary-foreground/70 hover:text-primary-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto bg-background p-4">
          {messages.length === 0 && (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
              <Icon className="h-8 w-8 text-primary/40" />
              <p>Mulai percakapan dengan {meta.title}.</p>
            </div>
          )}

          <div className="space-y-3">
            {messages.map((m) => (
              <div key={m.id} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "max-w-[85%] whitespace-pre-wrap rounded-xl px-3.5 py-2.5 text-[13px] leading-relaxed",
                    m.role === "user"
                      ? "rounded-tr-sm bg-primary text-primary-foreground"
                      : "rounded-tl-sm border border-border bg-card text-foreground"
                  )}
                >
                  {m.role === "assistant" && m.content === "" && sending ? (
                    <span className="inline-flex items-center gap-1 text-muted-foreground">
                      <Sparkles className="h-3.5 w-3.5 animate-pulse" />
                      Berpikir...
                    </span>
                  ) : (
                    m.content
                  )}
                </div>
              </div>
            ))}
          </div>
          <div ref={bottomRef} />
        </div>

        <div className="flex items-end gap-2 border-t border-border bg-card p-3">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            placeholder={meta.placeholder}
            rows={1}
            className="max-h-28 min-h-10 flex-1 resize-none rounded-full"
          />
          <Button
            size="icon"
            className="shrink-0 rounded-full"
            onClick={sendMessage}
            disabled={sending || !input.trim()}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </>
  );
}
