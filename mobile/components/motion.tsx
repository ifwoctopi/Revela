// Shared motion primitives. Everything here honours the system Reduce Motion
// setting by rendering the final state immediately.

import { useFocusEffect } from 'expo-router';
import React from 'react';
import {
  AccessibilityInfo, Animated, Easing, Pressable, type PressableProps, type StyleProp, type ViewStyle,
} from 'react-native';

export function useReduceMotion(): boolean {
  const [reduce, setReduce] = React.useState(false);
  React.useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled().then((v) => active && setReduce(v), () => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce);
    return () => {
      active = false;
      sub.remove();
    };
  }, []);
  return reduce;
}

const STAGGER_MS = 70;

/**
 * Fades and lifts its children into place each time the screen gains focus,
 * so switching tabs or coming back to a screen feels alive. `index` staggers
 * siblings; the first few items lead and the rest follow quickly.
 */
export function Reveal({
  children, index = 0, style, distance = 18,
}: { children: React.ReactNode; index?: number; style?: StyleProp<ViewStyle>; distance?: number }) {
  const reduce = useReduceMotion();
  const v = React.useRef(new Animated.Value(0)).current;

  useFocusEffect(
    React.useCallback(() => {
      if (reduce) {
        v.setValue(1);
        return;
      }
      v.setValue(0);
      const anim = Animated.timing(v, {
        toValue: 1,
        duration: 420,
        delay: Math.min(index, 8) * STAGGER_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      });
      anim.start();
      return () => anim.stop();
    }, [reduce, index, v]),
  );

  return (
    <Animated.View
      style={[
        style,
        { opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [distance, 0] }) }] },
      ]}
    >
      {children}
    </Animated.View>
  );
}

/** A Pressable that springs down slightly while held. */
export function PressableScale({
  style, containerStyle, children, scaleTo = 0.96, ...rest
}: Omit<PressableProps, 'style' | 'children'> & {
  style?: StyleProp<ViewStyle>;
  /** Layout for the outer touch target, e.g. `flex: 1` inside a row. */
  containerStyle?: StyleProp<ViewStyle>;
  children: React.ReactNode;
  scaleTo?: number;
}) {
  const scale = React.useRef(new Animated.Value(1)).current;
  const to = (toValue: number) =>
    Animated.spring(scale, { toValue, useNativeDriver: true, speed: 40, bounciness: toValue === 1 ? 8 : 0 }).start();
  return (
    <Pressable
      {...rest}
      style={containerStyle}
      onPressIn={(e) => {
        to(scaleTo);
        rest.onPressIn?.(e);
      }}
      onPressOut={(e) => {
        to(1);
        rest.onPressOut?.(e);
      }}
    >
      <Animated.View style={[style, { transform: [{ scale }] }]}>{children}</Animated.View>
    </Pressable>
  );
}

/** Wraps a tab icon so it pops up when its tab becomes active. */
export function TabIconBounce({ focused, children }: { focused: boolean; children: React.ReactNode }) {
  const v = React.useRef(new Animated.Value(focused ? 1 : 0)).current;
  React.useEffect(() => {
    Animated.spring(v, { toValue: focused ? 1 : 0, useNativeDriver: true, friction: 5, tension: 140 }).start();
  }, [focused, v]);
  return (
    <Animated.View
      style={{
        transform: [
          { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, -3] }) },
          { scale: v.interpolate({ inputRange: [0, 1], outputRange: [1, 1.14] }) },
        ],
      }}
    >
      {children}
    </Animated.View>
  );
}
