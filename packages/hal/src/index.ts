/**
 * @file index.ts
 * @description Hardware Abstraction Layer (HAL) for ARIA.
 *
 * The HAL is the critical bridge that makes the same application code run
 * identically on a mobile phone (app mode) and on a Raspberry Pi robot (hardware mode).
 *
 * Architecture:
 *   - IARIAHardware: The interface contract every platform must implement
 *   - MobileHAL: Implementation using Expo APIs (runs on iOS/Android)
 *   - RaspberryPiHAL: Implementation using native Linux APIs (runs on hardware)
 *   - HALRegistry: Factory that selects the correct implementation at runtime
 *
 * To add a new hardware platform (e.g., Jetson Orin):
 *   1. Create a new class implementing IARIAHardware
 *   2. Register it in HALRegistry with a new platform identifier
 *   3. No changes needed anywhere else in the codebase
 */

export type {
  IARIAHardware,
  AudioConfig,
  LEDColor,
  MotorCommand,
} from './interfaces/IARIAHardware';
export { HALRegistry } from './registry/HALRegistry';
export { MobileHAL } from './platforms/MobileHAL';
