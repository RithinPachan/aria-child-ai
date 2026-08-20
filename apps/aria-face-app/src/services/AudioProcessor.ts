/**
 * @file AudioProcessor.ts
 * @description Manages microphone recording, audio level analysis (for lip sync),
 * Voice Activity Detection (VAD), and audio playback of ARIA's responses.
 *
 * Hardware portability note: On Raspberry Pi, this class is replaced by
 * the HAL's NativeAudioDriver which interfaces with ALSA/PulseAudio directly.
 * The interface contract (constructor options + public methods) is identical.
 */

import { Audio, type AVPlaybackStatus } from 'expo-av';

// ─── Types ────────────────────────────────────────────────────────────────────

interface AudioProcessorOptions {
  sampleRate: 16000 | 24000;
  onAudioLevel: (level: number) => void;
  onChunk: (chunk: ArrayBuffer) => void;
  onSilenceDetected: () => void;
  silenceThresholdMs?: number; // Default: 1200ms
  silenceThresholdDb?: number; // Default: -40dB
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_SILENCE_THRESHOLD_MS = 1200;
const DEFAULT_SILENCE_DB = -40;
const AUDIO_LEVEL_POLL_MS = 50;

// ─── Class ────────────────────────────────────────────────────────────────────

export class AudioProcessor {
  private recording: Audio.Recording | null = null;
  private playbackSound: Audio.Sound | null = null;
  private levelPollTimer: ReturnType<typeof setInterval> | null = null;
  private silenceTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly options: Required<AudioProcessorOptions>;

  constructor(options: AudioProcessorOptions) {
    this.options = {
      silenceThresholdMs: DEFAULT_SILENCE_THRESHOLD_MS,
      silenceThresholdDb: DEFAULT_SILENCE_DB,
      ...options,
    };
  }

  // ── Recording ──────────────────────────────────────────────────────────────

  async startRecording(): Promise<void> {
    this.recording = new Audio.Recording();

    await this.recording.prepareToRecordAsync({
      android: {
        extension: '.wav',
        outputFormat: Audio.AndroidOutputFormat.DEFAULT,
        audioEncoder: Audio.AndroidAudioEncoder.DEFAULT,
        sampleRate: this.options.sampleRate,
        numberOfChannels: 1,
        bitRate: 128_000,
      },
      ios: {
        extension: '.wav',
        outputFormat: Audio.IOSOutputFormat.LINEARPCM,
        audioQuality: Audio.IOSAudioQuality.HIGH,
        sampleRate: this.options.sampleRate,
        numberOfChannels: 1,
        bitRate: 128_000,
        linearPCMBitDepth: 16,
        linearPCMIsBigEndian: false,
        linearPCMIsFloat: false,
      },
      web: {
        mimeType: 'audio/wav',
        bitsPerSecond: 128_000,
      },
    });

    this.recording.setOnRecordingStatusUpdate(this.handleRecordingStatus.bind(this));
    await this.recording.startAsync();

    // Poll audio levels for lip sync animation
    this.levelPollTimer = setInterval(() => {
      void this.pollAudioLevel();
    }, AUDIO_LEVEL_POLL_MS);
  }

  stopRecording(): void {
    if (this.levelPollTimer !== null) {
      clearInterval(this.levelPollTimer);
      this.levelPollTimer = null;
    }
    if (this.silenceTimer !== null) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }
    void this.recording?.stopAndUnloadAsync();
    this.recording = null;
    this.options.onAudioLevel(0);
  }

  private handleRecordingStatus(status: Audio.RecordingStatus): void {
    if (!status.isRecording) {
      return;
    }

    // Expo provides metering in dB. Convert to 0–1 for the store.
    const db = status.metering ?? this.options.silenceThresholdDb;
    const normalizedLevel = Math.max(0, (db + 60) / 60); // Map -60dB..0dB → 0..1
    this.options.onAudioLevel(normalizedLevel);

    // VAD: detect silence to auto-stop
    if (db < this.options.silenceThresholdDb) {
      if (this.silenceTimer === null) {
        this.silenceTimer = setTimeout(() => {
          this.options.onSilenceDetected();
        }, this.options.silenceThresholdMs);
      }
    } else {
      if (this.silenceTimer !== null) {
        clearTimeout(this.silenceTimer);
        this.silenceTimer = null;
      }
    }
  }

  private async pollAudioLevel(): Promise<void> {
    if (!this.recording) {
      return;
    }
    const status = await this.recording.getStatusAsync();
    if (status.isRecording) {
      const db = status.metering ?? -60;
      const level = Math.max(0, (db + 60) / 60);
      this.options.onAudioLevel(level);
    }
  }

  // ── Playback ───────────────────────────────────────────────────────────────

  async playChunk(chunk: ArrayBuffer): Promise<void> {
    // Convert ArrayBuffer to base64 URI for expo-av
    const base64 = Buffer.from(chunk).toString('base64');
    const uri = `data:audio/wav;base64,${base64}`;

    const { sound } = await Audio.Sound.createAsync({ uri });
    this.playbackSound = sound;

    sound.setOnPlaybackStatusUpdate((status: AVPlaybackStatus) => {
      if (status.isLoaded && status.didJustFinish) {
        void sound.unloadAsync();
      }
    });

    await sound.playAsync();
  }
}
