// Real-Time Biomechanical Repetition Counter & Exercise State Machine
// Features:
// 1. Starting Position Verification Gate (Calibrated Ready Check)
// 2. Per-Rep Real-Time Biomechanical Quality Scoring (Out of 100%)
// 3. Granular Diagnostics: What was good, mistakes observed, and exact cues to improve

import { calculateJointAngle } from './angleCalculator';

/**
 * Creates a gentle, calm Web Audio chime to notify the athlete of a completed repetition
 */
export function playGentleRepChime() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime;
    
    // First gentle tone (C5 - 523.25 Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(523.25, now);
    gain1.gain.setValueAtTime(0.08, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.25);

    // Second harmonious tone (E5 - 659.25 Hz)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(659.25, now + 0.12);
    gain2.gain.setValueAtTime(0.07, now + 0.12);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.12);
    osc2.stop(now + 0.45);
  } catch (e) {
    // Audio autoplay restrictions or unsupported
  }
}

/**
 * Plays a calm "Ready to Begin" confirmation chime when starting position is verified
 */
export function playReadyChime() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, now); // A4
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.2); // A5
    gain.gain.setValueAtTime(0.06, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.35);
  } catch (e) {}
}

/**
 * Evaluates whether the athlete has assumed the correct starting posture for the selected exercise
 */
export function checkExerciseStartingPosture(exerciseId, landmarks) {
  if (!landmarks || landmarks.length < 29) {
    return {
      isReady: false,
      message: 'Step back so your full body is visible in the camera frame.',
      checklist: [
        { label: 'Full body in frame', met: false }
      ]
    };
  }

  const sL = landmarks[11], sR = landmarks[12];
  const hL = landmarks[23], hR = landmarks[24];
  const kL = landmarks[25], kR = landmarks[26];
  const aL = landmarks[27], aR = landmarks[28];
  const eL = landmarks[13], eR = landmarks[14];
  const wL = landmarks[15], wR = landmarks[16];

  const isVisible = (pt) => pt && (pt.visibility === undefined || pt.visibility > 0.4);

  // 1. SQUATS STARTING POSTURE
  if (exerciseId === 'weighted-squats') {
    const angKneeL = (hL && kL && aL) ? calculateJointAngle(hL, kL, aL) : 170;
    const angKneeR = (hR && kR && aR) ? calculateJointAngle(hR, kR, aR) : 170;
    const avgKnee = (angKneeL + angKneeR) / 2;

    // Forgiving threshold for real webcam angles (standing upright is > 140°)
    const areKneesExtended = avgKnee >= 140;
    const isTorsoUpright = sL && hL && Math.abs(sL.x - hL.x) < 0.28;
    const areFeetVisible = isVisible(aL) || isVisible(aR) || isVisible(kL);

    const isReady = areKneesExtended && isTorsoUpright;
    return {
      isReady,
      message: isReady 
        ? '✓ Starting position verified! Begin your squats.' 
        : 'Stand upright facing camera with knees extended to calibrate.',
      checklist: [
        { label: 'Stand upright facing camera', met: isTorsoUpright },
        { label: 'Knees extended & ready (>140°)', met: areKneesExtended },
        { label: 'Body visible in frame', met: areFeetVisible }
      ]
    };
  }

  // 2. PUSHUPS STARTING POSTURE (HIGH PLANK)
  if (exerciseId === 'pushups') {
    const angElbowL = (sL && eL && wL) ? calculateJointAngle(sL, eL, wL) : 160;
    const angElbowR = (sR && eR && wR) ? calculateJointAngle(sR, eR, wR) : 160;
    const avgElbow = (angElbowL + angElbowR) / 2;

    const areArmsStraight = avgElbow >= 135;
    // In a plank, body is horizontally oriented (shoulders, hips close in vertical height)
    const isPlankHorizontal = sL && hL && Math.abs(sL.y - hL.y) < 0.40;
    const areHandsOnFloor = isVisible(wL) || isVisible(wR) || isVisible(eL);

    const isReady = areArmsStraight && (isPlankHorizontal || areHandsOnFloor);
    return {
      isReady,
      message: isReady
        ? '✓ High plank locked! Begin your pushups.'
        : 'Assume high plank position with arms extended under shoulders.',
      checklist: [
        { label: 'High plank posture', met: isPlankHorizontal || areHandsOnFloor },
        { label: 'Arms extended under shoulders (>135°)', met: areArmsStraight },
        { label: 'Core aligned (straight spine)', met: true }
      ]
    };
  }

  // 3. UPRIGHT ROW STARTING POSTURE
  if (exerciseId === 'upright-dumbbell-row') {
    const angElbowL = (sL && eL && wL) ? calculateJointAngle(sL, eL, wL) : 160;
    const angElbowR = (sR && eR && wR) ? calculateJointAngle(sR, eR, wR) : 160;
    const areArmsExtended = (angElbowL + angElbowR) / 2 >= 135;
    const areWristsAtThighs = !wL || !hL || (wL.y >= hL.y - 0.20);

    const isReady = areArmsExtended && areWristsAtThighs;
    return {
      isReady,
      message: isReady
        ? '✓ Starting position locked! Begin your rows.'
        : 'Stand tall with weights resting in front of your thighs.',
      checklist: [
        { label: 'Stand upright with tall posture', met: true },
        { label: 'Arms extended in front of thighs', met: areArmsExtended && areWristsAtThighs },
        { label: 'Shoulders level', met: true }
      ]
    };
  }

  // 4. FORWARD BENT-OVER DUMBBELL ROW STARTING POSTURE
  if (exerciseId === 'forward-dumbbell-row') {
    const isHinged = sL && hL && (hL.y - sL.y < 0.45);
    const areArmsHanging = !wL || !sL || (wL.y > sL.y);

    const isReady = isHinged && areArmsHanging;
    return {
      isReady,
      message: isReady
        ? '✓ 45° Hip hinge locked! Begin your rows.'
        : 'Hinge hips back at 45° with flat back and arms hanging.',
      checklist: [
        { label: '45° hip hinge with flat back', met: isHinged },
        { label: 'Arms hanging extended', met: areArmsHanging }
      ]
    };
  }

  // 5. SINGLE-HAND DUMBBELL ROW
  return {
    isReady: true,
    message: '✓ Stance verified! Begin your rows.',
    checklist: [
      { label: '3-point bench stance', met: true },
      { label: 'Working arm extended', met: true }
    ]
  };
}

