// A quick, story-style rundown of an appearance check: what was noticed, the
// summary in one line, and the routine at a glance. Shorter than the
// personalized highlights; scenes advance on their own and can be stepped.

import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { AccessibilityInfo, Animated, Easing, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';

import { theme } from '../../constants/theme';
import { SHORT_DISCLAIMER } from '../../safety/disclaimer';
import type { Scan } from '../../types/scan';
import { useReduceMotion } from '../motion';
import type { IconName } from '../ui';

const SCENE_MS = 4200;
const INK = theme.colors.onDark;
const INK_MUTED = theme.colors.onDarkMuted;
const GLASS = 'rgba(255, 250, 242, 0.12)';

const OBS_ICONS: Record<string, IconName> = {
  acne_like: 'ellipse-outline',
  dryness_like: 'leaf-outline',
  oiliness_like: 'water-outline',
  dark_circle_like: 'eye-outline',
  hyperpigmentation_like: 'color-palette-outline',
};

function firstSentence(text: string): string {
  const m = text.match(/^.*?[.!?](\s|$)/);
  return (m ? m[0] : text).trim();
}

export function QuickHighlights({ scan, onDone }: { scan: Scan; onDone(): void }) {
  const reduce = useReduceMotion();
  const [index, setIndex] = React.useState(0);
  const progress = React.useRef(new Animated.Value(0)).current;
  const doneRef = React.useRef(onDone);
  doneRef.current = onDone;

  // Screen reader users go straight to the written results.
  React.useEffect(() => {
    AccessibilityInfo.isScreenReaderEnabled().then((on) => on && doneRef.current(), () => {});
  }, []);

  const scenes = React.useMemo(() => buildScenes(scan), [scan]);
  const last = scenes.length - 1;

  React.useEffect(() => {
    progress.setValue(0);
    const anim = Animated.timing(progress, { toValue: 1, duration: SCENE_MS, easing: Easing.linear, useNativeDriver: false });
    anim.start(({ finished }) => {
      if (!finished) return;
      if (index >= last) doneRef.current();
      else setIndex(index + 1);
    });
    return () => anim.stop();
  }, [index, last, progress]);

  const scene = scenes[index];

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.top}>
        <View style={styles.segments} accessibilityLabel={`Highlight ${index + 1} of ${scenes.length}`}>
          {scenes.map((_, i) => (
            <View key={i} style={styles.segment}>
              <Animated.View
                style={[
                  styles.segmentFill,
                  {
                    width:
                      i < index ? '100%' : i > index ? '0%' : progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
                  },
                ]}
              />
            </View>
          ))}
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Skip to full results" onPress={onDone} style={styles.skip} hitSlop={10}>
          <Text style={styles.skipText}>Skip</Text>
          <Ionicons name="play-skip-forward" size={16} color={INK} />
        </Pressable>
      </View>

      {/* Left third goes back, the rest goes forward, like stories. */}
      <View style={styles.stage}>
        <SceneView key={index} scene={scene} reduce={reduce} />
        <View style={styles.tapZones}>
          <Pressable style={{ flex: 1 }} onPress={() => index > 0 && setIndex(index - 1)} accessibilityLabel="Previous highlight" />
          <Pressable style={{ flex: 2 }} onPress={() => (index >= last ? onDone() : setIndex(index + 1))} accessibilityLabel="Next highlight" />
        </View>
      </View>

      <View style={styles.bottom}>
        <Pressable accessibilityRole="button" onPress={onDone} style={styles.cta}>
          <Text style={styles.ctaText}>{index >= last ? 'See full results' : 'Full results'}</Text>
          <Ionicons name="chevron-forward" size={18} color={theme.colors.primaryDark} />
        </Pressable>
        <Text style={styles.disclaimer}>{SHORT_DISCLAIMER}</Text>
      </View>
    </SafeAreaView>
  );
}

interface QuickScene {
  icon: IconName;
  kicker: string;
  headline: string;
  chips?: Array<{ icon: IconName; label: string; pct: number }>;
  stats?: Array<{ icon: IconName; value: number; label: string }>;
  body?: string;
}

function buildScenes(scan: Scan): QuickScene[] {
  const top = [...scan.observations].sort((a, b) => b.modelConfidence - a.modelConfidence).slice(0, 3);
  return [
    top.length
      ? {
          icon: 'eye-outline',
          kicker: 'What we noticed',
          headline: top.length === 1 ? '1 pattern stood out' : `${top.length} patterns stood out`,
          chips: top.map((o) => ({
            icon: OBS_ICONS[o.characteristic] ?? 'ellipse-outline',
            label: o.displayLabel,
            pct: Math.round(o.modelConfidence * 100),
          })),
        }
      : { icon: 'happy-outline', kicker: 'What we noticed', headline: 'Nothing stood out this time', body: 'No supported pattern crossed the model threshold.' },
    { icon: 'sparkles-outline', kicker: 'In short', headline: 'Your skin today', body: firstSentence(scan.appearanceSummary) },
    {
      icon: 'heart-outline',
      kicker: 'Love your skin',
      headline: 'Your routine',
      stats: [
        { icon: 'sunny', value: scan.morningRoutine.length, label: 'morning steps' },
        { icon: 'moon', value: scan.eveningRoutine.length, label: 'evening steps' },
      ],
    },
  ];
}

