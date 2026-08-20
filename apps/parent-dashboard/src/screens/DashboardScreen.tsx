/**
 * @file DashboardScreen.tsx
 * @description Parent Dashboard home screen.
 * Shows today's session summary, emotional state timeline,
 * recent conversation highlights, and safety alerts.
 */

import React from 'react';
import { ScrollView, View, Text, StyleSheet, TouchableOpacity, RefreshControl } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SessionSummaryCard } from '../components/SessionSummaryCard';
import { EmotionTimelineChart } from '../components/EmotionTimelineChart';
import { SafetyAlertBanner } from '../components/SafetyAlertBanner';
import { RecentTopicsCard } from '../components/RecentTopicsCard';
import { LearningProgressCard } from '../components/LearningProgressCard';
import { fetchDashboardData } from '../api/dashboardApi';

// ─── Component ────────────────────────────────────────────────────────────────

export const DashboardScreen: React.FC = () => {
  const { data, isLoading, isRefetching, refetch } = useQuery({
    queryKey: ['dashboard'],
    queryFn: fetchDashboardData,
    refetchInterval: 30_000, // Auto-refresh every 30 seconds
  });

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.greeting}>Good morning! 👋</Text>
          <Text style={styles.subtitle}>
            Here is how {data?.childName ?? 'your child'} is doing with ARIA
          </Text>
        </View>

        {/* Safety Alerts — shown only when present */}
        {data?.alerts && data.alerts.length > 0 && <SafetyAlertBanner alerts={data.alerts} />}

        {/* Today's Session Summary */}
        <SessionSummaryCard
          totalMinutes={data?.todayStats.totalMinutes ?? 0}
          sessionCount={data?.todayStats.sessionCount ?? 0}
          topicsExplored={data?.todayStats.topicsExplored ?? 0}
          isLoading={isLoading}
        />

        {/* Emotional State Timeline */}
        <EmotionTimelineChart dataPoints={data?.emotionTimeline ?? []} isLoading={isLoading} />

        {/* Recent Topics Explored */}
        <RecentTopicsCard topics={data?.recentTopics ?? []} isLoading={isLoading} />

        {/* Learning Progress */}
        <LearningProgressCard milestones={data?.learningMilestones ?? []} isLoading={isLoading} />

        {/* Data Management Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerNote}>
            All conversation data is automatically deleted after 24 hours. Profile facts are
            retained for 90 days.
          </Text>
          <TouchableOpacity style={styles.deleteButton}>
            <Text style={styles.deleteButtonText}>Delete All My Child's Data</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: 20,
    gap: 16,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 8,
  },
  greeting: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1A1A2E',
  },
  subtitle: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 4,
  },
  footer: {
    marginTop: 24,
    padding: 16,
    backgroundColor: '#FFF8F0',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FED7AA',
  },
  footerNote: {
    fontSize: 12,
    color: '#92400E',
    lineHeight: 18,
  },
  deleteButton: {
    marginTop: 12,
    padding: 10,
    backgroundColor: '#FEE2E2',
    borderRadius: 8,
    alignItems: 'center',
  },
  deleteButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#DC2626',
  },
});
