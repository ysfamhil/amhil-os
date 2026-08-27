import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { getAIProvider } from "@/lib/ai";
import { AIUnavailableError, type AIConversationItem, type AIToolResult } from "@/lib/ai/provider";
import { AI_TOOLS, runAITool, type ProposedAction } from "@/lib/ai/tools";

const MAX_TOOL_ROUNDS = 4;

export interface AgentResult {
  text: string;
  proposedAction: ProposedAction | null;
}

/**
 * Runs one assistant turn to completion: lets the model call read-only data
 * tools as many times as it needs (capped, so a confused model can't loop
 * forever racking up API calls), then returns its final natural-language
 * answer. A `propose_create_task` call short-circuits the loop and is
 * surfaced to the UI as a confirmation card instead of more tool rounds.
 */
export async function runAssistantTurn(
  supabase: SupabaseClient<Database>,
  userId: string,
  system: string,
  conversation: AIConversationItem[]
): Promise<AgentResult> {
  const provider = getAIProvider();
  if (!provider) throw new AIUnavailableError("AI is not configured. Add ANTHROPIC_API_KEY to enable it.");

  const working = [...conversation];

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    let completion;
    try {
      completion = await provider.complete({ system, conversation: working, tools: AI_TOOLS });
    } catch {
      throw new AIUnavailableError();
    }

    if (completion.toolCalls.length === 0) {
      return { text: completion.text ?? "", proposedAction: null };
    }

    working.push({ role: "assistant_tool_use", toolCalls: completion.toolCalls });

    const proposeCall = completion.toolCalls.find((c) => c.name === "propose_create_task");
    if (proposeCall) {
      const { proposedAction } = await runAITool(supabase, userId, proposeCall.name, proposeCall.input);
      return { text: completion.text ?? "", proposedAction: proposedAction ?? null };
    }

    const results: AIToolResult[] = [];
    for (const call of completion.toolCalls) {
      try {
        const { content } = await runAITool(supabase, userId, call.name, call.input);
        results.push({ toolCallId: call.id, content });
      } catch (err) {
        results.push({ toolCallId: call.id, content: `Error: ${err instanceof Error ? err.message : "tool failed"}` });
      }
    }
    working.push({ role: "tool_result", results });
  }

  return { text: "I wasn't able to finish looking that up — try narrowing the question a bit.", proposedAction: null };
}
