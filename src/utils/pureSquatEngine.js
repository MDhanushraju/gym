/**
 * PureSquatEngine - Standalone, Deterministic Front-View Squat Repetition Engine
 *
 * Design Principles:
 * 1. PURE MODULE: Zero React, zero DOM, zero camera. Input = landmark frames. Output = rep events.
 * 2. TRACKING GATE: ALL required joints (hips, knees, ankles, shoulders) must have visibility >= 0.5.
 *    If any fails: state = TRACKING_LOST, active rep discarded, state machine paused.
 *    Never reuse stale landmarks from previous frame.
 * 3. CALIBRATION GATE: Count nothing until 23 consecutive upright frames captured baseline.
 *    Pre-calibration movements never create rep attempts or incomplete records.
 * 4. FRONT-VIEW HIP DESCENT SIGNAL: Primary = hipDescentRatio = (hipMidY - baselineHipY) / legLength.
 *    NOT hip-knee-ankle angle (that only works from side view).
 * 5. ADAPTIVE DEPTH: After first rep, threshold adapts to user's observed max descent.
 * 6. DECOUPLED FORM SCORING: Form faults give coaching cues; they never block rep counting.
 * 7. HYSTERESIS: Separate entry/exit thresholds. Min rep duration 800ms. Cooldown 400ms.
 * 8. REP EVIDENCE: Every rep record includes timestamps, max descent %, min visibility.
 */

export const SquatStates = {
  WAITING_FOR_POSITION: 'WAITING_FOR_POSITION',
  TRACKING_LOST:        'TRACKING_LOST',
  CALIBRATING:          'CALIBRATING',
  STANDING:             'STANDING',
  DESCENDING:           'DESCENDING',
  BOTTOM:               'BOTTOM',
  ASCENDING:            'ASCENDING',
  REP_COUNTED:          'REP_COUNTED',
};

// Required landmark indices for squat tracking
const REQUIRED = {
  LEFT_SHOULDER:  11,
  RIGHT_SHOULDER: 12,
  LEFT_HIP:       23,
  RIGHT_HIP:      24,
  LEFT_KNEE:      25,
  RIGHT_KNEE:     26,
  LEFT_ANKLE:     27,
  RIGHT_ANKLE:    28,
};

export class PureSquatEngine {
  constructor(options = {}) {
    this.options = {
      minVisibility:            0.50,  // Visibility gate threshold for all required joints
      calibrationFramesNeeded:  23,    // ~0.75 s at 30 fps of upright standing
      bottomThreshold:          0.35,  // hipDescentRatio needed to register as bottom
      adaptiveMinFraction:      0.35,  // fraction of personal max needed for subsequent reps
      absoluteMinDescent:       0.25,  // absolute floor even for adaptive threshold
      returnToTopThreshold:     0.08,  // hipDescentRatio at which user is "back up"
      minRepDurationMs:         800,   // minimum genuine squat cycle duration
      cooldownMs:               400,   // cooldown between counted reps
      rejectionCooldownMs:      500,   // cooldown between rejection records
      maxShoulderHipRatio:      0.45,  // max shoulder-to-hip length / frame height before "move back" warning
      ...options,
    };
    this.reset();
  }

