// What the highlight reel shows while each section's voiceover plays: big
// numbers, icons and images taken straight from the plan. Built in code, never
// by the model, so every number on screen matches the written summary.

import type { Ionicons } from '@expo/vector-icons';

import { ACTIVES } from '../products/ingredients';
import type { ConditionName, Severity } from '../types/session';
import { TIMELINE_LABELS, type ResultsPlan } from './plan';
import type { SectionId } from './schema';

export type IconName = keyof typeof Ionicons.glyphMap;

export interface HighlightStat {
  icon: IconName;
  value: number | string;
  label: string;
}

export interface HighlightChip {
  icon: IconName;
  label: string;
  detail?: string;
  /** 1–3, drawn as a small meter (severity). */
  level?: 1 | 2 | 3;
}

export interface HighlightScene {
  icon: IconName;
  headline: string;
  stats: HighlightStat[];
  chips: HighlightChip[];
  /** Scan ("scan:front") or product ("product:<barcode>") image refs. */
  imageRefs: string[];
  /** Full sentences shown as a list, for points the voiceover doesn't read. */
  notes: string[];
}

const CONDITION_ICONS: Record<ConditionName, IconName> = {
  acne: 'radio-button-on',
  redness: 'flame-outline',
  dryness: 'leaf-outline',
  hyperpigmentation: 'contrast-outline',
  dark_circles: 'eye-outline',
  oily_skin: 'water-outline',
};

const SHORT_LABELS: Record<ConditionName, string> = {
  acne: 'Breakouts',
  redness: 'Redness',
  dryness: 'Dryness',
  hyperpigmentation: 'Dark spots',
  dark_circles: 'Under-eyes',
  oily_skin: 'Shine',
};

const LEVELS: Record<Severity, 1 | 2 | 3> = { mild: 1, moderate: 2, severe: 3 };

/** Contributor sentences are free text, so the visuals pick out the factors they name. */
const FACTORS: ReadonlyArray<readonly [RegExp, IconName, string]> = [
  [/\bsun\b|sunscreen/i, 'sunny-outline', 'Sun'],
  [/exfoliat/i, 'sparkles-outline', 'Exfoliating'],
  [/moisturi/i, 'water-outline', 'Moisture'],
  [/oily/i, 'water', 'Oil'],
  [/retinoid|strong/i, 'flask-outline', 'Strong actives'],
  [/sensitive|fragrance/i, 'alert-circle-outline', 'Sensitivity'],
  [/sleep/i, 'moon-outline', 'Sleep'],
  [/stress/i, 'pulse-outline', 'Stress'],
  [/weather/i, 'partly-sunny-outline', 'Weather'],
  [/hydration/i, 'beaker-outline', 'Hydration'],
  [/genetic/i, 'people-outline', 'Genetics'],
];

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

export function highlightScene(id: SectionId, plan: ResultsPlan): HighlightScene {
  const scene = (icon: IconName, headline: string, rest: Partial<HighlightScene> = {}): HighlightScene => ({
    icon, headline, stats: [], chips: [], imageRefs: [], notes: [], ...rest,
  });

  switch (id) {
    case 'overview':
      if (plan.findings.length === 0) {
        return scene('sparkles', 'Nothing stood out', { imageRefs: plan.scanImageRefs.slice(0, 1) });
      }
      return scene('scan-outline', 'Your scan', {
        stats: [{ icon: 'scan-outline', value: plan.findings.length, label: plural(plan.findings.length, 'area to focus on', 'areas to focus on') }],
        chips: plan.findings.map((f) => ({
          icon: CONDITION_ICONS[f.condition],
          label: SHORT_LABELS[f.condition],
          detail: [f.region, f.hedged ? 'less certain' : null].filter(Boolean).join(' · ') || undefined,
          level: LEVELS[f.severity],
        })),
        imageRefs: plan.scanImageRefs.slice(0, 1),
      });
    case 'contributing': {
      const text = plan.contributors.join(' ');
      return scene('bulb-outline', 'What may play a part', {
        chips: FACTORS.filter(([pattern]) => pattern.test(text)).slice(0, 6).map(([, icon, label]) => ({ icon, label })),
      });
    }
    case 'routine':
      return scene('repeat', 'Your routine', {
        stats: [
          { icon: 'sunny', value: plan.routine.am.length, label: plural(plan.routine.am.length, 'morning step', 'morning steps') },
          { icon: 'moon', value: plan.routine.pm.length, label: plural(plan.routine.pm.length, 'evening step', 'evening steps') },
        ],
      });
    case 'products': {
      const actives = [...new Set(plan.products.flatMap((p) => p.actives.filter((a) => ACTIVES[a].concerns.length > 0)))];
      return scene('flask-outline', plan.products.length ? 'Picked for you' : 'Keep it simple', {
        stats: plan.products.length
          ? [{ icon: 'flask-outline', value: plan.products.length, label: plural(plan.products.length, 'product', 'products') }]
          : [],
        chips: actives.slice(0, 4).map((a) => ({ icon: 'leaf-outline', label: ACTIVES[a].name })),
        imageRefs: plan.products.map((p) => p.imageRef),
      });
    }
    case 'cautions':
      return scene('shield-checkmark-outline', 'Good to know', {
        stats: [{ icon: 'shield-checkmark-outline', value: plan.cautions.length, label: plural(plan.cautions.length, 'thing to watch', 'things to watch') }],
      });
    case 'expectations':
      return scene('time-outline', 'What to expect', {
        chips: plan.findings.map((f) => ({ icon: 'time-outline', label: SHORT_LABELS[f.condition], detail: TIMELINE_LABELS[f.condition] })),
      });
    case 'professional':
      // TEMPORARY (see SPEAK_PROFESSIONAL_SIGNS): the signs are shown here instead of being read aloud.
      return scene('medkit-outline', 'When to see a pro', {
        notes: plan.professionalSigns.map((s) => `${s[0].toUpperCase()}${s.slice(1)}`),
      });
  }
}
