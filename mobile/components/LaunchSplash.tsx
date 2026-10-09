// Picks up exactly where the native splash leaves off: same white screen,
// same icon in the same spot, so the hand-off is invisible. Then the tagline
// lands under the icon — "Love your skin" — and the whole thing fades away.

import { Ionicons } from '@expo/vector-icons';
import * as SplashScreen from 'expo-splash-screen';
import React from 'react';
import { Animated, Easing, Image, StyleSheet, Text, View } from 'react-native';

import { theme } from '../constants/theme';
import { useReduceMotion } from './motion';

// Must match the expo-splash-screen plugin config in app.json.
const ICON = require('../assets/splash-icon.png');
const ICON_SIZE = 160;
const BACKGROUND = '#FFFFFF';

SplashScreen.preventAutoHideAsync().catch(() => {});

export function LaunchSplash({ onDone }: { onDone: () => void }) {
  const reduce = useReduceMotion();
  const tagline = React.useRef(new Animated.Value(0)).current;
  const exit = React.useRef(new Animated.Value(0)).current;
  const doneRef = React.useRef(onDone);
  doneRef.current = onDone;

  React.useEffect(() => {
    const native = { useNativeDriver: true } as const;
    const anim = Animated.sequence([
      Animated.timing(tagline, { toValue: 1, duration: reduce ? 0 : 600, delay: 150, easing: Easing.out(Easing.cubic), ...native }),
      Animated.delay(reduce ? 900 : 1300),
      Animated.timing(exit, { toValue: 1, duration: reduce ? 150 : 450, easing: Easing.in(Easing.quad), ...native }),
    ]);
    // Swap the native splash for this identical view, then animate.
    SplashScreen.hideAsync()
      .catch(() => {})
      .finally(() => anim.start(({ finished }) => finished && doneRef.current()));
    return () => anim.stop();
  }, [reduce, tagline, exit]);

  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, styles.wrap, { opacity: exit.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) }]}
      accessible
      accessibilityLabel="Révéla. Love your skin."
    >
      <Image source={ICON} style={styles.icon} resizeMode="contain" />
      <Animated.View
        style={[
          styles.tagline,
          {
            opacity: tagline,
            transform: [{ translateY: tagline.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
          },
        ]}
      >
        <Text style={styles.taglineText}>Love your skin</Text>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { backgroundColor: BACKGROUND, alignItems: 'center', justifyContent: 'center', zIndex: 10 },
  icon: { width: ICON_SIZE, height: ICON_SIZE },
  // Positioned below the icon without nudging it off-center.
  tagline: {
    position: 'absolute', top: '50%', marginTop: ICON_SIZE / 2 + 20,
    flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  taglineText: { color: theme.colors.espresso, fontSize: 17, fontWeight: '800', fontStyle: 'italic', letterSpacing: 0.5 },
});
