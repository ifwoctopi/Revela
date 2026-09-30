// Wires the results flow to its on-device dependencies. None of these make
// network calls: SQLite, llama.cpp and Piper all run locally.

import { distinctiveBrands } from '../guardrails/outputValidator';
import type { LlmClient } from '../llm/client';
import type { SpeechEngine } from '../narration/narrator';
import { getProductRepository } from '../products/sqliteRepository';
import type { ProductRepository } from '../products/types';
import { sampleUserProfile } from '../data/mockData';
import { prepareSpeech } from '../../services/tts';

/**
 * There is no working sign-in yet, so the app has one local user: the mock
 * profile's id. Swap for the signed-in user's id once auth is wired up.
 */
export const CURRENT_USER_ID = sampleUserProfile.user_id;

export interface FlowServices {
  repository: ProductRepository;
  /** Null when the model file isn't installed (or native modules are unavailable, e.g. Expo Go). */
  llm: LlmClient | null;
  knownBrands: string[];
  speech: SpeechEngine;
}

function loadLlm(): LlmClient | null {
  try {
    // Loaded lazily: llama.rn is a native module that isn't present in Expo Go.
    const { createOnDeviceLlmClient } = require('../llm/onDeviceLlm') as typeof import('../llm/onDeviceLlm');
    return createOnDeviceLlmClient();
  } catch {
    return null;
  }
}

let servicesPromise: Promise<FlowServices> | null = null;

export function getFlowServices(): Promise<FlowServices> {
  if (!servicesPromise) {
    servicesPromise = (async () => {
      const repository = await getProductRepository();
      return {
        repository,
        llm: loadLlm(),
        knownBrands: distinctiveBrands(await repository.listBrands()),
        speech: { prepare: prepareSpeech },
      };
    })().catch((error: unknown) => {
      servicesPromise = null;
      throw error;
    });
  }
  return servicesPromise;
}
