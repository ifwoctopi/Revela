# Results flow: notes

The personalized scan flow: intake → mock scan → section-by-section summary → narrated, scrolling results → guarded follow-up chat. Everything runs on the device.

Entry point: **Home → "Start a personalized scan"** (below "Start appearance check") (`/results/intake`). Routes are in `mobile/app/results/`. They share one `ResultsFlowProvider` (`mobile/src/flow/ResultsFlowContext.tsx`) that holds the flow's state in memory.

## Codebase findings

### LLM
- **Runtime:** llama.cpp through `llama.rn` (a native module, so it needs a dev build and does not work in Expo Go). See `mobile/src/llm/onDeviceLlm.ts`.
- **Model:** Llama 3.2 3B Instruct, Q4_K_M GGUF. It is loaded from `<documents>/models/` with `n_ctx` 2048 and GPU offload.
- **Prompt format:** chat `messages` (system/user/assistant). llama.rn applies the model's chat template. For JSON output, `response_format: json_schema` constrains decoding with a grammar.
- **Streaming:** the runtime supports a per-token callback. The results flow doesn't stream: every output has to be validated in full before it is shown or spoken.
- **Abstraction:** `LlmClient` (`src/llm/client.ts`) has a single method, `complete()`. The flow and the tests depend only on this interface. When the model file is missing, `createOnDeviceLlmClient()` returns `null` and the flow falls back to deterministic template text.

### Product database
- **Storage:** SQLite (`expo-sqlite`), shipped as `assets/db/products.db`. It is built from the Open Beauty Facts export by `etl/build-products-db.mjs` and is not committed.
- **Schema:** one `products` table with `barcode` (the id), `name`, `brand`, `ingredients`, `categories`, `image_path`, and `last_modified`, plus a sync-watermark table.
- **Access:** `ProductRepository` (`src/products/types.ts`) has two implementations: SQLite and in-memory (used by tests). Its queries are `getByBarcode(s)`, `findFaceCare` (a LIKE prefilter on ingredient/category terms), `searchByName`, and `listBrands`.
- **Retrieval layer:** there is no vector search. Retrieval is a deterministic keyword prefilter followed by the exact rules in `products/ingredients.ts`, which is the rules table for actives, pregnancy flags, sun sensitivity, and conflicts.

### TTS
- **Engine:** Piper (`vits-piper-en_GB-cori-high`) through `react-native-sherpa-onnx`, played with `expo-audio`. See `mobile/services/tts.ts`.
- **Events:** synthesis produces a whole WAV file. Playback only reports status updates and `didJustFinish`. There are **no word or sentence boundary events**.
- **Controls:** the `AudioPlayer` supports pause and resume, and stopping means releasing the player. `prepareSpeech()` was added: it synthesizes without playing and returns `play / pause / resume / release`.

### Mock scan data
- **Location:** `src/data/mockData.ts` (`sampleSessionSummary`, typed as `SessionSummary` in `src/types/session.ts`).
- **Shape:** `session_id`, `timestamp`, `angles_captured` (front/left_3q/right_3q), and `results[condition]`, where each result is `{ present, confidence?, region?, severity? }`. It contains no images.
- **Consumers:** `CaptureSummaryScreen` (the existing `/summary`), and the new flow through `ResultsFlowContext`. The shape is unchanged.

### Navigation, state, tests
- **Navigation:** expo-router, with routes in `mobile/app/` (a header-less Stack with tabs). The results flow keeps its own code under `mobile/src/`, including its own mock-scan `SessionSummary` type in `src/types/session.ts`, which is separate from the vision pipeline's `types/session.ts`.
- **State:** React state and context only; there is no global store. Chat history is not persisted anywhere in the app, so it stays in memory for the session.
- **Tests:** Jest with `jest-expo`, `src/**/__tests__/*.test.ts(x)`.

## What was built (file map)

| Area | Files |
|---|---|
| Intake | `intake/questions.ts`, `intake/extract.ts`, `intake/userContext.ts` (strict schema), `intake/storage.ts` (per-user JSON under documents), `screens/IntakeScreen.tsx` |
| Scan | `screens/MockScanScreen.tsx`, `components/ScanIllustration.tsx` |
| Deterministic plan | `summary/plan.ts`: grade→tier, sensitivity and pregnancy filtering, conflict checks, timelines |
| Generation | `summary/generate.ts`, `summary/sections.ts`, `summary/schema.ts`, `summary/speech.ts` |
| Narration | `narration/narrator.ts`, `narration/autoScroll.ts`, `screens/NarratedResultsScreen.tsx`, `components/ProductImage.tsx`, `products/images.ts` |
| Chat | `screens/FollowUpChatScreen.tsx`, `guardrails/pipeline.ts` |
| Guardrails | `guardrails/contextBuilder.ts` (L1), `systemPrompt.ts` (L2), `grounding.ts` (L3), `outputValidator.ts` (L4), `escalation.ts`, `inputFilter.ts`, `messages.ts` (**`FALLBACK_MESSAGE`**, the single constant) |
| Wiring | `flow/services.ts`, `flow/ResultsFlowContext.tsx`, `app/results/*` |

