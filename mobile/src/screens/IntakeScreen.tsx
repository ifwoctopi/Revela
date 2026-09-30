import { router } from 'expo-router';
import React from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';

import { useResultsFlow } from '../flow/ResultsFlowContext';
import { checkTextForEscalation, type Escalation } from '../guardrails/escalation';
import { applyAnswer } from '../intake/extract';
import { INTAKE_QUESTIONS, MAX_INTAKE_ANSWER_CHARS } from '../intake/questions';
import { theme } from '../../constants/theme';

interface Bubble {
  from: 'assistant' | 'user';
  text: string;
}

export function IntakeScreen() {
  const { services, userContext, updateUserContext, addIntakeEscalation } = useResultsFlow();
  const [step, setStep] = React.useState(0);
  const [draft, setDraft] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [escalation, setEscalation] = React.useState<Escalation | null>(null);
  const [bubbles, setBubbles] = React.useState<Bubble[]>(() => [
    { from: 'assistant', text: "Hi! Before your scan, I'll ask up to five quick questions so your results fit you. You can skip any of them." },
    { from: 'assistant', text: INTAKE_QUESTIONS[0].prompt },
  ]);
  const scroll = React.useRef<ScrollView>(null);
  const question = INTAKE_QUESTIONS[step];

  const advance = React.useCallback(() => {
    const next = step + 1;
    if (next >= INTAKE_QUESTIONS.length) {
      router.replace('/results/scan');
      return;
    }
    setStep(next);
    setBubbles((b) => [...b, { from: 'assistant', text: INTAKE_QUESTIONS[next].prompt }]);
  }, [step]);

  const submit = async (answer: string) => {
    const text = answer.trim().slice(0, MAX_INTAKE_ANSWER_CHARS);
    if (!text || busy || !question) return;
    setDraft('');
    setBubbles((b) => [...b, { from: 'user', text }]);

    // Red-flag answers are handled before anything else.
    const found = checkTextForEscalation(text);
    if (found) {
      addIntakeEscalation(found);
      setEscalation(found);
      setBubbles((b) => [...b, { from: 'assistant', text: found.message }]);
      return;
    }

    setBusy(true);
    try {
      await updateUserContext(await applyAnswer(userContext, question.field, text, services?.llm ?? null));
    } finally {
      setBusy(false);
    }
    advance();
  };

  const skip = () => {
    setBubbles((b) => [...b, { from: 'user', text: 'Skip' }]);
    advance();
  };

  const acknowledge = () => {
    setEscalation(null);
    advance();
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <Text style={styles.kicker}>Before your scan</Text>
          <Text style={styles.progress} accessibilityLabel={`Question ${step + 1} of ${INTAKE_QUESTIONS.length}`}>
            {Math.min(step + 1, INTAKE_QUESTIONS.length)} / {INTAKE_QUESTIONS.length}
          </Text>
        </View>

        <ScrollView
          ref={scroll}
          style={styles.flex}
          contentContainerStyle={styles.thread}
          onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: false })}
        >
          {bubbles.map((b, i) => (
            <View key={i} style={[styles.bubble, b.from === 'user' ? styles.userBubble : styles.assistantBubble]}>
              <Text style={b.from === 'user' ? styles.userText : styles.assistantText}>{b.text}</Text>
            </View>
          ))}
          {question && !escalation ? <Text style={styles.hint}>{question.hint}</Text> : null}
        </ScrollView>

        {escalation ? (
          <View style={styles.escalation} accessibilityRole="alert">
            <Text style={styles.escalationText}>{escalation.message}</Text>
            {escalation.level === 'emergency' ? (
              <Pressable accessibilityRole="button" style={styles.primaryButton} onPress={() => router.replace('/(tabs)/home')}>
                <Text style={styles.primaryText}>Leave the scan</Text>
              </Pressable>
            ) : (
              <Pressable accessibilityRole="button" style={styles.primaryButton} onPress={acknowledge}>
                <Text style={styles.primaryText}>I understand, continue with a cosmetic check</Text>
              </Pressable>
            )}
          </View>
        ) : question ? (
          <View style={styles.composer}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              {question.quickReplies.map((reply) => (
                <Pressable key={reply} accessibilityRole="button" style={styles.chip} onPress={() => submit(reply)} disabled={busy}>
                  <Text style={styles.chipText}>{reply}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <View style={styles.inputRow}>
              <TextInput
                value={draft}
                onChangeText={setDraft}
                placeholder="Type your answer"
                accessibilityLabel="Your answer"
                maxLength={MAX_INTAKE_ANSWER_CHARS}
                style={styles.input}
                onSubmitEditing={() => submit(draft)}
                returnKeyType="send"
                editable={!busy}
              />
              {busy ? (
                <ActivityIndicator color={theme.colors.primary} />
              ) : (
                <Pressable accessibilityRole="button" accessibilityLabel="Send answer" style={styles.sendButton} onPress={() => submit(draft)}>
                  <Text style={styles.primaryText}>Send</Text>
                </Pressable>
              )}
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Skip this question" onPress={skip} disabled={busy} style={styles.skip}>
              <Text style={styles.link}>Skip</Text>
            </Pressable>
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: theme.colors.background },
  flex: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 16 },
  kicker: { fontSize: 13, fontWeight: '800', letterSpacing: 2, color: theme.colors.primary, textTransform: 'uppercase' },
  progress: { color: theme.colors.mutedText, fontWeight: '700' },
  thread: { padding: 20, gap: 10 },
  bubble: { maxWidth: '85%', borderRadius: 16, padding: 12 },
  assistantBubble: { alignSelf: 'flex-start', backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border },
  userBubble: { alignSelf: 'flex-end', backgroundColor: theme.colors.primary },
  assistantText: { color: theme.colors.text, fontSize: 15, lineHeight: 21 },
  userText: { color: '#FFFFFF', fontSize: 15, lineHeight: 21 },
  hint: { color: theme.colors.mutedText, fontSize: 13, marginTop: 4 },
  composer: { borderTopWidth: 1, borderTopColor: theme.colors.border, backgroundColor: theme.colors.surface, paddingBottom: 8 },
  chips: { gap: 8, paddingHorizontal: 16, paddingTop: 12 },
  chip: { borderRadius: 999, borderWidth: 1, borderColor: theme.colors.primary, paddingHorizontal: 14, paddingVertical: 8 },
  chipText: { color: theme.colors.primary, fontWeight: '700' },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingTop: 10 },
  input: {
    flex: 1, minHeight: 44, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.border, paddingHorizontal: 12,
    color: theme.colors.text, backgroundColor: theme.colors.background,
  },
  sendButton: { backgroundColor: theme.colors.primary, borderRadius: 12, paddingHorizontal: 16, minHeight: 44, justifyContent: 'center' },
  skip: { alignSelf: 'center', padding: 10 },
  link: { color: theme.colors.primary, fontWeight: '700' },
  escalation: { margin: 16, padding: 16, borderRadius: 16, backgroundColor: '#FBEAEA', gap: 12 },
  escalationText: { color: theme.colors.danger, fontSize: 15, lineHeight: 21, fontWeight: '700' },
  primaryButton: { backgroundColor: theme.colors.primary, borderRadius: 12, padding: 14, alignItems: 'center' },
  primaryText: { color: '#FFFFFF', fontWeight: '800' },
});
