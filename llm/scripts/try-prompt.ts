// Desktop prompt-tuning loop: sends the exact prompt the phone would build
// (mobile/src/llm/prompt.ts) to a local Ollama server and streams the reply.
// Dev tool only — the app itself never talks to Ollama.
//
// Usage (from repo root, Ollama running):
//   node llm/scripts/try-prompt.ts
//   OLLAMA_MODEL=llama3.2:1b node llm/scripts/try-prompt.ts

import { readFileSync } from 'node:fs';

import { sampleSessionSummary, sampleUserProfile } from '../../mobile/src/data/mockData.ts';
import { SYSTEM_PROMPT, buildFeedbackMessages } from '../../mobile/src/llm/prompt.ts';

const OLLAMA_URL = process.env.OLLAMA_HOST ?? 'http://127.0.0.1:11434';
const MODEL = process.env.OLLAMA_MODEL ?? 'llama3.2';

const normalize = (s: string) => s.replace(/\s+/g, ' ').trim();
const promptFile = readFileSync(new URL('../prompts/system_prompt.md', import.meta.url), 'utf8');
if (normalize(promptFile) !== normalize(SYSTEM_PROMPT)) {
  console.warn('warning: llm/prompts/system_prompt.md differs from SYSTEM_PROMPT in mobile/src/llm/prompt.ts\n');
}

const messages = buildFeedbackMessages(sampleSessionSummary, sampleUserProfile);
console.log(`--- prompt (${MODEL}) ---\n${messages.at(-1)!.content}\n\n--- reply ---`);

// Options mirror mobile/src/llm/onDeviceLlm.ts so results carry over to the phone.
const response = await fetch(`${OLLAMA_URL}/api/chat`, {
  method: 'POST',
  body: JSON.stringify({
    model: MODEL,
    messages,
    stream: true,
    options: { num_ctx: 2048, num_predict: 300, temperature: 0.4 },
  }),
}).catch(() => {
  console.error(`Could not reach Ollama at ${OLLAMA_URL}. Is it running? (start the Ollama app or run \`ollama serve\`)`);
  process.exit(1);
});

if (!response.ok) {
  console.error(`Ollama error ${response.status}: ${await response.text()}`);
  process.exit(1);
}

// Ollama streams newline-delimited JSON chunks.
const decoder = new TextDecoder();
let buffered = '';
for await (const chunk of response.body!) {
  buffered += decoder.decode(chunk, { stream: true });
  const lines = buffered.split('\n');
  buffered = lines.pop()!;
  for (const line of lines.filter(Boolean)) {
    const data = JSON.parse(line);
    process.stdout.write(data.message?.content ?? '');
    if (data.done) {
      const seconds = data.eval_duration / 1e9;
      console.log(`\n\n--- ${data.eval_count} tokens in ${seconds.toFixed(1)}s (${(data.eval_count / seconds).toFixed(1)} tok/s) ---`);
    }
  }
}
