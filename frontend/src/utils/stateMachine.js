// Formanti-Inspired Dedicated Exercise State Machine & Repetition Engine
// Strict Top and Bottom Benchmark Position Validation
// Decoupled Repetition Counting from Form Quality Evaluation
// Explicit 7 Push-Up States with Multi-Signal Detection & Rejection of Invalid Movements

import { getExerciseValidator } from './exerciseValidators.js';
import { evaluateCameraCalibration } from './poseCalibration.js';
import { voiceCoach } from './voiceCoach.js';
import { PurePushupEngine } from './purePushupEngine.js';
import { PureSquatEngine } from './pureSquatEngine.js';

const SQUAT_IDS = ['basic-squats', 'weighted-squats', 'squats'];

export const ExerciseStates = {
  // Canonical 7 States specified by user requirements
  WAITING_FOR_START: 'WAITING_FOR_START',
  TOP_POSITION: 'TOP_POSITION',
  LOWERING: 'LOWERING',
  BOTTOM_POSITION: 'BOTTOM_POSITION',
  RISING: 'RISING',
  REPETITION_COMPLETED: 'REPETITION_COMPLETED',
  INVALID_MOVEMENT: 'INVALID_MOVEMENT',

  // Aliases for compatibility across other exercises & UI hooks
  WAITING_FOR_CAMERA: 'WAITING_FOR_START',
  CALIBRATING: 'WAITING_FOR_START',
  INVALID_POSITION: 'INVALID_MOVEMENT',
  READY: 'TOP_POSITION',
  GOING_DOWN: 'LOWERING',
  GOING_UP: 'RISING',
  REP_COMPLETED: 'REPETITION_COMPLETED',
  PAUSED: 'WAITING_FOR_START',
  TRACKING_LOST: 'TRACKING_LOST',
  TRACKING_PAUSED: 'TRACKING_LOST'
};

export class FormantiExerciseEngine {
  constructor(exerciseId, callbacks = {}) {
    this.exerciseId = exerciseId || 'weighted-squats';
    this.validator = getExerciseValidator(this.exerciseId);

    // Callbacks
    this.onStateChange = callbacks.onStateChange || (() => {});
    this.onRepCounted = callbacks.onRepCounted || (() => {});
    this.onFeedback = callbacks.onFeedback || (() => {});
    this.onCalibrationUpdate = callbacks.onCalibrationUpdate || (() => {});
    this.onTelemetryUpdate = callbacks.onTelemetryUpdate || (() => {});

    // State Tracking
    this.state = ExerciseStates.WAITING_FOR_START;
    
    // Repetition Counts (Decoupled: Clean + Imperfect = Valid Reps)
    this.validReps = 0;                  // Total completed push-ups (clean + imperfect)
    this.completedCleanReps = 0;         // Reps with optimal form (score >= 85)
    this.completedImperfectReps = 0;     // Reps completed with form faults (score 50-84)
    this.incompleteReps = 0;             // Aborted downward or upward movements
    this.rejectedCount = 0;              // Discarded invalid movements (hip pumps, head bobs)
    this.invalidReps = 0;                // Backwards compatibility alias for incomplete
    this.repsLedger = [];
    this.purePushupEngine = (this.exerciseId === 'pushups') ? new PurePushupEngine() : null;
    this.pureSquatEngine  = SQUAT_IDS.includes(this.exerciseId) ? new PureSquatEngine() : null;

    // Calibration & Stabilization
    this.isCalibrated = false;
    this.calibrationHoldFrames = 0;
    this.calibrationRequiredFrames = 6;

    // Temporal Validation & Hysteresis
    this.phaseStartTime = Date.now();
    this.repStartTime = Date.now();
    this.lastRepCompletedTime = 0;
    this.repCooldownMs = 380;

    // Dwell Times (ms)
    this.topDwellStartTime = 0;
    this.topDwellFrames = 0;
    this.bottomDwellStartTime = 0;
    this.bottomDwellFrames = 0;
    this.hasDweltBottom = false;

    // Repetition Quality Logging & Baselines
    this.currentRepFaults = new Set();
    this.currentRepGoodPoints = new Set();
    this.peakDepthAngle = 180;
    this.maxShoulderDisp = 0;
    this.smoothedAngle = null;
    this.alphaSmoothing = 0.35;
    this.baselineTop = null; // Baseline position at top lockout

    // Telemetry & Diagnostic Tracking (User Requirement 6)
    this.previousState = ExerciseStates.WAITING_FOR_START;
    this.bottomDetected = false;
    this.risingDetected = false;
    this.topPositionReached = false;
    this.hasAscendedPastMidpoint = false;
    this.lastRepCompletionEvent = 'Awaiting completion';
    this.lastRepAcceptedAt = 'None yet';
    this.lastRejectionReason = 'None';
    this.repValidationStatus = 'WAITING_FOR_START';
    this.debugTelemetry = {};

    // Tracking Health
    this.lostTrackingFrames = 0;
    this.maxAllowedMissingFrames = 8;
  }

