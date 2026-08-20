/**
 * @file RaspberryPiHAL.ts
 * @description HAL implementation for Raspberry Pi 5 running Linux.
 * Uses ALSA for audio, RPi.GPIO for LEDs and sensors, and pigpio for motors.
 *
 * IMPORTANT: This module uses Node.js native bindings that only work on Linux ARM.
 * It is NOT imported in the mobile app bundle — only in the firmware entry point.
 *
 * Hardware wiring assumptions:
 *   - Microphone: ReSpeaker 4-Mic Array (USB, appears as ALSA device hw:1,0)
 *   - Speaker: 3W mono speaker on GPIO PWM or USB audio adapter
 *   - LED Ring: WS2812B 12-LED ring on GPIO 18 (PWM)
 *   - Motors: L298N H-bridge on GPIO 17/18/27/22 (differential drive)
 *   - Proximity: HC-SR04 ultrasonic on GPIO 23 (trigger) / 24 (echo)
 *   - Wake Word: Picovoice Porcupine via @picovoice/porcupine-node
 */

import type {
  IARIAHardware,
  AudioConfig,
  LEDColor,
  MotorCommand,
  SensorReadings,
} from '../interfaces/IARIAHardware';

export class RaspberryPiHAL implements IARIAHardware {
  readonly platformId = 'raspberry-pi-5';

  // Native module references (loaded dynamically to prevent import errors on non-Pi platforms)
  private _alsa: unknown = null;
  private _gpio: unknown = null;
  private _porcupine: unknown = null;

  async initialize(): Promise<void> {
    // Dynamically require native modules — these only exist on the Pi
    try {
      this._alsa = require('alsa-binding');
      this._gpio = require('rpi-gpio');
      console.info('[RaspberryPiHAL] Hardware initialized');
    } catch (err) {
      throw new Error(
        `[RaspberryPiHAL] Failed to load native modules. ` +
          `Are you running on a Raspberry Pi with required packages installed? Error: ${err}`,
      );
    }
  }

  async shutdown(): Promise<void> {
    await this.stopMotors();
    await this.stopAudioCapture();
    await this.stopWakeWordDetection();
    // Release GPIO
    const gpio = this._gpio as { destroy: () => void } | null;
    gpio?.destroy();
    console.info('[RaspberryPiHAL] Hardware shutdown complete');
  }

  // ── Audio ──────────────────────────────────────────────────────────────────

  async requestAudioPermission(): Promise<boolean> {
    // Linux does not require runtime audio permissions
    return true;
  }

  async startAudioCapture(
    config: AudioConfig,
    onChunk: (chunk: ArrayBuffer) => void,
    onAudioLevel: (level: number) => void,
  ): Promise<void> {
    /**
     * Implementation note:
     * Use the alsa-binding npm package to open hw:1,0 (ReSpeaker USB mic array).
     * Configure: sampleRate=config.sampleRate, channels=1, format=S16_LE
     * Read chunks of config.chunkSizeMs * config.sampleRate / 1000 * 2 bytes
     * Call onChunk() for each read frame.
     * Compute RMS amplitude for onAudioLevel().
     *
     * Full implementation requires the alsa-binding package:
     *   npm install alsa-binding
     */
    console.info('[RaspberryPiHAL] Audio capture started (ALSA)', config);
    // TODO: Implement ALSA capture loop
  }

  async stopAudioCapture(): Promise<void> {
    // TODO: Stop ALSA capture loop
  }

  async playAudio(buffer: ArrayBuffer, config: AudioConfig): Promise<void> {
    /**
     * Implementation note:
     * Write PCM buffer to ALSA playback device (hw:0,0 or USB audio adapter).
     * Use aplay subprocess or alsa-binding for direct playback.
     */
    console.info('[RaspberryPiHAL] Playing audio buffer', buffer.byteLength, 'bytes');
    // TODO: Implement ALSA playback
  }

  async setVolume(level: number): Promise<void> {
    // Use amixer to set Master volume: `amixer set Master ${Math.round(level * 100)}%`
    const { exec } = require('child_process');
    exec(`amixer set Master ${Math.round(level * 100)}%`);
  }

  // ── Display / LEDs ─────────────────────────────────────────────────────────

  async setLEDColor(color: LEDColor): Promise<void> {
    /**
     * Implementation note:
     * Use the rpi-ws281x-native package to control WS2812B LED ring on GPIO 18.
     *   npm install rpi-ws281x-native
     * Set all 12 LEDs to the specified RGB color with brightness scaling.
     */
    const brightness = color.brightness ?? 1.0;
    const r = Math.round(color.r * brightness);
    const g = Math.round(color.g * brightness);
    const b = Math.round(color.b * brightness);
    console.info(`[RaspberryPiHAL] LED color: rgb(${r},${g},${b})`);
    // TODO: Implement WS2812B control
  }

  async setDisplayBrightness(level: number): Promise<void> {
    // Write to /sys/class/backlight/rpi_backlight/brightness
    const value = Math.round(level * 255);
    const { writeFile } = require('fs/promises');
    await writeFile('/sys/class/backlight/rpi_backlight/brightness', String(value));
  }

  // ── Motion ─────────────────────────────────────────────────────────────────

  async moveMotors(command: MotorCommand): Promise<void> {
    /**
     * Implementation note:
     * L298N H-bridge wiring:
     *   Left motor:  IN1=GPIO17, IN2=GPIO18, ENA=GPIO12 (PWM)
     *   Right motor: IN3=GPIO27, IN4=GPIO22, ENB=GPIO13 (PWM)
     * Use pigpio for hardware PWM control.
     *   npm install pigpio
     */
    console.info('[RaspberryPiHAL] Motor command:', command);
    // TODO: Implement L298N motor control via pigpio
  }

  async stopMotors(): Promise<void> {
    // Set all motor pins LOW
    console.info('[RaspberryPiHAL] Motors stopped');
    // TODO: Implement motor stop
  }

  // ── Sensors ────────────────────────────────────────────────────────────────

  async readSensors(): Promise<SensorReadings> {
    /**
     * Implementation note:
     * HC-SR04 proximity: Trigger GPIO23 for 10μs, measure echo pulse width on GPIO24.
     * Distance = (pulse_width_μs * 0.0343) / 2 cm
     */
    return {
      proximityDistanceCm: null, // TODO: Implement HC-SR04 reading
      ambientLightLux: null, // TODO: Implement BH1750 I2C reading
      accelerometerG: null, // TODO: Implement MPU6050 I2C reading
      batteryPercent: null, // TODO: Implement INA219 I2C reading
      isCharging: false,
    };
  }

  // ── Wake Word ──────────────────────────────────────────────────────────────

  async startWakeWordDetection(onDetected: () => void): Promise<void> {
    /**
     * Implementation note:
     * Use @picovoice/porcupine-node for offline wake word detection.
     *   npm install @picovoice/porcupine-node
     * Keyword: "Hey ARIA" (custom keyword file from Picovoice Console)
     * Runs in a separate thread to avoid blocking the main event loop.
     */
    console.info('[RaspberryPiHAL] Wake word detection started (Porcupine)');
    // TODO: Implement Porcupine wake word detection
  }

  async stopWakeWordDetection(): Promise<void> {
    // TODO: Stop Porcupine engine
  }
}
