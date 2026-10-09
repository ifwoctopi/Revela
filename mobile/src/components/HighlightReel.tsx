// The narrated part of the results: one animated scene per summary section,
// played while the voice reads that section, and stepped through with Back and
// Next. Visuals come from summary/highlights.ts (the plan), never from model text.

import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Animated, Easing, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';

import { ProductImage } from './ProductImage';
import { ScanIllustration, parseScanRef } from './ScanIllustration';
import type { HighlightChip, HighlightScene, HighlightStat } from '../summary/highlights';
import type { ResultsPlan } from '../summary/plan';
import type { SessionSummary } from '../types/session';
import { theme } from '../../constants/theme';

const INK = '#FFF9F1';
const INK_MUTED = 'rgba(255, 249, 241, 0.72)';
const GLASS = 'rgba(255, 249, 241, 0.12)';

interface Props {
  sectionCount: number;
  /** Sections generated so far; shown while the highlights are being prepared. */
  readyCount: number;
  /** Section being narrated, or null while the sections are still being prepared. */
  sceneIndex: number | null;
  scene: HighlightScene | null;
  caption: string;
  voiceUnavailable: boolean;
  escalationMessages: string[];
  plan: ResultsPlan;
  scan: SessionSummary;
  reduceMotion: boolean;
  /** The current section has finished playing and is waiting for Next. */
  sectionEnded: boolean;
  onBack(): void;
  onNext(): void;
  onSkip(): void;
}

export function HighlightReel({
  sectionCount, readyCount, sceneIndex, scene, caption, voiceUnavailable, escalationMessages, plan, scan, reduceMotion,
  sectionEnded, onBack, onNext, onSkip,
}: Props) {
  const canGoBack = sceneIndex !== null && sceneIndex > 0;
  const isLast = sceneIndex === sectionCount - 1;
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.top}>
        <View style={styles.progress} accessibilityLabel={sceneIndex === null ? 'Preparing highlights' : `Highlight ${sceneIndex + 1} of ${sectionCount}`}>
          {Array.from({ length: sectionCount }, (_, i) => (
            <View key={i} style={[styles.segment, sceneIndex !== null && i <= sceneIndex && styles.segmentDone]} />
          ))}
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Skip to the full summary" onPress={onSkip} style={styles.skip} hitSlop={10}>
          <Text style={styles.skipText}>Skip</Text>
          <Ionicons name="play-skip-forward" size={16} color={INK} />
        </Pressable>
      </View>

      {escalationMessages.length ? (
        <View style={styles.escalation} accessibilityRole="alert">
          {escalationMessages.map((m) => (
            <Text key={m} style={styles.escalationText}>{m}</Text>
          ))}
        </View>
      ) : null}

      <View style={styles.stage}>
        {scene && sceneIndex !== null ? (
          <Scene key={sceneIndex} scene={scene} plan={plan} scan={scan} reduceMotion={reduceMotion} />
        ) : (
          <Preparing reduceMotion={reduceMotion} ready={readyCount} total={sectionCount} />
        )}
      </View>

      <View style={styles.captionBox} accessibilityLiveRegion="polite">
        {caption ? <Text style={styles.caption}>{caption}</Text> : null}
        {voiceUnavailable ? <Text style={styles.voiceNote}>Voice isn't available here, so captions only.</Text> : null}
      </View>

      <View style={styles.nav}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Previous highlight"
          accessibilityState={{ disabled: !canGoBack }}
          disabled={!canGoBack}
          onPress={onBack}
          style={[styles.navButton, !canGoBack && styles.navDisabled]}
          hitSlop={10}
        >
          <Ionicons name="chevron-back" size={20} color={INK} />
          <Text style={styles.navText}>Back</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={isLast ? 'See the full summary' : 'Next highlight'}
          accessibilityState={{ disabled: sceneIndex === null }}
          disabled={sceneIndex === null}
          onPress={onNext}
          style={[styles.navButton, sectionEnded && styles.navReady, sceneIndex === null && styles.navDisabled]}
          hitSlop={10}
        >
          <Text style={[styles.navText, sectionEnded && styles.navReadyText]}>{isLast ? 'See summary' : 'Next'}</Text>
          <Ionicons name="chevron-forward" size={20} color={sectionEnded ? theme.colors.primaryDark : INK} />
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

/** One 0→1 value per item, started in sequence. */
function useStagger(count: number, reduceMotion: boolean): Animated.Value[] {
  const values = React.useMemo(() => Array.from({ length: count }, () => new Animated.Value(reduceMotion ? 1 : 0)), [count, reduceMotion]);
  React.useEffect(() => {
    if (reduceMotion) return;
    const animation = Animated.stagger(
      140,
      values.map((v) => Animated.spring(v, { toValue: 1, useNativeDriver: true, friction: 7, tension: 60 })),
    );
    animation.start();
    return () => animation.stop();
  }, [values, reduceMotion]);
  return values;
}

const rise = (v: Animated.Value) => ({
  opacity: v,
  transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }],
});
const pop = (v: Animated.Value) => ({
  opacity: v,
  transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }],
});

