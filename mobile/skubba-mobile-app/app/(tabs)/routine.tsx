import { SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import ProductCard from '../../components/ProductCard';
import RoutineItem from '../../components/RoutineItem';
import SectionHeader from '../../components/SectionHeader';
import { theme } from '../../constants/theme';
import { mockProducts } from '../../data/mockProducts';
import { mockScans } from '../../data/mockScans';

export default function RoutineScreen() {
  const latestScan = mockScans[0];

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Your Routine</Text>
        <Text style={styles.subtitle}>Suggestions generated from your latest smart-mirror results.</Text>

        <SectionHeader title="Morning" />
        <View style={styles.card}>
          {latestScan.morningRoutine.map((item, index) => (
            <RoutineItem key={`am-${item}`} number={index + 1} text={item} />
          ))}
        </View>

        <SectionHeader title="Evening" />
        <View style={styles.card}>
          {latestScan.eveningRoutine.map((item, index) => (
            <RoutineItem key={`pm-${item}`} number={index + 1} text={item} />
          ))}
        </View>

        <SectionHeader title="Product Recommendations" />
        {mockProducts.map((product) => <ProductCard key={product.id} product={product} />)}

        <Text style={styles.disclaimer}>
          SKUBBA provides informational skincare guidance and is not a medical diagnosis or treatment service.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: theme.colors.background },
  container: { padding: 20, paddingBottom: 40 },
  title: { fontSize: 31, fontWeight: '800', color: theme.colors.text, marginTop: 10 },
  subtitle: { color: theme.colors.mutedText, fontSize: 16, lineHeight: 23, marginTop: 6 },
  card: { backgroundColor: theme.colors.surface, borderRadius: 18, padding: 16, borderWidth: 1, borderColor: theme.colors.border },
  disclaimer: { marginTop: 24, color: theme.colors.mutedText, fontSize: 12, lineHeight: 18, textAlign: 'center' },
});
