import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { sampleSessionSummary, sampleUserProfile } from '../data/mockData';
import { ConditionName, Severity } from '../types/session';

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
};

export function CaptureSummaryScreen() {
  const conditions = Object.entries(sampleSessionSummary.results) as Array<
    [ConditionName, { present: boolean; confidence?: number; region?: string; severity?: Severity }]
  >;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.kicker}>Today’s skin check</Text>
      <Text style={styles.title}>Révéla summary</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Capture angles</Text>
        <Text style={styles.rowText}>{sampleSessionSummary.angles_captured.join(' • ')}</Text>
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
