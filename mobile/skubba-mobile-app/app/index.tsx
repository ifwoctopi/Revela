import { router } from 'expo-router';
import { SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { theme } from '../constants/theme';

export default function WelcomeScreen() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View>
          <Text style={styles.brand}>SKUBBA</Text>
          <Text style={styles.title}>Your skincare companion</Text>
          <Text style={styles.subtitle}>
            Review smart-mirror scans, understand your results, and keep your routine in one place.
          </Text>
        </View>

        <TouchableOpacity style={styles.primaryButton} onPress={() => router.push('/login')}>
          <Text style={styles.primaryButtonText}>Get Started</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: theme.colors.background },
  container: {
    flex: 1,
    padding: 24,
    justifyContent: 'space-between',
    paddingTop: 90,
    paddingBottom: 36,
  },
  brand: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 4,
    color: theme.colors.primary,
    marginBottom: 18,
  },
  title: {
    fontSize: 42,
    lineHeight: 48,
    fontWeight: '800',
    color: theme.colors.text,
    maxWidth: 320,
  },
  subtitle: {
    marginTop: 18,
    fontSize: 17,
    lineHeight: 26,
    color: theme.colors.mutedText,
    maxWidth: 360,
  },
  primaryButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryButtonText: { color: '#fff', fontSize: 17, fontWeight: '700' },
});
