// On-device LLM runtime (llama.cpp via llama.rn). No network calls here:
// the model is a local GGUF file and generation runs entirely on the phone.
//
// Requires a development build (`npx expo run:ios` / `run:android`); llama.rn
// is a native module and does not work in Expo Go.

import { File, Paths } from 'expo-file-system';
import { initLlama, type LlamaContext } from 'llama.rn';

import type { SessionSummary, UserProfile } from '../types/session';
import type { LlmClient } from './client';
import { buildFeedbackMessages } from './prompt';

// Same weights as Ollama's `llama3.2` (3B, Q4_K_M). See llm/README.md for how
// to get this file onto a device.
export const MODEL_FILENAME = 'llama-3.2-3b-instruct-q4_k_m.gguf';

const STOP_WORDS = ['<|eot_id|>', '<|end_of_text|>', '</s>', '<|im_end|>', '<|end|>'];

let contextPromise: Promise<LlamaContext> | null = null;

export function getModelFile(): File {
  return new File(Paths.document, 'models', MODEL_FILENAME);
}

export function isModelAvailable(): boolean {
  return getModelFile().exists;
}

function getContext(onLoadProgress?: (progress: number) => void): Promise<LlamaContext> {
  if (!contextPromise) {
    contextPromise = initLlama(
      {
        model: getModelFile().uri,
        n_ctx: 2048,
        n_gpu_layers: 99, // Metal on iOS, OpenCL on supported Android GPUs
        use_mlock: true,
      },
      onLoadProgress,
    ).catch((error: unknown) => {
      contextPromise = null; // allow a retry after a failed load
      throw error;
    });
  }
  return contextPromise;
}

export async function generateFeedback(
  summary: SessionSummary,
  profile: UserProfile,
  onToken?: (textSoFar: string) => void,
): Promise<string> {
  if (!isModelAvailable()) {
    throw new Error(`LLM model not found on device (expected ${MODEL_FILENAME}).`);
  }

  const context = await getContext();
  let textSoFar = '';
  const result = await context.completion(
    {
      messages: buildFeedbackMessages(summary, profile),
      n_predict: 300,
      temperature: 0.4,
      stop: STOP_WORDS,
    },
    onToken &&
      ((data) => {
        textSoFar += data.token;
        onToken(textSoFar);
      }),
  );
  return result.text.trim();
}

/** LlmClient backed by the on-device model. Returns null when the model file isn't installed. */
export function createOnDeviceLlmClient(): LlmClient | null {
  if (!isModelAvailable()) return null;
  return {
    async complete({ messages, maxTokens, jsonSchema, temperature = 0.3 }) {
      const context = await getContext();
      const result = await context.completion({
        messages,
        n_predict: maxTokens,
        temperature,
        stop: STOP_WORDS,
        response_format: jsonSchema ? { type: 'json_schema', json_schema: { strict: true, schema: jsonSchema } } : undefined,
      });
      return result.text.trim();
    },
  };
}

export async function releaseLlm(): Promise<void> {
  const pending = contextPromise;
  contextPromise = null;
  if (pending) await (await pending).release();
}
