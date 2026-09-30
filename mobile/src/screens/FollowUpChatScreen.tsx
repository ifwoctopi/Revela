import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import React from 'react';
import {
  ActivityIndicator, AppState, KeyboardAvoidingView, Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, Text,
  TextInput, View,
} from 'react-native';

import { useResultsFlow } from '../flow/ResultsFlowContext';
import { MAX_CHAT_TURNS, MAX_USER_MESSAGE_CHARS } from '../guardrails/inputFilter';
import { answerQuestion, type ChatMessage } from '../guardrails/pipeline';
import type { PreparedSpeech } from '../narration/narrator';
import type { SummarySection } from '../summary/schema';
import { theme } from '../../skubba-mobile-app/constants/theme';

/**
 * Follow-up questions about the results just presented. Every assistant
 * message comes from answerQuestion(), so only validated or fixed guardrail
 * text is ever shown or spoken. History lives in the flow's memory only.
 */
export function FollowUpChatScreen() {
  const { services, userContext, plan, sections, chat, setChat } = useResultsFlow();
  const [draft, setDraft] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [speaking, setSpeaking] = React.useState<number | null>(null);
  const speech = React.useRef<PreparedSpeech | null>(null);
  const scroll = React.useRef<ScrollView>(null);

  const stopSpeaking = React.useCallback(() => {
    speech.current?.release();
    speech.current = null;
    setSpeaking(null);
  }, []);

  // Interruptions: backgrounding or leaving the screen stops and releases audio.
  React.useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => next !== 'active' && stopSpeaking());
    return () => sub.remove();
  }, [stopSpeaking]);
  useFocusEffect(React.useCallback(() => stopSpeaking, [stopSpeaking]));

  const userTurns = chat.filter((m) => m.role === 'user').length;
  const atLimit = userTurns >= MAX_CHAT_TURNS;

  const send = async () => {
    const question = draft.trim();
    if (!question || busy || !services || !plan) return;
    setDraft('');
    const history = chat;
    setChat([...history, { role: 'user', text: question }]);
    setBusy(true);
    try {
      const reply = await answerQuestion(question, history, {
        llm: services.llm,
        repository: services.repository,
        knownBrands: services.knownBrands,
        context: userContext,
        plan,
        sections: sections.filter((s): s is SummarySection => s !== null),
      });
      setChat((all) => [...all, { role: 'assistant', text: reply.text, kind: reply.kind }]);
    } finally {
      setBusy(false);
    }
  };

  const play = async (index: number, message: ChatMessage) => {
    if (!services) return;
    stopSpeaking();
    setSpeaking(index);
    try {
      const prepared = await services.speech.prepare(message.text);
      speech.current = prepared;
      prepared.play(() => {
        if (speech.current === prepared) {
          speech.current = null;
          setSpeaking(null);
        }
      });
    } catch {
      setSpeaking(null);
    }
  };

  if (!plan) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <Text style={[styles.assistantText, styles.empty]}>Run a scan first, then ask about your results here.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <Text style={styles.kicker}>Your results</Text>
          <Text style={styles.title}>Ask a question</Text>
          <Text style={styles.note}>
            Answers cover cosmetic skin care for your scan and the products in the app only. They aren't medical advice.
          </Text>
        </View>

        <ScrollView
          ref={scroll}
          style={styles.flex}
          contentContainerStyle={styles.thread}
          onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: false })}
          accessibilityLiveRegion="polite"
        >
          {chat.length === 0 ? (
            <Text style={styles.hint}>For example: "When should I use the serum?" or "Can I use these together?"</Text>
          ) : null}
          {chat.map((m, i) => (
            <View key={i} style={[styles.bubble, m.role === 'user' ? styles.userBubble : styles.assistantBubble]}>
              <Text
                style={m.role === 'user' ? styles.userText : m.kind === 'escalation' ? styles.escalationText : styles.assistantText}
                accessibilityRole={m.kind === 'escalation' ? 'alert' : undefined}
              >
                {m.text}
              </Text>
              {m.role === 'assistant' ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={speaking === i ? 'Stop reading this reply' : 'Read this reply aloud'}
                  onPress={() => (speaking === i ? stopSpeaking() : play(i, m))}
                  style={styles.playButton}
                  hitSlop={8}
                >
                  <Ionicons name={speaking === i ? 'stop-circle-outline' : 'volume-high-outline'} size={18} color={theme.colors.primary} />
                </Pressable>
              ) : null}
            </View>
          ))}
          {busy ? <ActivityIndicator color={theme.colors.primary} style={styles.busy} accessibilityLabel="Preparing an answer" /> : null}
        </ScrollView>

        <View style={styles.inputRow}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder={atLimit ? 'Question limit reached' : 'Ask about your results'}
            accessibilityLabel="Your question"
            maxLength={MAX_USER_MESSAGE_CHARS}
            style={styles.input}
            onSubmitEditing={send}
            returnKeyType="send"
            editable={!busy && !atLimit && !!services}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Send question"
            accessibilityState={{ disabled: busy || atLimit || !draft.trim() }}
            disabled={busy || atLimit || !draft.trim()}
            style={[styles.sendButton, (busy || atLimit || !draft.trim()) && styles.disabled]}
            onPress={send}
          >
            <Text style={styles.sendText}>Send</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: theme.colors.background },
  flex: { flex: 1 },
  header: { paddingHorizontal: 20, paddingTop: 16, gap: 4 },
  kicker: { fontSize: 13, fontWeight: '800', letterSpacing: 2, color: theme.colors.primary, textTransform: 'uppercase' },
  title: { fontSize: 24, fontWeight: '800', color: theme.colors.text },
  note: { fontSize: 13, lineHeight: 19, color: theme.colors.mutedText },
  empty: { padding: 24 },
  thread: { padding: 20, gap: 10 },
  hint: { color: theme.colors.mutedText, fontSize: 14 },
  bubble: { maxWidth: '85%', borderRadius: 16, padding: 12, gap: 6 },
  assistantBubble: { alignSelf: 'flex-start', backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border },
  userBubble: { alignSelf: 'flex-end', backgroundColor: theme.colors.primary },
  assistantText: { color: theme.colors.text, fontSize: 15, lineHeight: 21 },
  escalationText: { color: theme.colors.danger, fontSize: 15, lineHeight: 21, fontWeight: '700' },
  userText: { color: '#FFFFFF', fontSize: 15, lineHeight: 21 },
  playButton: { alignSelf: 'flex-end' },
  busy: { alignSelf: 'flex-start', marginLeft: 8 },
  inputRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10, padding: 16, borderTopWidth: 1,
    borderTopColor: theme.colors.border, backgroundColor: theme.colors.surface,
  },
  input: {
    flex: 1, minHeight: 44, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.border, paddingHorizontal: 12,
    color: theme.colors.text, backgroundColor: theme.colors.background,
  },
  sendButton: { backgroundColor: theme.colors.primary, borderRadius: 12, paddingHorizontal: 16, minHeight: 44, justifyContent: 'center' },
  sendText: { color: '#FFFFFF', fontWeight: '800' },
  disabled: { opacity: 0.5 },
});
