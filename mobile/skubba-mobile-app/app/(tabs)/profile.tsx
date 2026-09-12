import { router } from 'expo-router';
import { SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { theme } from '../../constants/theme';

export default function ProfileScreen() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.title}>Profile</Text>
        <View style={styles.card}>
          <Text style={styles.name}>Demo User</Text>
          <Text style={styles.email}>demo@skubba.app</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Data & Privacy</Text>
          <Text style={styles.body}>
            Facial images can be treated as temporary data while scan summaries and structured results remain available for history and progress tracking.
          </Text>
        </View>

        <TouchableOpacity style={styles.logoutButton} onPress={() => router.replace('/login')}>
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: theme.colors.background },
  container: { flex: 1, padding: 20 },
  title: { fontSize: 31, fontWeight: '800', color: theme.colors.text, marginTop: 10, marginBottom: 18 },
  card: { backgroundColor: theme.colors.surface, borderRadius: 18, padding: 18, borderWidth: 1, borderColor: theme.colors.border, marginBottom: 14 },
  name: { color: theme.colors.text, fontSize: 20, fontWeight: '800' },
  email: { color: theme.colors.mutedText, marginTop: 5 },
  sectionTitle: { color: theme.colors.text, fontSize: 17, fontWeight: '800', marginBottom: 8 },
  body: { color: theme.colors.mutedText, fontSize: 14, lineHeight: 21 },
  logoutButton: { marginTop: 'auto', marginBottom: 18, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  logoutText: { color: theme.colors.danger, fontWeight: '800' },
});
