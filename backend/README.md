# FormFit AI Gym - Backend Service

Real-Time Dual-Camera WebSocket & HTTP Relay Server for FormFit.

## Responsibilities
- **Session Management:** Generates 6-character short session codes (e.g. `FF-8924`) for fast pairing.
- **Device Pairing:** Pairs Phone 1 (Primary / Front View) with Phone 2 (Secondary / Back View).
- **Synchronized Countdown:** Broadcasts synchronized start countdown (3, 2, 1, GO!) to both devices.
- **Zero Video Telemetry Relay:** Relays lightweight numerical MediaPipe pose landmark packets (`x, y, z, visibility`) from Phone 2 to Phone 1.
- **Privacy Enforcement:** **Strictly rejects any binary / raw video payloads.** No camera video frames are ever transmitted or stored.
- **Safety & Rate Limits:** 64 KB message size limit, session inactivity expiration (30 mins), and ping/pong keep-alive heartbeats.

## Quick Start

```bash
# Install dependencies
npm install

# Start relay server
npm start
```

Runs by default on port `3001` (`ws://0.0.0.0:3001` and `http://0.0.0.0:3001/health`).
