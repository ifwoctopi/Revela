import { StyleSheet, Text, View } from 'react-native';
import { theme } from '../constants/theme';

export default function RoutineItem({ number, text }: { number: number; text: string }) {
  return (
    <View style={styles.row}>
      <View style={styles.numberCircle}><Text style={styles.number}>{number}</Text></View>
      <Text style={styles.text}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 7 },
  numberCircle: { width: 30, height: 30, borderRadius: 15, backgroundColor: theme.colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  number: { color: theme.colors.primary, fontWeight: '800' },
  text: { color: theme.colors.text, fontSize: 15, flex: 1 },
});