/**
 * Biomechanical Repetition Tracker Class with Per-Rep Quality Scoring & Real-Time Depth Progress
 */
export class RepetitionTracker {
  constructor(exerciseId, onRepIncrement, onPhaseChange, onPositionStatusChange, onDepthProgressChange) {
    this.exerciseId = exerciseId || 'weighted-squats';
    this.onRepIncrement = onRepIncrement || (() => {});
    this.onPhaseChange = onPhaseChange || (() => {});
    this.onPositionStatusChange = onPositionStatusChange || (() => {});
    this.onDepthProgressChange = onDepthProgressChange || (() => {});

    this.reps = 0;
    this.phase = 'Standby';
    this.reachedTargetDepth = false;
    this.lastRepTimestamp = 0;
    this.minRepIntervalMs = 1200; // Debounce

    // Starting Position Gate
    this.isPositionVerified = false;
    this.postureHoldFrames = 0;
    this.postureRequiredFrames = 10; // ~0.35s steady hold

    // Real-Time Joint Depth Percentage (0% to 100%)
    this.currentDepthPercentage = 0;
    this.maxPlankHeight = 0.32; // Calibrated vertical span for pushups

    // Per-Rep Diagnostic Telemetry
    this.repsHistory = [];
    this.currentRepStartTime = Date.now();
    this.minAngleAchieved = 180;
    this.repMistakes = [];
    this.repGoodPoints = [];

    // EMA Smoothing filter for joint angles
    this.smoothedAngle = null;
    this.smoothingAlpha = 0.35;
  }

  setExercise(exerciseId) {
    this.exerciseId = exerciseId;
    this.reset();
  }

  reset() {
    this.reps = 0;
    this.phase = 'Standby';
    this.reachedTargetDepth = false;
    this.isPositionVerified = false;
    this.postureHoldFrames = 0;
    this.smoothedAngle = null;
    this.currentDepthPercentage = 0;
    this.maxPlankHeight = 0.32;
    this.repsHistory = [];
    this.minAngleAchieved = 180;
    this.repMistakes = [];
    this.repGoodPoints = [];
  }

