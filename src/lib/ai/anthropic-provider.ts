import Anthropic from "@anthropic-ai/sdk";
import type { AIProvider, AIConversationItem, AICompletion } from "./provider";

const MODEL = "claude-sonnet-4-5";
const MAX_TOKENS = 1536;

function toAnthropicMessages(conversation: AIConversationItem[]): Anthropic.MessageParam[] {
  const messages: Anthropic.MessageParam[] = [];

  for (const item of conversation) {
    if (item.role === "user") {
      messages.push({ role: "user", content: item.content });
    } else if (item.role === "assistant") {
      messages.push({ role: "assistant", content: item.content });
    } else if (item.role === "assistant_tool_use") {
      messages.push({
        role: "assistant",
        content: item.toolCalls.map((call) => ({
          type: "tool_use" as const,
          id: call.id,
          name: call.name,
          input: call.input,
        })),
      });
    } else if (item.role === "tool_result") {
      messages.push({
        role: "user",
        content: item.results.map((result) => ({
          type: "tool_result" as const,
          tool_use_id: result.toolCallId,
          content: result.content,
        })),
      });
    }
  }

  return messages;
}

export class AnthropicProvider implements AIProvider {
  private client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  async complete({
    system,
    conversation,
    tools,
  }: {
    system: string;
    conversation: AIConversationItem[];
    tools?: { name: string; description: string; inputSchema: Record<string, unknown> }[];
  }): Promise<AICompletion> {
    const response = await this.client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system,
      messages: toAnthropicMessages(conversation),
      tools: tools?.map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.inputSchema as Anthropic.Tool.InputSchema,
      })),
    });

    let text: string | null = null;
    const toolCalls: AICompletion["toolCalls"] = [];

    for (const block of response.content) {
      if (block.type === "text") {
        text = (text ?? "") + block.text;
      } else if (block.type === "tool_use") {
        toolCalls.push({ id: block.id, name: block.name, input: block.input as Record<string, unknown> });
      }
    }

    return { text, toolCalls };
  }
}
