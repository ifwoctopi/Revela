// Small layout building blocks that keep screens calm: one clear header, icon
// badges in place of walls of text, and long copy collapsed behind "Read more".

import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Image, LayoutAnimation, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { theme } from '../constants/theme';

export type IconName = React.ComponentProps<typeof Ionicons>['name'];
type Tone = 'ginger' | 'brown' | 'cream' | 'espresso';

const TONES: Record<Tone, { bg: string; fg: string }> = {
  ginger: { bg: theme.colors.gingerSoft, fg: theme.colors.ginger },
  brown: { bg: theme.colors.creamDeep, fg: theme.colors.brown },
  cream: { bg: theme.colors.surface, fg: theme.colors.ginger },
  espresso: { bg: theme.colors.espresso, fg: theme.colors.cream },
};

export const HAND_IMAGE = require('../assets/brand/hand.png');

export function IconBadge({ name, tone = 'ginger', size = 40 }: { name: IconName; tone?: Tone; size?: number }) {
  const t = TONES[tone];
  return (
    <View style={[styles.badge, { width: size, height: size, borderRadius: size / 2, backgroundColor: t.bg }]}>
      <Ionicons name={name} size={size * 0.5} color={t.fg} />
    </View>
  );
}

export function HandMark({ size = 44 }: { size?: number }) {
  return <Image source={HAND_IMAGE} style={{ width: size * 0.77, height: size }} resizeMode="contain" accessibilityIgnoresInvertColors />;
}

export function ScreenHeader({ kicker, title, subtitle, icon }: { kicker: string; title: string; subtitle?: string; icon?: IconName }) {
  return (
    <View style={styles.header}>
      <View style={styles.headerRow}>
        <View style={styles.flex}>
          <Text style={styles.kicker}>{kicker}</Text>
          <Text style={styles.title} accessibilityRole="header">{title}</Text>
        </View>
        {icon ? <IconBadge name={icon} size={48} /> : null}
      </View>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function SectionTitle({ icon, children }: { icon?: IconName; children: React.ReactNode }) {
  return (
    <View style={styles.sectionRow}>
      {icon ? <Ionicons name={icon} size={18} color={theme.colors.primary} /> : null}
      <Text style={styles.section} accessibilityRole="header">{children}</Text>
    </View>
  );
}

/** Long copy shows a few lines, with a toggle to read the rest. */
export function ExpandableText({ text, lines = 3, style }: { text: string; lines?: number; style?: StyleProp<any> }) {
  const [open, setOpen] = React.useState(false);
  const [overflows, setOverflows] = React.useState(false);
  return (
    <View>
      <Text style={style} numberOfLines={open ? undefined : lines}>
        {text}
      </Text>
      {/* Hidden full copy measures whether truncation happened, since a clamped Text reports clamped lines. */}
      {!overflows ? (
        <Text
          style={[style, styles.measure]}
          onTextLayout={(e) => e.nativeEvent.lines.length > lines && setOverflows(true)}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          {text}
        </Text>
      ) : null}
      {overflows ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={open ? 'Show less' : 'Read more'}
          onPress={() => {
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            setOpen((o) => !o);
          }}
          hitSlop={8}
          style={styles.more}
        >
          <Text style={styles.moreText}>{open ? 'Show less' : 'Read more'}</Text>
          <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={14} color={theme.colors.primary} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  badge: { alignItems: 'center', justifyContent: 'center' },
  header: { gap: 8, marginBottom: 4 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  kicker: { color: theme.colors.primary, fontWeight: '900', letterSpacing: 2, fontSize: 12, textTransform: 'uppercase' },
  title: { fontSize: 30, fontWeight: '900', color: theme.colors.text, marginTop: 2 },
  subtitle: { fontSize: 15, lineHeight: 22, color: theme.colors.mutedText },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 18,
    ...theme.shadow,
  },
  sectionRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  section: { fontSize: 18, fontWeight: '900', color: theme.colors.text },
  measure: { position: 'absolute', opacity: 0, left: 0, right: 0 },
  more: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6, alignSelf: 'flex-start' },
  moreText: { color: theme.colors.primary, fontWeight: '800', fontSize: 14 },
});
