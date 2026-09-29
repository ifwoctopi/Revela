import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { theme } from '../constants/theme';

type Props = {
  title: string;
  action?: string;
  onPress?: () => void;
};

export default function SectionHeader({ title, action, onPress }: Props) {
  return (
    <View style={styles.row}>
      <Text style={styles.title}>{title}</Text>
      {action ? (
        <TouchableOpacity onPress={onPress}>
          <Text style={styles.action}>{action}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 24, marginBottom: 10 },
  title: { color: theme.colors.text, fontSize: 18, fontWeight: '800' },
  action: { color: theme.colors.primary, fontWeight: '700', fontSize: 13 },
});