## TTS sync approach

The engine exposes only per-utterance completion. The narrator therefore splits each section's validated `spokenText` into sentences and plays **each sentence as its own utterance**. This gives **sentence-level** sync driven entirely by real playback events, with no timers or estimated durations:

- A section's first sentence starting fires `onSectionStart`, which auto-scrolls to the section and highlights it. Each sentence fires `onSentenceStart`, which updates the caption bar.
- While one sentence plays, the next is synthesized, to keep the gaps between them short.
- Skip, stop, and dispose bump a run counter, so a callback from interrupted audio is ignored. Interrupted and prefetched audio is always released.
- If a section is still generating when narration reaches it, the narrator goes to `waiting` and resumes as soon as that section validates. Narration starts once section 1 validates.
- When a screen reader is on, narration doesn't auto-start, so it won't talk over the screen reader. The user presses Play.
- With reduced motion on, scrolling jumps without animation and the image fade is skipped.
- Backgrounding pauses narration. Leaving the screen stops it and releases audio. Chat "read aloud" follows the same rules.

## Assumptions

1. **Single local user.** Sign-in isn't wired up yet, so `CURRENT_USER_ID` is the mock profile's id (`flow/services.ts`). `UserContext` storage is keyed by user id and rejects mismatched records.
2. **No budget question.** The product database has no prices, so budget couldn't affect the results.
3. **Scan images.** The mock data has no photos. `scan:<angle>` image refs render as a face diagram with the flagged regions marked. Product images come from bundled thumbnails or the local cache only (`allowNetwork: false`), because downloading an image would reveal which products were recommended.
4. **The confidence threshold is 0.5** (`SCAN_CONFIDENCE_THRESHOLD`), matching `docs/model-integration.md`. A result below that threshold combined with a severe grade escalates.
5. **Without a model installed,** sections use deterministic template text and chat returns the fallback for anything it can't answer from rules alone.
6. **Escalation errs toward escalating.** For example, "no fever" still triggers the infection rule. Escalations never depend on the model. Every scan and intake escalation appears as a fixed-wording alert banner at the top of the results, and the scan's escalation message is added in code at the start of the "When to see a professional" section, including when that section falls back.
7. **Chat history is not persisted,** because the app has no existing conversation persistence.

## New dependencies

None. Everything uses packages that were already in `package.json`: llama.rn, expo-sqlite, react-native-sherpa-onnx, expo-audio, and expo-file-system.

Config change: `tsconfig.json` now sets `"types": ["jest"]`. TypeScript 6 no longer auto-includes `@types/*`, so `tsc` couldn't see the Jest globals in the test files.

## Tests

In `mobile/src/__tests__/`:
- `schema.test.ts` covers valid and invalid sections and `UserContext`.
- `summary.test.ts` covers the deterministic plan, and checks that an unknown product id triggers 2 retries and then the fallback.
- `guardrails.test.ts` covers the adversarial chat inputs from the spec, unsafe model output, and injection hidden in intake answers.
- `escalation.test.ts` covers every trigger.
- `narration.test.ts` covers section and sentence sync, pause and resume, skip, stale callbacks, release on interruption, and auto-scroll following, manual scroll, and reduced motion.
- `privacy.test.ts` runs the full flow, with and without a model, using stubbed `fetch`, `XMLHttpRequest`, and `WebSocket`. It asserts that no network calls are made and that no user data appears in console output.

## Known limitations and follow-ups

- **Needs professional review:** the escalation patterns (`guardrails/escalation.ts`), the ingredient rules and pregnancy flags (`products/ingredients.ts`), the output-validator medical and diagnosis patterns, and all fixed messages (`guardrails/messages.ts`). A dermatology or esthetics professional should review these before release.
- **Rule matching is English-only and regex-based.** Paraphrases can slip past the input screen. The output validator is the backstop, but it is also pattern-based.
- **Sync is sentence-level only.** Word-level sync would need an engine that exposes timing, for example Piper phoneme durations through sherpa-onnx, which isn't available today.
- **Gaps between sentences.** Synthesizing one sentence at a time can leave short pauses on slow devices.
- **UI tests.** There are no rendered-component tests for the screens. Screen behavior is covered at the controller level: `Narrator` and `AutoScrollController`.
- **Pre-existing type errors.** `src/supabaseclient.ts` imports packages that aren't installed, so `tsc` still reports those errors. This was already the case before this work.
- **Model size.** Llama 3.2 3B with `n_ctx` 2048 limits how many facts each section prompt can include. This is why generation is section by section.
