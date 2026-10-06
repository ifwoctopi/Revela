import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import { StyleSheet, Text } from 'react-native';

import { PressableScale } from '../../components/motion';
import { theme } from '../../constants/theme';

/** Leaves the results flow for the home tab, popping the flow's screens rather than stacking home on top. */
export function HomeButton() {
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel="Back to home"
      containerStyle={styles.wrap}
      style={styles.button}
      onPress={() => router.dismissTo('/(tabs)/home')}
    >
      <Ionicons name="home-outline" size={18} color={theme.colors.primary} />
      <Text style={styles.text}>Home</Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  wrap: { alignSelf: 'flex-start' },
  button: {
    flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 999, backgroundColor: theme.colors.primarySoft,
  },
  text: { color: theme.colors.primary, fontWeight: '800' },
});