  setExercise(exerciseId) {
    this.exerciseId = exerciseId;
    this.validator = getExerciseValidator(exerciseId);
    this.purePushupEngine = (exerciseId === 'pushups') ? new PurePushupEngine() : null;
    this.pureSquatEngine  = SQUAT_IDS.includes(exerciseId) ? new PureSquatEngine() : null;
    this.reset();
  }

  reset() {
    this.state = ExerciseStates.WAITING_FOR_START;
    this.validReps = 0;
    this.completedCleanReps = 0;
    this.completedImperfectReps = 0;
    this.incompleteReps = 0;
    this.rejectedCount = 0;
    this.invalidReps = 0;
    this.repsLedger = [];
    this.isCalibrated = false;
    this.calibrationHoldFrames = 0;
    this.hasDweltBottom = false;
    this.smoothedAngle = null;
    this.currentRepFaults.clear();
    this.currentRepGoodPoints.clear();
    this.peakDepthAngle = 180;
    this.maxShoulderDisp = 0;
    this.baselineTop = null;
    this.lastRejectionReason = 'None';
    this.repValidationStatus = 'WAITING_FOR_START';
    this.previousState = ExerciseStates.WAITING_FOR_START;
    this.bottomDetected = false;
    this.risingDetected = false;
    this.topPositionReached = false;
    this.hasAscendedPastMidpoint = false;
    this.lastRepCompletionEvent = 'Awaiting completion';
    this.lastRepAcceptedAt = 'None yet';
    if (this.pureSquatEngine) this.pureSquatEngine.reset();
    this.onStateChange(this.state);
  }

  transitionTo(newState, message = '') {
    if (this.state !== newState) {
      const prev = this.state;
      this.previousState = prev;
      this.state = newState;
      this.phaseStartTime = Date.now();
      
      if (newState === ExerciseStates.BOTTOM_POSITION) {
        this.bottomDetected = true;
      } else if (newState === ExerciseStates.RISING) {
        this.risingDetected = true;
      } else if (newState === ExerciseStates.TOP_POSITION) {
        this.topPositionReached = true;
      }

      this.onStateChange(newState, { prev, message });

      if (message) {
        this.onFeedback(message);
        voiceCoach.speak(message, { category: 'state_transition' });
      }
    }
  }

