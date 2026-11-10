import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  KeyboardAvoidingView,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { PressableScale, useReduceMotion } from '../components/motion';
import { SignHello } from '../components/SignHello';
import { theme } from '../constants/theme';
import { syncKnowledge } from '../src/knowledge/sync';
import { signIn, signUp } from '../services/auth';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [mode, setMode] = useState<'signIn' | 'signUp'>('signIn');
  const [busy, setBusy] = useState(false);
  const [focused, setFocused] = useState<'email' | 'password' | null>(null);
  const reduce = useReduceMotion();

  // The form sheet rises once the hand has started signing.
  const sheet = React.useRef(new Animated.Value(0)).current;
  const shake = React.useRef(new Animated.Value(0)).current;
  React.useEffect(() => {
    if (reduce) {
      sheet.setValue(1);
      return;
    }
    const anim = Animated.timing(sheet, {
      toValue: 1, duration: 650, delay: 700, easing: Easing.out(Easing.cubic), useNativeDriver: true,
    });
    anim.start();
    return () => anim.stop();
  }, [reduce, sheet]);

  function nudge() {
    if (reduce) return;
    shake.setValue(0);
    Animated.sequence(
      [1, -1, 0.6, -0.6, 0].map((toValue) => Animated.timing(shake, { toValue, duration: 60, useNativeDriver: true })),
    ).start();
  }

  async function handleLogin() {
    if (busy) return;
    setError('');
    setNotice('');
    setBusy(true);
    const result = mode === 'signIn' ? await signIn(email, password) : await signUp(email, password);
    setBusy(false);
    if (!result.ok) {
      setError(result.message ?? 'Unable to sign in.');
      nudge();
      return;
    }
    if (result.needsConfirmation) {
      setNotice('Check your email to confirm your account, then sign in.');
      setMode('signIn');
      return;
    }
    void syncKnowledge();
    router.replace('/(tabs)/home');
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
      <KeyboardAvoidingView style={styles.flex} behavior="padding">
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" bounces={false}>
          <View style={styles.hero}>
            <Text style={styles.brand}>RÉVÉLA</Text>
            <SignHello height={210} />
          </View>

          <Animated.View
            style={[
              styles.sheet,
              {
                opacity: sheet,
                transform: [
                  { translateY: sheet.interpolate({ inputRange: [0, 1], outputRange: [60, 0] }) },
                  { translateX: shake.interpolate({ inputRange: [-1, 1], outputRange: [-10, 10] }) },
                ],
              },
            ]}
          >
            <Text style={styles.title}>{mode === 'signIn' ? 'Welcome back' : 'Create account'}</Text>
            <Text style={styles.subtitle}>
              {mode === 'signIn' ? 'Sign in to see your checks, routine and journal.' : 'Sign up to keep your checks, routine and journal.'}
            </Text>

            <View style={[styles.field, focused === 'email' && styles.fieldFocused]}>
              <Ionicons name="mail-outline" size={18} color={focused === 'email' ? theme.colors.primary : theme.colors.mutedText} />
              <TextInput
                value={email}
                onChangeText={setEmail}
                onFocus={() => setFocused('email')}
                onBlur={() => setFocused(null)}
                autoCapitalize="none"
                keyboardType="email-address"
                style={styles.input}
                placeholder="you@example.com"
                placeholderTextColor={theme.colors.mutedText}
                accessibilityLabel="Email"
              />
            </View>

            <View style={[styles.field, focused === 'password' && styles.fieldFocused]}>
              <Ionicons name="lock-closed-outline" size={18} color={focused === 'password' ? theme.colors.primary : theme.colors.mutedText} />
              <TextInput
                value={password}
                onChangeText={setPassword}
                onFocus={() => setFocused('password')}
                onBlur={() => setFocused(null)}
                secureTextEntry
                autoCapitalize="none"
                autoComplete={mode === 'signIn' ? 'current-password' : 'new-password'}
                style={styles.input}
                placeholder="Password"
                placeholderTextColor={theme.colors.mutedText}
                accessibilityLabel="Password"
                onSubmitEditing={handleLogin}
                returnKeyType="go"
              />
            </View>

            {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}
            {notice ? <Text style={styles.notice}>{notice}</Text> : null}

            <PressableScale style={styles.button} onPress={handleLogin} accessibilityRole="button" accessibilityLabel={mode === 'signIn' ? 'Sign in' : 'Sign up'}>
              {busy ? (
                <ActivityIndicator color={theme.colors.onDark} />
              ) : (
                <>
                  <Text style={styles.buttonText}>{mode === 'signIn' ? 'Sign in' : 'Sign up'}</Text>
                  <Ionicons name="arrow-forward" size={18} color={theme.colors.onDark} />
                </>
              )}
            </PressableScale>

            <PressableScale
              onPress={() => {
                setError('');
                setNotice('');
                setMode(mode === 'signIn' ? 'signUp' : 'signIn');
              }}
              accessibilityRole="button"
            >
              <Text style={styles.switchText}>
                {mode === 'signIn' ? "New here? Create an account" : 'Already have an account? Sign in'}
              </Text>
            </PressableScale>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: theme.colors.espresso },
  flex: { flex: 1 },
  scroll: { flexGrow: 1 },
  hero: { alignItems: 'center', paddingTop: 28, paddingBottom: 8 },
  brand: { color: theme.colors.copper, fontWeight: '900', letterSpacing: 6, fontSize: 14, marginBottom: 12 },
  sheet: {
    flexGrow: 1,
    backgroundColor: theme.colors.cream,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 24,
    paddingTop: 28,
    gap: 12,
  },
  title: { fontSize: 30, fontWeight: '900', color: theme.colors.text },
  subtitle: { fontSize: 15, lineHeight: 22, color: theme.colors.mutedText, marginBottom: 6 },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    paddingHorizontal: 14,
  },
  fieldFocused: { borderColor: theme.colors.primary },
  input: { flex: 1, paddingVertical: 14, fontSize: 16, color: theme.colors.text },
  button: {
    marginTop: 8,
    borderRadius: theme.radius.md,
    paddingVertical: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    backgroundColor: theme.colors.primary,
    minHeight: 54,
  },
  buttonText: { color: theme.colors.onDark, fontSize: 16, fontWeight: '800' },
  error: { color: theme.colors.danger },
  notice: { color: theme.colors.primary },
  switchText: { textAlign: 'center', color: theme.colors.primary, fontSize: 14, fontWeight: '700', paddingVertical: 8 },
});
