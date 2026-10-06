// Section-by-section summary generation. Each section gets its own model call
// with only the facts it needs, then passes the schema check and the Layer 4
// output validator. Invalid output is regenerated (up to 2 retries), then
// replaced with the fallback. Nothing reaches the screen or TTS unvalidated.

import { policyFor, sectionFacts } from '../guardrails/contextBuilder';
import { sectionFallbackMessage } from '../guardrails/messages';
import { validateOutput } from '../guardrails/outputValidator';
import { GUARDED_SYSTEM_PROMPT } from '../guardrails/systemPrompt';
import type { UserContext } from '../intake/userContext';
import { extractJson, type LlmClient } from '../llm/client';
import type { ProductRepository } from '../products/types';
import type { ResultsPlan } from './plan';
import { MAX_DISPLAY_CHARS, SECTION_IDS, validateSection, type SectionId, type SummarySection } from './schema';
import { SECTION_FALLBACK_TOPICS, SECTION_GUIDANCE, SECTION_TITLES, templateSection, type SectionText } from './sections';
import { spokenFor } from './speech';

export const MAX_SECTION_RETRIES = 2;

/**
 * Sections the model writes. The others only restate fixed lists from the plan
 * (their facts say "use only these"), so their templates say the same thing
 * and skip a slow on-device model call each.
 */
export const MODEL_WRITTEN_SECTIONS: ReadonlySet<SectionId> = new Set<SectionId>(['overview', 'contributing', 'products']);

/**
 * TEMPORARY, while debugging TTS on the last slide: the professional signs are
 * shown as text on the highlight instead of being read aloud. Set to true to
 * read them again.
 */
export const SPEAK_PROFESSIONAL_SIGNS = false;

const OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    displayText: { type: 'string' },
    productRefs: { type: 'array', items: { type: 'string' } },
  },
  required: ['displayText', 'productRefs'],
};

export interface GenerateOptions {
  llm: LlmClient | null;
  repository: ProductRepository;
  /** Brands used by the output validator to catch ungrounded product mentions. */
  knownBrands: readonly string[];
}

export function fallbackSection(id: SectionId): SummarySection {
  const message = sectionFallbackMessage(SECTION_FALLBACK_TOPICS[id]);
  return {
    id, title: SECTION_TITLES[id], spokenText: spokenFor(SECTION_TITLES[id], message), displayText: message,
    imageRefs: [], productIds: [], isFallback: true,
  };
}

function sectionPrompt(id: SectionId, facts: string, requiresProducts: boolean): string {
  return `Write the "${SECTION_TITLES[id]}" section of this user's skin results.

Facts (use only these and add nothing else):
${facts}

Reply with JSON containing displayText and productRefs.
- displayText: ${SECTION_GUIDANCE[id]} Be brief: short, direct sentences with no filler or repetition, but keep every fact. Plain text only; it is shown on screen and also read aloud, so avoid symbols and abbreviations.
- productRefs: the reference, like P1, of every product you mention${requiresProducts ? ' (at least one)' : ', or an empty list'}.`;
}

