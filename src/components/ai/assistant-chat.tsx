"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Sparkles, Send, Loader2 } from "lucide-react";
import { askAssistant, type ChatMessage } from "@/lib/actions/ai";
import { createTask } from "@/lib/actions/tasks";
import type { ProposedAction } from "@/lib/ai/tools";

interface DisplayMessage extends ChatMessage {
  proposedAction?: ProposedAction | null;
  error?: boolean;
}

const SUGGESTIONS = [
  "What did I accomplish this week?",
  "What tasks are overdue?",
  "How much revenue did I receive this month?",
  "Which habits are becoming inconsistent?",
];

export function AssistantChat() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const sentInitialQuery = useRef(false);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, pending]);

  useEffect(() => {
    const q = searchParams.get("q");
    if (q && !sentInitialQuery.current) {
      sentInitialQuery.current = true;
      void send(q);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || pending) return;

    const next: DisplayMessage[] = [...messages, { role: "user", content: trimmed }];
    setMessages(next);
    setInput("");
    setPending(true);

    try {
      const response = await askAssistant(next.map((m) => ({ role: m.role, content: m.content })));
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: response.text, proposedAction: response.proposedAction, error: !response.ok },
      ]);
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "AI insights are temporarily unavailable.", error: true }]);
    } finally {
      setPending(false);
    }
  }

  async function confirmAction(action: ProposedAction) {
    setConfirming(true);
    try {
      if (action.type === "create_task") {
        await createTask({
          title: action.payload.title,
          due_date: action.payload.due_date,
          priority: (action.payload.priority as never) ?? undefined,
        });
        setMessages((prev) => [...prev, { role: "assistant", content: `Created "${action.payload.title}".` }]);
        router.refresh();
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: err instanceof Error ? err.message : "Failed to create.", error: true },
      ]);
    } finally {
      setConfirming(false);
    }
  }

  return (
    <div className="flex h-[calc(100vh-160px)] flex-col rounded-xl border border-border bg-surface">
      <div className="flex-1 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
            <Sparkles size={28} className="text-accent" />
            <div>
              <p className="text-sm font-medium">Ask about your data</p>
              <p className="mt-1 text-sm text-muted">Answers come from your real AMHIL OS records — nothing is invented.</p>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => send(s)}
                  className="rounded-lg border border-border px-3 py-2 text-left text-sm text-muted hover:border-accent hover:text-foreground"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] rounded-xl px-4 py-2.5 text-sm ${
                    m.role === "user"
                      ? "bg-accent text-accent-foreground"
                      : m.error
                        ? "border border-danger/40 bg-danger/10 text-danger"
                        : "bg-background text-foreground"
                  }`}
                >
                  <p className="whitespace-pre-wrap">{m.content}</p>
                  {m.proposedAction?.type === "create_task" && (
                    <div className="mt-3 rounded-lg border border-border bg-surface p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted">Proposed task</p>
                      <p className="mt-1 font-medium">{m.proposedAction.payload.title}</p>
                      <p className="text-xs text-muted">
                        {m.proposedAction.payload.due_date ? `Due ${m.proposedAction.payload.due_date}` : "No due date"}
                        {m.proposedAction.payload.priority ? ` · ${m.proposedAction.payload.priority} priority` : ""}
                      </p>
                      <button
                        type="button"
                        disabled={confirming}
                        onClick={() => confirmAction(m.proposedAction!)}
                        className="mt-2 rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground hover:opacity-90 disabled:opacity-50"
                      >
                        {confirming ? "Creating…" : "Create it"}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {pending && (
              <div className="flex justify-start">
                <div className="flex items-center gap-2 rounded-xl bg-background px-4 py-2.5 text-sm text-muted">
                  <Loader2 size={14} className="animate-spin" />
                  Thinking…
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="flex items-center gap-2 border-t border-border p-3"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about your tasks, time, learning, finances…"
          className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
        />
        <button
          type="submit"
          disabled={pending || !input.trim()}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground hover:opacity-90 disabled:opacity-50"
          aria-label="Send"
        >
          <Send size={16} />
        </button>
      </form>
    </div>
  );
}
