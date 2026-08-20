/**
 * @file useVoiceInteraction.ts
 * @description Core hook managing the full voice interaction lifecycle.
 * Handles WebSocket connection to the GCP Gateway, audio recording,
 * streaming, and playback. Drives the ARIAStore state machine.
 *
 * Architecture note: This hook is the bridge between the HAL (Hardware
 * Abstraction Layer) and the UI. On hardware, the HAL is replaced by
 * native Raspberry Pi audio drivers — the hook interface stays identical.
 */

import { useCallback, useEffect, useRef } from 'react';
import { Audio } from 'expo-av';
import { useARIAStore } from '../store/ariaStore';
import { GatewayClient } from '../services/GatewayClient';
import { AudioProcessor } from '../services/AudioProcessor';
import type { StreamingSessionConfig } from '@aria/shared-types';

// ─── Types ────────────────────────────────────────────────────────────────────

interface UseVoiceInteractionOptions {
  gatewayUrl: string;
  sessionConfig: StreamingSessionConfig;
  onTranscript?: (text: string, role: 'child' | 'aria') => void;
  onError?: (error: Error) => void;
}

interface UseVoiceInteractionReturn {
  startListening: () => Promise<void>;
  stopListening: () => void;
  disconnect: () => void;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useVoiceInteraction({
  gatewayUrl,
  sessionConfig,
  onTranscript,
  onError,
}: UseVoiceInteractionOptions): UseVoiceInteractionReturn {
  const gatewayRef = useRef<GatewayClient | null>(null);
  const audioProcessorRef = useRef<AudioProcessor | null>(null);

  const {
    setConnectionStatus,
    setListeningState,
    setAudioLevel,
    setEmotionalState,
    setSession,
    clearSession,
  } = useARIAStore();

  // ── Initialize Gateway Connection ──────────────────────────────────────────
  useEffect(() => {
    const gateway = new GatewayClient(gatewayUrl, sessionConfig);
    gatewayRef.current = gateway;

    setConnectionStatus('connecting');

    gateway.connect({
      onConnected: () => {
        setConnectionStatus('connected');
        setSession(sessionConfig.childId, ''); // Name loaded from profile
      },
      onDisconnected: () => {
        setConnectionStatus('disconnected');
        setListeningState('idle');
        clearSession();
      },
      onError: (err) => {
        setConnectionStatus('error');
        onError?.(err);
      },
      onAudioChunk: (chunk: ArrayBuffer) => {
        // Stream audio response to speaker
        void audioProcessorRef.current?.playChunk(chunk);
      },
      onTranscript: (text, role) => {
        onTranscript?.(text, role);
        if (role === 'aria') {
          setListeningState('idle');
        }
      },
      onEmotionDetected: (emotion) => {
        setEmotionalState(emotion);
      },
    });

    return () => {
      gateway.disconnect();
    };
  }, [gatewayUrl]);

  // ── Request Microphone Permissions ─────────────────────────────────────────
  useEffect(() => {
    void (async () => {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        onError?.(new Error('Microphone permission denied'));
      }
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
    })();
  }, [onError]);

  // ── Start Listening ────────────────────────────────────────────────────────
  const startListening = useCallback(async (): Promise<void> => {
    if (!gatewayRef.current?.isConnected) {
      return;
    }

    setListeningState('listening');

    const processor = new AudioProcessor({
      sampleRate: sessionConfig.audioConfig.sampleRate,
      onAudioLevel: setAudioLevel,
      onChunk: (chunk) => {
        gatewayRef.current?.sendAudioChunk(chunk);
      },
      onSilenceDetected: () => {
        stopListening();
      },
    });

    audioProcessorRef.current = processor;
    await processor.startRecording();
  }, [sessionConfig.audioConfig.sampleRate, setAudioLevel, setListeningState]);

  // ── Stop Listening ─────────────────────────────────────────────────────────
  const stopListening = useCallback((): void => {
    audioProcessorRef.current?.stopRecording();
    setAudioLevel(0);
    setListeningState('processing');
    gatewayRef.current?.sendEndOfTurn();
  }, [setAudioLevel, setListeningState]);

  // ── Disconnect ─────────────────────────────────────────────────────────────
  const disconnect = useCallback((): void => {
    audioProcessorRef.current?.stopRecording();
    gatewayRef.current?.disconnect();
    clearSession();
  }, [clearSession]);

  return { startListening, stopListening, disconnect };
}
