import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { theme } from '../constants/theme';
import { Scan } from '../types/scan';

type Props = {
  scan: Scan;
  onPress?: () => void;
};

export default function ScanCard({ scan, onPress }: Props) {
  const date = new Date(scan.createdAt).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.8}>
      <View>
        <Text style={styles.date}>{date}</Text>
        <Text style={styles.condition}>{scan.primaryCondition}</Text>
        <Text style={styles.summary} numberOfLines={2}>{scan.aiSummary}</Text>
      </View>
      <View style={styles.badge}>
        <Text style={styles.badgeText}>{Math.round(scan.confidence * 100)}%</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 18,
    padding: 18,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 14,
  },
  date: { color: theme.colors.mutedText, fontSize: 13, fontWeight: '600' },
  condition: { color: theme.colors.text, fontSize: 22, fontWeight: '800', marginTop: 5 },
  summary: { color: theme.colors.mutedText, fontSize: 13, lineHeight: 19, marginTop: 6, maxWidth: 250 },
  badge: { backgroundColor: theme.colors.primarySoft, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, alignSelf: 'flex-start' },
  badgeText: { color: theme.colors.primary, fontWeight: '800' },
});
