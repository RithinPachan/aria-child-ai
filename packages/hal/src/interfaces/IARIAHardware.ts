/**
 * @file IARIAHardware.ts
 * @description The core hardware interface contract for ARIA.
 * Every platform (mobile, Raspberry Pi, Jetson) must implement this interface.
 * The application layer only ever depends on this interface — never on a concrete implementation.
 */

// ─── Supporting Types ─────────────────────────────────────────────────────────

export interface AudioConfig {
  sampleRate: 16000 | 24000;
  channels: 1 | 2;
  encoding: 'pcm_s16le' | 'pcm_f32le';
  chunkSizeMs: number;
}

export interface LEDColor {
  r: number; // 0–255
  g: number; // 0–255
  b: number; // 0–255
  brightness?: number; // 0.0–1.0, default 1.0
}

export interface MotorCommand {
  leftSpeed: number; // -1.0 (full reverse) to 1.0 (full forward)
  rightSpeed: number; // -1.0 (full reverse) to 1.0 (full forward)
  durationMs?: number; // If set, stop after this duration
}

export interface SensorReadings {
  proximityDistanceCm: number | null;
  ambientLightLux: number | null;
  accelerometerG: { x: number; y: number; z: number } | null;
  batteryPercent: number | null;
  isCharging: boolean;
}

// ─── Main Interface ───────────────────────────────────────────────────────────

export interface IARIAHardware {
  /**
   * Platform identifier. Used for logging and diagnostics.
   * Examples: 'mobile-ios', 'mobile-android', 'raspberry-pi-5', 'jetson-orin'
   */
  readonly platformId: string;

  /**
   * Initialize all hardware subsystems.
   * Must be called once before any other method.
   */
  initialize(): Promise<void>;

  /**
   * Release all hardware resources.
   * Must be called on application shutdown.
   */
  shutdown(): Promise<void>;

  // ── Audio ──────────────────────────────────────────────────────────────────

  /** Request microphone permission (required on mobile platforms). */
  requestAudioPermission(): Promise<boolean>;

  /** Start streaming microphone audio. Calls onChunk for each audio frame. */
  startAudioCapture(
    config: AudioConfig,
    onChunk: (chunk: ArrayBuffer) => void,
    onAudioLevel: (level: number) => void,
  ): Promise<void>;

  /** Stop microphone capture. */
  stopAudioCapture(): Promise<void>;

  /** Play a raw PCM audio buffer through the speaker. */
  playAudio(buffer: ArrayBuffer, config: AudioConfig): Promise<void>;

  /** Set speaker volume. 0.0 = mute, 1.0 = max. */
  setVolume(level: number): Promise<void>;

  // ── Display / LEDs ─────────────────────────────────────────────────────────

  /**
   * Set the ambient LED ring color (hardware only; no-op on mobile).
   * Used to indicate emotional state via ambient lighting.
   */
  setLEDColor(color: LEDColor): Promise<void>;

  /** Set display brightness. 0.0 = off, 1.0 = max. */
  setDisplayBrightness(level: number): Promise<void>;

  // ── Motion (hardware only; no-op on mobile) ────────────────────────────────

  /** Execute a motor command to move the robot. */
  moveMotors(command: MotorCommand): Promise<void>;

  /** Stop all motors immediately. */
  stopMotors(): Promise<void>;

  // ── Sensors ────────────────────────────────────────────────────────────────

  /** Read all available sensor values. Returns null for unavailable sensors. */
  readSensors(): Promise<SensorReadings>;

  // ── Wake Word ──────────────────────────────────────────────────────────────

  /**
   * Start listening for the wake word ("Hey ARIA").
   * On mobile: uses a software VAD approach.
   * On hardware: uses a dedicated wake word chip (e.g., Picovoice Porcupine).
   */
  startWakeWordDetection(onDetected: () => void): Promise<void>;

  /** Stop wake word detection. */
  stopWakeWordDetection(): Promise<void>;
}
