"use server";

import { createClient } from "@/lib/supabase/server";
import { runAssistantTurn } from "@/lib/ai/agent";
import { getAIProvider } from "@/lib/ai";
import { AIUnavailableError, type AIConversationItem } from "@/lib/ai/provider";
import { todayISODate } from "@/lib/dates";
import type { ProposedAction } from "@/lib/ai/tools";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return { supabase, user };
}

const ASSISTANT_SYSTEM_PROMPT = `You are the AI assistant built into AMHIL OS, a personal operating system for tracking tasks, projects, learning, habits, time, clients, leads, and finances.

Today's date is ${todayISODate()}.

Rules:
- Only answer using data returned by your tools. Never invent numbers, dates, or facts.
- If a tool returns no data for the question asked, say so plainly rather than guessing.
- Keep answers concise and concrete — lead with the number or fact, then brief context.
- "Actual revenue" or "income" means Paid status only; Expected/Invoiced/Cancelled are separate and should not be summed into revenue unless the user explicitly asks about them.
- To create a task, call propose_create_task — never claim you created something without the user confirming.
- You are read-only otherwise: you cannot edit, delete, or complete anything.`;

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface AssistantResponse {
  ok: boolean;
  text: string;
  proposedAction: ProposedAction | null;
}

export async function askAssistant(messages: ChatMessage[]): Promise<AssistantResponse> {
  const { supabase, user } = await requireUser();

  const conversation: AIConversationItem[] = messages.map((m) => ({ role: m.role, content: m.content }));

  try {
    const result = await runAssistantTurn(supabase, user.id, ASSISTANT_SYSTEM_PROMPT, conversation);
    return { ok: true, text: result.text, proposedAction: result.proposedAction };
  } catch (err) {
    const message = err instanceof AIUnavailableError ? err.message : "AI insights are temporarily unavailable.";
    return { ok: false, text: message, proposedAction: null };
  }
}

export interface NarrativeResult {
  ok: boolean;
  text: string;
}

async function generateNarrative(system: string, data: unknown): Promise<NarrativeResult> {
  const provider = getAIProvider();
  if (!provider) {
    return { ok: false, text: "AI insights are temporarily unavailable — add an API key to enable summaries." };
  }
  try {
    const completion = await provider.complete({
      system,
      conversation: [{ role: "user", content: `Here is the data:\n${JSON.stringify(data)}` }],
    });
    return { ok: true, text: completion.text ?? "" };
  } catch {
    return { ok: false, text: "AI insights are temporarily unavailable." };
  }
}

export async function generateWeeklyReviewNarrative(data: unknown): Promise<NarrativeResult> {
  return generateNarrative(
    `You write the narrative summary for a Weekly Review in AMHIL OS, a personal productivity/finance/learning tracker. You will be given this week's real data as JSON — accomplishments, time, finance, habits, and problems (overdue tasks, stalled projects, inconsistent habits).
Write, in this order:
1. A short "Accomplishments" paragraph.
2. A short "Problems" paragraph — only mention issues actually present in the data; say "no issues" if none.
3. A "Next Week" section with 2-4 suggested priorities, clearly labeled as AI-generated recommendations, derived only from the data given.
Only state numbers and facts present in the JSON. Never invent figures. Keep it under 200 words total.`,
    data
  );
}

export async function generateMonthlyReviewNarrative(data: unknown): Promise<NarrativeResult> {
  return generateNarrative(
    `You write the narrative summary for a Monthly Review in AMHIL OS, a personal productivity/finance/learning tracker. You will be given this month's real data as JSON — accomplishments, learning, habits, finance, and goal progress.
Write a natural-language summary of the month in under 200 words, covering major accomplishments, learning progress, financial results, and goal progress. Only state numbers and facts present in the JSON. Never invent figures.`,
    data
  );
}

export async function explainReport(reportName: string, data: unknown): Promise<NarrativeResult> {
  return generateNarrative(
    `You explain a "${reportName}" report tab in AMHIL OS's Reports page. You will be given the exact data currently shown on screen as JSON, for a specific date range the user selected.
Explain what the numbers mean and point out anything notable — but ONLY claims the data actually supports. If the data doesn't support a comparison (e.g. no prior-period figure given), don't invent one. Keep it under 120 words, plain language, no bullet points.`,
    data
  );
}