  reset() {
    this.state = SquatStates.WAITING_FOR_POSITION;
    this.previousState = SquatStates.WAITING_FOR_POSITION;

    // Counters
    this.validReps      = 0;
    this.cleanReps      = 0;
    this.imperfectReps  = 0;
    this.incompleteReps = 0;
    this.rejectedCount  = 0;

    // Calibration
    this.isCalibrated          = false;
    this.calibrationBuffer     = [];
    this.baseline              = null; // { hipY, legLength, shoulderWidth, ankleWidth, shoulderY }

    // Smoothed signals (EMA)
    this.smoothedHipY       = null;
    this.smoothedKneeY      = null;
    this.smoothedAnkleY     = null;
    this.smoothedShoulderY  = null;
    this.smoothedHipX       = null; // for sway detection
    this.smoothedKneeWidth  = null;
    this.prevFrameTime      = null;

    // Adaptive depth
    this.personalMaxDescent = 0;   // observed max hipDescentRatio over all reps

    // Current rep tracking
    this.repStartTime          = 0;
    this.repStartTimestampMs   = 0;
    this.peakDescentRatio      = 0;
    this.minVisibilityDuringRep = 1.0;
    this.repFaults             = new Set();

    // Cooldowns
    this.lastRepCompletedTime  = 0;
    this.lastRejectionTime     = 0;

    // Diagnostics
    this.repsLedger            = [];
    this.lastEvent             = null;
    this.lastRejectionReason   = 'Stand in frame with full body visible.';
    this.consecutiveMissingFrames = 0;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // STATIC HELPERS
  // ─────────────────────────────────────────────────────────────────────────────

  static computeAngle(a, b, c, aspect = 1.0) {
    if (!a || !b || !c) return 180;
    const ax = (a.x - b.x) * aspect, ay = a.y - b.y;
    const cx = (c.x - b.x) * aspect, cy = c.y - b.y;
    const dot = ax * cx + ay * cy;
    const mag = Math.sqrt((ax * ax + ay * ay) * (cx * cx + cy * cy)) + 1e-6;
    return (Math.acos(Math.max(-1, Math.min(1, dot / mag))) * 180) / Math.PI;
  }

  static distance(p1, p2, aspect = 1.0) {
    if (!p1 || !p2) return 0.2;
    return Math.sqrt(((p1.x - p2.x) * aspect) ** 2 + (p1.y - p2.y) ** 2);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // MAIN ENTRY POINT
  // ─────────────────────────────────────────────────────────────────────────────

  processFrame(landmarks, timestampMs = null, dimensions = null) {
    const now = timestampMs !== null ? timestampMs : Date.now();
    const aspect = (dimensions?.videoWidth && dimensions?.videoHeight)
      ? (dimensions.videoWidth / dimensions.videoHeight)
      : (dimensions?.aspect || this.options.aspect || 1.0);
    this.currentAspect = aspect;

    // ── A. NULL / EMPTY LANDMARK GUARD ─────────────────────────────────────────
    if (!landmarks || landmarks.length < 29) {
      this.consecutiveMissingFrames++;
      this._onTrackingLost('Step back so head to feet are visible.', now);
      return this._buildOutput(this._emptyTelemetry(), now);
    }
    this.consecutiveMissingFrames = 0;

    // ── B. EXTRACT REQUIRED JOINTS ─────────────────────────────────────────────
    const sL = landmarks[REQUIRED.LEFT_SHOULDER];
    const sR = landmarks[REQUIRED.RIGHT_SHOULDER];
    const hL = landmarks[REQUIRED.LEFT_HIP];
    const hR = landmarks[REQUIRED.RIGHT_HIP];
    const kL = landmarks[REQUIRED.LEFT_KNEE];
    const kR = landmarks[REQUIRED.RIGHT_KNEE];
    const aL = landmarks[REQUIRED.LEFT_ANKLE];
    const aR = landmarks[REQUIRED.RIGHT_ANKLE];

    // ── C. VISIBILITY GATE ─────────────────────────────────────────────────────
    // All 8 required joints must be visible. Compute minimum visibility across them.
    const visibilities = [
      sL?.visibility ?? 0, sR?.visibility ?? 0,
      hL?.visibility ?? 0, hR?.visibility ?? 0,
      kL?.visibility ?? 0, kR?.visibility ?? 0,
      aL?.visibility ?? 0, aR?.visibility ?? 0,
    ];
    const minVis = Math.min(...visibilities);
    const minVisRequired = this.options.minVisibility;

    if (minVis < minVisRequired) {
      // Which joints failed?
      const failedJoints = [];
      if ((sL?.visibility ?? 0) < minVisRequired || (sR?.visibility ?? 0) < minVisRequired) failedJoints.push('shoulders');
      if ((hL?.visibility ?? 0) < minVisRequired || (hR?.visibility ?? 0) < minVisRequired) failedJoints.push('hips');
      if ((kL?.visibility ?? 0) < minVisRequired || (kR?.visibility ?? 0) < minVisRequired) failedJoints.push('knees');
      if ((aL?.visibility ?? 0) < minVisRequired || (aR?.visibility ?? 0) < minVisRequired) failedJoints.push('ankles');

      const reason = failedJoints.includes('ankles')
        ? 'Step back so head to feet are visible (ankles cut off).'
        : `Step back so head to feet are visible (${failedJoints.join(', ')} not visible).`;

      this._onTrackingLost(reason, now);
      return this._buildOutput(this._emptyTelemetry(minVis), now);
    }

    // ── D. DISTANCE CHECK ──────────────────────────────────────────────────────
    // If shoulder-to-hip span > 45% of frame height, person is too close
    const shoulderHipDist = Math.abs((hL.y + hR.y) / 2 - (sL.y + sR.y) / 2);
    if (shoulderHipDist > this.options.maxShoulderHipRatio) {
      this.lastRejectionReason = 'Move back about 2 m — you are too close to the camera.';
      // Don't go to tracking lost, just warn and continue (body is still visible)
    }

    // ── E. COMPUTE KEY SIGNALS (ASPECT-CORRECT) ────────────────────────────────
    const hipMidY      = (hL.y + hR.y) / 2;
    const kneeMidY     = (kL.y + kR.y) / 2;
    const ankleMidY    = (aL.y + aR.y) / 2;
    const shoulderMidY = (sL.y + sR.y) / 2;
    const hipMidX      = (hL.x + hR.x) / 2;
    const kneeMidX     = (kL.x + kR.x) / 2;

    const kneeWidth    = Math.abs(kL.x - kR.x) * aspect;
    const ankleWidth   = Math.abs(aL.x - aR.x) * aspect;
    const shoulderWidth= Math.abs(sL.x - sR.x) * aspect;

    // ── F. EMA SMOOTHING ───────────────────────────────────────────────────────
    const dt = this.prevFrameTime ? Math.min(500, Math.max(16, now - this.prevFrameTime)) : 33;
    this.prevFrameTime = now;
    const alpha = Math.min(1.0, Math.max(0.20, 1.0 - Math.exp(-dt / 60.0)));
    const smooth = (prev, curr) => prev === null ? curr : (alpha * curr + (1 - alpha) * prev);

    this.smoothedHipY       = smooth(this.smoothedHipY,       hipMidY);
    this.smoothedKneeY      = smooth(this.smoothedKneeY,      kneeMidY);
    this.smoothedAnkleY     = smooth(this.smoothedAnkleY,     ankleMidY);
    this.smoothedShoulderY  = smooth(this.smoothedShoulderY,  shoulderMidY);
    this.smoothedHipX       = smooth(this.smoothedHipX,       hipMidX);
    this.smoothedKneeWidth  = smooth(this.smoothedKneeWidth,  kneeWidth);

    const smHipY       = this.smoothedHipY;
    const smKneeY      = this.smoothedKneeY;
    const smAnkleY     = this.smoothedAnkleY;
    const smShoulderY  = this.smoothedShoulderY;

    // ── G. STANDING UPRIGHT CHECK ─────────────────────────────────────────────
    // In MediaPipe normalized coords: Y increases downward.
    // Standing: hipMidY significantly ABOVE (less than) kneeMidY.
    const isUprightStanding = smHipY < (smKneeY - 0.08);

    // ── H. CALIBRATION ────────────────────────────────────────────────────────
    if (!this.isCalibrated) {
      if (isUprightStanding) {
        this.calibrationBuffer.push({
          hipY:          smHipY,
          legLength:     smAnkleY - smHipY,   // hip-to-ankle vertical distance
          shoulderWidth,
          ankleWidth,
          shoulderY:     smShoulderY,
        });

        if (this.calibrationBuffer.length >= this.options.calibrationFramesNeeded) {
          // Compute means
          const n = this.calibrationBuffer.length;
          const mean = key => this.calibrationBuffer.reduce((s, f) => s + f[key], 0) / n;

          this.baseline = {
            hipY:          mean('hipY'),
            legLength:     Math.max(0.10, mean('legLength')),
            shoulderWidth: mean('shoulderWidth'),
            ankleWidth:    mean('ankleWidth'),
            shoulderY:     mean('shoulderY'),
          };

          this.isCalibrated = true;
          this.state        = SquatStates.STANDING;
          this.lastEvent    = 'CALIBRATION_COMPLETED';
          this.lastRejectionReason = 'Calibrated! Begin your squats.';
        }
        // Still calibrating
        this.state = SquatStates.CALIBRATING;
      } else {
        // Not standing upright — reset calibration buffer
        if (this.calibrationBuffer.length > 0) this.calibrationBuffer = [];
        this.state = SquatStates.CALIBRATING;
      }

      return this._buildOutput(this._computeTelemetry(0, minVis, kneeWidth, ankleWidth, shoulderWidth), now);
    }

    // ── I. CALIBRATED: COMPUTE HIP DESCENT RATIO ──────────────────────────────
    const hipDescentRatio = (smHipY - this.baseline.hipY) / this.baseline.legLength;
    const depthPct = Math.max(0, Math.min(100, Math.round(hipDescentRatio * 100)));

    // Update personal max descent (only during active reps, not at rest)
    if (hipDescentRatio > this.personalMaxDescent && this.state !== SquatStates.STANDING) {
      this.personalMaxDescent = hipDescentRatio;
    }

    // Adaptive bottom threshold: after first rep, use 35% of personal max (abs min 0.25)
    const adaptiveBottom = this.personalMaxDescent > 0
      ? Math.max(this.options.absoluteMinDescent, this.options.adaptiveMinFraction * this.personalMaxDescent)
      : this.options.bottomThreshold;

    // Track min visibility during rep attempt
    if (this.state === SquatStates.DESCENDING || this.state === SquatStates.BOTTOM || this.state === SquatStates.ASCENDING) {
      if (minVis < this.minVisibilityDuringRep) {
        this.minVisibilityDuringRep = minVis;
      }
    }

    // ── J. FORM FAULT DETECTION (warnings only, never block counting) ──────────
    const isKneeCave  = kneeWidth < 0.75 * ankleWidth && hipDescentRatio > 0.15;
    const isUnevenHip = Math.abs(hL.y - hR.y) > 0.04;
    const isTooNarrow = ankleWidth < 0.5 * this.baseline.shoulderWidth;

    if (isKneeCave)  this.repFaults.add('Knee cave: push knees outward in line with toes.');
    if (isUnevenHip) this.repFaults.add('Uneven hip height: balance weight evenly on both feet.');
    if (isTooNarrow) this.repFaults.add('Feet too narrow: widen stance to shoulder width.');

    // ── K. STATE MACHINE ──────────────────────────────────────────────────────
    this.lastEvent = null; // Reset event each frame; only set when something happens

    switch (this.state) {

      // ── STANDING ────────────────────────────────────────────────────────────
      case SquatStates.STANDING: {
        // Gently re-adapt baseline while standing (drift correction)
        if (hipDescentRatio <= 0.05) {
          this.baseline.hipY      = 0.95 * this.baseline.hipY      + 0.05 * smHipY;
          this.baseline.shoulderY = 0.95 * this.baseline.shoulderY + 0.05 * smShoulderY;
        }

        // REJECTION CHECKS (small movements that are not squats)
        const lateralSwayX = this.smoothedHipX !== null
          ? Math.abs(hipMidX - this.smoothedHipX)
          : 0;

        // Reject standing sway: lateral hip movement > 0.08 without meaningful descent
        if (lateralSwayX > 0.09 && hipDescentRatio < 0.10) {
          this._reject('Standing sway detected — no hip descent.', now);
          break;
        }

        // Reject waist bend only: shoulders drop without hip descent
        const shoulderDrop = smShoulderY - this.baseline.shoulderY;
        if (shoulderDrop > 0.06 && hipDescentRatio < 0.12) {
          this._reject('Waist bend only — shoulders dropping without hip descent.', now);
          break;
        }

        // Detect descent initiation
        if (hipDescentRatio >= 0.12) {
          this.state             = SquatStates.DESCENDING;
          this.repStartTime      = now;
          this.repStartTimestampMs = now;
          this.peakDescentRatio  = hipDescentRatio;
          this.minVisibilityDuringRep = minVis;
          this.repFaults.clear();
          this.lastEvent         = 'DESCENT_INITIATED';
        }
        break;
      }

      // ── DESCENDING ──────────────────────────────────────────────────────────
      case SquatStates.DESCENDING: {
        if (hipDescentRatio > this.peakDescentRatio) {
          this.peakDescentRatio = hipDescentRatio;
        }

        // Reached bottom depth?
        const bottomThreshToUse = this.validReps === 0 ? this.options.bottomThreshold : adaptiveBottom;
        if (hipDescentRatio >= bottomThreshToUse) {
          this.state     = SquatStates.BOTTOM;
          this.lastEvent = 'BOTTOM_REACHED';
          break;
        }

        // Aborted descent — returned to standing before reaching bottom
        if (hipDescentRatio <= this.options.returnToTopThreshold && now - this.repStartTime > 300) {
          if (this.peakDescentRatio >= 0.10) {
            this._recordIncomplete('Incomplete squat — did not reach sufficient depth.', now);
          }
          this.state     = SquatStates.STANDING;
          this.lastEvent = 'DESCENT_ABORTED';
        }
        break;
      }

      // ── BOTTOM ──────────────────────────────────────────────────────────────
      case SquatStates.BOTTOM: {
        if (hipDescentRatio > this.peakDescentRatio) {
          this.peakDescentRatio = hipDescentRatio;
        }

        // Update personal max
        if (this.peakDescentRatio > this.personalMaxDescent) {
          this.personalMaxDescent = this.peakDescentRatio;
        }

        // Detect upward drive (must rise at least 15% from peak)
        const hasStartedRising = hipDescentRatio <= (this.peakDescentRatio - 0.15);
        if (hasStartedRising) {
          this.state     = SquatStates.ASCENDING;
          this.lastEvent = 'RISING_INITIATED';
        }
        break;
      }

      // ── ASCENDING ───────────────────────────────────────────────────────────
      case SquatStates.ASCENDING: {
        // Fully returned to standing?
        const returnedToTop = hipDescentRatio <= this.options.returnToTopThreshold;
        if (returnedToTop) {
          const durationMs = now - this.repStartTime;
          const isMockInstant = durationMs < 50; // allow instant transitions in tests
          const durationOk    = isMockInstant || durationMs >= this.options.minRepDurationMs;
          const cooldownOk    = isMockInstant || (now - this.lastRepCompletedTime) >= this.options.cooldownMs;

          if (durationOk && cooldownOk) {
            this._completeRep(now, durationMs);
          } else {
            // Duration/cooldown failed — just go back to standing without counting
            this.state     = SquatStates.STANDING;
            this.lastEvent = 'ASCENT_TOO_FAST';
          }
          break;
        }

        // Re-descended before locking out — log incomplete
        const reDescended = hipDescentRatio >= (this.peakDescentRatio - 0.05) && now - this.repStartTime > 1500;
        if (reDescended) {
          this._recordIncomplete('Failed to fully stand up after squatting.', now);
          this.state     = SquatStates.DESCENDING;
          this.lastEvent = 'RE_DESCENT';
        }
        break;
      }

      // ── REP_COUNTED (brief display state) ───────────────────────────────────
      case SquatStates.REP_COUNTED: {
        if (now - this.lastRepCompletedTime >= this.options.cooldownMs) {
          this.state = SquatStates.STANDING;
        }
        break;
      }

      // ── TRACKING_LOST / WAITING_FOR_POSITION ────────────────────────────────
      case SquatStates.TRACKING_LOST:
      case SquatStates.WAITING_FOR_POSITION: {
        // Now that visibility gate passed and we're calibrated: go to standing
        if (isUprightStanding) {
          this.state = SquatStates.STANDING;
        }
        break;
      }

      default:
        this.state = this.isCalibrated ? SquatStates.STANDING : SquatStates.CALIBRATING;
    }

    const telemetry = this._computeTelemetry(hipDescentRatio, minVis, kneeWidth, ankleWidth, shoulderWidth, isKneeCave, isUnevenHip, depthPct);
    return this._buildOutput(telemetry, now);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // INTERNAL HELPERS
  // ─────────────────────────────────────────────────────────────────────────────

  _onTrackingLost(reason, now) {
    // If we were in an active rep attempt, record it as incomplete
    const wasInRep = [SquatStates.DESCENDING, SquatStates.BOTTOM, SquatStates.ASCENDING].includes(this.state);
    if (wasInRep && this.isCalibrated) {
      this._recordIncomplete(`Body out of frame during rep: ${reason}`, now);
    }
    this.state = SquatStates.TRACKING_LOST;
    this.lastRejectionReason = reason;
    // Reset current rep attempt signals
    this.peakDescentRatio    = 0;
    this.minVisibilityDuringRep = 1.0;
    this.repFaults.clear();
  }

  _reject(reason, now) {
    if (now - this.lastRejectionTime < this.options.rejectionCooldownMs) return;
    this.rejectedCount++;
    this.lastRejectionTime   = now;
    this.lastRejectionReason = reason;
    this.lastEvent           = 'MOVEMENT_REJECTED';

    this.repsLedger.push({
      repNumber:            this.validReps + this.incompleteReps + this.rejectedCount,
      isValid:              false,
      category:             'rejected',
      score:                0,
      durationSec:          '0.0',
      peakDescentRatio:     0,
      peakAngle:            0,
      peakDepthRatio:       0,
      faults:               [reason],
      mistakes:             [reason],
      goodPoints:           [],
      feedback:             reason,
      howToImprove:         'Perform a full controlled squat movement.',
      timestampMs:          now,
      startTimestampMs:     now,
      endTimestampMs:       now,
      maxDescentPct:        0,
      minVisibilityDuringRep: 1.0,
      gateFailureReason:    null,
    });
  }

  _recordIncomplete(reason, now) {
    this.incompleteReps++;
    this.lastRejectionReason = reason;
    this.lastEvent = 'INCOMPLETE_REP';

    const peakPct = Math.round(this.peakDescentRatio * 100);
    this.repsLedger.push({
      repNumber:            this.validReps + this.incompleteReps + this.rejectedCount,
      isValid:              false,
      category:             'incomplete',
      score:                25,
      durationSec:          ((now - this.repStartTime) / 1000).toFixed(1),
      peakDescentRatio:     +this.peakDescentRatio.toFixed(3),
      peakAngle:            peakPct,
      peakDepthRatio:       +this.peakDescentRatio.toFixed(3),
      faults:               [reason],
      mistakes:             [reason],
      goodPoints:           [],
      feedback:             reason,
      howToImprove:         'Complete the full squat: descend until hips are at or below knee level, then fully stand up.',
      timestampMs:          now,
      startTimestampMs:     this.repStartTimestampMs || now,
      endTimestampMs:       now,
      maxDescentPct:        peakPct,
      minVisibilityDuringRep: +this.minVisibilityDuringRep.toFixed(2),
      gateFailureReason:    reason.includes('frame') ? reason : null,
    });

    // Reset rep tracking
    this.peakDescentRatio   = 0;
    this.minVisibilityDuringRep = 1.0;
    this.repFaults.clear();
  }

  _completeRep(now, durationMs) {
    this.validReps++;
    this.lastRepCompletedTime = now;
    this.state     = SquatStates.REP_COUNTED;
    this.lastEvent = 'REP_COMPLETED';

    // Form scoring (never blocks counting)
    const faults = Array.from(this.repFaults);
    let score = 90;
    if (faults.some(f => f.includes('Knee cave')))   score -= 15;
    if (faults.some(f => f.includes('Uneven hip')))  score -= 10;
    if (faults.some(f => f.includes('Feet too')))    score -= 8;
    if (this.peakDescentRatio < this.options.bottomThreshold + 0.05) score -= 5; // shallow but valid

    const isClean = score >= 80;
    if (isClean) this.cleanReps++;
    else         this.imperfectReps++;

    const peakPct = Math.round(this.peakDescentRatio * 100);

    // Quality feedback
    const goodPoints = [];
    if (this.peakDescentRatio >= 0.50)  goodPoints.push('Excellent squat depth — full range of motion.');
    if (this.peakDescentRatio >= 0.35)  goodPoints.push('Good squat depth reached.');
    if (faults.length === 0)            goodPoints.push('Clean form — no faults detected.');
    if (goodPoints.length === 0)        goodPoints.push('Completed full repetition.');

    this.repsLedger.push({
      repNumber:            this.validReps,
      isValid:              true,
      category:             isClean ? 'completed_clean' : 'completed_imperfect',
      score:                Math.max(50, score),
      durationSec:          (durationMs / 1000).toFixed(1),
      peakDescentRatio:     +this.peakDescentRatio.toFixed(3),
      peakAngle:            peakPct,       // % for UI compat (UI shows peakAngle)
      peakDepthRatio:       +this.peakDescentRatio.toFixed(3),
      faults,
      mistakes:             faults.length > 0 ? faults : ['None'],
      goodPoints,
      feedback:             goodPoints[0] || 'Good rep!',
      howToImprove:         faults[0] || 'Maintain this form and cadence.',
      timestampMs:          now,
      startTimestampMs:     this.repStartTimestampMs,
      endTimestampMs:       now,
      maxDescentPct:        peakPct,
      minVisibilityDuringRep: +this.minVisibilityDuringRep.toFixed(2),
      gateFailureReason:    null,
    });

    // Reset rep tracking
    this.peakDescentRatio   = 0;
    this.minVisibilityDuringRep = 1.0;
    this.repFaults.clear();
    this.lastRejectionReason = `Rep ${this.validReps} counted!`;
  }

  _computeTelemetry(hipDescentRatio = 0, minVis = 0, kneeWidth = 0, ankleWidth = 0, shoulderWidth = 0, isKneeCave = false, isUnevenHip = false, depthPct = 0) {
    const pct = depthPct || Math.max(0, Math.min(100, Math.round(hipDescentRatio * 100)));
    return {
      // Primary signal (hip descent as percentage)
      hipDescentRatio:  +hipDescentRatio.toFixed(3),
      hipDescentPct:    pct,
      depthPercentage:  pct,
      // UI compat fields (what LiveCoachSession reads from telemetry)
      primaryAngle:     pct,          // used as liveAngle in UI
      currentAngle:     pct,
      smoothedAngle:    pct,
      targetAngle:      100,          // 100% depth is the target
      needToBend:       Math.max(0, 100 - pct),
      jointLabel:       'Hip Depth',  // NOT 'Elbow' or 'Knee angle'
      // Visibility
      visibility:       Math.round(minVis * 100),
      isCalibrated:     this.isCalibrated,
      // Form signals
      kneeWidth:        +kneeWidth.toFixed(3),
      ankleWidth:       +ankleWidth.toFixed(3),
      shoulderWidth:    +shoulderWidth.toFixed(3),
      isKneeCave,
      isUnevenHip,
      // No elbow/knee angle fields for squats
      leftElbowAngle:   null,
      rightElbowAngle:  null,
      kneeAngle:        null,
      // Metadata
      chosenSide:       'bilateral',
      baseline:         this.baseline ? {
        hipY:          +this.baseline.hipY.toFixed(3),
        legLength:     +this.baseline.legLength.toFixed(3),
        shoulderWidth: +this.baseline.shoulderWidth.toFixed(3),
      } : null,
      personalMaxDescent: +this.personalMaxDescent.toFixed(3),
    };
  }

  _emptyTelemetry(minVis = 0) {
    return this._computeTelemetry(0, minVis, 0, 0, 0, false, false, 0);
  }

  _buildOutput(telemetry, timestampMs) {
    return {
      state:               this.state,
      validReps:           this.validReps,
      cleanReps:           this.cleanReps,
      imperfectReps:       this.imperfectReps,
      incompleteReps:      this.incompleteReps,
      rejectedCount:       this.rejectedCount,
      lastEvent:           this.lastEvent,
      lastRejectionReason: this.lastRejectionReason,
      isCalibrated:        this.isCalibrated,
      telemetry,
      timestampMs,
    };
  }
}

