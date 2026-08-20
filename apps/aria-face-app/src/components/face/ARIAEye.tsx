/**
 * @file ARIAEye.tsx
 * @description A single animated eye for the ARIA robot face.
 * Supports blinking, pupil tracking, and emotional shape morphing.
 * Built with react-native-svg and react-native-reanimated for 60fps performance.
 */

import React, { useEffect } from 'react';
import Svg, { Ellipse } from 'react-native-svg';
import Animated, {
  useAnimatedProps,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';
import type { ARIAEmotionalState } from '@aria/shared-types';

const AnimatedEllipse = Animated.createAnimatedComponent(Ellipse);

// ─── Types ────────────────────────────────────────────────────────────────────

interface ARIAEyeProps {
  side: 'left' | 'right';
  emotionalState: ARIAEmotionalState;
  size?: number;
}

// ─── Eye Shape Configs per Emotional State ────────────────────────────────────

interface EyeShape {
  rx: number;
  ry: number;
  pupilRx: number;
  pupilRy: number;
  offsetY: number; // Vertical offset of pupil within eye
}

const EYE_SHAPES: Record<ARIAEmotionalState, EyeShape> = {
  neutral: { rx: 28, ry: 32, pupilRx: 14, pupilRy: 16, offsetY: 0 },
  happy: { rx: 30, ry: 22, pupilRx: 14, pupilRy: 12, offsetY: 4 },
  curious: { rx: 26, ry: 34, pupilRx: 16, pupilRy: 18, offsetY: -2 },
  thinking: { rx: 28, ry: 28, pupilRx: 12, pupilRy: 14, offsetY: -4 },
  excited: { rx: 32, ry: 34, pupilRx: 16, pupilRy: 18, offsetY: 0 },
  listening: { rx: 28, ry: 32, pupilRx: 16, pupilRy: 16, offsetY: 0 },
  sleeping: { rx: 30, ry: 8, pupilRx: 0, pupilRy: 0, offsetY: 0 },
  offline: { rx: 28, ry: 28, pupilRx: 10, pupilRy: 10, offsetY: 0 },
};

const EYE_COLORS: Record<ARIAEmotionalState, { iris: string; pupil: string; sclera: string }> = {
  neutral: { iris: '#4A9EFF', pupil: '#1A1A2E', sclera: '#FFFFFF' },
  happy: { iris: '#4AFF9E', pupil: '#1A2E1A', sclera: '#FFFFFF' },
  curious: { iris: '#9E4AFF', pupil: '#1A1A2E', sclera: '#FFFFFF' },
  thinking: { iris: '#FFD04A', pupil: '#2E2A1A', sclera: '#F5F5F5' },
  excited: { iris: '#FF6B4A', pupil: '#2E1A1A', sclera: '#FFFFFF' },
  listening: { iris: '#4AFFFF', pupil: '#1A2E2E', sclera: '#FFFFFF' },
  sleeping: { iris: '#8899AA', pupil: '#334455', sclera: '#E8EEF4' },
  offline: { iris: '#666677', pupil: '#222233', sclera: '#DDDDEE' },
};

// ─── Component ────────────────────────────────────────────────────────────────

export const ARIAEye: React.FC<ARIAEyeProps> = ({ side, emotionalState, size = 80 }) => {
  const shape = EYE_SHAPES[emotionalState];
  const colors = EYE_COLORS[emotionalState];

  // Blink animation: scaleY collapses the eye to simulate blinking
  const blinkScale = useSharedValue(1);
  const pupilScale = useSharedValue(1);

  // Trigger blink animation on a natural interval
  useEffect(() => {
    const blinkDelay = side === 'left' ? 0 : 80; // Slight offset for natural look
    const triggerBlink = (): void => {
      blinkScale.value = withDelay(
        blinkDelay,
        withSequence(
          withTiming(0.05, { duration: 80, easing: Easing.out(Easing.quad) }),
          withTiming(1, { duration: 120, easing: Easing.in(Easing.quad) }),
        ),
      );
    };

    // Initial blink after random delay, then repeat every 3–5 seconds
    const interval = setInterval(triggerBlink, 3500 + Math.random() * 1500);
    return () => clearInterval(interval);
  }, [blinkScale, side]);

  // Pupil dilation on excited/curious states
  useEffect(() => {
    if (emotionalState === 'excited' || emotionalState === 'curious') {
      pupilScale.value = withRepeat(
        withSequence(withTiming(1.2, { duration: 600 }), withTiming(1.0, { duration: 600 })),
        -1,
        true,
      );
    } else {
      pupilScale.value = withTiming(1.0, { duration: 300 });
    }
  }, [emotionalState, pupilScale]);

  const animatedEyeProps = useAnimatedProps(() => ({
    ry: shape.ry * blinkScale.value,
  }));

  const cx = size / 2;
  const cy = size / 2;

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {/* Sclera (white of eye) */}
      <AnimatedEllipse
        cx={cx}
        cy={cy}
        rx={shape.rx}
        fill={colors.sclera}
        animatedProps={animatedEyeProps}
      />
      {/* Iris */}
      <AnimatedEllipse
        cx={cx}
        cy={cy + shape.offsetY}
        rx={shape.pupilRx * 1.4}
        fill={colors.iris}
        animatedProps={useAnimatedProps(() => ({
          ry: shape.pupilRy * 1.4 * blinkScale.value * pupilScale.value,
        }))}
      />
      {/* Pupil */}
      <AnimatedEllipse
        cx={cx}
        cy={cy + shape.offsetY}
        rx={shape.pupilRx}
        fill={colors.pupil}
        animatedProps={useAnimatedProps(() => ({
          ry: shape.pupilRy * blinkScale.value * pupilScale.value,
        }))}
      />
      {/* Specular highlight (light reflection) */}
      <Ellipse
        cx={cx + shape.pupilRx * 0.4}
        cy={cy + shape.offsetY - shape.pupilRy * 0.4}
        rx={shape.pupilRx * 0.25}
        ry={shape.pupilRy * 0.25}
        fill="rgba(255,255,255,0.7)"
      />
    </Svg>
  );
};
