/**
 * @file MobileHAL.ts
 * @description HAL implementation for iOS and Android using Expo APIs.
 * Hardware-only features (LEDs, motors, proximity sensors) are graceful no-ops.
 */

import type {
  IARIAHardware,
  AudioConfig,
  LEDColor,
  MotorCommand,
  SensorReadings,
} from '../interfaces/IARIAHardware';

export class MobileHAL implements IARIAHardware {
  readonly platformId = 'mobile';

  private _isCapturing = false;
  private _captureInterval: ReturnType<typeof setInterval> | null = null;

  async initialize(): Promise<void> {
    // Expo initializes lazily — no explicit init needed
    console.info('[MobileHAL] Initialized on mobile platform');
  }

  async shutdown(): Promise<void> {
    await this.stopAudioCapture();
    await this.stopWakeWordDetection();
  }

  // ── Audio ──────────────────────────────────────────────────────────────────

  async requestAudioPermission(): Promise<boolean> {
    // Dynamically import to avoid bundling Expo in non-Expo environments
    const { Audio } = await import('expo-av');
    const { status } = await Audio.requestPermissionsAsync();
    return status === 'granted';
  }

  async startAudioCapture(
    config: AudioConfig,
    onChunk: (chunk: ArrayBuffer) => void,
    onAudioLevel: (level: number) => void,
  ): Promise<void> {
    if (this._isCapturing) {
      return;
    }
    this._isCapturing = true;

    const { Audio } = await import('expo-av');
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
    });

    // Audio capture is handled by AudioProcessor in the app layer.
    // The HAL provides the permission and mode setup.
    // The actual chunk streaming is wired through AudioProcessor.
    console.info('[MobileHAL] Audio capture started', config);
  }

  async stopAudioCapture(): Promise<void> {
    this._isCapturing = false;
    if (this._captureInterval) {
      clearInterval(this._captureInterval);
      this._captureInterval = null;
    }
  }

  async playAudio(_buffer: ArrayBuffer, _config: AudioConfig): Promise<void> {
    // Playback handled by AudioProcessor.playChunk() in the app layer
  }

  async setVolume(_level: number): Promise<void> {
    // System volume — not directly controllable on iOS/Android without native modules
  }

  // ── Display / LEDs — No-ops on mobile ─────────────────────────────────────

  async setLEDColor(_color: LEDColor): Promise<void> {
    // No LED ring on mobile — graceful no-op
  }

  async setDisplayBrightness(_level: number): Promise<void> {
    // Could use expo-brightness if needed
  }

  // ── Motion — No-ops on mobile ──────────────────────────────────────────────

  async moveMotors(_command: MotorCommand): Promise<void> {
    // No motors on mobile — graceful no-op
  }

  async stopMotors(): Promise<void> {
    // No motors on mobile — graceful no-op
  }

  // ── Sensors ────────────────────────────────────────────────────────────────

  async readSensors(): Promise<SensorReadings> {
    return {
      proximityDistanceCm: null,
      ambientLightLux: null,
      accelerometerG: null,
      batteryPercent: null,
      isCharging: false,
    };
  }

  // ── Wake Word ──────────────────────────────────────────────────────────────

  async startWakeWordDetection(onDetected: () => void): Promise<void> {
    // On mobile: the tap-to-talk button replaces wake word detection.
    // This is a stub for future integration with Picovoice React Native SDK.
    console.info('[MobileHAL] Wake word detection: using tap-to-talk on mobile');
  }

  async stopWakeWordDetection(): Promise<void> {
    // No-op on mobile
  }
}
