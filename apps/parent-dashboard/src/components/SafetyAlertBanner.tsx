/**
 * @file SafetyAlertBanner.tsx
 * @description Prominent safety alert banner shown when crisis signals are detected.
 * Provides actionable guidance to parents.
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

interface SafetyAlert {
  id: string;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  timestamp: string;
  sessionId: string;
}

interface SafetyAlertBannerProps {
  alerts: SafetyAlert[];
}

const SEVERITY_STYLES = {
  info: { bg: '#EFF6FF', border: '#BFDBFE', text: '#1E40AF', icon: 'ℹ️' },
  warning: { bg: '#FFFBEB', border: '#FDE68A', text: '#92400E', icon: '⚠️' },
  critical: { bg: '#FEF2F2', border: '#FECACA', text: '#991B1B', icon: '🚨' },
};

export const SafetyAlertBanner: React.FC<SafetyAlertBannerProps> = ({ alerts }) => {
  return (
    <View style={styles.container}>
      {alerts.map((alert) => {
        const style = SEVERITY_STYLES[alert.severity];
        return (
          <View
            key={alert.id}
            style={[styles.alert, { backgroundColor: style.bg, borderColor: style.border }]}
          >
            <Text style={styles.icon}>{style.icon}</Text>
            <View style={styles.content}>
              <Text style={[styles.message, { color: style.text }]}>{alert.message}</Text>
              <Text style={styles.timestamp}>{alert.timestamp}</Text>
            </View>
            <TouchableOpacity style={styles.reviewButton}>
              <Text style={[styles.reviewText, { color: style.text }]}>Review</Text>
            </TouchableOpacity>
          </View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { gap: 8 },
  alert: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    gap: 10,
  },
  icon: { fontSize: 20 },
  content: { flex: 1 },
  message: { fontSize: 14, fontWeight: '600', lineHeight: 20 },
  timestamp: { fontSize: 11, color: '#94A3B8', marginTop: 2 },
  reviewButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: 'rgba(0,0,0,0.06)',
  },
  reviewText: { fontSize: 13, fontWeight: '600' },
});
