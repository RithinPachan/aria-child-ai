/**
 * @file ARIAMainScreen.tsx
 * @description The primary screen of the ARIA Face App.
 * Displays the animated face and handles the tap-to-talk interaction.
 * This is the screen that runs full-screen on the robot's display.
 */

import React, { useCallback } from 'react';
import { StyleSheet, TouchableOpacity, View, Text, StatusBar, SafeAreaView } from 'react-native';
import { ARIAFace } from '../components/face/ARIAFace';
import { useVoiceInteraction } from '../hooks/useVoiceInteraction';
import { useARIAStore } from '../store/ariaStore';
import { GATEWAY_URL } from '../constants/config';
import type { StreamingSessionConfig } from '@aria/shared-types';

// ─── Demo session config (replace with real auth flow) ────────────────────────

const DEMO_SESSION_CONFIG: StreamingSessionConfig = {
  childId: 'demo-child-001',
  deviceId: 'demo-device-001',
  sessionToken: 'REPLACE_WITH_JWT',
  audioConfig: {
    sampleRate: 16000,
    channels: 1,
    encoding: 'pcm_s16le',
    chunkSizeMs: 100,
  },
};

// ─── Component ────────────────────────────────────────────────────────────────

export const ARIAMainScreen: React.FC = () => {
  const listeningState = useARIAStore((s) => s.listeningState);
  const connectionStatus = useARIAStore((s) => s.connectionStatus);
  const isInteractive = useARIAStore((s) => s.isInteractive);

  const { startListening, stopListening } = useVoiceInteraction({
    gatewayUrl: GATEWAY_URL,
    sessionConfig: DEMO_SESSION_CONFIG,
    onTranscript: (text, role) => {
      // In production: dispatch to conversation log store
      console.warn(`[${role}]: ${text}`);
    },
    onError: (error) => {
      console.error('Voice interaction error:', error.message);
    },
  });

  const handlePressIn = useCallback((): void => {
    if (isInteractive) {
      void startListening();
    }
  }, [isInteractive, startListening]);

  const handlePressOut = useCallback((): void => {
    if (listeningState === 'listening') {
      stopListening();
    }
  }, [listeningState, stopListening]);

  const getStatusLabel = (): string => {
    switch (connectionStatus) {
      case 'connecting':
        return 'Connecting...';
      case 'error':
        return 'Connection error';
      case 'disconnected':
        return 'Offline';
      default:
        switch (listeningState) {
          case 'listening':
            return 'Listening...';
          case 'processing':
            return 'Thinking...';
          default:
            return 'Tap & hold to talk';
        }
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar hidden />

      {/* Full-screen animated face */}
      <ARIAFace />

      {/* Tap-to-talk button overlay */}
      <View style={styles.controlsOverlay}>
        <Text style={styles.statusLabel}>{getStatusLabel()}</Text>

        <TouchableOpacity
          style={[
            styles.talkButton,
            listeningState === 'listening' && styles.talkButtonActive,
            !isInteractive && styles.talkButtonDisabled,
          ]}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          activeOpacity={0.8}
          disabled={!isInteractive && listeningState !== 'listening'}
          accessibilityLabel="Hold to talk to ARIA"
          accessibilityRole="button"
        >
          <Text style={styles.talkButtonIcon}>{listeningState === 'listening' ? '🔴' : '🎤'}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0D1B2A',
  },
  controlsOverlay: {
    position: 'absolute',
    bottom: 48,
    left: 0,
    right: 0,
    alignItems: 'center',
    gap: 16,
  },
  statusLabel: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    fontWeight: '500',
    letterSpacing: 0.5,
  },
  talkButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(74, 158, 255, 0.25)',
    borderWidth: 2,
    borderColor: 'rgba(74, 158, 255, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  talkButtonActive: {
    backgroundColor: 'rgba(255, 74, 74, 0.30)',
    borderColor: 'rgba(255, 74, 74, 0.8)',
  },
  talkButtonDisabled: {
    opacity: 0.4,
  },
  talkButtonIcon: {
    fontSize: 28,
  },
});
