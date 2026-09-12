import { router } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { theme } from '../constants/theme';
import { signIn } from '../services/auth';

export default function LoginScreen() {
  const [email, setEmail] = useState('demo@skubba.app');
  const [password, setPassword] = useState('demo1234');
  const [error, setError] = useState('');

  async function handleLogin() {
    setError('');
    const result = await signIn(email, password);
    if (!result.ok) {
      setError(result.message ?? 'Unable to sign in.');
      return;
    }
    router.replace('/(tabs)/home');
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View>
          <Text style={styles.eyebrow}>SKUBBA</Text>
          <Text style={styles.title}>Welcome back</Text>
          <Text style={styles.subtitle}>Sign in to view your mirror scan history and recommendations.</Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            style={styles.input}
            placeholder="you@example.com"
          />

          <Text style={styles.label}>Password</Text>
          <TextInput
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            style={styles.input}
            placeholder="Password"
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TouchableOpacity style={styles.button} onPress={handleLogin}>
            <Text style={styles.buttonText}>Sign In</Text>
          </TouchableOpacity>

          <Text style={styles.demoText}>Demo credentials are prefilled for the prototype.</Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: theme.colors.background },
  container: { flex: 1, padding: 24, justifyContent: 'center' },
  eyebrow: { color: theme.colors.primary, fontWeight: '800', letterSpacing: 3, marginBottom: 12 },
  title: { fontSize: 36, fontWeight: '800', color: theme.colors.text },
  subtitle: { marginTop: 10, fontSize: 16, lineHeight: 24, color: theme.colors.mutedText },
  form: { marginTop: 36 },
  label: { fontSize: 14, fontWeight: '700', color: theme.colors.text, marginBottom: 8, marginTop: 14 },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: theme.colors.text,
  },
  button: {
    marginTop: 24,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    backgroundColor: theme.colors.primary,
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  error: { color: theme.colors.danger, marginTop: 12 },
  demoText: { marginTop: 12, textAlign: 'center', color: theme.colors.mutedText, fontSize: 13 },
});
