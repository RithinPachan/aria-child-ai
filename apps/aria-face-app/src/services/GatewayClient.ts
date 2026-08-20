/**
 * @file GatewayClient.ts
 * @description WebSocket client for the ARIA Cloud Gateway.
 * Implements exponential backoff reconnection, binary audio framing,
 * and JSON control message handling.
 *
 * Protocol:
 *   - Binary frames: Raw PCM audio chunks (child → gateway)
 *   - Binary frames: Raw PCM audio response (gateway → child)
 *   - Text frames:   JSON control messages (both directions)
 *
 * Control message types:
 *   { type: 'session_start', sessionId: string, childName: string }
 *   { type: 'end_of_turn' }
 *   { type: 'transcript', role: 'child'|'aria', text: string }
 *   { type: 'emotion', state: ARIAEmotionalState }
 *   { type: 'error', code: string, message: string }
 */

import type { ARIAEmotionalState, StreamingSessionConfig } from '@aria/shared-types';

// ─── Types ────────────────────────────────────────────────────────────────────

interface GatewayCallbacks {
  onConnected: () => void;
  onDisconnected: () => void;
  onError: (error: Error) => void;
  onAudioChunk: (chunk: ArrayBuffer) => void;
  onTranscript: (text: string, role: 'child' | 'aria') => void;
  onEmotionDetected: (emotion: ARIAEmotionalState) => void;
}

interface ControlMessage {
  type: string;
  [key: string]: unknown;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_RECONNECT_ATTEMPTS = 5;
const BASE_RECONNECT_DELAY_MS = 1000;
const HEARTBEAT_INTERVAL_MS = 30_000;

// ─── Client ───────────────────────────────────────────────────────────────────

export class GatewayClient {
  private ws: WebSocket | null = null;
  private callbacks: GatewayCallbacks | null = null;
  private reconnectAttempts = 0;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private isIntentionalDisconnect = false;

  constructor(
    private readonly gatewayUrl: string,
    private readonly sessionConfig: StreamingSessionConfig,
  ) {}

  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  // ── Connect ────────────────────────────────────────────────────────────────

  connect(callbacks: GatewayCallbacks): void {
    this.callbacks = callbacks;
    this.isIntentionalDisconnect = false;
    this.establishConnection();
  }

  private establishConnection(): void {
    const url = new URL(this.gatewayUrl);
    url.searchParams.set('token', this.sessionConfig.sessionToken);
    url.searchParams.set('childId', this.sessionConfig.childId);
    url.searchParams.set('deviceId', this.sessionConfig.deviceId);

    this.ws = new WebSocket(url.toString());
    this.ws.binaryType = 'arraybuffer';

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      this.startHeartbeat();
      this.callbacks?.onConnected();
    };

    this.ws.onmessage = (event) => {
      if (event.data instanceof ArrayBuffer) {
        // Binary frame = audio chunk from ARIA
        this.callbacks?.onAudioChunk(event.data);
      } else if (typeof event.data === 'string') {
        this.handleControlMessage(event.data);
      }
    };

    this.ws.onerror = () => {
      this.callbacks?.onError(new Error('WebSocket connection error'));
    };

    this.ws.onclose = () => {
      this.stopHeartbeat();
      this.callbacks?.onDisconnected();
      if (!this.isIntentionalDisconnect) {
        this.scheduleReconnect();
      }
    };
  }

  // ── Control Message Handling ───────────────────────────────────────────────

  private handleControlMessage(raw: string): void {
    let msg: ControlMessage;
    try {
      msg = JSON.parse(raw) as ControlMessage;
    } catch {
      console.warn('Received malformed control message from gateway');
      return;
    }

    switch (msg.type) {
      case 'transcript':
        this.callbacks?.onTranscript(msg['text'] as string, msg['role'] as 'child' | 'aria');
        break;
      case 'emotion':
        this.callbacks?.onEmotionDetected(msg['state'] as ARIAEmotionalState);
        break;
      case 'error':
        this.callbacks?.onError(new Error(msg['message'] as string));
        break;
      default:
        break;
    }
  }

  // ── Send Methods ───────────────────────────────────────────────────────────

  sendAudioChunk(chunk: ArrayBuffer): void {
    if (this.isConnected) {
      this.ws?.send(chunk);
    }
  }

  sendEndOfTurn(): void {
    this.sendControl({ type: 'end_of_turn' });
  }

  private sendControl(message: ControlMessage): void {
    if (this.isConnected) {
      this.ws?.send(JSON.stringify(message));
    }
  }

  // ── Reconnection ───────────────────────────────────────────────────────────

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      this.callbacks?.onError(
        new Error(`Failed to reconnect after ${MAX_RECONNECT_ATTEMPTS} attempts`),
      );
      return;
    }

    const delay = BASE_RECONNECT_DELAY_MS * Math.pow(2, this.reconnectAttempts);
    this.reconnectAttempts++;

    setTimeout(() => {
      this.establishConnection();
    }, delay);
  }

  // ── Heartbeat ──────────────────────────────────────────────────────────────

  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      this.sendControl({ type: 'ping' });
    }, HEARTBEAT_INTERVAL_MS);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer !== null) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  // ── Disconnect ─────────────────────────────────────────────────────────────

  disconnect(): void {
    this.isIntentionalDisconnect = true;
    this.stopHeartbeat();
    this.ws?.close(1000, 'Client disconnected intentionally');
    this.ws = null;
  }
}
