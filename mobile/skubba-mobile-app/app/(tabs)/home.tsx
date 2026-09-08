import { router } from 'expo-router';
import { SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import ScanCard from '../../components/ScanCard';
import SectionHeader from '../../components/SectionHeader';
import { theme } from '../../constants/theme';
import { mockScans } from '../../data/mockScans';

export default function HomeScreen() {
  const latestScan = mockScans[0];

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <Text style={styles.brand}>SKUBBA</Text>
        <Text style={styles.greeting}>Good afternoon</Text>
        <Text style={styles.subGreeting}>Here is your latest smart-mirror update.</Text>

        <SectionHeader title="Latest Scan" action="View history" onPress={() => router.push('/(tabs)/history')} />
        <ScanCard scan={latestScan} onPress={() => router.push(`/scan/${latestScan.id}`)} />

        <SectionHeader title="Today's Routine" />
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Morning</Text>
          {latestScan.morningRoutine.slice(0, 4).map((item, index) => (
            <Text key={item} style={styles.listItem}>{index + 1}. {item}</Text>
          ))}
          <TouchableOpacity style={styles.linkButton} onPress={() => router.push('/(tabs)/routine')}>
            <Text style={styles.linkText}>View complete routine</Text>
          </TouchableOpacity>
        </View>

        <SectionHeader title="Progress Snapshot" />
        <View style={styles.card}>
          <Text style={styles.metricLabel}>Recent scan confidence</Text>
          <Text style={styles.metricValue}>{Math.round(latestScan.confidence * 100)}%</Text>
          <Text style={styles.caption}>
            Confidence describes the model's certainty in its classification. It is not a medical severity score.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: theme.colors.background },
  container: { padding: 20, paddingBottom: 36 },
  brand: { fontSize: 15, fontWeight: '800', letterSpacing: 3, color: theme.colors.primary, marginTop: 6 },
  greeting: { fontSize: 31, fontWeight: '800', color: theme.colors.text, marginTop: 14 },
  subGreeting: { fontSize: 16, color: theme.colors.mutedText, marginTop: 6, marginBottom: 12 },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  cardTitle: { fontSize: 18, fontWeight: '800', color: theme.colors.text, marginBottom: 10 },
  listItem: { fontSize: 15, color: theme.colors.text, marginVertical: 4 },
  linkButton: { marginTop: 14 },
  linkText: { color: theme.colors.primary, fontWeight: '700' },
  metricLabel: { color: theme.colors.mutedText, fontSize: 14 },
  metricValue: { color: theme.colors.text, fontSize: 36, fontWeight: '800', marginVertical: 6 },
  caption: { color: theme.colors.mutedText, fontSize: 13, lineHeight: 19 },
});