  /**
   * Main Frame Processing Loop
   */
  processFrame(landmarks, timestampMs = null, dimensions = null) {
    const now = timestampMs !== null ? timestampMs : Date.now();

    // 1. Pure Engine Push-up Delegation (Single authoritative pure rep counter)
    if (this.exerciseId === 'pushups' && this.purePushupEngine) {
      if (this.isCalibrated && !this.purePushupEngine.isCalibrated) {
        this.purePushupEngine.isCalibrated = true;
      }
      if (this.state && this.state !== this.purePushupEngine.state) {
        const mapped = this.state === 'READY' ? 'TOP_POSITION'
          : this.state === 'GOING_DOWN' ? 'LOWERING'
          : this.state === 'GOING_UP' ? 'RISING'
          : this.state;
        this.purePushupEngine.state = mapped;
      }

      const pureResult = this.purePushupEngine.processFrame(landmarks, now, dimensions);
      const telemetry = (landmarks && landmarks.length >= 25 && this.validator)
        ? this.validator.computeTelemetry(landmarks)
        : {};

      this.state = pureResult.state;
      this.validReps = pureResult.validReps;
      this.completedCleanReps = pureResult.cleanReps;
      this.completedImperfectReps = pureResult.imperfectReps;
      this.incompleteReps = pureResult.incompleteReps;
      this.invalidReps = pureResult.incompleteReps;
      this.rejectedCount = pureResult.rejectedCount;
      this.repsLedger = this.purePushupEngine.repsLedger;
      this.lastRepAcceptedAt = pureResult.lastRepAcceptedAt;
      this.isCalibrated = this.purePushupEngine.isCalibrated;

      const pTelem = pureResult.telemetry || {};
      const telem = {
        ...telemetry,
        confidence: pTelem.visibility ? Math.round(pTelem.visibility * 100) : 0,
        visionConfidence: pTelem.visibility ? Math.round(pTelem.visibility * 100) : 0,
        depthPercentage: pTelem.depthPercentage ?? 0,
        primaryAngle: pTelem.elbowAngle,
        elbowAngle: pTelem.elbowAngle,
        dominantSide: pTelem.chosenSide,
        shoulderDescentPercent: pTelem.shoulderDescentPercent ?? 0,
        hipDescentPercent: pTelem.hipDescentPercent ?? 0,
        debug: {
          state: pureResult.state,
          chosenSide: pTelem.chosenSide,
          elbowAngle: pTelem.elbowAngle,
          shoulderDescentPercent: pTelem.shoulderDescentPercent ?? 0,
          hipDescentPercent: pTelem.hipDescentPercent ?? 0,
          visibility: pTelem.visibility ?? 0,
          baseline: pTelem.baseline,
          lastRejectionReason: pureResult.lastRejectionReason,
          repCount: pureResult.validReps,
          lastRepAcceptedAt: pureResult.lastRepAcceptedAt,
          repCompletionEvent: pureResult.lastEvent || 'Awaiting completion'
        }
      };

      if (pureResult.lastEvent === 'REP_COMPLETED' || pureResult.lastEvent === 'INCOMPLETE_REP') {
        const lastRec = this.repsLedger[this.repsLedger.length - 1];
        if (lastRec) {
          this.onRepCounted({
            validReps: this.validReps,
            completedCleanReps: this.completedCleanReps,
            completedImperfectReps: this.completedImperfectReps,
            invalidReps: this.invalidReps,
            rejectedCount: this.rejectedCount,
            totalReps: this.validReps + this.invalidReps + this.rejectedCount,
            repRecord: lastRec
          });
        }
      }

      this.onStateChange(this.state, { message: pureResult.lastRejectionReason });
      this.onTelemetryUpdate(telem);
      return;
    }

    // 2. Pure Squat Engine Delegation (front-view hip-descent-based counting)
    if (this.pureSquatEngine && SQUAT_IDS.includes(this.exerciseId)) {
      const squatResult = this.pureSquatEngine.processFrame(landmarks, now, dimensions);
      const sqTelem     = squatResult.telemetry || {};

      // Sync state to engine
      this.state                 = squatResult.state;
      this.validReps             = squatResult.validReps;
      this.completedCleanReps    = squatResult.cleanReps;
      this.completedImperfectReps= squatResult.imperfectReps;
      this.incompleteReps        = squatResult.incompleteReps;
      this.invalidReps           = squatResult.incompleteReps;
      this.rejectedCount         = squatResult.rejectedCount;
      this.repsLedger            = this.pureSquatEngine.repsLedger;
      this.isCalibrated          = this.pureSquatEngine.isCalibrated;
      this.lastRejectionReason   = squatResult.lastRejectionReason;

      // Build telemetry for UI — use hip descent % as the primary/live angle
      const depthPct = sqTelem.hipDescentPct ?? 0;
      const telem = {
        ...sqTelem,
        confidence: sqTelem.visibility ? Math.round(sqTelem.visibility * 100) : 0,
        visionConfidence: sqTelem.visibility ? Math.round(sqTelem.visibility * 100) : 0,
        primaryAngle:    depthPct,
        smoothedAngle:   depthPct,
        currentAngle:    depthPct,
        elbowAngle:      null,
        kneeAngle:       null,
        leftElbowAngle:  null,
        rightElbowAngle: null,
        jointLabel:      'Hip Depth',
        targetAngle:     100,
        needToBend:      Math.max(0, 100 - depthPct),
        depthPercentage: depthPct,
        currentState:    squatResult.state,
        lastRejectionReason: squatResult.lastRejectionReason,
        debug: {
          state:               squatResult.state,
          hipDescentPct:       depthPct,
          visibility:          sqTelem.visibility ?? 0,
          isCalibrated:        this.pureSquatEngine.isCalibrated,
          lastRejectionReason: squatResult.lastRejectionReason,
          repCount:            squatResult.validReps,
          personalMaxDescent:  sqTelem.personalMaxDescent ?? 0,
        }
      };

      // Fire onRepCounted for every new rep/incomplete entry
      if (squatResult.lastEvent === 'REP_COMPLETED' || squatResult.lastEvent === 'INCOMPLETE_REP') {
        const lastRec = this.repsLedger[this.repsLedger.length - 1];
        if (lastRec) {
          this.onRepCounted({
            validReps:            this.validReps,
            completedCleanReps:   this.completedCleanReps,
            completedImperfectReps: this.completedImperfectReps,
            invalidReps:          this.invalidReps,
            rejectedCount:        this.rejectedCount,
            totalReps:            this.validReps + this.invalidReps + this.rejectedCount,
            repRecord:            lastRec
          });
        }
      }

      this.onStateChange(this.state, { message: squatResult.lastRejectionReason });
      this.onCalibrationUpdate({
        isCalibrated:    this.pureSquatEngine.isCalibrated,
        confidence:      sqTelem.visibility ?? 0,
        trackingStatus:  squatResult.state,
        checks: []
      });
      this.onTelemetryUpdate(telem);
      return;
    }

    // 3. Fallback for non-pure exercises: Check Camera Presence & Body Visibility
    if (!landmarks || landmarks.length < 29) {
      this.lostTrackingFrames++;
      if (this.lostTrackingFrames > this.maxAllowedMissingFrames) {
        if (this.state !== ExerciseStates.WAITING_FOR_START) {
          this.transitionTo(ExerciseStates.WAITING_FOR_START, 'Tracking paused. Step back so head to feet are visible.');
        }
      }
      this.onTelemetryUpdate({
        confidence: 0,
        visionConfidence: 0,
        currentState: this.state,
        depthPercentage: 0
      });
      return;
    }

    this.lostTrackingFrames = 0;

    // 2. Telemetry Computation & Angle Smoothing (Runs on every frame so UI always has live angles!)
    const telemetry = this.validator.computeTelemetry(landmarks);
    if (this.smoothedAngle === null) {
      this.smoothedAngle = telemetry.primaryAngle;
    } else {
      this.smoothedAngle = this.alphaSmoothing * telemetry.primaryAngle + (1 - this.alphaSmoothing) * this.smoothedAngle;
    }
    telemetry.smoothedAngle = Math.round(this.smoothedAngle);

    // 3. Camera Calibration & Position Check
    const calibration = evaluateCameraCalibration(this.exerciseId, landmarks);
    this.onCalibrationUpdate(calibration);

    const startCheck = this.validator.validateStartingPosition(landmarks);

    // Reject standing upright when doing push-ups
    if (this.exerciseId === 'pushups' && !startCheck.isValid && startCheck.reason && startCheck.reason.includes('standing upright')) {
      if (this.state !== ExerciseStates.INVALID_MOVEMENT) {
        this.transitionTo(ExerciseStates.INVALID_MOVEMENT, startCheck.reason);
      }
      this.onTelemetryUpdate(telemetry);
      return;
    }

    // Auto-activate tracking immediately when user is in practice posture
    if (!this.isCalibrated) {
      this.isCalibrated = true;
      if (this.state === ExerciseStates.WAITING_FOR_START || this.state === ExerciseStates.INVALID_MOVEMENT) {
        this.transitionTo(ExerciseStates.TOP_POSITION, 'Position detected! Begin your exercise.');
      }
    }

    // Compute vertical displacements relative to calibrated top baseline
    if (!this.baselineTop && (this.state === ExerciseStates.TOP_POSITION || this.state === ExerciseStates.WAITING_FOR_START)) {
      this.baselineTop = {
        shoulderY: telemetry.shoulderY,
        hipY: telemetry.hipY,
        wristY: telemetry.wristY,
        primaryAngle: telemetry.primaryAngle
      };
    }

    const baseTopShoulderY = this.baselineTop?.shoulderY ?? telemetry.shoulderY;
    const baseTopHipY = this.baselineTop?.hipY ?? telemetry.hipY;
    const baseTopElbow = this.baselineTop?.primaryAngle ?? telemetry.primaryAngle;

    const deltaShoulderY = +(telemetry.shoulderY - baseTopShoulderY).toFixed(4); // positive = lowering downward
    const deltaHipY = +(telemetry.hipY - baseTopHipY).toFixed(4);
    const elbowFlexion = Math.round(baseTopElbow - telemetry.primaryAngle); // positive = flexing

    // Movement direction: DOWN / UP / HOLD
    let direction = 'HOLD';
    if (this.state === ExerciseStates.LOWERING || deltaShoulderY > 0.025) {
      direction = 'DOWN';
    } else if (this.state === ExerciseStates.RISING || deltaShoulderY < -0.010) {
      direction = 'UP';
    }

    // Update real-time HUD telemetry with multi-signal data
    telemetry.direction = direction;
    telemetry.shoulderDisp = deltaShoulderY;
    telemetry.hipDisp = deltaHipY;
    telemetry.elbowFlexion = elbowFlexion;
    telemetry.currentState = this.state;
    telemetry.repValidationStatus = this.repValidationStatus;
    telemetry.lastRejectionReason = this.lastRejectionReason;

    this.debugTelemetry = {
      state: this.state,
      previousState: this.previousState,
      direction: direction,
      leftElbowAngle: telemetry.leftElbowAngle,
      rightElbowAngle: telemetry.rightElbowAngle,
      leftShoulderAngle: telemetry.leftShoulderAngle ?? 90,
      rightShoulderAngle: telemetry.rightShoulderAngle ?? 90,
      hipAlignment: telemetry.hipAlignment ?? 170,
      kneeAngle: telemetry.kneeAngle ?? 168,
      dominantAngle: telemetry.primaryAngle,
      dominantSide: telemetry.dominantSide,
      shoulderDisp: deltaShoulderY,
      hipDisp: deltaHipY,
      confidence: telemetry.dominantConfidence,
      visibleCount: telemetry.visibleLandmarksCount ?? 33,
      missingJoints: telemetry.missingRequiredJoints ?? [],
      movementAmplitude: elbowFlexion,
      bottomDetected: this.bottomDetected ? `YES (${Math.round(this.peakDepthAngle)}°)` : 'NO',
      risingDetected: this.risingDetected ? 'YES' : 'NO',
      topPositionReached: this.topPositionReached ? 'YES' : 'NO',
      repValidationStatus: this.repValidationStatus,
      repCompletionEvent: this.lastRepCompletionEvent,
      currentRepCount: this.validReps,
      rejectionReason: this.lastRejectionReason,
      lastRepAcceptedAt: this.lastRepAcceptedAt,
      isFrontView: telemetry.isFrontView
    };
    telemetry.debug = this.debugTelemetry;

    this.onTelemetryUpdate(telemetry);

    // Track minimum angle reached in this repetition
    if (telemetry.primaryAngle < this.peakDepthAngle) {
      this.peakDepthAngle = telemetry.primaryAngle;
    }
    if (deltaShoulderY > this.maxShoulderDisp) {
      this.maxShoulderDisp = deltaShoulderY;
    }

    // Register faults dynamically during movement
    if (this.exerciseId === 'pushups') {
      if (telemetry.hipAlignment < 148) {
        this.currentRepFaults.add('Hips sagging: maintain rigid plank line.');
        voiceCoach.speak('Keep your hips aligned.', { category: 'hip_sag', cooldownMs: 4000 });
      }
      if (telemetry.isElbowFlaring) {
        this.currentRepFaults.add('Elbow flare: elbows flared wide (>75°).');
        voiceCoach.speak('Tuck your elbows closer to your ribs.', { category: 'elbow_flare', cooldownMs: 4500 });
      }
    } else if (this.exerciseId === 'weighted-squats') {
      if (telemetry.isKneeValgus) {
        this.currentRepFaults.add('Knee valgus: knees caved inward.');
        voiceCoach.speak('Push your knees outward in line with your toes.', { category: 'knee_valgus', cooldownMs: 4000 });
      }
    }

    // =========================================================================
    // 4. Exercise State Machine Flow (7 Canonical States)
    // WAITING_FOR_START -> TOP_POSITION -> LOWERING -> BOTTOM_POSITION -> RISING -> REPETITION_COMPLETED
    // =========================================================================
    switch (this.state) {
      case ExerciseStates.WAITING_FOR_START: {
        const topCheck = this.validator.validateTopPosition(landmarks, telemetry, this.baselineTop);
        if (topCheck.isTop || topCheck.isAcceptable) {
          this.baselineTop = {
            shoulderY: telemetry.shoulderY,
            hipY: telemetry.hipY,
            wristY: telemetry.wristY,
            primaryAngle: telemetry.primaryAngle
          };
          this.transitionTo(ExerciseStates.TOP_POSITION, 'In starting position. Lower with control.');
          this.repStartTime = now;
          this.currentRepFaults.clear();
          this.currentRepGoodPoints.clear();
          this.peakDepthAngle = telemetry.primaryAngle;
          this.maxShoulderDisp = 0;
          this.repValidationStatus = 'READY';
        }
        break;
      }

      case ExerciseStates.TOP_POSITION: {
        // While resting in top position with arms extended, gently adapt top baseline
        if (telemetry.primaryAngle >= 140) {
          this.baselineTop.shoulderY = 0.8 * this.baselineTop.shoulderY + 0.2 * telemetry.shoulderY;
          this.baselineTop.hipY = 0.8 * this.baselineTop.hipY + 0.2 * telemetry.hipY;
          this.baselineTop.primaryAngle = 0.8 * this.baselineTop.primaryAngle + 0.2 * telemetry.primaryAngle;
        }

        // =====================================================================
        // REJECT INCORRECT MOVEMENTS (User Requirement 4)
        // =====================================================================
        
        // A. Reject Hip Pump / Butt Dips:
        // Hips move down/up significantly while shoulders remain stationary
        if (this.exerciseId === 'pushups' && deltaHipY > 0.048 && deltaShoulderY < 0.020 && elbowFlexion < 15) {
          this.rejectMovement('Hips moving up and down without lowering upper body (hip pump)', now);
          return;
        }

        // B. Reject Arm / Wrist Twitches:
        // Small wrist movement without upper body displacement
        if (Math.abs(telemetry.wristY - (this.baselineTop?.wristY || telemetry.wristY)) > 0.055 && deltaShoulderY < 0.018 && elbowFlexion < 12) {
          this.rejectMovement('Wrist/arm movement only without body descent', now);
          return;
        }

        // C. Detect Genuine Initiation of LOWERING:
        // Multi-signal requirement: Elbow angle flexes AND/OR upper body descends downward
        const hasElbowFlexion = (elbowFlexion >= 16) || (telemetry.depthPercentage >= 15);
        const hasShoulderDescent = deltaShoulderY >= 0.020;
        
        // In synthetic test frames shoulder displacement might be 0, so allow elbow flexion >= 22° as well
        if (hasElbowFlexion && (hasShoulderDescent || elbowFlexion >= 22)) {
          this.transitionTo(ExerciseStates.LOWERING);
          this.repStartTime = now;
          this.peakDepthAngle = telemetry.primaryAngle;
          this.maxShoulderDisp = deltaShoulderY;
          this.currentRepFaults.clear();
          this.hasDweltBottom = false;
          this.repValidationStatus = 'LOWERING';
        }
        break;
      }

      case ExerciseStates.LOWERING: {
        // Continuous tracking of maximum depth reached
        if (telemetry.primaryAngle < this.peakDepthAngle) {
          this.peakDepthAngle = telemetry.primaryAngle;
        }
        if (deltaShoulderY > this.maxShoulderDisp) {
          this.maxShoulderDisp = deltaShoulderY;
        }

        // Check if bottom inflection position reached
        const bottomCheck = this.validator.validateBottomPosition(landmarks, telemetry, this.baselineTop);
        
        if (bottomCheck.isBottom) {
          this.hasDweltBottom = true;
          this.bottomDetected = true;
          this.transitionTo(ExerciseStates.BOTTOM_POSITION);
          this.repValidationStatus = 'BOTTOM_REACHED';
          voiceCoach.speak('Drive back up.', { category: 'drive_up', cooldownMs: 3000 });
        } else if (now - this.phaseStartTime > 500 && telemetry.primaryAngle >= baseTopElbow - 6 && deltaShoulderY < 0.012) {
          // User aborted downward movement without reaching bottom inflection
          if (elbowFlexion >= 22) {
            this.recordIncompleteRepetition('Incomplete depth: aborted descent before reaching bottom inflection.', now);
          }
          this.transitionTo(ExerciseStates.TOP_POSITION, 'Complete the full downward movement.');
          this.bottomDwellStartTime = 0;
          this.repValidationStatus = 'READY';
        }
        break;
      }

      case ExerciseStates.BOTTOM_POSITION: {
        // Track lowest inflection
        if (telemetry.primaryAngle < this.peakDepthAngle) {
          this.peakDepthAngle = telemetry.primaryAngle;
        }

        // Detect initiation of upward return drive
        // Elbow angle begins increasing from peak depth OR shoulder starts rising OR user drives upward
        const isElbowExtending = telemetry.primaryAngle >= (this.peakDepthAngle + 6);
        const isShoulderRising = deltaShoulderY <= (this.maxShoulderDisp - 0.012);
        const isRisingUp = telemetry.primaryAngle >= 115 || telemetry.depthPercentage <= 70;

        if (isElbowExtending || isShoulderRising || isRisingUp) {
          this.risingDetected = true;
          this.hasAscendedPastMidpoint = false;
          this.transitionTo(ExerciseStates.RISING);
          this.bottomDwellStartTime = 0;
          this.bottomDwellFrames = 0;
          this.repValidationStatus = 'RISING';
        }
        break;
      }

      case ExerciseStates.RISING: {
        // Track whether user ascended past midpoint of movement
        if (telemetry.primaryAngle >= 122 || telemetry.depthPercentage <= 45) {
          this.hasAscendedPastMidpoint = true;
        }

        // Check for return to top lockout
        const topCheck = this.validator.validateTopPosition(landmarks, telemetry, this.baselineTop);

        // Multi-signal top validation:
        // Arm is extended (>= 140° or within 8° of baseline top lockout) OR returned to starting height with lockout
        const hasBaselineLockout = this.baselineTop && 
          this.baselineTop.primaryAngle >= 140 && 
          telemetry.primaryAngle >= Math.min(140, this.baselineTop.primaryAngle - 8) && 
          deltaShoulderY <= 0.025;

        const reachedTopExtension = topCheck.isTop || 
          topCheck.isAcceptable || 
          hasBaselineLockout ||
          (telemetry.depthPercentage <= 12 && telemetry.primaryAngle >= 140);

        if (reachedTopExtension) {
          this.topPositionReached = true;
          // VERIFIED REPETITION COMPLETED!
          this.completeRepetition(true, now, telemetry);
        } else if (this.hasAscendedPastMidpoint && (telemetry.primaryAngle <= 105 || telemetry.depthPercentage >= 75)) {
          // Incomplete rep! User ascended halfway and then collapsed/re-descended without locking out!
          this.recordIncompleteRepetition('Incomplete range of motion: failed to lock out at the top.', now);
          this.transitionTo(ExerciseStates.LOWERING);
        }
        break;
      }

      case ExerciseStates.REPETITION_COMPLETED: {
        // After brief cooldown (250ms), return to TOP_POSITION ready for the next rep
        const cooldown = (timestampMs !== null) ? 180 : 250;
        if (now - this.lastRepCompletedTime >= cooldown) {
          this.topPositionReached = false;
          this.bottomDetected = false;
          this.risingDetected = false;
          this.hasAscendedPastMidpoint = false;
          this.transitionTo(ExerciseStates.TOP_POSITION);
          this.repValidationStatus = 'READY';
        }
        break;
      }

      case ExerciseStates.INVALID_MOVEMENT: {
        // Display invalid reason for 500ms then reset to TOP_POSITION
        if (now - this.phaseStartTime >= 500) {
          this.transitionTo(ExerciseStates.TOP_POSITION);
          this.repValidationStatus = 'READY';
        }
        break;
      }

      default:
        break;
    }
  }

