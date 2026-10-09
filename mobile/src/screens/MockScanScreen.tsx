import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import { ActivityIndicator, Animated, Easing, SafeAreaView, StyleSheet, Text, View } from 'react-native';

import { PressableScale, Reveal, useReduceMotion } from '../../components/motion';
import { IconBadge } from '../../components/ui';

import { ScanIllustration } from '../components/ScanIllustration';
import { HomeButton } from '../components/HomeButton';
import { useResultsFlow } from '../flow/ResultsFlowContext';
import { theme } from '../../constants/theme';

/**
 * The scan step. Results still come from the mock scan data; the real
 * capture + vision pipeline can replace this screen without changing
 * anything downstream.
 */
export function MockScanScreen() {
  const { services, servicesError, scan, plan, startResults } = useResultsFlow();
  const [started, setStarted] = React.useState(false);

  React.useEffect(() => {
    // Move on as soon as the plan exists; sections keep generating on the results screen.
    if (started && plan) router.replace('/results/summary');
  }, [started, plan]);

  // A light sweeps across the face views while the scan runs.
  const reduce = useReduceMotion();
  const sweep = React.useRef(new Animated.Value(0)).current;
  React.useEffect(() => {
    if (!started || reduce) return;
    const loop = Animated.loop(
      Animated.timing(sweep, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, [started, reduce, sweep]);

  const start = () => {
    setStarted(true);
    void startResults();
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <HomeButton />
      </View>
      <View style={styles.container}>
        <Reveal>
          <IconBadge name="scan" size={52} />
        </Reveal>
        <Reveal index={1}>
          <Text style={styles.kicker}>Skin scan</Text>
          <Text style={styles.title}>Three views of your face</Text>
        </Reveal>
        <Reveal index={2} style={styles.privacy}>
          <Ionicons name="lock-closed" size={14} color={theme.colors.brown} />
          <Text style={styles.privacyText}>Sample results · analyzed on your device, nothing leaves it</Text>
        </Reveal>

        <Reveal index={3} style={styles.viewsCard}>
          <View style={styles.views}>
            {scan.angles_captured.map((angle) => (
              <ScanIllustration key={angle} angle={angle} scan={scan} />
            ))}
          </View>
          {started && !reduce ? (
            <Animated.View
              pointerEvents="none"
              style={[
                styles.sweep,
                { transform: [{ translateX: sweep.interpolate({ inputRange: [0, 1], outputRange: [-40, 340] }) }] },
              ]}
            />
          ) : null}
        </Reveal>

        {servicesError ? (
          <Text style={styles.error} accessibilityRole="alert">
            The on-device product database couldn't be opened. Rebuild the app after running the product database script.
          </Text>
        ) : started ? (
          <View style={styles.working} accessibilityLiveRegion="polite">
            <ActivityIndicator color={theme.colors.primary} />
            <Text style={styles.body}>Analyzing your scan…</Text>
          </View>
        ) : (
          <Reveal index={4}>
            <PressableScale
              accessibilityRole="button"
              accessibilityState={{ disabled: !services }}
              disabled={!services}
              style={[styles.button, !services && styles.disabled]}
              onPress={start}
            >
              <Ionicons name="play" size={18} color={theme.colors.cream} />
              <Text style={styles.buttonText}>{services ? 'Run scan' : 'Getting ready…'}</Text>
            </PressableScale>
          </Reveal>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: theme.colors.background },
  header: { paddingHorizontal: 24, paddingTop: 28 },
  container: { flex: 1, padding: 24, gap: 14, justifyContent: 'center' },
  kicker: { fontSize: 13, fontWeight: '800', letterSpacing: 2, color: theme.colors.primary, textTransform: 'uppercase' },
  title: { fontSize: 28, fontWeight: '800', color: theme.colors.text },
  body: { fontSize: 15, lineHeight: 22, color: theme.colors.mutedText },
  privacy: {
    flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', backgroundColor: theme.colors.surfaceAlt,
    borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6,
  },
  privacyText: { color: theme.colors.brown, fontSize: 12, fontWeight: '700' },
  viewsCard: {
    backgroundColor: theme.colors.surface, borderRadius: 22, borderWidth: 1, borderColor: theme.colors.border,
    paddingVertical: 18, paddingHorizontal: 8, marginVertical: 8, overflow: 'hidden', ...theme.shadow,
  },
  views: { flexDirection: 'row', justifyContent: 'space-between' },
  sweep: { position: 'absolute', top: 0, bottom: 0, width: 36, backgroundColor: 'rgba(208, 112, 58, 0.22)' },
  working: { flexDirection: 'row', alignItems: 'center', gap: 10, justifyContent: 'center' },
  button: {
    backgroundColor: theme.colors.primary, borderRadius: 16, padding: 16, alignItems: 'center', justifyContent: 'center',
    flexDirection: 'row', gap: 8,
  },
  disabled: { opacity: 0.6 },
  buttonText: { color: theme.colors.cream, fontSize: 16, fontWeight: '800' },
  error: { color: theme.colors.danger, fontSize: 14, lineHeight: 20 },
});
