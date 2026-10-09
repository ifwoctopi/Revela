// Per-section instructions for the model, and deterministic templates used
// when no on-device model is installed. Templates only restate the plan.

import { CONDITION_LABELS } from '../llm/prompt';
import { ACTIVES } from '../products/ingredients';
import type { ResultsPlan } from './plan';
import type { SectionId } from './schema';

export const SECTION_TITLES: Record<SectionId, string> = {
  overview: 'What we found',
  contributing: 'What may be contributing',
  routine: 'Your routine',
  products: 'Products for you',
  cautions: 'Cautions',
  expectations: 'What to expect',
  professional: 'When to see a professional',
};

/** Fills "I don't have reliable information on …" when a section falls back. */
export const SECTION_FALLBACK_TOPICS: Record<SectionId, string> = {
  overview: 'what your scan found',
  contributing: 'what may be contributing',
  routine: 'your routine',
  products: 'products for you',
  cautions: 'cautions for your routine',
  expectations: 'what to expect',
  professional: 'when to see a professional',
};

export const SECTION_GUIDANCE: Record<SectionId, string> = {
  overview: 'Describe what the scan noticed in plain, non-medical language. Where the facts say the scan is not very confident, use hedged words like "may" or "seems".',
  contributing: 'Explain which of the listed contributors may apply to this user, tied to what they told you. Do not add any other causes.',
  routine: 'Give the morning steps, then the evening steps, in order.',
  products: 'For each product, say its key ingredient, why it fits, how often to use it, and when in the routine. Mention every listed product.',
  cautions: 'State each caution clearly and kindly.',
  expectations: 'Give realistic timelines, and say what is normal and what is not.',
  professional: 'List the signs that mean seeing a professional, one per line. If the facts include an important message, say it first.',
};

const joinList = (items: string[]) =>
  items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;

export interface SectionText {
  displayText: string;
  productRefs: string[];
}

export function templateSection(id: SectionId, plan: ResultsPlan): SectionText {
  const byRef = new Map(plan.products.map((p) => [p.ref, p]));
  // The voiceover reads this same text (see spokenFor), so the highlights say everything the summary shows.
  const text = (displayText: string, productRefs: string[] = []): SectionText => ({ displayText, productRefs });

  switch (id) {
    case 'overview': {
      if (plan.findings.length === 0) {
        return text("Nothing stood out today. Keep up your current routine.");
      }
      const parts = plan.findings.map((f) => {
        const where = f.region ? ` around the ${f.region}` : '';
        return `${f.hedged ? 'possible ' : ''}${f.severity} ${f.label}${where}`;
      });
      return text(`Across ${plan.scanImageRefs.length} views, we noticed ${joinList(parts)}. This is a cosmetic check, not a medical assessment.`);
    }
    case 'contributing':
      return text(plan.contributors.join(' '));
    case 'routine': {
      const describe = (steps: ResultsPlan['routine']['am']) =>
        steps.map((s) => (s.productRef ? `${s.label.toLowerCase()} with ${byRef.get(s.productRef)!.name}` : s.label.toLowerCase()));
      const refs = [...plan.routine.am, ...plan.routine.pm].flatMap((s) => (s.productRef ? [s.productRef] : []));
      const numbered = (steps: ResultsPlan['routine']['am']) => describe(steps).map((s, i) => `${i + 1}. ${s[0].toUpperCase()}${s.slice(1)}`).join('\n');
      return text(
        `Morning:\n${numbered(plan.routine.am)}\n\nEvening:\n${numbered(plan.routine.pm)}`,
        [...new Set(refs)],
      );
    }
    case 'products': {
      if (plan.products.length === 0) {
        return text("No product in the database suits everything you told me, so keep your routine simple and gentle for now.");
      }
      const lines = plan.products.map((p) => {
        const actives = p.actives.filter((a) => ACTIVES[a].concerns.length > 0 || p.kind === 'sunscreen').map((a) => ACTIVES[a].name);
        const why = p.addresses.length ? ` for ${joinList(p.addresses.map((c) => CONDITION_LABELS[c]))}` : '';
        const has = actives.length ? ` has ${joinList(actives)}${why}.` : ` is a gentle ${p.kind.replace('_', ' ')}.`;
        return `${p.name}${has} Use ${p.time === 'AM' ? 'mornings' : 'evenings'}, ${p.frequency}.`;
      });
      return text(
        lines.join('\n\n'),
        plan.products.map((p) => p.ref),
      );
    }
    case 'cautions':
      return text(plan.cautions.join(' '));
    case 'expectations':
      return text(plan.expectations.join(' '));
    case 'professional': {
      const lead = plan.escalation ? `${plan.escalation.message} ` : '';
      // One sign per line: easier to scan, and each is read as its own short sentence.
      const signs = plan.professionalSigns.map((s) => `- ${s[0].toUpperCase()}${s.slice(1)}`).join('\n');
      return text(`${lead}See a healthcare provider or dermatologist promptly if you notice:\n${signs}`);
    }
  }
}
