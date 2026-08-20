/**
 * @file ARIAFace.tsx
 * @description The complete ARIA robot face component.
 * Composes eyes, mouth, and ambient glow effects into a unified face.
 * Driven entirely by the ARIAStore — no local state.
 * Designed to fill the screen on a phone or a robot's display panel.
 */

import React, { useEffect } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  withSpring,
} from 'react-native-reanimated';
import { ARIAEye } from './ARIAEye';
import { ARIAMouth } from './ARIAMouth';
import { useARIAStore } from '../../store/ariaStore';
import type { ARIAEmotionalState } from '@aria/shared-types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ─── Background Color per State ───────────────────────────────────────────────

const FACE_BG_COLORS: Record<ARIAEmotionalState, string> = {
  neutral: '#0D1B2A',
  happy: '#0A1F0A',
  curious: '#1A0D2A',
  thinking: '#1F1A0A',
  excited: '#2A0D0D',
  listening: '#0A1F1F',
  sleeping: '#0D0D1A',
  offline: '#1A1A1A',
};

const GLOW_COLORS: Record<ARIAEmotionalState, string> = {
  neutral: 'rgba(74, 158, 255, 0.15)',
  happy: 'rgba(74, 255, 158, 0.20)',
  curious: 'rgba(158, 74, 255, 0.18)',
  thinking: 'rgba(255, 208, 74, 0.15)',
  excited: 'rgba(255, 107, 74, 0.22)',
  listening: 'rgba(74, 255, 255, 0.18)',
  sleeping: 'rgba(136, 153, 170, 0.08)',
  offline: 'rgba(100, 100, 110, 0.10)',
};

// ─── Component ────────────────────────────────────────────────────────────────

export const ARIAFace: React.FC = () => {
  const emotionalState = useARIAStore((s) => s.emotionalState);
  const audioLevel = useARIAStore((s) => s.audioLevel);
  const listeningState = useARIAStore((s) => s.listeningState);

  // Ambient glow pulse
  const glowOpacity = useSharedValue(0.5);
  const faceScale = useSharedValue(1);

  // Pulse glow when listening
  useEffect(() => {
    if (listeningState === 'listening') {
      glowOpacity.value = withRepeat(
        withSequence(withTiming(1.0, { duration: 600 }), withTiming(0.4, { duration: 600 })),
        -1,
        true,
      );
    } else if (listeningState === 'processing') {
      glowOpacity.value = withRepeat(
        withSequence(withTiming(0.8, { duration: 300 }), withTiming(0.2, { duration: 300 })),
        -1,
        true,
      );
    } else {
      glowOpacity.value = withTiming(0.5, { duration: 400 });
    }
  }, [listeningState, glowOpacity]);

  // Subtle bounce on excited state
  useEffect(() => {
    if (emotionalState === 'excited') {
      faceScale.value = withRepeat(
        withSequence(withSpring(1.03, { damping: 8 }), withSpring(1.0, { damping: 8 })),
        4,
        true,
      );
    } else {
      faceScale.value = withSpring(1.0, { damping: 12 });
    }
  }, [emotionalState, faceScale]);

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
  }));

  const faceContainerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: faceScale.value }],
  }));

  const bgColor = FACE_BG_COLORS[emotionalState];
  const glowColor = GLOW_COLORS[emotionalState];

  return (
    <View style={[styles.screen, { backgroundColor: bgColor }]}>
      {/* Ambient glow layer */}
      <Animated.View style={[styles.glowCircle, { backgroundColor: glowColor }, glowStyle]} />

      {/* Face container */}
      <Animated.View style={[styles.faceContainer, faceContainerStyle]}>
        {/* Eyes row */}
        <View style={styles.eyesRow}>
          <ARIAEye side="left" emotionalState={emotionalState} size={90} />
          <View style={styles.eyeSpacing} />
          <ARIAEye side="right" emotionalState={emotionalState} size={90} />
        </View>

        {/* Nose dot (subtle) */}
        <View style={styles.noseDot} />

        {/* Mouth */}
        <View style={styles.mouthContainer}>
          <ARIAMouth
            emotionalState={emotionalState}
            audioLevel={audioLevel}
            width={SCREEN_WIDTH * 0.55}
          />
        </View>
      </Animated.View>
    </View>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glowCircle: {
    position: 'absolute',
    width: SCREEN_WIDTH * 0.9,
    height: SCREEN_WIDTH * 0.9,
    borderRadius: SCREEN_WIDTH * 0.45,
    alignSelf: 'center',
  },
  faceContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
  },
  eyesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyeSpacing: {
    width: SCREEN_WIDTH * 0.12,
  },
  noseDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(255,255,255,0.15)',
    marginTop: -8,
  },
  mouthContainer: {
    marginTop: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 40,
  },
});
