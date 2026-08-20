/**
 * @file config.ts
 * @description Runtime configuration constants.
 * In production, these are injected via environment variables at build time.
 * For local development, set EXPO_PUBLIC_* variables in .env.local
 */

// Gateway WebSocket URL — set EXPO_PUBLIC_GATEWAY_URL in your .env
export const GATEWAY_URL: string =
  process.env['EXPO_PUBLIC_GATEWAY_URL'] ?? 'ws://localhost:8000/ws/audio';

// API base URL for REST endpoints
export const API_BASE_URL: string =
  process.env['EXPO_PUBLIC_API_BASE_URL'] ?? 'http://localhost:8000';

// Feature flags
export const FEATURES = {
  ENABLE_DEMO_MODE: process.env['EXPO_PUBLIC_DEMO_MODE'] === 'true',
  ENABLE_DEBUG_OVERLAY: __DEV__,
} as const;