function Scene({ scene, plan, scan, reduceMotion }: { scene: HighlightScene; plan: ResultsPlan; scan: SessionSummary; reduceMotion: boolean }) {
  const products = new Map(plan.products.map((p) => [p.imageRef, p]));
  const images = scene.imageRefs.filter((ref) => parseScanRef(ref) || products.has(ref));
  // hero, headline, stats…, chips…, notes…, images…
  const count = 2 + scene.stats.length + scene.chips.length + scene.notes.length + images.length;
  const v = useStagger(count, reduceMotion);
  let i = 2;

  return (
    <View style={styles.scene}>
      <Animated.View style={pop(v[0])}>
        <Hero icon={scene.icon} reduceMotion={reduceMotion} />
      </Animated.View>
      <Animated.Text style={[styles.headline, rise(v[1])]} accessibilityRole="header">
        {scene.headline}
      </Animated.Text>

      {scene.stats.length ? (
        <View style={styles.row}>
          {scene.stats.map((stat) => (
            <Animated.View key={stat.label} style={[styles.stat, pop(v[i++])]}>
              <Stat stat={stat} reduceMotion={reduceMotion} />
            </Animated.View>
          ))}
        </View>
      ) : null}

      {scene.chips.length ? (
        <View style={styles.chips}>
          {scene.chips.map((chip) => (
            <Animated.View key={chip.label} style={rise(v[i++])}>
              <Chip chip={chip} />
            </Animated.View>
          ))}
        </View>
      ) : null}

      {scene.notes.length ? (
        <View style={styles.notes}>
          {scene.notes.map((note) => (
            <Animated.View key={note} style={[styles.note, rise(v[i++])]}>
              <Ionicons name="alert-circle-outline" size={18} color={theme.colors.accent} />
              <Text style={styles.noteText}>{note}</Text>
            </Animated.View>
          ))}
        </View>
      ) : null}

      {images.length ? (
        <View style={styles.row}>
          {images.map((ref) => {
            const angle = parseScanRef(ref);
            const product = products.get(ref);
            return (
              <Animated.View key={ref} style={[styles.imageCard, pop(v[i++])]}>
                {angle ? (
                  <ScanIllustration angle={angle} scan={scan} />
                ) : product ? (
                  <ProductImage barcode={product.barcode} imagePath={product.imagePath} allowNetwork={false} label={product.name} size={64} />
                ) : null}
              </Animated.View>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

function Hero({ icon, reduceMotion }: { icon: HighlightScene['icon']; reduceMotion: boolean }) {
  const pulse = React.useRef(new Animated.Value(0)).current;
  React.useEffect(() => {
    if (reduceMotion) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1100, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 0, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, reduceMotion]);

  return (
    <View style={styles.hero}>
      {reduceMotion ? null : (
        <Animated.View
          style={[
            styles.heroRing,
            {
              opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] }),
              transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.6] }) }],
            },
          ]}
        />
      )}
      <View style={styles.heroCircle}>
        <Ionicons name={icon} size={40} color={theme.colors.primaryDark} />
      </View>
    </View>
  );
}

function Stat({ stat, reduceMotion }: { stat: HighlightStat; reduceMotion: boolean }) {
  return (
    <>
      <Ionicons name={stat.icon} size={20} color={theme.colors.accent} />
      {typeof stat.value === 'number' ? (
        <CountUp to={stat.value} reduceMotion={reduceMotion} />
      ) : (
        <Text style={styles.statValue}>{stat.value}</Text>
      )}
      <Text style={styles.statLabel}>{stat.label}</Text>
    </>
  );
}

function CountUp({ to, reduceMotion }: { to: number; reduceMotion: boolean }) {
  const [shown, setShown] = React.useState(reduceMotion ? to : 0);
  React.useEffect(() => {
    if (reduceMotion) {
      setShown(to);
      return;
    }
    const value = new Animated.Value(0);
    const id = value.addListener(({ value: n }) => setShown(Math.round(n)));
    const animation = Animated.timing(value, { toValue: to, duration: 700, delay: 250, easing: Easing.out(Easing.cubic), useNativeDriver: false });
    animation.start();
    return () => {
      animation.stop();
      value.removeListener(id);
    };
  }, [to, reduceMotion]);
  return <Text style={styles.statValue} accessibilityLabel={String(to)}>{shown}</Text>;
}