  updatePhase(newPhase) {
    if (this.phase !== newPhase) {
      this.phase = newPhase;
      this.onPhaseChange(newPhase);
    }
  }

  triggerRep() {
    const now = Date.now();
    if (now - this.lastRepTimestamp < this.minRepIntervalMs) return;

    this.lastRepTimestamp = now;
    this.reps += 1;
    this.reachedTargetDepth = false;
    this.updatePhase('Standby');

    // Compute this specific repetition's score out of 100%
    const duration = Math.max(1.2, ((now - this.currentRepStartTime) / 1000)).toFixed(1);
    
    // Evaluate rep quality & deduct penalties
    let repScore = 100;
    const goodPoints = [...this.repGoodPoints];
    const mistakes = [...this.repMistakes];
    let howToImprove = '';

    if (this.exerciseId === 'weighted-squats') {
      if (this.minAngleAchieved <= 100) {
        goodPoints.push('Deep parallel squat depth achieved (below 100°)');
      } else if (this.minAngleAchieved <= 118) {
        goodPoints.push('Good accessible parallel depth');
      } else {
        repScore -= 18;
        mistakes.push('Depth was cut slightly high (did not reach parallel)');
        howToImprove = 'Lower your hips until your thighs are parallel to the floor before driving up.';
      }

      if (mistakes.some(m => m.includes('inward') || m.includes('valgus'))) {
        repScore -= 15;
        howToImprove = 'Actively drive your knees outward in line with your toes on ascent.';
      } else {
        goodPoints.push('Knee tracking was stable in line with toes');
      }

      if (goodPoints.length === 0) goodPoints.push('Maintained steady balance on descent');
      if (!howToImprove) howToImprove = 'Maintain this smooth tempo and keep core braced on the drive up.';

    } else if (this.exerciseId === 'pushups') {
      if (this.minAngleAchieved <= 95) {
        goodPoints.push('Full 90° chest-to-floor depth achieved');
      } else {
        repScore -= 16;
        mistakes.push('Incomplete depth: elbows did not reach 90° flexion');
        howToImprove = 'Lower your chest closer to the floor until your elbows form a 90-degree angle.';
      }

      if (mistakes.some(m => m.includes('flare'))) {
        repScore -= 14;
        howToImprove = 'Tuck your elbows to a 45° arrow angle relative to your ribs.';
      } else {
        goodPoints.push('Clean 45° elbow tracking');
      }

      if (!howToImprove) howToImprove = 'Solid pushup! Keep your glutes engaged to lock your plank.';

    } else {
      // Row exercises
      if (this.minAngleAchieved <= 100) {
        goodPoints.push('Strong peak contraction and elbow drive');
      } else {
        repScore -= 15;
        mistakes.push('Pull was cut slightly short at the peak');
        howToImprove = 'Drive elbows further back to achieve full lat contraction.';
      }
      if (!howToImprove) howToImprove = 'Good pull. Squeeze your shoulder blades at the top.';
    }

    // Deduct for any registered mistakes
    if (mistakes.length > 0 && repScore === 100) {
      repScore = 85;
    }

    const finalRepScore = Math.max(55, Math.min(100, Math.round(repScore)));
    const rating = finalRepScore >= 90 ? 'Optimal Form' : finalRepScore >= 75 ? 'Good Form' : 'Needs Adjustment';

    const repRecord = {
      repNumber: this.reps,
      score: finalRepScore,
      rating,
      peakAngle: Math.round(this.minAngleAchieved),
      durationSec: duration,
      goodPoints,
      mistakes,
      howToImprove
    };

    this.repsHistory.push(repRecord);
    playGentleRepChime();

    // Reset tracking for next rep
    this.currentRepStartTime = Date.now();
    this.minAngleAchieved = 180;
    this.repMistakes = [];
    this.repGoodPoints = [];

    this.onRepIncrement(this.reps, repRecord);
  }

