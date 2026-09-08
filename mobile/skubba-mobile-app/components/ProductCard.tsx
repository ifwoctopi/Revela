import { Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { theme } from '../constants/theme';
import { Product } from '../types/product';

export default function ProductCard({ product }: { product: Product }) {
  return (
    <View style={styles.card}>
      <Text style={styles.category}>{product.category}</Text>
      <Text style={styles.name}>{product.name}</Text>
      <Text style={styles.brand}>{product.brand}</Text>
      <Text style={styles.description}>{product.description}</Text>
      {product.url ? (
        <TouchableOpacity onPress={() => Linking.openURL(product.url as string)}>
          <Text style={styles.link}>View product</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: theme.colors.surface, borderRadius: 18, borderWidth: 1, borderColor: theme.colors.border, padding: 18, marginBottom: 12 },
  category: { color: theme.colors.primary, textTransform: 'uppercase', fontSize: 12, letterSpacing: 1, fontWeight: '800' },
  name: { color: theme.colors.text, fontSize: 18, fontWeight: '800', marginTop: 6 },
  brand: { color: theme.colors.mutedText, marginTop: 2 },
  description: { color: theme.colors.text, fontSize: 14, lineHeight: 21, marginTop: 10 },
  link: { color: theme.colors.primary, fontWeight: '800', marginTop: 12 },
});
