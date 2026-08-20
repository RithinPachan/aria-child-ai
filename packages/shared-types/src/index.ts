/**
 * @package @aria/shared-types
 * @description Canonical type definitions shared across all ARIA subprojects.
 * Single source of truth for domain models. Any change here propagates to all consumers.
 */

// ─── Domain: Child Profile ────────────────────────────────────────────────────

export interface ChildProfile {
  readonly id: string;
  readonly parentId: string;
  name: string;
  ageYears: number;
  avatarUrl?: string;
  preferredLanguage: SupportedLocale;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProfileFact {
  readonly id: string;
  readonly childId: string;
  category: FactCategory;
  key: string;
  value: string;
  confidence: number; // 0.0 – 1.0
  learnedAt: Date;
}

export type FactCategory = 'preference' | 'interest' | 'achievement' | 'family' | 'learning_style';

// ─── Domain: Interaction Session ─────────────────────────────────────────────

export interface InteractionSession {
  readonly sessionId: string;
  readonly childId: string;
  startedAt: Date;
  endedAt?: Date;
  turnCount: number;
  topicsDiscussed: string[];
  guardrailInterventions: number;
}

export interface ConversationTurn {
  readonly turnId: string;
  readonly sessionId: string;
  role: 'child' | 'aria';
  textContent: string; // Sanitized transcript — never raw PII
  audioLengthMs: number;
  latencyMs?: number;
  timestamp: Date;
}

// ─── Domain: Safety & Guardrails ─────────────────────────────────────────────

export interface GuardrailResult {
  passed: boolean;
  sanitizedText: string;
  interventionType?: InterventionType;
  escalationRequired: boolean;
}

export type InterventionType =
  'pii_redacted' | 'topic_blocked' | 'crisis_detected' | 'persona_violation';

// ─── Domain: Device & Hardware ────────────────────────────────────────────────

export interface DeviceInfo {
  readonly deviceId: string;
  readonly parentId: string;
  firmwareVersion: string;
  platform: DevicePlatform;
  isOnline: boolean;
  lastSeenAt: Date;
  batteryLevel?: number; // 0–100, undefined if not applicable (e.g., plugged-in app)
}

export type DevicePlatform = 'ios' | 'android' | 'raspberry_pi' | 'jetson_nano';

// ─── Domain: Audio & Streaming ────────────────────────────────────────────────

export interface AudioConfig {
  sampleRate: 16000 | 24000;
  channels: 1 | 2;
  encoding: 'pcm_s16le' | 'opus';
  chunkSizeMs: number;
}

export interface StreamingSessionConfig {
  childId: string;
  deviceId: string;
  audioConfig: AudioConfig;
  sessionToken: string; // Short-lived JWT
}

// ─── Domain: Parent & Auth ────────────────────────────────────────────────────

export interface ParentUser {
  readonly uid: string;
  email: string;
  displayName?: string;
  coppaConsentVerified: boolean;
  consentVerifiedAt?: Date;
  children: string[]; // Array of childId
}

// ─── Enums & Constants ────────────────────────────────────────────────────────

export type SupportedLocale = 'en-US' | 'en-GB' | 'es-US' | 'fr-FR' | 'hi-IN';

export type ARIAEmotionalState =
  'neutral' | 'happy' | 'curious' | 'thinking' | 'excited' | 'listening' | 'sleeping' | 'offline';

// ─── API Response Wrappers ────────────────────────────────────────────────────

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiError;
  requestId: string;
}

export interface ApiError {
  code: string;
  message: string;
  statusCode: number;
}
