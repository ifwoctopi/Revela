import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { theme } from '../../constants/theme';
import { mockScans } from '../../data/mockScans';

export default function ScanDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const scan = mockScans.find((item) => item.id === id);

  if (!scan) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centered}>
          <Text style={styles.title}>Scan not found</Text>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.link}>Go back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const date = new Date(scan.createdAt).toLocaleString();

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={theme.colors.text} />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>

        <Text style={styles.title}>Scan Details</Text>
        <Text style={styles.date}>{date}</Text>

        <View style={styles.heroCard}>
          <Text style={styles.heroLabel}>Primary classification</Text>
          <Text style={styles.condition}>{scan.primaryCondition}</Text>
          <Text style={styles.confidence}>{Math.round(scan.confidence * 100)}% confidence</Text>
        </View>

        <Text style={styles.sectionTitle}>AI Summary</Text>
        <View style={styles.card}>
          <Text style={styles.body}>{scan.aiSummary}</Text>
        </View>

        <Text style={styles.sectionTitle}>Observations</Text>
        <View style={styles.card}>
          {scan.observations.map((item) => <Text key={item} style={styles.bullet}>• {item}</Text>)}
        </View>

        <Text style={styles.sectionTitle}>Suggested Product Types</Text>
        <View style={styles.card}>
          {scan.recommendedProductTypes.map((item) => <Text key={item} style={styles.bullet}>• {item}</Text>)}
        </View>

        <Text style={styles.disclaimer}>
          Classification confidence is not the same as condition severity. SKUBBA is not a medical diagnostic tool.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: theme.colors.background },
  container: { padding: 20, paddingBottom: 40 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  backButton: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, marginBottom: 18 },
  backText: { color: theme.colors.text, fontWeight: '700' },
  title: { fontSize: 31, fontWeight: '800', color: theme.colors.text },
  date: { color: theme.colors.mutedText, marginTop: 6, marginBottom: 18 },
  heroCard: { backgroundColor: theme.colors.primarySoft, borderRadius: 20, padding: 20 },
  heroLabel: { color: theme.colors.mutedText, fontSize: 13, fontWeight: '700' },
  condition: { color: theme.colors.text, fontSize: 32, fontWeight: '800', marginTop: 8 },
  confidence: { color: theme.colors.primary, fontSize: 16, fontWeight: '800', marginTop: 4 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: theme.colors.text, marginTop: 24, marginBottom: 10 },
  card: { backgroundColor: theme.colors.surface, borderRadius: 18, borderWidth: 1, borderColor: theme.colors.border, padding: 17 },
  body: { color: theme.colors.text, fontSize: 15, lineHeight: 23 },
  bullet: { color: theme.colors.text, fontSize: 15, lineHeight: 24 },
  disclaimer: { marginTop: 24, color: theme.colors.mutedText, fontSize: 12, lineHeight: 18, textAlign: 'center' },
  link: { color: theme.colors.primary, fontWeight: '800', marginTop: 12 },
});
