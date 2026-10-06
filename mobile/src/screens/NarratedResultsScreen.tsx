import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import React from 'react';
import { AccessibilityInfo, AppState, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';

import { PressableScale, Reveal } from '../../components/motion';
import { ExpandableText, HandMark, IconBadge, type IconName } from '../../components/ui';
import { HighlightReel } from '../components/HighlightReel';
import { HomeButton } from '../components/HomeButton';
import { ProductImage } from '../components/ProductImage';
import { ScanIllustration, parseScanRef } from '../components/ScanIllustration';
import { useResultsFlow } from '../flow/ResultsFlowContext';
import { Narrator, type NarratorState } from '../narration/narrator';
import { withSilentFallback } from '../narration/silentSpeech';
import { highlightScene } from '../summary/highlights';
import type { ResultsPlan } from '../summary/plan';
import { SECTION_IDS, type SectionId, type SummarySection } from '../summary/schema';
import { SECTION_TITLES } from '../summary/sections';
import { splitSentences } from '../summary/speech';
import type { SessionSummary } from '../types/session';
import { theme } from '../../constants/theme';

const SECTION_ICONS: Record<SectionId, IconName> = {
  overview: 'sparkles-outline',
  contributing: 'git-branch-outline',
  routine: 'repeat-outline',
  products: 'flask-outline',
  cautions: 'alert-circle-outline',
  expectations: 'calendar-outline',
  professional: 'medkit-outline',
};

function useAccessibilitySetting(
  query: () => Promise<boolean>,
  event: 'reduceMotionChanged' | 'screenReaderChanged',
): boolean | null {
  const [value, setValue] = React.useState<boolean | null>(null);
  React.useEffect(() => {
    let active = true;
    query().then((v) => active && setValue(v), () => active && setValue(false));
    const sub = AccessibilityInfo.addEventListener(event, (v: boolean) => setValue(v));
    return () => {
      active = false;
      sub.remove();
    };
  }, [query, event]);
  return value;
}

export function NarratedResultsScreen() {
  const { services, plan, scan, sections, intakeEscalations } = useResultsFlow();
  const [state, setState] = React.useState<NarratorState>({ status: 'idle', sectionIndex: 0, sentenceIndex: 0 });
  const [phase, setPhase] = React.useState<'highlights' | 'summary'>('highlights');
  /** Section whose scene is on screen; null until the first one starts playing. */
  const [sceneIndex, setSceneIndex] = React.useState<number | null>(null);
  const [voiceUnavailable, setVoiceUnavailable] = React.useState(false);
  const reduceMotion = useAccessibilitySetting(AccessibilityInfo.isReduceMotionEnabled, 'reduceMotionChanged') ?? false;
  const screenReader = useAccessibilitySetting(AccessibilityInfo.isScreenReaderEnabled, 'screenReaderChanged');

  const narratorRef = React.useRef<Narrator | null>(null);
  const fed = React.useRef(new Set<number>());
  const autoStarted = React.useRef(false);
  const phaseRef = React.useRef(phase);
  phaseRef.current = phase;

  React.useEffect(() => {
    if (!services) return;
    // Without a voice (e.g. Expo Go) the highlights still play, captions only.
    const speech = withSilentFallback(services.speech, () => setVoiceUnavailable(true));
    // The user steps through the highlights with Back and Next, so a finished section waits on its scene.
    const narrator = new Narrator(
      speech,
      SECTION_IDS.length,
      { onChange: setState, onSectionStart: setSceneIndex },
      { autoAdvance: false },
    );
    narratorRef.current = narrator;
    fed.current = new Set();
    return () => {
      narrator.dispose();
      narratorRef.current = null;
    };
  }, [services]);

  // Feed each section to the narrator as soon as it validates. Playback waits
  // until every section is ready, so the highlights never stall mid-way on the
  // model (and the voice doesn't compete with it for the CPU).
  React.useEffect(() => {
    const narrator = narratorRef.current;
    if (!narrator) return;
    sections.forEach((s, i) => {
      if (s && !fed.current.has(i)) {
        fed.current.add(i);
        narrator.setSection(i, s);
      }
    });
    if (sections.every(Boolean) && !autoStarted.current && screenReader === false && phaseRef.current === 'highlights') {
      autoStarted.current = true;
      narrator.play();
    }
  }, [sections, services, screenReader]);

  // With a screen reader on, don't talk over it: go straight to the written summary.
  React.useEffect(() => {
    if (screenReader && !autoStarted.current) setPhase('summary');
  }, [screenReader]);

  React.useEffect(() => {
    if (state.status === 'finished') setPhase('summary');
  }, [state.status]);

  // Interruptions: backgrounding or a call pauses and coming back resumes; leaving the screen ends the highlights.
  React.useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next !== 'active') narratorRef.current?.pause();
      else if (phaseRef.current === 'highlights') narratorRef.current?.resume();
    });
    return () => sub.remove();
  }, []);
  useFocusEffect(
    React.useCallback(
      () => () => {
        narratorRef.current?.stop();
        setPhase('summary');
      },
      [],
    ),
  );

  const skip = () => {
    narratorRef.current?.stop();
    setPhase('summary');
  };
  const goTo = (index: number) => {
    setSceneIndex(index);
    narratorRef.current?.jumpTo(index);
  };
  const lastScene = SECTION_IDS.length - 1;
  const next = () => {
    if (sceneIndex === null) return;
    if (sceneIndex >= lastScene) skip();
    else goTo(sceneIndex + 1);
  };
  const back = () => {
    if (sceneIndex !== null && sceneIndex > 0) goTo(sceneIndex - 1);
  };
  const watchAgain = () => {
    setSceneIndex(null);
    setPhase('highlights');
    autoStarted.current = true;
    narratorRef.current?.replay();
  };

  // Every rule-based escalation (scan and intake), shown up front in fixed wording.
  const escalationMessages = [...new Set([plan?.escalation, ...intakeEscalations].flatMap((e) => (e ? [e.message] : [])))];

  if (!plan) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <Text style={styles.body}>No scan results yet.</Text>
      </SafeAreaView>
    );
  }

  if (phase === 'highlights') {
    const narrating = state.status === 'playing' || state.status === 'paused' || state.status === 'sectionEnded';
    const current = sections[state.sectionIndex];
    const caption = narrating && current ? splitSentences(current.spokenText)[state.sentenceIndex] ?? '' : '';
    return (
      <HighlightReel
        sectionCount={SECTION_IDS.length}
        readyCount={sections.filter(Boolean).length}
        sceneIndex={sceneIndex}
        scene={sceneIndex === null ? null : highlightScene(SECTION_IDS[sceneIndex], plan)}
        caption={caption}
        voiceUnavailable={voiceUnavailable}
        escalationMessages={escalationMessages}
        plan={plan}
        scan={scan}
        reduceMotion={reduceMotion}
        sectionEnded={state.status === 'sectionEnded'}
        onBack={back}
        onNext={next}
        onSkip={skip}
      />
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <HomeButton />
        <Reveal>
          <View style={styles.hero}>
            <View style={styles.heroText}>
              <Text style={styles.heroKicker}>Your results</Text>
              <Text style={styles.heroTitle}>Révéla summary</Text>
              <Text style={styles.heroSub}>Tap any section to read more.</Text>
            </View>
            <HandMark size={64} />
          </View>
        </Reveal>
        {services && !services.llm ? (
          <Text style={styles.note}>The on-device language model isn't installed, so this summary uses standard wording.</Text>
        ) : null}
        {escalationMessages.length ? (
          <View style={styles.escalation} accessibilityRole="alert">
            {escalationMessages.map((message) => (
              <Text key={message} style={styles.escalationText}>
                {message}
              </Text>
            ))}
          </View>
        ) : null}
        {sections[0] ? (
          <PressableScale accessibilityRole="button" style={styles.watchAgain} containerStyle={styles.watchAgainWrap} onPress={watchAgain}>
            <Ionicons name="play-circle" size={20} color={theme.colors.primary} />
            <Text style={styles.watchAgainText}>Watch highlights again</Text>
          </PressableScale>
        ) : null}

        {SECTION_IDS.map((id, i) => {
          const section = sections[i];
          return (
            <Reveal key={id} index={i + 1} style={styles.card}>
              <View style={styles.cardHead}>
                <IconBadge name={SECTION_ICONS[id]} tone={id === 'cautions' || id === 'professional' ? 'espresso' : 'ginger'} size={36} />
                <Text style={styles.cardTitle} accessibilityRole="header">
                  {section?.title ?? SECTION_TITLES[id]}
                </Text>
              </View>
              {section ? (
                <>
                  <SectionImages section={section} plan={plan} scan={scan} />
                  <ExpandableText text={section.displayText} lines={3} style={styles.body} />
                </>
              ) : (
                <View style={styles.pending} accessibilityLabel="This section is still being prepared">
                  <View style={styles.pendingLine} />
                  <View style={[styles.pendingLine, { width: '70%' }]} />
                </View>
              )}
            </Reveal>
          );
        })}

        {sections.every(Boolean) ? (
          <PressableScale accessibilityRole="button" style={styles.askCard} onPress={() => router.push('/results/chat')}>
            <IconBadge name="chatbubbles" tone="cream" size={44} />
            <View style={styles.askText}>
              <Text style={styles.askTitle}>Have a question about your results?</Text>
              <Text style={styles.askBody}>Ask a follow-up question.</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.colors.cream} />
          </PressableScale>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function SectionImages({ section, plan, scan }: { section: SummarySection; plan: ResultsPlan; scan: SessionSummary }) {
  if (section.imageRefs.length === 0) return null;
  const products = new Map(plan.products.map((p) => [p.imageRef, p]));

  return (
    <View style={styles.images}>
      {section.imageRefs.map((ref) => {
        const angle = parseScanRef(ref);
        if (angle) return <ScanIllustration key={ref} angle={angle} scan={scan} />;
        const product = products.get(ref);
        if (!product) return null;
        return (
          <View key={ref} style={styles.productTile}>
            <ProductImage barcode={product.barcode} imagePath={product.imagePath} allowNetwork={false} label={product.name} />
            <Text style={styles.productName} numberOfLines={2}>
              {product.name}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: 20, paddingBottom: 32, gap: 14 },
  hero: {
    flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: theme.colors.espresso, borderRadius: 24, padding: 20,
  },
  heroText: { flex: 1, gap: 2 },
  heroKicker: { fontSize: 12, fontWeight: '900', letterSpacing: 2, color: theme.colors.copper, textTransform: 'uppercase' },
  heroTitle: { fontSize: 26, fontWeight: '900', color: theme.colors.cream },
  heroSub: { fontSize: 13, color: theme.colors.onDarkMuted, marginTop: 2 },
  note: { fontSize: 13, color: theme.colors.mutedText, lineHeight: 19 },
  escalation: { padding: 16, borderRadius: 16, backgroundColor: theme.colors.dangerSoft, gap: 8 },
  escalationText: { color: theme.colors.danger, fontSize: 15, lineHeight: 21, fontWeight: '700' },
  card: {
    backgroundColor: theme.colors.surface, borderRadius: 18, padding: 18, borderWidth: 1,
    borderColor: theme.colors.border, gap: 12, ...theme.shadow,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardTitle: { flex: 1, fontSize: 17, fontWeight: '800', color: theme.colors.text },
  body: { fontSize: 15, lineHeight: 22, color: theme.colors.text },
  pending: { gap: 8, paddingVertical: 4 },
  pendingLine: { height: 12, borderRadius: 6, backgroundColor: theme.colors.border, width: '100%' },
  images: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  productTile: { width: 96, alignItems: 'center', gap: 6 },
  productName: { fontSize: 12, color: theme.colors.mutedText, textAlign: 'center' },
  askCard: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: theme.colors.primary, borderRadius: 20, padding: 18 },
  askText: { flex: 1, gap: 2 },
  askTitle: { color: theme.colors.cream, fontSize: 16, fontWeight: '800' },
  askBody: { color: theme.colors.onDarkMuted, fontSize: 14 },
  watchAgainWrap: { alignSelf: 'flex-start' },
  watchAgain: {
    flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 999, backgroundColor: theme.colors.primarySoft,
  },
  watchAgainText: { color: theme.colors.primary, fontWeight: '800' },
});
