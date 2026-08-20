/**
 * @file HALRegistry.ts
 * @description Factory registry that selects the correct HAL implementation
 * based on the runtime platform. This is the single point of platform detection
 * in the entire codebase.
 *
 * Usage:
 *   const hal = HALRegistry.getHAL();
 *   await hal.initialize();
 */

import type { IARIAHardware } from '../interfaces/IARIAHardware';
import { MobileHAL } from '../platforms/MobileHAL';

type PlatformId = 'mobile' | 'raspberry-pi-5' | 'jetson-orin';

export class HALRegistry {
  private static _instance: IARIAHardware | null = null;

  /**
   * Get the singleton HAL instance for the current platform.
   * Detects the platform automatically unless overridden.
   */
  static getHAL(platformOverride?: PlatformId): IARIAHardware {
    if (this._instance) {
      return this._instance;
    }

    const platform = platformOverride ?? this._detectPlatform();
    this._instance = this._createHAL(platform);
    return this._instance;
  }

  /**
   * Override the HAL instance (useful for testing with mock implementations).
   */
  static setHAL(hal: IARIAHardware): void {
    this._instance = hal;
  }

  /**
   * Reset the singleton (useful for testing).
   */
  static reset(): void {
    this._instance = null;
  }

  private static _detectPlatform(): PlatformId {
    // Check for React Native environment (mobile)
    const runtimeNavigator =
      typeof navigator !== 'undefined'
        ? (navigator as Navigator & { product?: string })
        : undefined;
    if (runtimeNavigator?.product === 'ReactNative') {
      return 'mobile';
    }

    // Check for Raspberry Pi Linux environment
    if (process.platform === 'linux') {
      try {
        const fs = require('fs');
        const model: string = fs.readFileSync('/proc/device-tree/model', 'utf8');
        if (model.includes('Raspberry Pi')) {
          return 'raspberry-pi-5';
        }
        if (model.includes('NVIDIA Jetson')) {
          return 'jetson-orin';
        }
      } catch {
        // Not a Pi or Jetson
      }
    }

    // Default to mobile
    return 'mobile';
  }

  private static _createHAL(platform: PlatformId): IARIAHardware {
    switch (platform) {
      case 'mobile':
        return new MobileHAL();
      case 'raspberry-pi-5':
        // Dynamically require to avoid bundling native modules in mobile app

        const { RaspberryPiHAL } = require('../platforms/RaspberryPiHAL');
        return new RaspberryPiHAL();
      case 'jetson-orin':
        // Future: return new JetsonOrinHAL();
        throw new Error('Jetson Orin HAL not yet implemented');
      default:
        throw new Error(`Unknown platform: ${platform as string}`);
    }
  }
}
