/**
 * src/utils/dualCameraClient.js
 * Client-side WebSocket manager for real-time dual-camera pairing and pose relay.
 */

export class DualCameraClient {
  constructor() {
    this.ws = null;
    this.url = this.getWebSocketUrl();
    this.sessionId = null;
    this.role = null; // 'primary' | 'secondary'
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.listeners = new Map();
    this.shouldReconnect = true;
    this.pendingTelemetryThrottle = 0;
    this.outboxQueue = [];
  }

  setWebSocketUrl(newUrl) {
    if (!newUrl) return;
    this.url = newUrl.trim();
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem('formfit_backend_ws_url', this.url);
    }
    if (this.ws) {
      try { this.ws.close(); } catch (e) {}
      this.ws = null;
    }
    this.isConnected = false;
    this.emit('connection_changed', { isConnected: false });
    this.connect().catch(() => {});
  }

  /**
   * Determine WebSocket URL from environment variable, query param, or window location
   */
  getWebSocketUrl() {
    // 1. URL Query parameter (e.g. ?join=CODE&ws=wss://...)
    if (typeof window !== 'undefined' && window.location && window.location.search) {
      try {
        const params = new URLSearchParams(window.location.search);
        const wsParam = params.get('ws');
        if (wsParam) {
          if (window.localStorage) {
            window.localStorage.setItem('formfit_backend_ws_url', wsParam);
          }
          return wsParam;
        }
      } catch (e) {}
    }

    // 2. LocalStorage override
    if (typeof window !== 'undefined' && window.localStorage) {
      const stored = window.localStorage.getItem('formfit_backend_ws_url');
      if (stored && stored.trim()) return stored.trim();
    }

    // 3. Explicit Vite env var
    if (import.meta.env && import.meta.env.VITE_DUAL_CAMERA_WS_URL) {
      return import.meta.env.VITE_DUAL_CAMERA_WS_URL;
    }
    if (import.meta.env && import.meta.env.VITE_WS_URL) {
      return import.meta.env.VITE_WS_URL;
    }

    // 4. Derive from browser location
    if (typeof window !== 'undefined' && window.location) {
      const hostname = window.location.hostname || 'localhost';
      // GitHub Pages does not run WebSockets on port 3001
      if (hostname.endsWith('github.io')) {
        return 'wss://gym-backend-5oxw.onrender.com';
      }
      const isHttps = window.location.protocol === 'https:';
      const wsProtocol = isHttps ? 'wss:' : 'ws:';
      return `${wsProtocol}//${hostname}:3001`;
    }

    return 'ws://localhost:3001';
  }

  /**
   * Connect to WebSocket server
   */
  connect() {
    return new Promise((resolve, reject) => {
      this.shouldReconnect = true;
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        return resolve(this.ws);
      }

      const onOpened = () => {
        resolve(this.ws);
      };

      if (this.ws && this.ws.readyState === WebSocket.CONNECTING) {
        this.ws.addEventListener('open', onOpened, { once: true });
        return;
      }

      try {
        this.ws = new WebSocket(this.url);
      } catch (err) {
        this.emit('error', { message: `WebSocket connection failed: ${err.message}` });
        return reject(err);
      }

      this.ws.onopen = () => {
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.emit('connection_changed', { isConnected: true });

        // Flush queued non-telemetry control messages (e.g. create_session, join_session)
        while (this.outboxQueue.length > 0) {
          const item = this.outboxQueue.shift();
          try {
            this.ws.send(JSON.stringify(item));
          } catch (e) {
            console.warn('[DualCameraClient] Flush error:', e);
          }
        }

        resolve(this.ws);
      };

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          this.handleIncomingMessage(msg);
        } catch (e) {
          console.warn('[DualCameraClient] Parse error on message:', e);
        }
      };

      this.ws.onclose = (event) => {
        this.isConnected = false;
        this.emit('connection_changed', { isConnected: false, code: event.code, reason: event.reason });
        if (this.shouldReconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
          const delay = Math.min(1000 * Math.pow(1.5, this.reconnectAttempts), 8000);
          this.reconnectAttempts++;
          setTimeout(() => {
            if (this.shouldReconnect) {
              this.connect().catch(() => {});
            }
          }, delay);
        }
      };

      this.ws.onerror = (err) => {
        this.emit('error', { message: 'WebSocket communication error occurred.' });
      };
    });
  }

  /**
   * Disconnect and clear state
   */
  disconnect() {
    this.shouldReconnect = false;
    if (this.ws) {
      try {
        if (this.ws.readyState === WebSocket.OPEN) {
          this.send({ type: 'leave_session' });
        }
        this.ws.close();
      } catch (e) {}
      this.ws = null;
    }
    this.isConnected = false;
    this.sessionId = null;
    this.role = null;
  }

  /**
   * Subscribe to client events
   */
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);
    return () => this.off(event, callback);
  }

  off(event, callback) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).delete(callback);
    }
  }

  emit(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(cb => {
        try {
          cb(data);
        } catch (err) {
          console.error(`[DualCameraClient] Listener error on event "${event}":`, err);
        }
      });
    }
  }

  /**
   * Dispatch incoming server message
   */
  handleIncomingMessage(msg) {
    switch (msg.type) {
      case 'session_created':
        this.sessionId = msg.sessionId;
        this.role = 'primary';
        this.emit('session_created', msg);
        break;

      case 'session_joined':
        this.sessionId = msg.sessionId;
        this.role = 'secondary';
        this.emit('session_joined', msg);
        break;

      case 'peer_connected':
        this.emit('peer_connected', msg);
        break;

      case 'peer_disconnected':
        this.emit('peer_disconnected', msg);
        break;

      case 'countdown_started':
        this.emit('countdown_started', msg);
        break;

      case 'secondary_pose_telemetry':
        this.emit('secondary_pose_telemetry', msg);
        break;

      case 'primary_status_sync':
        this.emit('primary_status_sync', msg);
        break;

      case 'error':
        this.emit('error', msg);
        break;

      default:
        this.emit('message', msg);
        break;
    }
  }

  /**
   * Safe send JSON helper
   */
  send(payload) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(payload));
        return true;
      } catch (err) {
        console.warn('[DualCameraClient] Send failed:', err);
        return false;
      }
    }
    // Queue non-telemetry control messages (e.g. create_session, join_session)
    if (payload && payload.type !== 'secondary_pose_telemetry') {
      this.outboxQueue.push(payload);
    }
    return false;
  }

  /**
   * Primary action: Create new session
   */
  async createSession(exerciseId = 'basic-squats', preferredSessionId = null) {
    if (preferredSessionId) {
      this.sessionId = preferredSessionId;
    }
    await this.connect().catch(() => {});
    this.send({
      type: 'create_session',
      exerciseId,
      sessionId: preferredSessionId
    });
  }

  /**
   * Secondary action: Join existing session
   */
  async joinSession(sessionId, metadata = {}) {
    await this.connect();
    this.send({
      type: 'join_session',
      sessionId: (sessionId || '').trim().toUpperCase(),
      videoDimensions: metadata.videoDimensions || { w: 1280, h: 720 },
      cameraLabel: metadata.cameraLabel || 'Rear Camera'
    });
  }

  /**
   * Primary action: Trigger synchronized countdown
   */
  startCountdown(durationSeconds = 3) {
    if (this.role !== 'primary') return;
    this.send({
      type: 'start_countdown',
      durationSeconds
    });
  }

  /**
   * Secondary action: Transmit local MediaPipe pose landmarks (throttled ~30fps, zero video)
   */
  sendPoseTelemetry(landmarks, visibility, videoDimensions) {
    if (this.role !== 'secondary' || !this.isConnected) return;

    const now = Date.now();
    // Throttle to at most once every 30ms (~33 fps)
    if (now - this.pendingTelemetryThrottle < 30) return;
    this.pendingTelemetryThrottle = now;

    // Send minimal compact landmark array
    const compactLandmarks = landmarks ? landmarks.map(lm => ({
      x: Math.round(lm.x * 1000) / 1000,
      y: Math.round(lm.y * 1000) / 1000,
      z: lm.z !== undefined ? Math.round(lm.z * 1000) / 1000 : 0,
      visibility: lm.visibility !== undefined ? Math.round(lm.visibility * 100) / 100 : 1
    })) : null;

    this.send({
      type: 'pose_telemetry',
      timestampMs: now,
      videoDimensions,
      landmarks: compactLandmarks,
      visibility
    });
  }
}

export const dualCameraClient = new DualCameraClient();
