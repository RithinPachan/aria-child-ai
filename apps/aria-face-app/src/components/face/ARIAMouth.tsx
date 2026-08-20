/**
 * @file ARIAMouth.tsx
 * @description Animated mouth for ARIA robot face.
 * Morphs between emotional expressions and animates in sync with audio level
 * to simulate lip movement during speech.
 */

import React, { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  interpolate,
  Easing,
} from 'react-native-reanimated';
import type { ARIAEmotionalState } from '@aria/shared-types';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ARIAMouthProps {
  emotionalState: ARIAEmotionalState;
  audioLevel: number; // 0.0 – 1.0
  width?: number;
}

// ─── Mouth Shape Configs ──────────────────────────────────────────────────────

interface MouthConfig {
  width: number; // Percentage of container width
  height: number; // Height of the mouth shape
  borderRadius: number;
  curveDirection: 'up' | 'down' | 'flat'; // Smile / frown / neutral
  color: string;
}

const MOUTH_CONFIGS: Record<ARIAEmotionalState, MouthConfig> = {
  neutral: { width: 0.45, height: 8, borderRadius: 4, curveDirection: 'flat', color: '#2A2A3E' },
  happy: { width: 0.6, height: 20, borderRadius: 20, curveDirection: 'up', color: '#1A1A2E' },
  curious: { width: 0.35, height: 12, borderRadius: 8, curveDirection: 'flat', color: '#2A2A3E' },
  thinking: { width: 0.3, height: 8, borderRadius: 4, curveDirection: 'flat', color: '#3A3A4E' },
  excited: { width: 0.65, height: 24, borderRadius: 24, curveDirection: 'up', color: '#1A1A2E' },
  listening: { width: 0.4, height: 10, borderRadius: 5, curveDirection: 'flat', color: '#2A2A3E' },
  sleeping: { width: 0.3, height: 6, borderRadius: 3, curveDirection: 'flat', color: '#4A4A5E' },
  offline: { width: 0.35, height: 6, borderRadius: 3, curveDirection: 'down', color: '#5A5A6E' },
};

// ─── Component ────────────────────────────────────────────────────────────────

export const ARIAMouth: React.FC<ARIAMouthProps> = ({
  emotionalState,
  audioLevel,
  width: containerWidth = 200,
}) => {
  const config = MOUTH_CONFIGS[emotionalState];

  const mouthOpenness = useSharedValue(0);
  const mouthWidth = useSharedValue(config.width * containerWidth);
  const mouthHeight = useSharedValue(config.height);

  // Animate mouth shape on emotional state change
  useEffect(() => {
    mouthWidth.value = withSpring(config.width * containerWidth, {
      damping: 15,
      stiffness: 120,
    });
    mouthHeight.value = withSpring(config.height, {
      damping: 15,
      stiffness: 120,
    });
  }, [emotionalState, config, containerWidth, mouthWidth, mouthHeight]);

  // Animate mouth openness based on audio level (lip sync)
  useEffect(() => {
    mouthOpenness.value = withTiming(audioLevel, {
      duration: 60,
      easing: Easing.linear,
    });
  }, [audioLevel, mouthOpenness]);

  const mouthStyle = useAnimatedStyle(() => {
    const openAmount = interpolate(mouthOpenness.value, [0, 1], [0, 14]);
    const totalHeight = mouthHeight.value + openAmount;

    // Curve direction via border radius manipulation
    const borderTopLeftRadius = config.curveDirection === 'up' ? 0 : config.borderRadius;
    const borderTopRightRadius = config.curveDirection === 'up' ? 0 : config.borderRadius;
    const borderBottomLeftRadius = config.curveDirection === 'down' ? 0 : config.borderRadius;
    const borderBottomRightRadius = config.curveDirection === 'down' ? 0 : config.borderRadius;

    return {
      width: mouthWidth.value,
      height: totalHeight,
      borderTopLeftRadius,
      borderTopRightRadius,
      borderBottomLeftRadius,
      borderBottomRightRadius,
      backgroundColor: config.color,
    };
  });

  return (
    <View style={{ alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={mouthStyle} />
    </View>
  );
};