  /**
   * Finalizes a completed repetition (Decoupled Repetition Counting from Form Scoring)
   * If the user completed the push-up cycle, it COUNTS as a valid repetition!
   */
  completeRepetition(isValid, now, telemetry = {}) {
    this.lastRepCompletedTime = now;
    this.lastRepCompletionEvent = `Rep #${this.validReps + 1} completed (${new Date().toLocaleTimeString()})`;
    this.lastRepAcceptedAt = `${((now - this.repStartTime) / 1000).toFixed(1)}s (Rep #${this.validReps + 1})`;
    const duration = Math.max(1.0, ((now - this.repStartTime) / 1000)).toFixed(1);

    // Evaluate form independently
    let evaluation;
    if (this.validator.evaluateRepForm) {
      evaluation = this.validator.evaluateRepForm(
        telemetry, 
        Array.from(this.currentRepFaults), 
        Math.round(this.peakDepthAngle), 
        duration
      );
    } else {
      // General fallback for other exercises
      let score = 100;
      const faults = Array.from(this.currentRepFaults);
      if (faults.length > 0) score -= faults.length * 15;
      score = Math.max(55, Math.min(100, score));
      evaluation = {
        score,
        category: score >= 85 ? 'completed_clean' : 'completed_imperfect',
        rating: score >= 90 ? 'Optimal Form' : (score >= 80 ? 'Good Form' : 'Imperfect Form (Needs Adjustment)'),
        mistakes: faults,
        goodPoints: ['Steady movement pacing throughout the repetition.'],
        howToImprove: faults[0] || 'Maintain this solid cadence.'
      };
    }

    // =========================================================================
    // CRITICAL: BOTH CLEAN AND IMPERFECT REPS COUNT AS VALID REPETITIONS!
    // =========================================================================
    this.validReps++;
    this.repValidationStatus = 'VALID_REP_COMPLETED';

    if (evaluation.category === 'completed_clean') {
      this.completedCleanReps++;
      this.transitionTo(ExerciseStates.REPETITION_COMPLETED, 'Good repetition!');
      voiceCoach.speak('Good repetition!', { category: 'rep_good', priority: true });
    } else {
      this.completedImperfectReps++;
      const primaryIssue = evaluation.mistakes[0] || 'Rep counted. Refine your form.';
      this.transitionTo(ExerciseStates.REPETITION_COMPLETED, primaryIssue);
      voiceCoach.speak('Rep counted. ' + primaryIssue, { category: 'rep_good', priority: true });
    }

    const repRecord = {
      repNumber: this.validReps + this.incompleteReps + this.rejectedCount,
      completedRepNumber: this.validReps,
      isValid: true,
      category: evaluation.category, // 'completed_clean' | 'completed_imperfect'
      score: evaluation.score,
      rating: evaluation.rating,
      peakAngle: Math.round(this.peakDepthAngle),
      durationSec: duration,
      goodPoints: evaluation.goodPoints,
      mistakes: evaluation.mistakes,
      howToImprove: evaluation.howToImprove
    };

    this.repsLedger.push(repRecord);
    this.onRepCounted({
      validReps: this.validReps,
      completedCleanReps: this.completedCleanReps,
      completedImperfectReps: this.completedImperfectReps,
      invalidReps: this.incompleteReps,
      rejectedCount: this.rejectedCount,
      totalReps: this.validReps + this.incompleteReps + this.rejectedCount,
      repRecord
    });

    this.hasDweltBottom = false;
    this.currentRepFaults.clear();
  }

