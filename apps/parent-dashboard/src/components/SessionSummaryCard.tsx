/**
 * @file SessionSummaryCard.tsx
 * @description Today's session statistics card for the parent dashboard.
 */

import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';

interface SessionSummaryCardProps {
  totalMinutes: number;
  sessionCount: number;
  topicsExplored: number;
  isLoading: boolean;
}

interface StatItemProps {
  label: string;
  value: string | number;
  unit?: string;
  color: string;
}

const StatItem: React.FC<StatItemProps> = ({ label, value, unit, color }) => (
  <View style={styles.statItem}>
    <Text style={[styles.statValue, { color }]}>{value}</Text>
    {unit && <Text style={styles.statUnit}>{unit}</Text>}
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

export const SessionSummaryCard: React.FC<SessionSummaryCardProps> = ({
  totalMinutes,
  sessionCount,
  topicsExplored,
  isLoading,
}) => {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Today with ARIA</Text>
      {isLoading ? (
        <ActivityIndicator color="#4A9EFF" style={styles.loader} />
      ) : (
        <View style={styles.statsRow}>
          <StatItem label="Minutes" value={totalMinutes} color="#4A9EFF" />
          <View style={styles.divider} />
          <StatItem label="Sessions" value={sessionCount} color="#4AFF9E" />
          <View style={styles.divider} />
          <StatItem label="Topics" value={topicsExplored} color="#9E4AFF" />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A2E',
    marginBottom: 16,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: 32,
    fontWeight: '800',
  },
  statUnit: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: -2,
  },
  statLabel: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 4,
    fontWeight: '500',
  },
  divider: {
    width: 1,
    height: 40,
    backgroundColor: '#E2E8F0',
  },
  loader: {
    marginVertical: 20,
  },
});