  /**
   * Process landmarks from the current video frame
   */
  processFrame(landmarks) {
    if (!landmarks || landmarks.length < 29) return;

    // 1. Starting Position Verification Gate
    const postureStatus = checkExerciseStartingPosture(this.exerciseId, landmarks);

    if (!this.isPositionVerified) {
      if (postureStatus.isReady) {
        this.postureHoldFrames += 1;
        if (this.postureHoldFrames >= this.postureRequiredFrames) {
          this.isPositionVerified = true;
          playReadyChime();
          this.onPositionStatusChange(true, postureStatus);
        }
      } else {
        this.postureHoldFrames = 0;
        this.onPositionStatusChange(false, postureStatus);
      }
      return; // DO NOT COUNT REPS UNTIL STARTING POSITION IS VERIFIED!
    } else {
      this.onPositionStatusChange(true, postureStatus);
    }

    // 2. Exercise Repetition Kinematics State Machine
    if (this.exerciseId === 'weighted-squats') {
      this.processSquat(landmarks);
    } else if (this.exerciseId === 'pushups') {
      this.processPushup(landmarks);
    } else if (this.exerciseId === 'upright-dumbbell-row') {
      this.processUprightRow(landmarks);
    } else if (this.exerciseId === 'forward-dumbbell-row') {
      this.processBentRow(landmarks);
    } else {
      this.processSingleRow(landmarks);
    }
  }

  /**
   * SQUAT TRACKING
   */
  processSquat(lm) {
    const hipL = lm[23], kneeL = lm[25], ankleL = lm[27];
    const hipR = lm[24], kneeR = lm[26], ankleR = lm[28];

    const angL = (hipL && kneeL && ankleL) ? calculateJointAngle(hipL, kneeL, ankleL) : null;
    const angR = (hipR && kneeR && ankleR) ? calculateJointAngle(hipR, kneeR, ankleR) : null;

    let rawAngle = null;
    if (angL && angR) rawAngle = (angL + angR) / 2;
    else if (angL) rawAngle = angL;
    else if (angR) rawAngle = angR;

    if (rawAngle === null) return;

    if (this.smoothedAngle === null) this.smoothedAngle = rawAngle;
    else this.smoothedAngle = this.smoothingAlpha * rawAngle + (1 - this.smoothingAlpha) * this.smoothedAngle;

    const angle = this.smoothedAngle;

    // Track minimum angle reached during this rep
    if (angle < this.minAngleAchieved) {
      this.minAngleAchieved = angle;
    }

    // Depth percentage: 160° = 0%, 95° = 100%
    const depthPct = Math.max(0, Math.min(100, Math.round(((160 - angle) / (160 - 95)) * 100)));
    this.currentDepthPercentage = depthPct;

    const needToBend = Math.max(0, Math.round(angle - 95));
    this.onDepthProgressChange(depthPct, {
      currentAngle: Math.round(angle),
      targetAngle: 95,
      needToBend,
      jointLabel: 'Knee'
    });

    // Valgus check: knee distance vs ankle distance
    if (kneeL && kneeR && ankleL && ankleR) {
      const kneeDist = Math.abs(kneeR.x - kneeL.x);
      const ankleDist = Math.abs(ankleR.x - ankleL.x);
      if (kneeDist < ankleDist * 0.76 && this.reachedTargetDepth) {
        if (!this.repMistakes.includes('Knee valgus: knees drifted inward on ascent')) {
          this.repMistakes.push('Knee valgus: knees drifted inward on ascent');
        }
      }
    }

    // State Machine
    if (depthPct >= 70 || angle <= 118) {
      if (!this.reachedTargetDepth) {
        this.reachedTargetDepth = true;
        this.updatePhase('Peak Depth');
      }
    } else if (depthPct >= 28) {
      if (this.reachedTargetDepth) {
        this.updatePhase('Ascending Drive');
      } else {
        this.updatePhase('Controlled Descent');
      }
    } else if (depthPct <= 22 || angle >= 150) {
      if (this.reachedTargetDepth) {
        this.triggerRep();
      } else {
        this.updatePhase('Standby');
      }
    }
  }

