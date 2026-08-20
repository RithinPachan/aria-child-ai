import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import type { LearningMilestone } from '../api/dashboardApi';

interface LearningProgressCardProps {
  milestones: LearningMilestone[];
  isLoading: boolean;
}

export const LearningProgressCard: React.FC<LearningProgressCardProps> = ({
  milestones,
  isLoading,
}) => (
  <View style={styles.card}>
    <Text style={styles.title}>Learning progress</Text>
    {isLoading ? (
      <ActivityIndicator color="#9E4AFF" />
    ) : milestones.length === 0 ? (
      <Text style={styles.empty}>Learning milestones are optional and require parent consent.</Text>
    ) : (
      milestones.map((milestone) => (
        <View key={milestone.id} style={styles.milestone}>
          <View style={styles.heading}>
            <Text style={styles.milestoneTitle}>{milestone.title}</Text>
            <Text style={styles.percent}>{Math.round(milestone.progress * 100)}%</Text>
          </View>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${Math.round(milestone.progress * 100)}%` }]} />
          </View>
        </View>
      ))
    )}
  </View>
);

const styles = StyleSheet.create({
  card: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 20, gap: 14 },
  title: { color: '#1A1A2E', fontSize: 16, fontWeight: '700' },
  empty: { color: '#64748B', fontSize: 13, lineHeight: 19 },
  milestone: { gap: 6 },
  heading: { flexDirection: 'row', justifyContent: 'space-between' },
  milestoneTitle: { color: '#334155', fontSize: 13, fontWeight: '600' },
  percent: { color: '#7C3AED', fontSize: 12, fontWeight: '700' },
  track: { backgroundColor: '#EDE9FE', borderRadius: 4, height: 8, overflow: 'hidden' },
  fill: { backgroundColor: '#9E4AFF', borderRadius: 4, height: '100%' },
});
