import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import { StyleSheet, Text } from 'react-native';

import { PressableScale } from '../../components/motion';
import { theme } from '../../constants/theme';
import { isSignedIn } from '../../services/auth';

/**
 * Leaves wherever the user is for the home tab, popping screens rather than
 * stacking home on top. Hidden before sign-in (e.g. the care page reached from
 * the welcome screen) so it can't skip the login.
 */
export function HomeButton({ iconOnly = false, onDark = false }: { iconOnly?: boolean; onDark?: boolean }) {
  if (!isSignedIn()) return null;
  const color = onDark ? theme.colors.onDark : theme.colors.primary;
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel="Back to home"
      containerStyle={styles.wrap}
      style={[styles.button, iconOnly && styles.iconOnly, onDark && styles.onDark]}
      onPress={() => router.dismissTo('/(tabs)/home')}
    >
      <Ionicons name="home-outline" size={18} color={color} />
      {iconOnly ? null : <Text style={[styles.text, { color }]}>Home</Text>}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  wrap: { alignSelf: 'flex-start' },
  button: {
    flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 999, backgroundColor: theme.colors.primarySoft,
  },
  iconOnly: { paddingHorizontal: 9 },
  onDark: { backgroundColor: 'rgba(255, 250, 242, 0.16)' },
  text: { fontWeight: '800' },
});
