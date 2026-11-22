import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';

const PORT = parseInt(process.env.PORT || '3001', 10);
const MAX_MESSAGE_SIZE = 64 * 1024; // 64 KB safety limit
const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes session lifetime
const CLEANUP_INTERVAL_MS = 60 * 1000; // 1 minute cleanup interval

// Active workout sessions: Map<sessionId, SessionObject>
const sessions = new Map();

/**
 * Generate a clean, human-readable 6-character alphanumeric session code (e.g. FF-4821)
 */
export function generateSessionCode() {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // Exclude ambiguous chars like 0, 1, I, O
  let code = 'FF-';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Validate session code format
 */
export function isValidSessionCode(code) {
  if (typeof code !== 'string') return false;
  return /^[A-Z0-9-]{4,10}$/i.test(code.trim());
}

/**
 * Clean up expired or dead sessions
 */
export function pruneExpiredSessions() {
  const now = Date.now();
  for (const [sessionId, session] of sessions.entries()) {
    const isExpired = (now - session.lastActivity) > SESSION_TTL_MS;
    const isAbandoned = (!session.primary || session.primary.readyState !== WebSocket.OPEN) &&
                        (!session.secondary || session.secondary.readyState !== WebSocket.OPEN);

    if (isExpired || isAbandoned) {
      try {
        if (session.primary && session.primary.readyState === WebSocket.OPEN) {
          session.primary.close(1000, 'Session expired');
        }
        if (session.secondary && session.secondary.readyState === WebSocket.OPEN) {
          session.secondary.close(1000, 'Session expired');
        }
      } catch (e) {}
      sessions.delete(sessionId);
    }
  }
}

/**
 * Safely send JSON to a WebSocket client
 */
export function safeSend(ws, payload) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    try {
      ws.send(JSON.stringify(payload));
    } catch (e) {
      console.warn('[DualCameraServer] Error sending message:', e.message);
    }
  }
}

/**
 * Create and configure HTTP + WebSocket server
 */
export function createDualCameraServer() {
  const server = http.createServer((req, res) => {
    // Healthcheck endpoint
    if (req.url === '/health' || req.url === '/') {
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      });
      res.end(JSON.stringify({
        status: 'ok',
        service: 'FormFit Dual Camera Relay Service',
        activeSessions: sessions.size,
        timestamp: Date.now()
      }));
      return;
    }

    res.writeHead(404);
    res.end('Not Found');
  });

  const wss = new WebSocketServer({
    server,
    maxPayload: MAX_MESSAGE_SIZE
  });

  wss.on('connection', (ws) => {
    ws.isAlive = true;
    ws.sessionId = null;
    ws.role = null;

    ws.on('pong', () => {
      ws.isAlive = true;
    });

    ws.on('message', (data, isBinary) => {
      if (isBinary) {
        // Enforce privacy rule: reject any raw binary / video streams
        safeSend(ws, { type: 'error', error: 'Binary video streams not accepted. Pose telemetry only.' });
        return;
      }

      if (data.length > MAX_MESSAGE_SIZE) {
        safeSend(ws, { type: 'error', error: 'Payload exceeds maximum allowed size (64KB).' });
        return;
      }

      let msg;
      try {
        msg = JSON.parse(data.toString('utf8'));
      } catch (err) {
        safeSend(ws, { type: 'error', error: 'Malformed JSON payload.' });
        return;
      }

      if (!msg || typeof msg.type !== 'string') {
        safeSend(ws, { type: 'error', error: 'Invalid message structure. "type" field required.' });
        return;
      }

      handleClientMessage(ws, msg);
    });

    ws.on('close', () => {
      handleClientDisconnect(ws);
    });

    ws.on('error', (err) => {
      console.warn('[DualCameraServer] Client socket error:', err.message);
      handleClientDisconnect(ws);
    });
  });

  // Keep-alive heartbeat interval (prunes broken sockets)
  const heartbeatInterval = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (!ws.isAlive) {
        ws.terminate();
        return;
      }
      ws.isAlive = false;
      ws.ping();
    });
    pruneExpiredSessions();
  }, 15000);
  heartbeatInterval.unref();

  wss.on('close', () => {
    clearInterval(heartbeatInterval);
  });

  return { server, wss, sessions };
}

/**
 * Handle message dispatch
 */
