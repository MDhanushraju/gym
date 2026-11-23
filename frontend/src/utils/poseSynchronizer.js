/**
 * src/utils/poseSynchronizer.js
 * Synchronizes dual-camera timestamped pose landmark frames across devices,
 * performs posterior alignment evaluation, and enforces primary rep-count authority.
 */

import { analyzeBackView } from './angleCalculator.js';

export class PoseSynchronizer {
  constructor(options = {}) {
    this.maxSyncWindowMs = options.maxSyncWindowMs || 200; // Match within 200ms
    this.bufferCapacity = options.bufferCapacity || 30; // Store last ~1s of frames
    this.secondaryBuffer = [];
    this.lastMatchedTelemetry = null;
    this.lastMatchDeltaMs = 0;
  }

  /**
   * Add incoming secondary pose telemetry frame to sliding buffer
   */
  pushSecondaryFrame(frame) {
    if (!frame || !frame.timestampMs) return;

    this.secondaryBuffer.push({
      timestampMs: frame.timestampMs,
      landmarks: frame.landmarks,
      visibility: frame.visibility,
      videoDimensions: frame.videoDimensions || { w: 1280, h: 720 },
      receivedAt: Date.now()
    });

    // Prune buffer to capacity
    if (this.secondaryBuffer.length > this.bufferCapacity) {
      this.secondaryBuffer.shift();
    }
  }

  /**
   * Find closest secondary frame to primary timestamp and compute posterior alignment
   */
  matchAndAnalyze(primaryTimestampMs) {
    if (this.secondaryBuffer.length === 0) {
      return null;
    }

    const targetTime = primaryTimestampMs || Date.now();
    let closestFrame = null;
    let minDelta = Infinity;

    for (let i = this.secondaryBuffer.length - 1; i >= 0; i--) {
      const frame = this.secondaryBuffer[i];
      const delta = Math.abs(frame.timestampMs - targetTime);

      if (delta < minDelta) {
        minDelta = delta;
        closestFrame = frame;
      }

      // Buffer is chronologically ordered, so if delta starts increasing significantly, we can break
      if (delta > minDelta && delta > this.maxSyncWindowMs) {
        break;
      }
    }

    this.lastMatchDeltaMs = minDelta;

    // Check if closest frame is within allowable synchronization tolerance
    if (!closestFrame || minDelta > this.maxSyncWindowMs) {
      // In live streaming workouts with two mobile devices across a network relay,
      // clocks between devices may have a minor offset (>200ms) even though telemetry is live.
      // If we are evaluating in real time (within 10s of Date.now()) and received telemetry recently (<1500ms),
      // match the freshest received back-view frame to absorb inter-device clock drift smoothly.
      const latestFrame = this.secondaryBuffer[this.secondaryBuffer.length - 1];
      const isLiveSession = Math.abs(targetTime - Date.now()) < 10000;
      const receiveAgeMs = latestFrame?.receivedAt ? Math.abs(Date.now() - latestFrame.receivedAt) : Infinity;

      if (isLiveSession && latestFrame && receiveAgeMs <= 1500 && latestFrame.landmarks) {
        const posteriorAnalysis = analyzeBackView(latestFrame.landmarks);
        this.lastMatchDeltaMs = receiveAgeMs;
        this.lastMatchedTelemetry = {
          matched: true,
          deltaMs: receiveAgeMs,
          timestampMs: latestFrame.timestampMs,
          landmarks: latestFrame.landmarks,
          visibility: latestFrame.visibility,
          videoDimensions: latestFrame.videoDimensions,
          posteriorAnalysis
        };
        return this.lastMatchedTelemetry;
      }

      return {
        matched: false,
        deltaMs: minDelta,
        posteriorAnalysis: null,
        message: 'Awaiting synchronized back-view frame...'
      };
    }

    // Run posterior biomechanical analysis on matched back-view landmarks
    const posteriorAnalysis = analyzeBackView(closestFrame.landmarks);

    this.lastMatchedTelemetry = {
      matched: true,
      deltaMs: minDelta,
      timestampMs: closestFrame.timestampMs,
      landmarks: closestFrame.landmarks,
      visibility: closestFrame.visibility,
      videoDimensions: closestFrame.videoDimensions,
      posteriorAnalysis
    };

    return this.lastMatchedTelemetry;
  }

  /**
   * Clear buffer on workout stop or device disconnect
   */
  reset() {
    this.secondaryBuffer = [];
    this.lastMatchedTelemetry = null;
    this.lastMatchDeltaMs = 0;
  }
}

export const poseSynchronizer = new PoseSynchronizer();
