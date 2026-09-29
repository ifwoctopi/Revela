import React from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

import { sampleUserProfile } from '../data/mockData';
import { ConditionName, SessionSummary, Severity } from '../types/session';
import { CapturedAngle, runVisionInference } from '../../skubba-mobile-app/services/vision';
import { speakText, stopSpeech } from '../../skubba-mobile-app/services/tts';

const severityColors: Record<Severity, string> = {
  mild: '#81d4fa',
  moderate: '#f9c74f',
  severe: '#f94144',
};

const conditionLabels: Record<ConditionName, string> = {
  acne: 'Acne',
  redness: 'Redness',
  dryness: 'Dryness',
  hyperpigmentation: 'Hyperpigmentation',
  dark_circles: 'Dark circles',
  oily_skin: 'Oily skin',
};

export function CaptureSummaryScreen() {
  const { frames } = useLocalSearchParams<{ frames?: string }>();
  const [summary, setSummary] = React.useState<SessionSummary | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [speechBusy, setSpeechBusy] = React.useState(false);
  const [speaking, setSpeaking] = React.useState(false);
  const [speechError, setSpeechError] = React.useState<string | null>(null);

  React.useEffect(() => () => {
    void stopSpeech();
  }, []);

  React.useEffect(() => {
    if (!frames) return;

    let frameUris: string[];
    try {
      frameUris = JSON.parse(frames);
    } catch {
      setError('The captured frames could not be read. Please try the scan again.');
      return;
    }

    runVisionInference(
      frameUris.map((uri, index) => ({
        uri,
        angle: ['front', 'left_3q', 'right_3q'][index] as CapturedAngle,
      })),
    ).then(setSummary).catch((inferenceError: unknown) => {
      setError(inferenceError instanceof Error ? inferenceError.message : 'Vision analysis failed.');
    });
  }, [frames]);

  if (frames && !summary && !error) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#3A6B58" />
        <Text style={styles.loadingText}>Analyzing your captured views...</Text>
      </View>
    );
  }

  if (frames && error) {
    return (
      <View style={styles.loading}>
        <Text style={styles.errorTitle}>Analysis unavailable</Text>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  if (!summary) {
    return (
      <View style={styles.loading}>
        <Text style={styles.errorTitle}>No capture to analyze</Text>
        <Text style={styles.errorText}>Start a new scan to generate results from your camera views.</Text>
      </View>
    );
  }

  const conditions = Object.entries(summary.results) as Array<
    [ConditionName, { present: boolean; confidence?: number; region?: string; severity?: Severity }]
  >;

  const spokenConditions = conditions.filter(([, value]) => value.present);
  const speechText = spokenConditions.length
    ? `Today's skin check. ${spokenConditions.map(([condition, value]) =>
      `${conditionLabels[condition]}: ${value.severity ?? 'mild'} observation${value.region ? ` around the ${value.region.replaceAll('_', ' ')}` : ''}.`,
    ).join(' ')}`
    : "Today's skin check did not detect any of the conditions included in this scan.";

  const onSpeechPress = async () => {
    setSpeechError(null);
    if (speaking) {
      await stopSpeech();
      setSpeaking(false);
      return;
    }

    setSpeechBusy(true);
    try {
      await speakText(speechText, () => setSpeaking(false));
      setSpeaking(true);
    } catch (speechFailure: unknown) {
      setSpeechError(speechFailure instanceof Error ? speechFailure.message : 'Speech playback failed.');
    } finally {
      setSpeechBusy(false);
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.kicker}>Today’s skin check</Text>
      <Text style={styles.title}>Révéla summary</Text>

      <View style={styles.speechCard}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: speechBusy }}
          disabled={speechBusy}
          onPress={onSpeechPress}
          style={({ pressed }) => [styles.speechButton, pressed && styles.speechButtonPressed, speechBusy && styles.speechButtonDisabled]}
        >
          {speechBusy ? <ActivityIndicator color="#fffaf5" /> : (
            <Text style={styles.speechButtonText}>{speaking ? 'Stop speaking' : 'Listen to summary'}</Text>
          )}
        </Pressable>
        <Text style={styles.speechHint}>
          {speechBusy ? 'Preparing the offline voice for this device…' : 'Spoken on your device with Piper.'}
        </Text>
        {speechError ? <Text accessibilityRole="alert" style={styles.speechError}>{speechError}</Text> : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Capture angles</Text>
        <Text style={styles.rowText}>{summary.angles_captured.join(' • ')}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Conditions detected</Text>
        {conditions.map(([condition, value]) => {
          if (!value.present) {
            return (
              <View key={condition} style={styles.conditionRow}>
                <Text style={styles.conditionName}>{conditionLabels[condition]}</Text>
                <Text style={styles.mutedText}>Not detected</Text>
              </View>
            );
          }

          return (
            <View key={condition} style={styles.conditionRow}>
              <View>
                <Text style={styles.conditionName}>{conditionLabels[condition]}</Text>
                <Text style={styles.mutedText}>{value.region ?? 'General area'}</Text>
              </View>

              <View style={styles.badgeWrap}>
                <Text style={[styles.badge, { backgroundColor: severityColors[value.severity ?? 'mild'] }]}>
                  {value.severity ?? 'mild'}
                </Text>
                <Text style={styles.confidence}>{Math.round((value.confidence ?? 0.5) * 100)}%</Text>
              </View>
            </View>
          );
        })}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>AI feedback focus</Text>
        <Text style={styles.rowText}>
          {sampleUserProfile.preferences.focus.join(', ')} · {sampleUserProfile.preferences.tone} tone
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f8f1ea',
  },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, backgroundColor: '#f8f1ea' },
  loadingText: { color: '#41332d', fontSize: 16, marginTop: 16, textAlign: 'center' },
  errorTitle: { color: '#1f1a17', fontSize: 24, fontWeight: '700', textAlign: 'center' },
  errorText: { color: '#73615b', fontSize: 15, lineHeight: 22, marginTop: 10, textAlign: 'center' },
  content: {
    padding: 24,
    paddingTop: 72,
    gap: 16,
  },
  kicker: {
    color: '#8b5e3c',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 34,
    fontWeight: '700',
    color: '#1f1a17',
    marginBottom: 8,
  },
  speechCard: {
    backgroundColor: '#fffaf5',
    borderRadius: 20,
    padding: 18,
    gap: 10,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  speechButton: {
    minHeight: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3A6B58',
  },
  speechButtonPressed: { opacity: 0.85 },
  speechButtonDisabled: { opacity: 0.75 },
  speechButtonText: { color: '#fffaf5', fontSize: 15, fontWeight: '700' },
  speechHint: { color: '#73615b', fontSize: 12, textAlign: 'center' },
  speechError: { color: '#a12622', fontSize: 13, lineHeight: 18 },
  card: {
    backgroundColor: '#fffaf5',
    borderRadius: 20,
    padding: 18,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#201a17',
    marginBottom: 12,
  },
  rowText: {
    color: '#41332d',
    fontSize: 15,
    lineHeight: 22,
  },
  conditionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0e5dc',
  },
  conditionName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1d1817',
  },
  mutedText: {
    color: '#73615b',
    fontSize: 12,
    marginTop: 4,
  },
  badgeWrap: {
    alignItems: 'flex-end',
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'capitalize',
    color: '#1c1b1b',
    overflow: 'hidden',
  },
  confidence: {
    marginTop: 6,
    fontSize: 12,
    color: '#6b554b',
    fontWeight: '600',
  },
});
