import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Image, StyleSheet, View, type ImageSourcePropType } from 'react-native';

import { resolveProductImage } from '../products/images';
import { theme } from '../../skubba-mobile-app/constants/theme';

type Props = {
  barcode: string;
  imagePath: string | null;
  /** False inside the private results flow; see products/images.ts. */
  allowNetwork: boolean;
  size?: number;
  label: string;
};

export function ProductImage({ barcode, imagePath, allowNetwork, size = 72, label }: Props) {
  const [source, setSource] = React.useState<ImageSourcePropType | null>(null);

  React.useEffect(() => {
    let active = true;
    setSource(null);
    resolveProductImage(barcode, imagePath, { allowNetwork }).then((s) => active && setSource(s), () => undefined);
    return () => {
      active = false;
    };
  }, [barcode, imagePath, allowNetwork]);

  const box = { width: size, height: size, borderRadius: size / 6 };
  if (!source) {
    return (
      <View style={[styles.placeholder, box]} accessibilityRole="image" accessibilityLabel={`${label} (no image available)`}>
        <Ionicons name="water-outline" size={size / 2.4} color={theme.colors.primary} />
      </View>
    );
  }
  return <Image source={source} style={[styles.image, box]} accessibilityLabel={label} resizeMode="contain" />;
}

const styles = StyleSheet.create({
  placeholder: { backgroundColor: theme.colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  image: { backgroundColor: theme.colors.surface },
});
