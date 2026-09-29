import type { ChatMessage } from './prompt';

export interface CompletionRequest {
  messages: ChatMessage[];
  /** Hard cap on generated tokens. */
  maxTokens: number;
  /** Constrain output to this JSON schema (grammar-based on llama.cpp). */
  jsonSchema?: object;
  temperature?: number;
}

/** The only way app code talks to a language model. Implementations must not touch the network. */
export interface LlmClient {
  complete(request: CompletionRequest): Promise<string>;
}

/** Pulls the first JSON object out of model output. Returns null if none parses. */
export function extractJson(text: string): unknown {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}
