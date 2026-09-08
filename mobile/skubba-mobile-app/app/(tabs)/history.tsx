import { router } from 'expo-router';
import { SafeAreaView, ScrollView, StyleSheet, Text } from 'react-native';
import ScanCard from '../../components/ScanCard';
import { theme } from '../../constants/theme';
import { mockScans } from '../../data/mockScans';

export default function HistoryScreen() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Scan History</Text>
        <Text style={styles.subtitle}>Review results collected from your smart mirror.</Text>
        {mockScans.map((scan) => (
          <ScanCard key={scan.id} scan={scan} onPress={() => router.push(`/scan/${scan.id}`)} />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: theme.colors.background },
  container: { padding: 20, paddingBottom: 36 },
  title: { fontSize: 31, fontWeight: '800', color: theme.colors.text, marginTop: 10 },
  subtitle: { color: theme.colors.mutedText, fontSize: 16, lineHeight: 23, marginTop: 6, marginBottom: 18 },
});
