// Login hero: the Révéla hand signs "I love you".
// The ASL sign combines three letters — I (pinky), L (thumb + index) and
// Y (thumb + pinky) — so each letter blooms beside the fingers that form it,
// the three fold into the hand, and the words appear. Then the hand keeps a
// gentle breathing float with hearts drifting up, and the tagline lands:
// "Love your skin".

import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Animated, Easing, Image, StyleSheet, Text, View } from 'react-native';

import { theme } from '../constants/theme';
import { useReduceMotion } from './motion';

const HAND = require('../assets/brand/hand-hero.png');
const HAND_RATIO = 543 / 712;

// Letter positions relative to the hand box (fractions of width/height).
const LETTERS = [
  { char: 'I', x: 1.1, y: 0.05 }, // pinky
  { char: 'L', x: -0.12, y: 0.14 }, // thumb + index
  { char: 'Y', x: 1.08, y: 0.52 }, // thumb + pinky
] as const;

const HEARTS = [
  { x: 0.15, delay: 0, size: 16 },
  { x: 0.7, delay: 1200, size: 12 },
  { x: 0.45, delay: 2300, size: 14 },
];

export function SignHello({ height = 230, onSigned }: { height?: number; onSigned?: () => void }) {
  const reduce = useReduceMotion();
  const width = height * HAND_RATIO;

  const enter = React.useRef(new Animated.Value(0)).current;
  const wave = React.useRef(new Animated.Value(0)).current;
  const letters = React.useRef(LETTERS.map(() => new Animated.Value(0))).current;
  const merge = React.useRef(new Animated.Value(0)).current;
  const words = React.useRef(new Animated.Value(0)).current;
  const tagline = React.useRef(new Animated.Value(0)).current;
  const float = React.useRef(new Animated.Value(0)).current;
  const ring = React.useRef(new Animated.Value(0)).current;
  const hearts = React.useRef(HEARTS.map(() => new Animated.Value(0))).current;
  const signedRef = React.useRef(onSigned);
  signedRef.current = onSigned;

  React.useEffect(() => {
    if (reduce) {
      [enter, merge, words, tagline].forEach((v) => v.setValue(1));
      letters.forEach((v) => v.setValue(1));
      signedRef.current?.();
      return;
    }
    [enter, wave, merge, words, tagline, float, ring].forEach((v) => v.setValue(0));
    letters.forEach((v) => v.setValue(0));
    hearts.forEach((v) => v.setValue(0));

    const native = { useNativeDriver: true } as const;
    const intro = Animated.sequence([
      // Hand rises and settles.
      Animated.spring(enter, { toValue: 1, friction: 6, tension: 45, ...native }),
      // A small flourish, like presenting the sign.
      Animated.sequence([
        Animated.timing(wave, { toValue: 1, duration: 180, easing: Easing.out(Easing.quad), ...native }),
        Animated.timing(wave, { toValue: -1, duration: 260, easing: Easing.inOut(Easing.quad), ...native }),
        Animated.spring(wave, { toValue: 0, friction: 4, tension: 80, ...native }),
      ]),
      // I, L, Y bloom beside the fingers that make them.
      Animated.stagger(
        320,
        letters.map((v) => Animated.spring(v, { toValue: 1, friction: 5, tension: 90, ...native })),
      ),
      Animated.delay(450),
      // They fold into the hand and the meaning appears.
      Animated.parallel([
        Animated.timing(merge, { toValue: 1, duration: 520, easing: Easing.in(Easing.back(1.4)), ...native }),
        Animated.timing(words, { toValue: 1, duration: 600, delay: 320, easing: Easing.out(Easing.cubic), ...native }),
      ]),
      // "I love you" turns toward the user: love your skin.
      Animated.spring(tagline, { toValue: 1, friction: 6, tension: 50, delay: 250, ...native }),
    ]);

    const loops: Animated.CompositeAnimation[] = [];
    intro.start(({ finished }) => {
      if (!finished) return;
      signedRef.current?.();
      const breathe = Animated.loop(
        Animated.sequence([
          Animated.timing(float, { toValue: 1, duration: 1800, easing: Easing.inOut(Easing.sin), ...native }),
          Animated.timing(float, { toValue: 0, duration: 1800, easing: Easing.inOut(Easing.sin), ...native }),
        ]),
      );
      const pulse = Animated.loop(
        Animated.timing(ring, { toValue: 1, duration: 2600, easing: Easing.out(Easing.quad), ...native }),
      );
      const drift = hearts.map((v, i) =>
        Animated.loop(
          Animated.sequence([
            Animated.delay(HEARTS[i].delay),
            Animated.timing(v, { toValue: 1, duration: 3200, easing: Easing.out(Easing.quad), ...native }),
            Animated.timing(v, { toValue: 0, duration: 0, ...native }),
          ]),
        ),
      );
      loops.push(breathe, pulse, ...drift);
      loops.forEach((l) => l.start());
    });

    return () => {
      intro.stop();
      loops.forEach((l) => l.stop());
    };
  }, [reduce, enter, wave, letters, merge, words, tagline, float, ring, hearts]);

  const handStyle = {
    opacity: enter.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 1, 1] }),
    transform: [
      { translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [height * 0.6, 0] }) },
      { translateY: float.interpolate({ inputRange: [0, 1], outputRange: [0, -7] }) },
      { scale: enter.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) },
      // Pulse grows slightly as the letters fold in, like the sign landing.
      { scale: merge.interpolate({ inputRange: [0, 0.85, 1], outputRange: [1, 1, 1.04] }) },
      { rotate: wave.interpolate({ inputRange: [-1, 0, 1], outputRange: ['-9deg', '0deg', '7deg'] }) },
      { rotate: float.interpolate({ inputRange: [0, 1], outputRange: ['-1.5deg', '1.5deg'] }) },
    ],
  };

  return (
    <View style={[styles.wrap, { height: height + 110 }]} accessible accessibilityRole="image" accessibilityLabel="A hand signing I love you in American Sign Language">
      <View style={[styles.stage, { width: width * 1.9, height }]}>
        {/* Soft halo and an expanding ring behind the hand. */}
        <View style={[styles.halo, { width: height * 1.05, height: height * 1.05, borderRadius: height }]} />
        <Animated.View
          style={[
            styles.ring,
            { width: height, height, borderRadius: height },
            {
              opacity: ring.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 0.5, 0] }),
              transform: [{ scale: ring.interpolate({ inputRange: [0, 1], outputRange: [0.75, 1.35] }) }],
            },
          ]}
        />

        <View style={{ width, height }}>
          {HEARTS.map((h, i) => (
            <Animated.View
              key={i}
              style={[
                styles.heart,
                {
                  left: width * h.x,
                  opacity: hearts[i].interpolate({ inputRange: [0, 0.15, 0.7, 1], outputRange: [0, 0.9, 0.6, 0] }),
                  transform: [
                    { translateY: hearts[i].interpolate({ inputRange: [0, 1], outputRange: [0, -height * 0.75] }) },
                    { translateX: hearts[i].interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, i % 2 ? 10 : -10, 0] }) },
                    { scale: hearts[i].interpolate({ inputRange: [0, 0.3, 1], outputRange: [0.4, 1, 0.8] }) },
                  ],
                },
              ]}
            >
              <Ionicons name="heart" size={h.size} color={theme.colors.copper} />
            </Animated.View>
          ))}

          <Animated.View style={handStyle}>
            <Image source={HAND} style={{ width, height }} resizeMode="contain" />
          </Animated.View>

          {LETTERS.map((l, i) => {
            const v = letters[i];
            // Fly from beside the finger to the palm and shrink away.
            const toX = width * (0.5 - l.x);
            const toY = height * (0.55 - l.y);
            return (
              <Animated.View
                key={l.char}
                style={[
                  styles.letter,
                  { left: width * l.x - 22, top: height * l.y - 22 },
                  {
                    opacity: Animated.multiply(v, merge.interpolate({ inputRange: [0, 0.8, 1], outputRange: [1, 1, 0] })),
                    transform: [
                      { translateX: merge.interpolate({ inputRange: [0, 1], outputRange: [0, toX] }) },
                      { translateY: merge.interpolate({ inputRange: [0, 1], outputRange: [0, toY] }) },
                      { scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.2, 1] }) },
                      { scale: merge.interpolate({ inputRange: [0, 1], outputRange: [1, 0.3] }) },
                    ],
                  },
                ]}
              >
                <Text style={styles.letterText}>{l.char}</Text>
              </Animated.View>
            );
          })}
        </View>
      </View>

      <Animated.View
        style={[
          styles.words,
          {
            opacity: words,
            transform: [
              { translateY: words.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) },
              { scale: words.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) },
            ],
          },
        ]}
      >
        <Text style={styles.wordsText}>I love you</Text>
        <Text style={styles.wordsSub}>I + L + Y in ASL</Text>
      </Animated.View>

      <Animated.View
        style={[
          styles.tagline,
          {
            opacity: tagline,
            transform: [{ scale: tagline.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) }],
          },
        ]}
      >
        <Ionicons name="heart" size={12} color={theme.colors.copper} />
        <Text style={styles.taglineText}>Love your skin</Text>
        <Ionicons name="heart" size={12} color={theme.colors.copper} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'flex-start' },
  stage: { alignItems: 'center', justifyContent: 'center' },
  halo: { position: 'absolute', backgroundColor: 'rgba(208, 112, 58, 0.16)' },
  ring: { position: 'absolute', borderWidth: 2, borderColor: theme.colors.copper },
  heart: { position: 'absolute', bottom: '35%' },
  letter: {
    position: 'absolute', width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
    backgroundColor: theme.colors.cream, borderWidth: 2, borderColor: theme.colors.ginger,
  },
  letterText: { fontSize: 22, fontWeight: '900', color: theme.colors.ginger },
  words: { alignItems: 'center', marginTop: 8 },
  wordsText: { fontSize: 26, fontWeight: '900', color: theme.colors.cream, letterSpacing: 0.5 },
  tagline: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, paddingHorizontal: 16, paddingVertical: 7,
    borderRadius: 999, borderWidth: 1, borderColor: 'rgba(208, 112, 58, 0.5)', backgroundColor: 'rgba(208, 112, 58, 0.14)',
  },
  taglineText: { color: theme.colors.cream, fontSize: 15, fontWeight: '800', fontStyle: 'italic', letterSpacing: 0.5 },
  wordsSub: { fontSize: 12, fontWeight: '700', color: theme.colors.onDarkMuted, letterSpacing: 1.5, marginTop: 2, textTransform: 'uppercase' },
});
