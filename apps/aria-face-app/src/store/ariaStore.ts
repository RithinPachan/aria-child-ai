/**
 * @file ariaStore.ts
 * @description Global state store for ARIA's runtime state.
 * Uses Zustand for lightweight, type-safe state management.
 * This store is the single source of truth for the face animation system.
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type { ARIAEmotionalState } from '@aria/shared-types';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';
export type ListeningState = 'idle' | 'wake_word_active' | 'listening' | 'processing';

export interface ARIAStore {
  // ── Emotional & Visual State ──
  emotionalState: ARIAEmotionalState;
  setEmotionalState: (state: ARIAEmotionalState) => void;

  // ── Connection State ──
  connectionStatus: ConnectionStatus;
  setConnectionStatus: (status: ConnectionStatus) => void;

  // ── Voice / Listening State ──
  listeningState: ListeningState;
  setListeningState: (state: ListeningState) => void;
  audioLevel: number; // 0.0 – 1.0, drives mouth animation
  setAudioLevel: (level: number) => void;

  // ── Session State ──
  sessionId: string | null;
  childName: string | null;
  setSession: (sessionId: string, childName: string) => void;
  clearSession: () => void;

  // ── Derived / Computed ──
  isInteractive: boolean; // true when connected and not processing
}

// ─── Store Implementation ─────────────────────────────────────────────────────

export const useARIAStore = create<ARIAStore>()(
  subscribeWithSelector((set, get) => ({
    emotionalState: 'neutral',
    setEmotionalState: (state) => set({ emotionalState: state }),

    connectionStatus: 'disconnected',
    setConnectionStatus: (status) =>
      set({
        connectionStatus: status,
        emotionalState: status === 'error' ? 'offline' : get().emotionalState,
      }),

    listeningState: 'idle',
    setListeningState: (state) => {
      const emotionalMap: Partial<Record<ListeningState, ARIAEmotionalState>> = {
        listening: 'listening',
        processing: 'thinking',
        idle: 'neutral',
      };
      set({
        listeningState: state,
        emotionalState: emotionalMap[state] ?? get().emotionalState,
      });
    },

    audioLevel: 0,
    setAudioLevel: (level) => set({ audioLevel: Math.max(0, Math.min(1, level)) }),

    sessionId: null,
    childName: null,
    setSession: (sessionId, childName) => set({ sessionId, childName }),
    clearSession: () => set({ sessionId: null, childName: null }),

    get isInteractive() {
      const { connectionStatus, listeningState } = get();
      return connectionStatus === 'connected' && listeningState !== 'processing';
    },
  })),
);