function Chip({ chip }: { chip: HighlightChip }) {
  return (
    <View style={styles.chip}>
      <Ionicons name={chip.icon} size={16} color={INK} />
      <View>
        <Text style={styles.chipLabel}>{chip.label}</Text>
        {chip.detail ? <Text style={styles.chipDetail}>{chip.detail}</Text> : null}
      </View>
      {chip.level ? (
        <View style={styles.meter} accessibilityLabel={['mild', 'moderate', 'severe'][chip.level - 1]}>
          {[1, 2, 3].map((n) => (
            <View key={n} style={[styles.meterBar, { height: 5 + n * 4 }, n <= chip.level! && styles.meterOn]} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function Preparing({ reduceMotion, ready, total }: { reduceMotion: boolean; ready: number; total: number }) {
  return (
    <View style={styles.scene} accessibilityLabel={`Putting together your highlights, ${ready} of ${total} sections ready`}>
      <Hero icon="sparkles" reduceMotion={reduceMotion} />
      <Text style={styles.headline}>Putting together your highlights…</Text>
      <Text style={styles.preparingCount}>{ready} of {total} sections ready</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: theme.colors.primaryDark },
  top: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingTop: 16 },
  progress: { flex: 1, flexDirection: 'row', gap: 4 },
  segment: { flex: 1, height: 4, borderRadius: 2, backgroundColor: GLASS },
  segmentDone: { backgroundColor: INK },
  skip: {
    flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 999, backgroundColor: GLASS,
  },
  skipText: { color: INK, fontWeight: '800', fontSize: 15 },
  escalation: { marginHorizontal: 20, marginTop: 14, padding: 14, borderRadius: 14, backgroundColor: '#FBEAEA', gap: 6 },
  escalationText: { color: theme.colors.danger, fontSize: 14, lineHeight: 20, fontWeight: '700' },
  stage: { flex: 1, justifyContent: 'center', paddingHorizontal: 20 },
  scene: { alignItems: 'center', gap: 18 },
  hero: { width: 96, height: 96, alignItems: 'center', justifyContent: 'center' },
  heroRing: { position: 'absolute', width: 96, height: 96, borderRadius: 48, borderWidth: 2, borderColor: theme.colors.accent },
  heroCircle: {
    width: 84, height: 84, borderRadius: 42, backgroundColor: theme.colors.primarySoft,
    alignItems: 'center', justifyContent: 'center',
  },
  headline: { color: INK, fontSize: 30, fontWeight: '800', textAlign: 'center' },
  preparingCount: { color: INK_MUTED, fontSize: 14, fontWeight: '700', fontVariant: ['tabular-nums'] },
  row: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 12 },
  stat: { minWidth: 120, alignItems: 'center', padding: 14, borderRadius: 18, backgroundColor: GLASS, gap: 2 },
  statValue: { color: INK, fontSize: 48, fontWeight: '900', fontVariant: ['tabular-nums'] },
  statLabel: { color: INK_MUTED, fontSize: 13, fontWeight: '700', textAlign: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 16, backgroundColor: GLASS,
  },
  chipLabel: { color: INK, fontSize: 15, fontWeight: '800' },
  chipDetail: { color: INK_MUTED, fontSize: 12, textTransform: 'capitalize' },
  meter: { flexDirection: 'row', alignItems: 'flex-end', gap: 3 },
  meterBar: { width: 5, borderRadius: 2, backgroundColor: 'rgba(255, 249, 241, 0.25)' },
  meterOn: { backgroundColor: theme.colors.accent },
  notes: { alignSelf: 'stretch', gap: 8 },
  note: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 12, borderRadius: 14, backgroundColor: GLASS },
  noteText: { flex: 1, color: INK, fontSize: 15, lineHeight: 21, fontWeight: '600' },
  imageCard: { padding: 10, borderRadius: 18, backgroundColor: theme.colors.surface },
  captionBox: { minHeight: 96, paddingHorizontal: 24, paddingBottom: 16, justifyContent: 'flex-end', gap: 6 },
  caption: { color: INK, fontSize: 18, lineHeight: 26, fontWeight: '600', textAlign: 'center' },
  voiceNote: { color: INK_MUTED, fontSize: 12, textAlign: 'center' },
  nav: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 24 },
  navButton: {
    flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 18, paddingVertical: 12,
    borderRadius: 999, backgroundColor: GLASS,
  },
  navDisabled: { opacity: 0.35 },
  navReady: { backgroundColor: INK },
  navText: { color: INK, fontWeight: '800', fontSize: 16 },
  navReadyText: { color: theme.colors.primaryDark },
});
