// Per-section instructions for the model, and deterministic templates used
// when no on-device model is installed. Templates only restate the plan.

import { CONDITION_LABELS } from '../llm/prompt';
import { ACTIVES } from '../products/ingredients';
import type { ResultsPlan } from './plan';
import type { SectionId } from './schema';
import { splitSentences, wordCount } from './speech';

export const SECTION_TITLES: Record<SectionId, string> = {
  overview: 'What we found',
  contributing: 'What may be contributing',
  routine: 'Your routine',
  products: 'Products for you',
  cautions: 'Cautions',
  expectations: 'What to expect',
  professional: 'When to see a professional',
};

export const SECTION_GUIDANCE: Record<SectionId, string> = {
  overview: 'Describe what the scan noticed in plain, non-medical language. Where the facts say the scan is not very confident, use hedged words like "may" or "seems".',
  contributing: 'Explain which of the listed contributors may apply to this user, tied to what they told you. Do not add any other causes.',
  routine: 'Give the morning steps, then the evening steps, in order.',
  products: 'For each product, say its key ingredient, why it fits, how often to use it, and when in the routine. Mention every listed product.',
  cautions: 'State each caution clearly and kindly.',
  expectations: 'Give realistic timelines, and say what is normal and what is not.',
  professional: 'List the signs that mean seeing a professional. If the facts include an important message, say it first.',
};

const joinList = (items: string[]) =>
  items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;

/** Keeps whole sentences until the word budget is reached. */
function limitWords(text: string, max: number): string {
  const out: string[] = [];
  for (const sentence of splitSentences(text)) {
    if (wordCount([...out, sentence].join(' ')) > max) break;
    out.push(sentence);
  }
  return out.join(' ');
}

export interface SectionText {
  displayText: string;
  spokenText: string;
  productRefs: string[];
}

export function templateSection(id: SectionId, plan: ResultsPlan): SectionText {
  const byRef = new Map(plan.products.map((p) => [p.ref, p]));
  const text = (display: string, productRefs: string[] = [], spoken = display): SectionText => ({
    displayText: display,
    spokenText: limitWords(spoken, 110),
    productRefs,
  });

  switch (id) {
    case 'overview': {
      if (plan.findings.length === 0) {
        return text("Your scan didn't notice anything that stood out today. That's a good sign, so keep going with your current routine.");
      }
      const parts = plan.findings.map((f) => {
        const where = f.region ? ` around the ${f.region}` : '';
        return `${f.severity} ${f.label}${where}${f.hedged ? ', though this result is less certain' : ''}`;
      });
      return text(
        `Your scan looked at ${plan.scanImageRefs.length} views of your face. It noticed ${joinList(parts)}. This is a cosmetic check, not a medical assessment.`,
      );
    }
    case 'contributing':
      return text(`Based on what you shared, a few everyday things may play a part. ${plan.contributors.join(' ')}`);
    case 'routine': {
      const describe = (steps: ResultsPlan['routine']['am']) =>
        steps.map((s) => (s.productRef ? `${s.label.toLowerCase()} with ${byRef.get(s.productRef)!.name}` : s.label.toLowerCase()));
      const refs = [...plan.routine.am, ...plan.routine.pm].flatMap((s) => (s.productRef ? [s.productRef] : []));
      const numbered = (steps: ResultsPlan['routine']['am']) => describe(steps).map((s, i) => `${i + 1}. ${s[0].toUpperCase()}${s.slice(1)}`).join('\n');
      return text(
        `Morning:\n${numbered(plan.routine.am)}\n\nEvening:\n${numbered(plan.routine.pm)}`,
        [...new Set(refs)],
        `In the morning, ${joinList(describe(plan.routine.am))}. In the evening, ${joinList(describe(plan.routine.pm))}.`,
      );
    }
    case 'products': {
      if (plan.products.length === 0) {
        return text("I couldn't find a product in the database that suits everything you told me, so for now keep your routine simple and gentle.");
      }
      const lines = plan.products.map((p) => {
        const actives = p.actives.filter((a) => ACTIVES[a].concerns.length > 0 || p.kind === 'sunscreen').map((a) => ACTIVES[a].name);
        const why = p.addresses.length ? `, which suits ${joinList(p.addresses.map((c) => CONDITION_LABELS[c]))}` : '';
        const has = actives.length ? ` contains ${joinList(actives)}${why}.` : ` is a gentle ${p.kind.replace('_', ' ')}.`;
        return `${p.name}${has} Use it ${p.time === 'AM' ? 'in the morning' : 'in the evening'}, ${p.frequency}.`;
      });
      return text(lines.join('\n\n'), plan.products.map((p) => p.ref), lines.join(' '));
    }
    case 'cautions':
      return text(plan.cautions.join(' '));
    case 'expectations':
      return text(plan.expectations.join(' '));
    case 'professional': {
      const lead = plan.escalation ? `${plan.escalation.message} ` : '';
      return text(`${lead}See a healthcare provider or dermatologist promptly if you notice ${joinList(plan.professionalSigns)}.`);
    }
  }
}
