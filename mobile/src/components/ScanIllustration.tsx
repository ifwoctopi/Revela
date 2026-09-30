// Stand-in for scan images. The mock scan data has angles and regions but no
// photos, so `scan:<angle>` image refs render as a face diagram with the
// noticed regions marked. Real captures can replace this without changing refs.

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { theme } from '../../constants/theme';
import type { AngleName, SessionSummary } from '../types/session';

const ANGLE_LABELS: Record<AngleName, string> = { front: 'Front', left_3q: 'Left side', right_3q: 'Right side' };

// Region positions on a 100×130 face, as fractions.
const REGION_POSITIONS: Record<string, { x: number; y: number }> = {
  forehead: { x: 0.5, y: 0.2 },
  left_cheek: { x: 0.28, y: 0.55 },
  right_cheek: { x: 0.72, y: 0.55 },
  nose: { x: 0.5, y: 0.5 },
  chin: { x: 0.5, y: 0.85 },
  under_eyes: { x: 0.5, y: 0.4 },
};

export function parseScanRef(ref: string): AngleName | null {
  const angle = ref.startsWith('scan:') ? ref.slice(5) : '';
  return angle in ANGLE_LABELS ? (angle as AngleName) : null;
}

export function ScanIllustration({ angle, scan }: { angle: AngleName; scan: SessionSummary }) {
  const regions = Object.values(scan.results).flatMap((r) => (r?.present && r.region && REGION_POSITIONS[r.region] ? [r.region] : []));
  const shift = angle === 'left_3q' ? -8 : angle === 'right_3q' ? 8 : 0;
  const label = `${ANGLE_LABELS[angle]} view${regions.length ? `, marked areas: ${regions.map((r) => r.replace('_', ' ')).join(', ')}` : ''}`;

  return (
    <View style={styles.frame} accessibilityRole="image" accessibilityLabel={label}>
      <View style={[styles.face, { transform: [{ translateX: shift }] }]}>
        {regions.map((region) => {
          const p = REGION_POSITIONS[region];
          return <View key={region} style={[styles.dot, { left: `${p.x * 100 - 9}%`, top: `${p.y * 100 - 7}%` }]} />;
        })}
      </View>
      <Text style={styles.caption}>{ANGLE_LABELS[angle]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { width: 104, alignItems: 'center', gap: 6 },
  face: {
    width: 76, height: 98, borderRadius: 40, borderWidth: 2, borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primarySoft,
  },
  dot: { position: 'absolute', width: 18, height: 14, borderRadius: 9, backgroundColor: 'rgba(176, 68, 68, 0.45)' },
  caption: { fontSize: 12, color: theme.colors.mutedText },
});