function SceneView({ scene, reduce }: { scene: QuickScene; reduce: boolean }) {
  const count = 3 + (scene.chips?.length ?? 0) + (scene.stats?.length ?? 0);
  const v = React.useMemo(() => Array.from({ length: count }, () => new Animated.Value(reduce ? 1 : 0)), [count, reduce]);
  React.useEffect(() => {
    if (reduce) return;
    const a = Animated.stagger(120, v.map((x) => Animated.spring(x, { toValue: 1, useNativeDriver: true, friction: 7, tension: 60 })));
    a.start();
    return () => a.stop();
  }, [v, reduce]);
  const rise = (x: Animated.Value) => ({ opacity: x, transform: [{ translateY: x.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }] });
  const pop = (x: Animated.Value) => ({ opacity: x, transform: [{ scale: x.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }] });
  let i = 3;

  return (
    <View style={styles.scene} pointerEvents="none">
      <Animated.View style={[styles.hero, pop(v[0])]}>
        <Ionicons name={scene.icon} size={38} color={theme.colors.primaryDark} />
      </Animated.View>
      <Animated.View style={[styles.center, rise(v[1])]}>
        <Text style={styles.kicker}>{scene.kicker}</Text>
        <Text style={styles.headline} accessibilityRole="header">{scene.headline}</Text>
      </Animated.View>
      {scene.body ? <Animated.Text style={[styles.body, rise(v[2])]}>{scene.body}</Animated.Text> : null}
      {scene.chips ? (
        <View style={styles.chips}>
          {scene.chips.map((c) => (
            <Animated.View key={c.label} style={[styles.chip, rise(v[i++])]}>
              <Ionicons name={c.icon} size={18} color={theme.colors.copper} />
              <Text style={styles.chipLabel} numberOfLines={1}>{c.label}</Text>
              <Text style={styles.chipPct}>{c.pct}%</Text>
            </Animated.View>
          ))}
          <Text style={styles.note}>Model confidence, not medical severity.</Text>
        </View>
      ) : null}
      {scene.stats ? (
        <View style={styles.stats}>
          {scene.stats.map((st) => (
            <Animated.View key={st.label} style={[styles.stat, pop(v[i++])]}>
              <Ionicons name={st.icon} size={20} color={theme.colors.copper} />
              <Text style={styles.statValue}>{st.value}</Text>
              <Text style={styles.statLabel}>{st.label}</Text>
            </Animated.View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.espresso },
  top: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingTop: 16 },
  segments: { flex: 1, flexDirection: 'row', gap: 4 },
  segment: { flex: 1, height: 4, borderRadius: 2, backgroundColor: GLASS, overflow: 'hidden' },
  segmentFill: { height: 4, backgroundColor: INK },
  skip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: GLASS },
  skipText: { color: INK, fontWeight: '800', fontSize: 15 },
  stage: { flex: 1, justifyContent: 'center', paddingHorizontal: 24 },
  tapZones: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, flexDirection: 'row' },
  scene: { alignItems: 'center', gap: 18 },
  hero: { width: 84, height: 84, borderRadius: 42, backgroundColor: theme.colors.gingerSoft, alignItems: 'center', justifyContent: 'center' },
  center: { alignItems: 'center', gap: 4 },
  kicker: { color: theme.colors.copper, fontWeight: '900', letterSpacing: 2, fontSize: 12, textTransform: 'uppercase' },
  headline: { color: INK, fontSize: 28, fontWeight: '900', textAlign: 'center' },
  body: { color: INK, fontSize: 18, lineHeight: 26, textAlign: 'center', fontWeight: '600' },
  chips: { alignSelf: 'stretch', gap: 10 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 16, backgroundColor: GLASS },
  chipLabel: { flex: 1, color: INK, fontSize: 15, fontWeight: '800' },
  chipPct: { color: theme.colors.copper, fontSize: 16, fontWeight: '900', fontVariant: ['tabular-nums'] },
  note: { color: INK_MUTED, fontSize: 12, textAlign: 'center', marginTop: 2 },
  stats: { flexDirection: 'row', gap: 12 },
  stat: { minWidth: 120, alignItems: 'center', padding: 14, borderRadius: 18, backgroundColor: GLASS, gap: 2 },
  statValue: { color: INK, fontSize: 44, fontWeight: '900', fontVariant: ['tabular-nums'] },
  statLabel: { color: INK_MUTED, fontSize: 13, fontWeight: '700' },
  bottom: { paddingHorizontal: 20, paddingBottom: 24, gap: 10 },
  cta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: INK, borderRadius: 999, paddingVertical: 14 },
  ctaText: { color: theme.colors.primaryDark, fontWeight: '900', fontSize: 16 },
  disclaimer: { color: INK_MUTED, fontSize: 11, textAlign: 'center' },
});