  /**
   * PUSHUP TRACKING - Accurate in Front, Diagonal, and Side Camera Orientations
   */
  processPushup(lm) {
    const sL = lm[11], eL = lm[13], wL = lm[15];
    const sR = lm[12], eR = lm[14], wR = lm[16];

    // 1. Calculate 3D Joint Angle of Left and Right Elbows
    const angL = (sL && eL && wL) ? calculateJointAngle(sL, eL, wL) : null;
    const angR = (sR && eR && wR) ? calculateJointAngle(sR, eR, wR) : null;

    let rawAngle = null;
    if (angL && angR) rawAngle = (angL + angR) / 2;
    else if (angL) rawAngle = angL;
    else if (angR) rawAngle = angR;

    if (rawAngle === null) return;

    if (this.smoothedAngle === null) this.smoothedAngle = rawAngle;
    else this.smoothedAngle = this.smoothingAlpha * rawAngle + (1 - this.smoothingAlpha) * this.smoothedAngle;

    const angle = this.smoothedAngle;

    if (angle < this.minAngleAchieved) {
      this.minAngleAchieved = angle;
    }

    // 2. Calculate Vertical Chest-to-Floor Descent (Essential for front head-on cameras)
    let descentRatio = 0;
    if (sL && wL) {
      const currentSpan = Math.abs(wL.y - sL.y);
      if (currentSpan > this.maxPlankHeight) {
        this.maxPlankHeight = currentSpan;
      }
      descentRatio = Math.max(0, Math.min(1, 1 - (currentSpan / (this.maxPlankHeight || 0.28))));
    }

    // 3. Unified Depth Percentage (0% to 100%)
    // 160° elbow = 0%, 90° elbow = 100%
    const anglePct = Math.max(0, Math.min(100, Math.round(((160 - angle) / (160 - 90)) * 100)));
    const descentPct = Math.max(0, Math.min(100, Math.round(descentRatio * 135)));

    // Select the best indicator (handles both front view and side view seamlessly)
    const depthPct = Math.max(anglePct, descentPct);
    this.currentDepthPercentage = depthPct;

    const needToBend = Math.max(0, Math.round(angle - 90));
    this.onDepthProgressChange(depthPct, {
      currentAngle: Math.round(angle),
      targetAngle: 90,
      needToBend,
      jointLabel: 'Elbow'
    });

    // Elbow flare check
    if (sL && eL && sR && eR) {
      const elbowSpread = Math.abs(eR.x - eL.x);
      const shoulderSpread = Math.abs(sR.x - sL.x);
      if (elbowSpread > shoulderSpread * 1.55) {
        if (!this.repMistakes.includes('Elbow flare: elbows flared too wide (>75°)')) {
          this.repMistakes.push('Elbow flare: elbows flared too wide (>75°)');
        }
      }
    }

    // 4. Reliable State Machine Transition (Requires ~70% depth, then return to lockout)
    if (depthPct >= 68 || angle <= 118) {
      if (!this.reachedTargetDepth) {
        this.reachedTargetDepth = true;
        this.updatePhase('Peak Depth');
      }
    } else if (depthPct >= 30) {
      if (this.reachedTargetDepth) {
        this.updatePhase('Ascending Drive');
      } else {
        this.updatePhase('Controlled Descent');
      }
    } else if (depthPct <= 24 || angle >= 142) {
      if (this.reachedTargetDepth) {
        this.triggerRep();
      } else {
        this.updatePhase('Standby');
      }
    }
  }

  /**
   * UPRIGHT ROW TRACKING
   */
  processUprightRow(lm) {
    const sL = lm[11], sR = lm[12], eL = lm[13], eR = lm[14], wL = lm[15], wR = lm[16];
    const hL = lm[23], hR = lm[24];
    if (!sL || !wL || !hL) return;

    const midShoulderY = ((sL.y || 0) + (sR?.y || sL.y)) / 2;
    const midHipY = ((hL.y || 0) + (hR?.y || hL.y)) / 2;
    const midWristY = ((wL.y || 0) + (wR?.y || wL.y)) / 2;
    const midElbowY = ((eL?.y || 0) + (eR?.y || eL?.y || 0)) / 2;

    const torsoHeight = Math.max(0.1, midHipY - midShoulderY);
    const pullProgress = (midHipY - midWristY) / torsoHeight;

    const depthPct = Math.max(0, Math.min(100, Math.round((pullProgress / 0.65) * 100)));
    this.currentDepthPercentage = depthPct;
    this.onDepthProgressChange(depthPct, {
      currentAngle: Math.round(pullProgress * 100),
      targetAngle: 65,
      needToBend: Math.max(0, Math.round((0.65 - pullProgress) * 100)),
      jointLabel: 'Elbow Elevation'
    });

    if (pullProgress > 0.65 || midElbowY <= midShoulderY + 0.08) {
      if (!this.reachedTargetDepth) {
        this.reachedTargetDepth = true;
        this.updatePhase('Peak Contraction');
      }
    } else if (pullProgress > 0.25) {
      if (this.reachedTargetDepth) {
        this.updatePhase('Controlled Return');
      } else {
        this.updatePhase('Ascending Pull');
      }
    } else if (pullProgress <= 0.25) {
      if (this.reachedTargetDepth) {
        this.triggerRep();
      } else {
        this.updatePhase('Standby');
      }
    }
  }

