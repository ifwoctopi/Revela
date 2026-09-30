import { router } from 'expo-router';
import React from 'react';
import { ActivityIndicator, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';

import { ScanIllustration } from '../components/ScanIllustration';
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

  const start = () => {
    setStarted(true);
    void startResults();
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.kicker}>Skin scan</Text>
        <Text style={styles.title}>Three views of your face</Text>
        <Text style={styles.body}>
          This prototype uses sample scan results. Everything is analyzed on your device, and nothing leaves it.
        </Text>

        <View style={styles.views}>
          {scan.angles_captured.map((angle) => (
            <ScanIllustration key={angle} angle={angle} scan={scan} />
          ))}
        </View>

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
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: !services }}
            disabled={!services}
            style={[styles.button, !services && styles.disabled]}
            onPress={start}
          >
            <Text style={styles.buttonText}>{services ? 'Run scan' : 'Getting ready…'}</Text>
          </Pressable>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: theme.colors.background },
  container: { flex: 1, padding: 24, gap: 14, justifyContent: 'center' },
  kicker: { fontSize: 13, fontWeight: '800', letterSpacing: 2, color: theme.colors.primary, textTransform: 'uppercase' },
  title: { fontSize: 28, fontWeight: '800', color: theme.colors.text },
  body: { fontSize: 15, lineHeight: 22, color: theme.colors.mutedText },
  views: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 18 },
  working: { flexDirection: 'row', alignItems: 'center', gap: 10, justifyContent: 'center' },
  button: { backgroundColor: theme.colors.primary, borderRadius: 14, padding: 16, alignItems: 'center' },
  disabled: { opacity: 0.6 },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  error: { color: theme.colors.danger, fontSize: 14, lineHeight: 20 },
});