async function sectionAttempts(
  id: SectionId,
  plan: ResultsPlan,
  context: UserContext,
  options: GenerateOptions,
  existing: ReadonlySet<string>,
): Promise<SummarySection> {
  const facts = sectionFacts(id, plan, context);
  const barcodeByRef = new Map(facts.products.map((p) => [p.ref, p.barcode]));
  const nameByRef = new Map(facts.products.map((p) => [p.ref, p.name]));
  const requiresProducts = id === 'products' && plan.products.length > 0;
  const imageRefs =
    id === 'overview' ? plan.scanImageRefs : id === 'products' ? plan.products.map((p) => p.imageRef) : [];
  const allowedImageRefs = new Set([...plan.scanImageRefs, ...plan.products.map((p) => p.imageRef)]);
  const prompt = sectionPrompt(id, facts.text, requiresProducts);
  // Only the instruction wording is secret; output is supposed to restate the facts.
  const policy = policyFor(facts, options.knownBrands, MAX_DISPLAY_CHARS, [sectionPrompt(id, '', requiresProducts)]);

  // Product references become names in the text; unknown ones stay visible so validation rejects them.
  const resolveRefs = (text: string) => text.replace(/\[?\b(P\d{1,2})\b\]?/g, (m, ref: string) => nameByRef.get(ref) ?? m);

  const toSection = (out: SectionText) => {
    const displayText = resolveRefs(out.displayText);
    return {
      id,
      title: SECTION_TITLES[id],
      displayText,
      // The voiceover reads everything the summary shows, so it is built from the display text, not written separately.
      spokenText: spokenFor(SECTION_TITLES[id], displayText),
      imageRefs,
      productIds: out.productRefs.map((ref) => barcodeByRef.get(ref) ?? `unknown:${ref}`),
    };
  };

  const accept = (candidate: ReturnType<typeof toSection>): SummarySection | null => {
    const schema = validateSection(candidate, {
      expectedId: id,
      allowedImageRefs,
      existingProductIds: existing,
      offeredProductIds: new Set(facts.products.map((p) => p.barcode)),
      requiresProducts,
    });
    if (!schema.ok) return null;
    const display = validateOutput(schema.section.displayText, policy);
    const spoken = validateOutput(schema.section.spokenText, policy);
    if (!display.ok || !spoken.ok) return null;
    return { ...schema.section, displayText: display.text, spokenText: spoken.text };
  };

  if (!options.llm || !MODEL_WRITTEN_SECTIONS.has(id)) {
    return accept(toSection(templateSection(id, plan))) ?? fallbackSection(id);
  }

  for (let attempt = 0; attempt <= MAX_SECTION_RETRIES; attempt++) {
    try {
      const raw = await options.llm.complete({
        messages: [
          { role: 'system', content: GUARDED_SYSTEM_PROMPT },
          { role: 'user', content: prompt },
        ],
        // Sections are a few short sentences; a lower cap stops long rambles early.
        maxTokens: 300,
        jsonSchema: OUTPUT_SCHEMA,
      });
      const parsed = extractJson(raw) as Partial<Record<keyof SectionText, unknown>> | null;
      if (!parsed || typeof parsed.displayText !== 'string' || !Array.isArray(parsed.productRefs)) {
        continue;
      }
      const section = accept(
        toSection({
          displayText: parsed.displayText,
          productRefs: parsed.productRefs.filter((r): r is string => typeof r === 'string'),
        }),
      );
      if (section) return section;
    } catch {
      // A failed call counts as a failed attempt.
    }
  }
  return fallbackSection(id);
}

/** Yields validated sections in order, as soon as each one is ready. */
export async function* generateSummary(
  plan: ResultsPlan,
  context: UserContext,
  options: GenerateOptions,
): AsyncGenerator<SummarySection> {
  const planned = plan.products.map((p) => p.barcode);
  const existing = new Set((await options.repository.getByBarcodes(planned)).map((p) => p.barcode));
  for (const id of SECTION_IDS) {
    const section = await sectionAttempts(id, plan, context, options, existing);
    if (id !== 'professional') {
      yield section;
      continue;
    }
    const escalated = withEscalation(section, plan);
    yield SPEAK_PROFESSIONAL_SIGNS || escalated.isFallback ? escalated : signsOnScreen(escalated, plan);
  }
}

/** The voiceover for the professional slide without the signs, which the slide shows as text. */
function signsOnScreen(section: SummarySection, plan: ResultsPlan): SummarySection {
  const lead = plan.escalation ? `${plan.escalation.message} ` : '';
  const spoken = `${lead}See a healthcare provider or dermatologist promptly if you notice any sign on screen.`;
  return { ...section, spokenText: spokenFor(section.title, spoken) };
}

/**
 * Escalations are rule-based, so their fixed message is added in code rather
 * than trusted to the model, and it survives a fallback section.
 */
function withEscalation(section: SummarySection, plan: ResultsPlan): SummarySection {
  const message = plan.escalation?.message;
  if (!message) return section;
  if (section.displayText.includes(message)) return section;
  const displayText = `${message} ${section.displayText}`;
  return { ...section, displayText, spokenText: spokenFor(section.title, displayText) };
}