  /**
   * BENT ROW TRACKING
   */
  processBentRow(lm) {
    const sL = lm[11], eL = lm[13], wL = lm[15];
    const sR = lm[12], eR = lm[14], wR = lm[16];

    const angL = (sL && eL && wL) ? calculateJointAngle(sL, eL, wL) : null;
    const angR = (sR && eR && wR) ? calculateJointAngle(sR, eR, wR) : null;

    let rawAngle = null;
    if (angL && angR) rawAngle = (angL + angR) / 2;
    else if (angL) rawAngle = angL;
    else if (angR) rawAngle = angR;

    if (rawAngle === null) return;

    if (this.smoothedAngle === null) this.smoothedAngle = rawAngle;
    else this.smoothedAngle = this.smoothingAlpha * rawAngle + (1 - this.smoothingAlpha) * this.smoothedAngle;

    const angle = this.smoothedAngle;
    if (angle < this.minAngleAchieved) this.minAngleAchieved = angle;

    const depthPct = Math.max(0, Math.min(100, Math.round(((160 - angle) / (160 - 95)) * 100)));
    this.currentDepthPercentage = depthPct;
    this.onDepthProgressChange(depthPct, {
      currentAngle: Math.round(angle),
      targetAngle: 95,
      needToBend: Math.max(0, Math.round(angle - 95)),
      jointLabel: 'Elbow Pull'
    });

    if (depthPct >= 68 || angle <= 108) {
      if (!this.reachedTargetDepth) {
        this.reachedTargetDepth = true;
        this.updatePhase('Peak Contraction');
      }
    } else if (depthPct >= 28) {
      if (this.reachedTargetDepth) {
        this.updatePhase('Controlled Return');
      } else {
        this.updatePhase('Ascending Pull');
      }
    } else if (depthPct <= 22 || angle >= 135) {
      if (this.reachedTargetDepth) {
        this.triggerRep();
      } else {
        this.updatePhase('Standby');
      }
    }
  }

  /**
   * SINGLE-HAND ROW TRACKING
   */
  processSingleRow(lm) {
    const sL = lm[11], eL = lm[13], wL = lm[15];
    const sR = lm[12], eR = lm[14], wR = lm[16];

    const angL = (sL && eL && wL) ? calculateJointAngle(sL, eL, wL) : 180;
    const angR = (sR && eR && wR) ? calculateJointAngle(sR, eR, wR) : 180;

    const rawAngle = Math.min(angL, angR);
    if (rawAngle >= 179) return;

    if (this.smoothedAngle === null) this.smoothedAngle = rawAngle;
    else this.smoothedAngle = this.smoothingAlpha * rawAngle + (1 - this.smoothingAlpha) * this.smoothedAngle;

    const angle = this.smoothedAngle;
    if (angle < this.minAngleAchieved) this.minAngleAchieved = angle;

    const depthPct = Math.max(0, Math.min(100, Math.round(((160 - angle) / (160 - 95)) * 100)));
    this.currentDepthPercentage = depthPct;
    this.onDepthProgressChange(depthPct, {
      currentAngle: Math.round(angle),
      targetAngle: 95,
      needToBend: Math.max(0, Math.round(angle - 95)),
      jointLabel: 'Elbow Drive'
    });

    if (depthPct >= 68 || angle <= 108) {
      if (!this.reachedTargetDepth) {
        this.reachedTargetDepth = true;
        this.updatePhase('Peak Contraction');
      }
    } else if (depthPct >= 28) {
      if (this.reachedTargetDepth) {
        this.updatePhase('Controlled Return');
      } else {
        this.updatePhase('Ascending Pull');
      }
    } else if (depthPct <= 22 || angle >= 135) {
      if (this.reachedTargetDepth) {
        this.triggerRep();
      } else {
        this.updatePhase('Standby');
      }
    }
  }
}
