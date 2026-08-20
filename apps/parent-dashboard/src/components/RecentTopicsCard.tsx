import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import type { TopicSummary } from '../api/dashboardApi';

interface RecentTopicsCardProps {
  topics: TopicSummary[];
  isLoading: boolean;
}

export const RecentTopicsCard: React.FC<RecentTopicsCardProps> = ({ topics, isLoading }) => (
  <View style={styles.card}>
    <Text style={styles.title}>Recent interests</Text>
    {isLoading ? (
      <ActivityIndicator color="#4AFF9E" />
    ) : topics.length === 0 ? (
      <Text style={styles.empty}>Topics ARIA explores with your child will appear here.</Text>
    ) : (
      topics.map((topic) => (
        <View key={topic.id} style={styles.row}>
          <View style={styles.dot} />
          <View style={styles.copy}>
            <Text style={styles.topic}>{topic.title}</Text>
            <Text style={styles.meta}>
              {topic.category} · {topic.exploredAt}
            </Text>
          </View>
        </View>
      ))
    )}
  </View>
);

const styles = StyleSheet.create({
  card: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 20, gap: 12 },
  title: { color: '#1A1A2E', fontSize: 16, fontWeight: '700' },
  empty: { color: '#64748B', fontSize: 13, lineHeight: 19 },
  row: { alignItems: 'center', flexDirection: 'row', gap: 10 },
  dot: { backgroundColor: '#4AFF9E', borderRadius: 4, height: 8, width: 8 },
  copy: { flex: 1 },
  topic: { color: '#1A1A2E', fontSize: 14, fontWeight: '600' },
  meta: { color: '#64748B', fontSize: 12, marginTop: 2 },
});
