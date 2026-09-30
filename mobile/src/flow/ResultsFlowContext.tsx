// In-memory state for one results session: intake → mock scan → narrated
// summary → follow-up chat. Chat history lives only here (the app doesn't
// persist conversations elsewhere), so it ends with the session.

import React from 'react';

import { sampleSessionSummary } from '../data/mockData';
import type { Escalation } from '../guardrails/escalation';
import type { ChatMessage } from '../guardrails/pipeline';
import { emptyUserContext, type UserContext } from '../intake/userContext';
import { loadUserContext, saveUserContext } from '../intake/storage';
import { hasOfflineImage } from '../products/images';
import { generateSummary } from '../summary/generate';
import { buildResultsPlan, type ResultsPlan } from '../summary/plan';
import { SECTION_IDS, type SummarySection } from '../summary/schema';
import type { SessionSummary } from '../types/session';
import { CURRENT_USER_ID, getFlowServices, type FlowServices } from './services';

interface ResultsFlowValue {
  services: FlowServices | null;
  servicesError: boolean;
  userContext: UserContext;
  updateUserContext(next: UserContext): Promise<void>;
  /** Escalations raised during intake; shown again in the results. */
  intakeEscalations: Escalation[];
  addIntakeEscalation(escalation: Escalation): void;
  scan: SessionSummary;
  plan: ResultsPlan | null;
  /** One slot per section, in order; null while that section is still generating. */
  sections: (SummarySection | null)[];
  startResults(): Promise<void>;
  chat: ChatMessage[];
  setChat: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
}

const ResultsFlowContext = React.createContext<ResultsFlowValue | null>(null);

export function ResultsFlowProvider({ children }: { children: React.ReactNode }) {
  const [services, setServices] = React.useState<FlowServices | null>(null);
  const [servicesError, setServicesError] = React.useState(false);
  const [userContext, setUserContext] = React.useState(() => emptyUserContext(CURRENT_USER_ID));
  const [intakeEscalations, setIntakeEscalations] = React.useState<Escalation[]>([]);
  const [plan, setPlan] = React.useState<ResultsPlan | null>(null);
  const [sections, setSections] = React.useState<(SummarySection | null)[]>(() => SECTION_IDS.map(() => null));
  const [chat, setChat] = React.useState<ChatMessage[]>([]);
  const generation = React.useRef(0);
  // Scan results come from the mock data, which stays the source of truth.
  const scan = sampleSessionSummary;

  React.useEffect(() => {
    let active = true;
    getFlowServices().then((s) => active && setServices(s), () => active && setServicesError(true));
    loadUserContext(CURRENT_USER_ID).then((saved) => active && saved && setUserContext(saved), () => undefined);
    return () => {
      active = false;
      generation.current++; // stop feeding sections into an unmounted flow
    };
  }, []);

  const updateUserContext = React.useCallback(async (next: UserContext) => {
    setUserContext(next);
    await saveUserContext(next);
  }, []);

  const addIntakeEscalation = React.useCallback((e: Escalation) => {
    setIntakeEscalations((all) => (all.some((x) => x.trigger === e.trigger) ? all : [...all, e]));
  }, []);

  const startResults = React.useCallback(async () => {
    if (!services) return;
    const run = ++generation.current;
    setSections(SECTION_IDS.map(() => null));
    setChat([]);
    const nextPlan = await buildResultsPlan(scan, userContext, services.repository, { hasOfflineImage });
    // Escalations from the intake answers are surfaced with the results too.
    const withIntake: ResultsPlan =
      !nextPlan.escalation && intakeEscalations.length ? { ...nextPlan, escalation: intakeEscalations[0] } : nextPlan;
    if (run !== generation.current) return;
    setPlan(withIntake);
    let index = 0;
    for await (const section of generateSummary(withIntake, userContext, services)) {
      if (run !== generation.current) return;
      const at = index++;
      setSections((all) => all.map((s, i) => (i === at ? section : s)));
    }
  }, [services, scan, userContext, intakeEscalations]);

  const value: ResultsFlowValue = {
    services, servicesError, userContext, updateUserContext, intakeEscalations, addIntakeEscalation,
    scan, plan, sections, startResults, chat, setChat,
  };
  return <ResultsFlowContext.Provider value={value}>{children}</ResultsFlowContext.Provider>;
}

export function useResultsFlow(): ResultsFlowValue {
  const value = React.useContext(ResultsFlowContext);
  if (!value) throw new Error('useResultsFlow must be used inside ResultsFlowProvider.');
  return value;
}
