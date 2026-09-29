# LLM

Révéla turns a scan's session summary into short cosmetic feedback with a small
LLM. Per `COPILOT_INSTRUCTIONS.md`, generation runs **on the phone** (llama.cpp
via [`llama.rn`](https://github.com/mybigday/llama.rn)) with zero network calls.

We use **Ollama on a laptop only as a dev tool** to pick a model and tune the
prompt quickly. Both run the same GGUF weights, so what works in Ollama carries
over to the phone.

| Piece | Where |
|---|---|
| Prompt builder (shared) | `mobile/src/llm/prompt.ts` |
| On-device runtime | `mobile/src/llm/onDeviceLlm.ts` |
| System prompt (reference copy) | `llm/prompts/system_prompt.md` |
| Desktop prompt-tuning script | `llm/scripts/try-prompt.ts` |
| Local model files (git-ignored) | `llm/quantized_models/` |

Current model: **Llama 3.2 3B Instruct, Q4_K_M** (~2 GB) — Ollama's `llama3.2`.

## 1. Tune the prompt with Ollama (laptop)

```sh
ollama pull llama3.2           # once
node llm/scripts/try-prompt.ts # from the repo root; needs Node 22.18+
```

The script builds the prompt from `mobile/src/data/mockData.ts` using the same
code as the app and streams Ollama's reply. Edit `mobile/src/llm/prompt.ts`
and re-run. Try other sizes with `OLLAMA_MODEL=llama3.2:1b`.

## 2. Get the model file

Ollama already stores the GGUF on disk. Copy it out:

```powershell
ollama show llama3.2 --modelfile   # the FROM line is the GGUF path
Copy-Item <that path> llm\quantized_models\llama-3.2-3b-instruct-q4_k_m.gguf
```

## 3. Run it on a phone

`llama.rn` is a native module, so it needs a **development build** (not Expo Go):

```sh
cd mobile
npx expo run:android   # or: npx expo run:ios (macOS only)
```

The app looks for the model at `<app documents>/models/llama-3.2-3b-instruct-q4_k_m.gguf`.
For development, push it there manually:

- **Android (debug build):**
  ```sh
  adb push llm/quantized_models/llama-3.2-3b-instruct-q4_k_m.gguf /data/local/tmp/
  adb shell run-as <android.package> mkdir -p files/models
  adb shell run-as <android.package> cp /data/local/tmp/llama-3.2-3b-instruct-q4_k_m.gguf files/models/
  ```
- **iOS simulator:** copy into `$(xcrun simctl get_app_container booted <bundleId> data)/Documents/models/`.

Then call `generateFeedback(summary, profile, onToken)` from `onDeviceLlm.ts`.

**TODO:** ship the model through the app/model update flow (Milestone 6),
downloaded once on first launch. That is the only network access the brief allows.
