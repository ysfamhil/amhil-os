/**
 * A minimal, provider-agnostic interface for the one thing this app needs
 * from an AI model: turn a conversation (optionally backed by tools it can
 * call to fetch real data) into a reply. Swapping providers later means
 * writing one new file that implements this interface — nothing else in
 * the app should ever import a provider SDK directly.
 */

export interface AIToolDefinition {
  name: string;
  description: string;
  /** JSON Schema for the tool's input. */
  inputSchema: Record<string, unknown>;
}

export interface AIToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface AIToolResult {
  toolCallId: string;
  content: string;
}

/**
 * One turn in the conversation. A tool-use round trip is two items: the
 * model's own "I want to call these tools" turn, followed by our
 * "here's what they returned" turn — kept explicit (rather than folded into
 * a single opaque message) so the orchestration loop in src/lib/ai/agent.ts
 * can execute tools itself between the two.
 */
export type AIConversationItem =
  | { role: "user"; content: string }
  | { role: "assistant"; content: string }
  | { role: "assistant_tool_use"; toolCalls: AIToolCall[] }
  | { role: "tool_result"; results: AIToolResult[] };

export interface AICompletion {
  /** Final natural-language text, if the model produced any this turn. */
  text: string | null;
  /** Tools the model wants to call before it can finish answering. */
  toolCalls: AIToolCall[];
}

export interface AIProvider {
  complete(params: {
    system: string;
    conversation: AIConversationItem[];
    tools?: AIToolDefinition[];
  }): Promise<AICompletion>;
}

export class AIUnavailableError extends Error {
  constructor(message = "AI insights are temporarily unavailable.") {
    super(message);
    this.name = "AIUnavailableError";
  }
}
