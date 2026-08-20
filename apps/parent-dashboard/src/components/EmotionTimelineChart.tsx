import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import type { EmotionDataPoint } from '../api/dashboardApi';

interface EmotionTimelineChartProps {
  dataPoints: EmotionDataPoint[];
  isLoading: boolean;
}

export const EmotionTimelineChart: React.FC<EmotionTimelineChartProps> = ({
  dataPoints,
  isLoading,
}) => (
  <View style={styles.card}>
    <Text style={styles.title}>Mood check-ins</Text>
    {isLoading ? (
      <ActivityIndicator color="#4A9EFF" />
    ) : dataPoints.length === 0 ? (
      <Text style={styles.empty}>ARIA will show a privacy-safe mood summary after a session.</Text>
    ) : (
      <View style={styles.points}>
        {dataPoints.map((point) => (
          <View key={point.label} style={styles.point}>
            <View style={[styles.bar, { height: Math.max(8, point.value * 56) }]} />
            <Text style={styles.label}>{point.label}</Text>
          </View>
        ))}
      </View>
    )}
  </View>
);

const styles = StyleSheet.create({
  card: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 20, gap: 14 },
  title: { color: '#1A1A2E', fontSize: 16, fontWeight: '700' },
  empty: { color: '#64748B', fontSize: 13, lineHeight: 19 },
  points: { height: 84, flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  point: { alignItems: 'center', flex: 1, gap: 5 },
  bar: { backgroundColor: '#4A9EFF', borderRadius: 4, minWidth: 12, width: '70%' },
  label: { color: '#64748B', fontSize: 10 },
});