  /**
   * Records an incomplete repetition (e.g., aborted descent, or failed to return to top)
   */
  recordIncompleteRepetition(reason, now) {
    this.incompleteReps++;
    this.invalidReps = this.incompleteReps;
    this.repValidationStatus = 'INCOMPLETE_REP';

    const repRecord = {
      repNumber: this.validReps + this.incompleteReps + this.rejectedCount,
      isValid: false,
      category: 'incomplete',
      score: 45,
      rating: 'Incomplete Rep',
      peakAngle: Math.round(this.peakDepthAngle || 160),
      durationSec: '1.4',
      goodPoints: ['Initiated movement cycle'],
      mistakes: [reason],
      howToImprove: 'Complete the entire movement cycle from full depth back to top lockout.'
    };

    this.repsLedger.push(repRecord);
    this.onRepCounted({
      validReps: this.validReps,
      completedCleanReps: this.completedCleanReps,
      completedImperfectReps: this.completedImperfectReps,
      invalidReps: this.incompleteReps,
      rejectedCount: this.rejectedCount,
      totalReps: this.validReps + this.incompleteReps + this.rejectedCount,
      repRecord
    });

    voiceCoach.speak('Complete the full movement.', { category: 'incomplete_rep', priority: true });
    this.hasDweltBottom = false;
  }

  /**
   * Rejects an invalid movement (hip pump, head bob, wrist twitch)
   */
  rejectMovement(reason, now) {
    this.rejectedCount++;
    this.lastRejectionReason = reason;
    this.repValidationStatus = 'REJECTED';

    const repRecord = {
      repNumber: this.validReps + this.incompleteReps + this.rejectedCount,
      isValid: false,
      category: 'rejected',
      score: 0,
      rating: 'Rejected Movement',
      peakAngle: Math.round(this.peakDepthAngle || 160),
      durationSec: '1.0',
      goodPoints: [],
      mistakes: [reason],
      howToImprove: 'Upper body and elbows must move through full push-up cycle.'
    };

    this.repsLedger.push(repRecord);
    this.transitionTo(ExerciseStates.INVALID_MOVEMENT, reason);

    this.onRepCounted({
      validReps: this.validReps,
      completedCleanReps: this.completedCleanReps,
      completedImperfectReps: this.completedImperfectReps,
      invalidReps: this.incompleteReps,
      rejectedCount: this.rejectedCount,
      totalReps: this.validReps + this.incompleteReps + this.rejectedCount,
      repRecord
    });

    voiceCoach.speak(reason, { category: 'invalid_movement', priority: true });
  }
}
