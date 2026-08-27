import { AnthropicProvider } from "./anthropic-provider";
import type { AIProvider } from "./provider";

export * from "./provider";

/**
 * Returns the configured AI provider, or null if none is set up. Every
 * caller must handle the null case gracefully — the app must keep working
 * with AI features simply hidden/disabled when no key is configured.
 */
export function getAIProvider(): AIProvider | null {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  return new AnthropicProvider(apiKey);
}
