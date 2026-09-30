import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import React from 'react';
import {
  AccessibilityInfo, Animated, AppState, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View,
} from 'react-native';

import { ProductImage } from '../components/ProductImage';
import { ScanIllustration, parseScanRef } from '../components/ScanIllustration';
import { useResultsFlow } from '../flow/ResultsFlowContext';
import { AutoScrollController } from '../narration/autoScroll';
import { Narrator, type NarratorState } from '../narration/narrator';
import type { ResultsPlan } from '../summary/plan';
import { SECTION_IDS, type SummarySection } from '../summary/schema';
import { SECTION_TITLES } from '../summary/sections';
import { splitSentences } from '../summary/speech';
import type { SessionSummary } from '../types/session';
import { theme } from '../../skubba-mobile-app/constants/theme';

const ACTIVE_STATUSES: NarratorState['status'][] = ['playing', 'paused', 'preparing', 'waiting'];

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
  const [following, setFollowing] = React.useState(true);
  const reduceMotion = useAccessibilitySetting(AccessibilityInfo.isReduceMotionEnabled, 'reduceMotionChanged') ?? false;
  const screenReader = useAccessibilitySetting(AccessibilityInfo.isScreenReaderEnabled, 'screenReaderChanged');

  const reduceMotionRef = React.useRef(reduceMotion);
  reduceMotionRef.current = reduceMotion;
  const scrollRef = React.useRef<ScrollView>(null);
  const autoScroll = React.useMemo(
    () =>
      new AutoScrollController(
        (y, animated) => scrollRef.current?.scrollTo({ y, animated }),
        () => reduceMotionRef.current,
        setFollowing,
      ),
    [],
  );

  const narratorRef = React.useRef<Narrator | null>(null);
  const fed = React.useRef(new Set<number>());
  const autoStarted = React.useRef(false);

  React.useEffect(() => {
    if (!services) return;
    const narrator = new Narrator(services.speech, SECTION_IDS.length, {
      onChange: setState,
      onSectionStart: (i) => autoScroll.onSectionStart(i),
    });
    narratorRef.current = narrator;
    fed.current = new Set();
    return () => {
      narrator.dispose();
      narratorRef.current = null;
    };
  }, [services, autoScroll]);

  // Feed each section to the narrator as soon as it validates; start with section 1.
  React.useEffect(() => {
    const narrator = narratorRef.current;
    if (!narrator) return;
    sections.forEach((s, i) => {
      if (s && !fed.current.has(i)) {
        fed.current.add(i);
        narrator.setSection(i, s);
      }
    });
    // With a screen reader on, don't talk over it: the user starts narration.
    if (sections[0] && !autoStarted.current && screenReader === false) {
      autoStarted.current = true;
      narrator.play();
    }
  }, [sections, services, screenReader]);

  // Interruptions: backgrounding or a call pauses; leaving the screen stops and releases audio.
  React.useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next !== 'active') narratorRef.current?.pause();
    });
    return () => sub.remove();
  }, []);
  useFocusEffect(
    React.useCallback(() => () => narratorRef.current?.stop(), []),
  );

  const narrator = narratorRef.current;
  const isActive = ACTIVE_STATUSES.includes(state.status);
  const currentSection = sections[state.sectionIndex];
  const caption =
    isActive && currentSection ? splitSentences(currentSection.spokenText)[state.sentenceIndex] ?? '' : '';

  // Every rule-based escalation (scan and intake), shown up front in fixed wording.
  const escalationMessages = [...new Set([plan?.escalation, ...intakeEscalations].flatMap((e) => (e ? [e.message] : [])))];

  if (!plan) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <Text style={styles.body}>No scan results yet.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.content}
        onScrollBeginDrag={() => autoScroll.onUserScroll()}
      >
        <Text style={styles.kicker}>Your results</Text>
        <Text style={styles.title}>Révéla summary</Text>
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

        {SECTION_IDS.map((id, i) => {
          const section = sections[i];
          const active = isActive && i === state.sectionIndex;
          return (
            <View
              key={id}
              onLayout={(e) => autoScroll.setSectionOffset(i, e.nativeEvent.layout.y)}
              style={[styles.card, active && styles.activeCard]}
              accessibilityState={{ selected: active }}
            >
              <Text style={styles.cardTitle} accessibilityRole="header">
                {section?.title ?? SECTION_TITLES[id]}
              </Text>
              {section ? (
                <>
                  <SectionImages section={section} plan={plan} scan={scan} active={active} reduceMotion={reduceMotion} />
                  <Text style={styles.body}>{section.displayText}</Text>
                </>
              ) : (
                <View style={styles.pending} accessibilityLabel="This section is still being prepared">
                  <View style={styles.pendingLine} />
                  <View style={[styles.pendingLine, { width: '70%' }]} />
                </View>
              )}
            </View>
          );
        })}

        {state.status === 'finished' || sections.every(Boolean) ? (
          <Pressable accessibilityRole="button" style={styles.askCard} onPress={() => router.push('/results/chat')}>
            <Text style={styles.askTitle}>Have a question about your results?</Text>
            <Text style={styles.askBody}>Ask a follow-up question.</Text>
          </Pressable>
        ) : null}
      </ScrollView>

      {!following && isActive ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Resume following the narration"
          style={styles.resumePill}
          onPress={() => autoScroll.resumeFollowing()}
        >
          <Text style={styles.resumeText}>Resume narration</Text>
        </Pressable>
      ) : null}

      <View style={styles.bar}>
        {state.status === 'error' ? (
          <Text style={styles.caption}>Voice isn't available right now. You can keep reading on screen.</Text>
        ) : caption ? (
          <Text style={styles.caption} numberOfLines={3}>
            {caption}
          </Text>
        ) : null}
        <View style={styles.controls}>
          <Control icon="play-skip-back" label="Previous section" onPress={() => narrator?.previous()} />
          {state.status === 'playing' || state.status === 'preparing' ? (
            <Control icon="pause" label="Pause narration" onPress={() => narrator?.pause()} primary />
          ) : state.status === 'paused' ? (
            <Control icon="play" label="Resume narration" onPress={() => narrator?.resume()} primary />
          ) : (
            <Control icon="play" label="Play narration" onPress={() => narrator?.play()} primary disabled={!sections[0]} />
          )}
          <Control icon="play-skip-forward" label="Next section" onPress={() => narrator?.next()} />
          <Control icon="stop" label="Stop narration" onPress={() => narrator?.stop()} />
          <Control icon="refresh" label="Replay from the start" onPress={() => narrator?.replay()} />
          <Control icon="chatbubble-ellipses-outline" label="Ask a question" onPress={() => router.push('/results/chat')} />
        </View>
      </View>
    </SafeAreaView>
  );
}

