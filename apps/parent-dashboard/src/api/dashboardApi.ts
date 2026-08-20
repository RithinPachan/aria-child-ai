/**
 * Parent Dashboard API client.
 * All responses are limited to parent-authorized summaries; raw child audio and
 * unredacted transcripts are intentionally never returned to this application.
 */

export type AlertSeverity = 'info' | 'warning' | 'critical';

export interface SafetyAlert {
  id: string;
  severity: AlertSeverity;
  message: string;
  timestamp: string;
  sessionId: string;
}

export interface EmotionDataPoint {
  label: string;
  value: number;
}

export interface TopicSummary {
  id: string;
  title: string;
  category: string;
  exploredAt: string;
}

export interface LearningMilestone {
  id: string;
  title: string;
  status: 'started' | 'progressing' | 'completed';
  progress: number;
}

export interface DashboardData {
  childName: string;
  alerts: SafetyAlert[];
  todayStats: {
    totalMinutes: number;
    sessionCount: number;
    topicsExplored: number;
  };
  emotionTimeline: EmotionDataPoint[];
  recentTopics: TopicSummary[];
  learningMilestones: LearningMilestone[];
}

const API_BASE_URL = (
  globalThis as unknown as { process?: { env?: Record<string, string | undefined> } }
).process?.env?.EXPO_PUBLIC_PARENT_API_BASE_URL;

const developmentDashboard: DashboardData = {
  childName: 'your child',
  alerts: [],
  todayStats: { totalMinutes: 0, sessionCount: 0, topicsExplored: 0 },
  emotionTimeline: [],
  recentTopics: [],
  learningMilestones: [],
};

export async function fetchDashboardData(): Promise<DashboardData> {
  if (!API_BASE_URL) {
    // Local-only placeholder. This keeps the UI usable before the parent API is deployed.
    return developmentDashboard;
  }

  const response = await fetch(`${API_BASE_URL}/api/v1/dashboard`, {
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`Dashboard request failed with HTTP ${response.status}`);
  }

  return (await response.json()) as DashboardData;
}