function handleClientMessage(ws, msg) {
  switch (msg.type) {
    case 'create_session': {
      let code = (msg.sessionId && isValidSessionCode(msg.sessionId) && !sessions.has(msg.sessionId.toUpperCase()))
        ? msg.sessionId.toUpperCase()
        : generateSessionCode();
      while (sessions.has(code)) {
        code = generateSessionCode();
      }

      const session = {
        id: code,
        exerciseId: msg.exerciseId || 'basic-squats',
        createdAt: Date.now(),
        lastActivity: Date.now(),
        primary: ws,
        secondary: null,
        secondaryMetadata: null
      };

      sessions.set(code, session);
      ws.sessionId = code;
      ws.role = 'primary';

      safeSend(ws, {
        type: 'session_created',
        sessionId: code,
        role: 'primary',
        exerciseId: session.exerciseId
      });
      break;
    }

    case 'join_session': {
      const code = (msg.sessionId || '').trim().toUpperCase();
      if (!isValidSessionCode(code)) {
        safeSend(ws, { type: 'error', error: 'Invalid session code format.' });
        return;
      }

      const session = sessions.get(code);
      if (!session) {
        safeSend(ws, { type: 'error', error: `Workout session "${code}" not found or expired.` });
        return;
      }

      if (session.secondary && session.secondary.readyState === WebSocket.OPEN) {
        safeSend(ws, { type: 'error', error: 'A secondary back camera is already connected to this session.' });
        return;
      }

      session.secondary = ws;
      session.secondaryMetadata = {
        joinedAt: Date.now(),
        videoDimensions: msg.videoDimensions || { w: 1280, h: 720 },
        cameraLabel: msg.cameraLabel || 'Rear Camera'
      };
      session.lastActivity = Date.now();

      ws.sessionId = code;
      ws.role = 'secondary';

      // Acknowledge secondary
      safeSend(ws, {
        type: 'session_joined',
        sessionId: code,
        role: 'secondary',
        exerciseId: session.exerciseId
      });

      // Notify primary device
      safeSend(session.primary, {
        type: 'peer_connected',
        sessionId: code,
        peerRole: 'secondary',
        metadata: session.secondaryMetadata
      });
      break;
    }

    case 'start_countdown': {
      const session = sessions.get(ws.sessionId);
      if (!session || ws.role !== 'primary') {
        safeSend(ws, { type: 'error', error: 'Only the primary device can initiate workout start.' });
        return;
      }

      session.lastActivity = Date.now();
      const durationSeconds = msg.durationSeconds || 3;
      const targetStartTimestamp = Date.now() + (durationSeconds * 1000);

      const broadcastPayload = {
        type: 'countdown_started',
        durationSeconds,
        targetStartTimestamp
      };

      safeSend(session.primary, broadcastPayload);
      if (session.secondary) {
        safeSend(session.secondary, broadcastPayload);
      }
      break;
    }

    case 'pose_telemetry': {
      const session = sessions.get(ws.sessionId);
      if (!session) return;

      session.lastActivity = Date.now();

      // Relay telemetry to the opposite peer (strictly landmarks & kinematics, NO video)
      if (ws.role === 'secondary' && session.primary) {
        safeSend(session.primary, {
          type: 'secondary_pose_telemetry',
          timestampMs: msg.timestampMs || Date.now(),
          videoDimensions: msg.videoDimensions || { w: 1280, h: 720 },
          landmarks: msg.landmarks || null,
          visibility: msg.visibility !== undefined ? msg.visibility : 1
        });
      } else if (ws.role === 'primary' && session.secondary) {
        safeSend(session.secondary, {
          type: 'primary_status_sync',
          repCount: msg.repCount || 0,
          state: msg.state || 'TRACKING'
        });
      }
      break;
    }

    case 'leave_session': {
      handleClientDisconnect(ws);
      break;
    }

    default:
      safeSend(ws, { type: 'error', error: `Unknown message type: "${msg.type}".` });
      break;
  }
}

/**
 * Handle disconnect of a client
 */
function handleClientDisconnect(ws) {
  if (!ws.sessionId) return;
  const session = sessions.get(ws.sessionId);
  if (!session) return;

  if (ws.role === 'primary') {
    // Primary disconnected: notify secondary and remove session
    if (session.secondary && session.secondary.readyState === WebSocket.OPEN) {
      safeSend(session.secondary, {
        type: 'peer_disconnected',
        peerRole: 'primary',
        reason: 'Primary device closed session.'
      });
    }
    sessions.delete(ws.sessionId);
  } else if (ws.role === 'secondary') {
    // Secondary disconnected: notify primary that back camera left
    session.secondary = null;
    session.secondaryMetadata = null;
    if (session.primary && session.primary.readyState === WebSocket.OPEN) {
      safeSend(session.primary, {
        type: 'peer_disconnected',
        peerRole: 'secondary',
        reason: 'Back camera disconnected.'
      });
    }
  }

  ws.sessionId = null;
  ws.role = null;
}

// Standalone execution support
if (process.argv[1] && (process.argv[1].endsWith('server.js') || process.argv[1].endsWith('dualCameraServer.js'))) {
  const { server } = createDualCameraServer();
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[DualCameraServer] Running on http://0.0.0.0:${PORT} and ws://0.0.0.0:${PORT}`);
  });
}
