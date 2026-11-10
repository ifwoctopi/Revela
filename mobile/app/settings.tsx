import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import { Alert, SafeAreaView, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import { theme } from '../constants/theme';
import { signOut } from '../services/auth';
import { PressableScale } from '../components/motion';
import { useFetchProductImages } from '../src/products/imageSettings';
import { SPEECH_PACES, useSpeechPace, type SpeechPace } from '../src/settings/speechSettings';

const PACE_LABELS: Record<SpeechPace, string> = { slow: 'Slow', normal: 'Normal', fast: 'Fast' };

function confirmSignOut() {
  Alert.alert('Sign out?', 'You will need to sign in again to see your checks.', [
    { text: 'Cancel', style: 'cancel' },
    {
      text: 'Sign out',
      style: 'destructive',
      onPress: async () => {
        await signOut();
        router.dismissAll();
        router.replace('/');
      },
    },
  ]);
}

export default function Settings() {
  const [fetchImages, setFetchImages] = useFetchProductImages();
  const [pace, setPace] = useSpeechPace();

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Settings</Text>
          <PressableScale style={styles.close} onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Close settings">
            <Ionicons name="close" size={22} color={theme.colors.primary} />
          </PressableScale>
        </View>

        <Text style={styles.section}>Product photos</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.rowText}>
              <Text style={styles.label}>Download missing photos</Text>
              <Text style={styles.hint}>
                When online, fetch photos that aren't on this device from the Open Beauty Facts photo server. This tells that server which products were recommended to you. Off by default.
              </Text>
            </View>
            <Switch value={fetchImages} onValueChange={setFetchImages} accessibilityLabel="Download missing product photos when online" />
          </View>
        </View>

        <Text style={styles.section}>Narration</Text>
        <View style={styles.card}>
          <Text style={styles.label}>Voice speed</Text>
          <View style={styles.segments} accessibilityRole="radiogroup">
            {SPEECH_PACES.map((option) => {
              const selected = option === pace;
              return (
                <PressableScale
                  key={option}
                  containerStyle={styles.segmentContainer}
                  style={[styles.segment, selected && styles.segmentOn]}
                  onPress={() => setPace(option)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  accessibilityLabel={`${PACE_LABELS[option]} voice speed`}
                >
                  <Text style={[styles.segmentText, selected && styles.segmentTextOn]} numberOfLines={1} adjustsFontSizeToFit>{PACE_LABELS[option]}</Text>
                </PressableScale>
              );
            })}
          </View>
          <Text style={styles.hint}>Applies to the next sentence that is read aloud.</Text>
        </View>

        <Text style={styles.section}>Account</Text>
        <PressableScale style={styles.signOut} onPress={confirmSignOut} accessibilityRole="button" accessibilityLabel="Sign out">
          <Ionicons name="log-out-outline" size={20} color={theme.colors.danger} />
          <Text style={styles.signOutText}>Sign out</Text>
        </PressableScale>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: 20, paddingBottom: 40, gap: 12 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  title: { fontSize: 28, fontWeight: '900', color: theme.colors.text },
  close: { width: 40, height: 40, borderRadius: 20, backgroundColor: theme.colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  section: { fontSize: 12, fontWeight: '900', letterSpacing: 1.5, color: theme.colors.mutedText, textTransform: 'uppercase', marginTop: 8 },
  card: { backgroundColor: theme.colors.surface, borderRadius: 18, padding: 16, gap: 10, borderWidth: 1, borderColor: theme.colors.border },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowText: { flex: 1, gap: 4 },
  label: { fontSize: 16, fontWeight: '800', color: theme.colors.text },
  hint: { fontSize: 13, lineHeight: 19, color: theme.colors.mutedText },
  segments: { flexDirection: 'row', gap: 8 },
  segmentContainer: { flex: 1 },
  segment: { alignSelf: 'stretch', paddingVertical: 12, paddingHorizontal: 8, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.primarySoft },
  segmentOn: { backgroundColor: theme.colors.primary },
  segmentText: { fontSize: 14, fontWeight: '800', color: theme.colors.primary },
  segmentTextOn: { color: theme.colors.surface },
  signOut: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 16, borderRadius: 18, backgroundColor: theme.colors.dangerSoft },
  signOutText: { fontSize: 16, fontWeight: '800', color: theme.colors.danger },
});