function SectionImages({
  section, plan, scan, active, reduceMotion,
}: { section: SummarySection; plan: ResultsPlan; scan: SessionSummary; active: boolean; reduceMotion: boolean }) {
  const opacity = React.useRef(new Animated.Value(1)).current;

  React.useEffect(() => {
    if (!active || reduceMotion) {
      opacity.setValue(1);
      return;
    }
    opacity.setValue(0.3);
    Animated.timing(opacity, { toValue: 1, duration: 350, useNativeDriver: true }).start();
  }, [active, reduceMotion, opacity]);

  if (section.imageRefs.length === 0) return null;
  const products = new Map(plan.products.map((p) => [p.imageRef, p]));

  return (
    <Animated.View style={[styles.images, { opacity }]}>
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
    </Animated.View>
  );
}

function Control({
  icon, label, onPress, primary, disabled,
}: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; primary?: boolean; disabled?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.control, primary && styles.controlPrimary, disabled && styles.disabled]}
      hitSlop={6}
    >
      <Ionicons name={icon} size={primary ? 26 : 20} color={primary ? '#FFFFFF' : theme.colors.primary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: 20, paddingBottom: 32, gap: 14 },
  kicker: { fontSize: 13, fontWeight: '800', letterSpacing: 2, color: theme.colors.primary, textTransform: 'uppercase' },
  title: { fontSize: 28, fontWeight: '800', color: theme.colors.text },
  note: { fontSize: 13, color: theme.colors.mutedText, lineHeight: 19 },
  escalation: { padding: 16, borderRadius: 16, backgroundColor: '#FBEAEA', gap: 8 },
  escalationText: { color: theme.colors.danger, fontSize: 15, lineHeight: 21, fontWeight: '700' },
  card: {
    backgroundColor: theme.colors.surface, borderRadius: 18, padding: 18, borderWidth: 1,
    borderColor: theme.colors.border, gap: 10,
  },
  activeCard: { borderColor: theme.colors.primary, borderWidth: 2, backgroundColor: theme.colors.primarySoft },
  cardTitle: { fontSize: 18, fontWeight: '800', color: theme.colors.text },
  body: { fontSize: 15, lineHeight: 22, color: theme.colors.text },
  pending: { gap: 8, paddingVertical: 4 },
  pendingLine: { height: 12, borderRadius: 6, backgroundColor: theme.colors.border, width: '100%' },
  images: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  productTile: { width: 96, alignItems: 'center', gap: 6 },
  productName: { fontSize: 12, color: theme.colors.mutedText, textAlign: 'center' },
  askCard: { backgroundColor: theme.colors.primary, borderRadius: 18, padding: 18, gap: 4 },
  askTitle: { color: '#FFFFFF', fontSize: 17, fontWeight: '800' },
  askBody: { color: '#FFFFFF', fontSize: 14 },
  resumePill: {
    position: 'absolute', alignSelf: 'center', bottom: 150, backgroundColor: theme.colors.text,
    borderRadius: 999, paddingHorizontal: 18, paddingVertical: 10,
  },
  resumeText: { color: '#FFFFFF', fontWeight: '800' },
  bar: {
    borderTopWidth: 1, borderTopColor: theme.colors.border, backgroundColor: theme.colors.surface,
    paddingHorizontal: 16, paddingTop: 10, paddingBottom: 12, gap: 10,
  },
  caption: { fontSize: 14, lineHeight: 20, color: theme.colors.text, textAlign: 'center' },
  controls: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  control: {
    width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
    backgroundColor: theme.colors.primarySoft,
  },
  controlPrimary: { width: 56, height: 56, borderRadius: 28, backgroundColor: theme.colors.primary },
  disabled: { opacity: 0.5 },
});
