// Formanti-Inspired Modular Exercise Validation Engines
// Each exercise has independent:
// - Required landmarks
// - Camera angle requirements
// - Position validation (TOP and BOTTOM benchmarks)
// - Joint-angle thresholds (configurable)
// - Movement phases
// - Repetition completion conditions
// - Form error diagnostics

import { calculateJointAngle } from './angleCalculator.js';

/**
 * Calculates 3-point angle in degrees between three landmarks
 */
function getAngle(a, b, c) {
  if (!a || !b || !c) return null;
  return calculateJointAngle(a, b, c);
}

/**
 * Calculates alignment angle (180° = perfectly straight line)
 */
function getAlignmentAngle(p1, p2, p3) {
  if (!p1 || !p2 || !p3) return 180;
  return calculateJointAngle(p1, p2, p3);
}

// ============================================================================
// ============================================================================
// 1. PUSH-UP VALIDATOR (Multi-Signal, Perspective-Adaptive, Decoupled Rep Engine)
// ============================================================================
export const PushUpValidator = {
  id: 'pushups',
  name: 'Push-ups',
  
  // Configurable biomechanical thresholds (Formanti coaching ranges: 40°-135° bottom, ~90° target, 138°-180° top)
  thresholds: {
    topElbowMin: 144,         // Natural arm extension lockout: 144° - 180°
    topElbowAcceptable: 140,  // Arm lockout threshold (perspective-tolerant)
    topElbowMax: 180,
    bottomElbowTarget: 90,    // Target depth (~90°)
    bottomElbowMaxSide: 128,  // Bottom inflection trigger range for side profile
    bottomElbowMaxFront: 130, // Bottom inflection trigger range for front/perspective view
    minPlankAlignment: 145,   // Ideal straight shoulder-hip-ankle line (degrees)
    minShoulderDispDown: 0.030, // Minimum vertical downward displacement of shoulder
    minRangeOfMotionDeg: 20,  // Minimum degrees traveled between top and bottom
    topHoldDwellMs: 80,       // Stable hold at top
    bottomDwellMs: 60         // Controlled inflection at bottom
  },

  validateStartingPosition(landmarks) {
    if (!landmarks || landmarks.length < 29) {
      return { isValid: false, reason: 'Body not detected in frame.' };
    }

    const sL = landmarks[11], sR = landmarks[12];
    const eL = landmarks[13], eR = landmarks[14];
    const wL = landmarks[15], wR = landmarks[16];
    const hL = landmarks[23], hR = landmarks[24];
    const aL = landmarks[27], aR = landmarks[28];
    const kL = landmarks[25], kR = landmarks[26];

    if (!sL && !sR) {
      return { isValid: false, reason: 'Upper body not detected in frame.' };
    }

    // Determine dominant side facing the camera based on visibility
    const visLeft = ((sL?.visibility ?? 0.8) + (hL?.visibility ?? 0.8)) / 2;
    const visRight = ((sR?.visibility ?? 0.8) + (hR?.visibility ?? 0.8)) / 2;
    const useRight = visRight > visLeft;
    const s = useRight ? (sR || sL) : (sL || sR);
    const h = useRight ? (hR || hL) : (hL || hR);
    const a = useRight ? (aR || kR || aL) : (aL || kL || aR);

    // 1. Must be in a horizontal plank (reject standing upright)
    // When standing: body is vertical with ankles directly beneath shoulders (dyBody > 0.35, dxBody < 0.25)
    const dxBody = (s && a) ? Math.abs(a.x - s.x) : 0;
    const dyBody = (s && a) ? (a.y - s.y) : 0;
    const dyTorso = (s && h) ? (h.y - s.y) : 0;
    const isStanding = (dyBody > 0.35 && dxBody < 0.25) || (dyTorso > 0.24 && dxBody < 0.20);
    if (isStanding) {
      return { 
        isValid: false, 
        reason: 'You are standing upright. Move into push-up position.' 
      };
    }

    // 2. Check arm extension for starting top position
    const angElbowL = (sL && eL && wL) ? getAngle(sL, eL, wL) : null;
    const angElbowR = (sR && eR && wR) ? getAngle(sR, eR, wR) : null;
    let startingElbow = 160;
    if (angElbowL !== null && angElbowR !== null) {
      startingElbow = Math.abs(visLeft - visRight) > 0.15 
        ? (visRight > visLeft ? angElbowR : angElbowL) 
        : Math.min(angElbowL, angElbowR);
    } else if (angElbowL !== null) {
      startingElbow = angElbowL;
    } else if (angElbowR !== null) {
      startingElbow = angElbowR;
    }

    if (startingElbow < this.thresholds.topElbowAcceptable) {
      return { 
        isValid: false, 
        reason: 'Extend your arms to lock into the starting top plank position.' 
      };
    }

    // 3. Body alignment check (warning if sagging heavily, but allows calibration to proceed)
    const alignAngle = (s && h && a) ? getAlignmentAngle(s, h, a) : 170;
    if (alignAngle < 135) {
      return { 
        isValid: false, 
        reason: 'Align your hips with your shoulders to establish your starting plank.' 
      };
    }

    return { 
      isValid: true, 
      reason: 'Push-up position detected. Start exercising.' 
    };
  },

  validateTopPosition(landmarks, telemetry, baseline = null) {
    const elbow = telemetry.elbowAngle || telemetry.primaryAngle || 160;
    const hipAlignment = telemetry.hipAlignment || 170;

    // Repetition validation is decoupled from strict plank perfection:
    // Arms extended within reasonable tolerance allows rep completion
    const isArmExtended = elbow >= this.thresholds.topElbowMin;
    const isAcceptable = elbow >= this.thresholds.topElbowAcceptable;
    const isPlankStraight = hipAlignment >= this.thresholds.minPlankAlignment;

    const errors = [];
    if (!isArmExtended && !isAcceptable) {
      errors.push('Extend arms fully at top of push-up.');
    }
    if (hipAlignment < 152) {
      errors.push('Hips sagging: maintain straight line from shoulders to ankles.');
    } else if (hipAlignment > 195) {
      errors.push('Hips piked too high.');
    }

    return {
      isTop: isArmExtended || isAcceptable,
      isAcceptable: isAcceptable,
      isOptimal: isArmExtended && isPlankStraight,
      errors
    };
  },

  validateBottomPosition(landmarks, telemetry, baseline = null) {
    const elbow = telemetry.elbowAngle || telemetry.primaryAngle || 120;
    const isFrontView = telemetry.isFrontView || false;
    const maxBottom = isFrontView ? this.thresholds.bottomElbowMaxFront : this.thresholds.bottomElbowMaxSide;
    const reachedDepth = elbow <= maxBottom;
    const isOptimal90 = elbow <= (this.thresholds.bottomElbowTarget + 10);
    const isPlankMaintained = telemetry.hipAlignment >= 145;

    const errors = [];
    if (!reachedDepth) {
      errors.push(`Incomplete depth: reached ${elbow}°. Lower chest further toward 90°.`);
    }
    if (telemetry.hipAlignment < 150) {
      errors.push('Hips are sagging toward the floor at the bottom.');
    }

    return {
      isBottom: reachedDepth,
      isOptimal: isOptimal90 && isPlankMaintained,
      errors
    };
  },

  evaluateRepForm(telemetry, faults = [], peakDepth = 90, durationSec = 2.0) {
    let score = 100;
    const mistakes = [];
    const goodPoints = [];

    // 1. Depth scoring
    if (peakDepth <= 96) {
      goodPoints.push('Full 90° chest-to-floor depth achieved.');
    } else if (peakDepth <= 112) {
      score -= 10;
      goodPoints.push('Good active chest descent depth.');
      mistakes.push(`Depth reached ${peakDepth}° (aim for 90° for full chest activation).`);
    } else {
      score -= 22;
      mistakes.push(`Partial depth reached (${peakDepth}°). Try lowering your chest closer to the floor.`);
    }

    // 2. Hip Alignment scoring
    const hasHipSag = faults.some(f => f.toLowerCase().includes('sag')) || (telemetry.hipAlignment && telemetry.hipAlignment < 150);
    const hasHipPike = faults.some(f => f.toLowerCase().includes('pike')) || (telemetry.hipAlignment && telemetry.hipAlignment > 195);

    if (hasHipSag) {
      score -= 20;
      mistakes.push('Lower back / hip sagging: keep core braced in a straight plank line.');
    } else if (hasHipPike) {
      score -= 15;
      mistakes.push('Hips elevated / piked: lower hips into neutral plank.');
    } else {
      goodPoints.push('Solid unbroken spinal plank alignment.');
    }

    // 3. Elbow Flare scoring
    if (telemetry.isElbowFlaring || faults.some(f => f.toLowerCase().includes('flare'))) {
      score -= 10;
      mistakes.push('Elbows flared wide: tuck elbows at ~45° arrow angle to ribs.');
    } else {
      goodPoints.push('Controlled elbow tuck maintained.');
    }

    // 4. Cadence & Control
    const durNum = parseFloat(durationSec) || 2.0;
    if (durNum >= 1.5 && durNum <= 4.0) {
      goodPoints.push('Smooth controlled lowering and drive tempo.');
    } else if (durNum < 1.5) {
      score -= 5;
      mistakes.push('Movement was rushed: control the lowering phase.');
    }

    if (goodPoints.length === 0) {
      goodPoints.push('Completed full push-up movement cycle.');
    }

    score = Math.max(50, Math.min(100, Math.round(score)));
    const category = score >= 85 ? 'completed_clean' : 'completed_imperfect';
    const rating = score >= 90 ? 'Optimal Form' : (score >= 80 ? 'Good Form' : 'Imperfect Form (Needs Adjustment)');

    return {
      score,
      category,
      rating,
      mistakes,
      goodPoints,
      howToImprove: mistakes[0] || 'Keep this solid cadence.'
    };
  },

  computeTelemetry(landmarks) {
    if (!landmarks || landmarks.length < 29) {
      return {
        elbowAngle: 160,
        primaryAngle: 160,
        leftElbowAngle: 160,
        rightElbowAngle: 160,
        dominantSide: 'both',
        dominantConfidence: 0,
        isFrontView: false,
        shoulderY: 0.5,
        hipY: 0.5,
        wristY: 0.7,
        hipAlignment: 170,
        isElbowFlaring: false,
        depthPercentage: 0,
        needToBend: 70,
        targetAngle: 90,
        jointLabel: 'Elbow'
      };
    }

    const sL = landmarks[11], sR = landmarks[12];
    const eL = landmarks[13], eR = landmarks[14];
    const wL = landmarks[15], wR = landmarks[16];
    const hL = landmarks[23], hR = landmarks[24];
    const kL = landmarks[25], kR = landmarks[26];
    const aL = landmarks[27], aR = landmarks[28];

    // Compute left and right 3-point elbow angles
    const angL = (sL && eL && wL) ? getAngle(sL, eL, wL) : null;
    const angR = (sR && eR && wR) ? getAngle(sR, eR, wR) : null;
    const visL = ((sL?.visibility ?? 0.8) + (eL?.visibility ?? 0.8) + (wL?.visibility ?? 0.8)) / 3;
    const visR = ((sR?.visibility ?? 0.8) + (eR?.visibility ?? 0.8) + (wR?.visibility ?? 0.8)) / 3;

    // Detect camera perspective:
    // In front view: both shoulders & wrists visible and widely spaced horizontally
    let isFrontView = false;
    if (sL && sR && wL && wR) {
      const shoulderSpreadX = Math.abs(sR.x - sL.x);
      const wristSpreadX = Math.abs(wR.x - wL.x);
      if (shoulderSpreadX > 0.14 || wristSpreadX > 0.18) {
        isFrontView = true;
      }
    }

    // Determine dominant side and primary elbow angle
    let dominantSide = 'both';
    let dominantConfidence = Math.max(visL, visR);
    let elbowAngle = 160;

    if (angL !== null && angR !== null) {
      if (isFrontView) {
        dominantSide = 'both';
        dominantConfidence = (visL + visR) / 2;
        // In front view, pick the clearer angle or minimum (deepest flex)
        elbowAngle = Math.min(angL, angR);
      } else if (visR > visL + 0.10) {
        dominantSide = 'right';
        dominantConfidence = visR;
        elbowAngle = angR;
      } else if (visL > visR + 0.10) {
        dominantSide = 'left';
        dominantConfidence = visL;
        elbowAngle = angL;
      } else {
        dominantSide = visR > visL ? 'right' : 'left';
        dominantConfidence = Math.max(visL, visR);
        // When visibilities are close, pick the arm showing true flexion
        elbowAngle = Math.min(angL, angR);
      }
    } else if (angL !== null) {
      dominantSide = 'left';
      dominantConfidence = visL;
      elbowAngle = angL;
    } else if (angR !== null) {
      dominantSide = 'right';
      dominantConfidence = visR;
      elbowAngle = angR;
    }

    // Dominant side alignment (shoulder -> hip -> ankle)
    const visSideL = ((sL?.visibility ?? 0.8) + (hL?.visibility ?? 0.8) + (aL?.visibility ?? 0.8)) / 3;
    const visSideR = ((sR?.visibility ?? 0.8) + (hR?.visibility ?? 0.8) + (aR?.visibility ?? 0.8)) / 3;
    const useRight = dominantSide === 'right' || (dominantSide === 'both' && visSideR > visSideL);
    const domS = useRight ? (sR || sL) : (sL || sR);
    const domH = useRight ? (hR || hL) : (hL || hR);
    const domA = useRight ? (aR || kR || aL) : (aL || kL || aR);

    const hipAlignment = (domS && domH && domA) ? Math.round(getAlignmentAngle(domS, domH, domA)) : 170;

    // Vertical Y positions (normalized 0 to 1, increases downward)
    const shoulderY = (domS?.y !== undefined) 
      ? (isFrontView && sL && sR ? (sL.y + sR.y) / 2 : domS.y)
      : 0.5;
    const hipY = (domH?.y !== undefined)
      ? (isFrontView && hL && hR ? (hL.y + hR.y) / 2 : domH.y)
      : 0.5;
    const wristY = (wL && wR) ? (wL.y + wR.y) / 2 : (wL?.y || wR?.y || 0.7);

    // Elbow flare check (wide flare > 1.55x shoulder spread)
    let isElbowFlaring = false;
    if (sL && sR && eL && eR) {
      const shoulderSpread = Math.abs(sR.x - sL.x);
      const elbowSpread = Math.abs(eR.x - eL.x);
      if (elbowSpread > shoulderSpread * 1.55) {
        isElbowFlaring = true;
      }
    }

    // Shoulder angles (Elbow -> Shoulder -> Hip)
    const angShoulderL = (eL && sL && hL) ? getAngle(eL, sL, hL) : null;
    const angShoulderR = (eR && sR && hR) ? getAngle(eR, sR, hR) : null;

    // Knee angle (Hip -> Knee -> Ankle)
    const angKneeL = (hL && kL && aL) ? getAngle(hL, kL, aL) : null;
    const angKneeR = (hR && kR && aR) ? getAngle(hR, kR, aR) : null;
    const kneeAngle = angKneeL !== null ? angKneeL : (angKneeR !== null ? angKneeR : 170);

    // Landmark visibility count & Missing required joints check (Requirement 2 & 3)
    let visibleLandmarksCount = 0;
    for (let i = 0; i < landmarks.length; i++) {
      if ((landmarks[i]?.visibility ?? 0.8) >= 0.35) visibleLandmarksCount++;
    }

    const keyJointDefs = [
      { id: 11, name: 'Left Shoulder' },
      { id: 12, name: 'Right Shoulder' },
      { id: 13, name: 'Left Elbow' },
      { id: 14, name: 'Right Elbow' },
      { id: 15, name: 'Left Wrist' },
      { id: 16, name: 'Right Wrist' },
      { id: 23, name: 'Left Hip' },
      { id: 24, name: 'Right Hip' },
      { id: 25, name: 'Left Knee' },
      { id: 26, name: 'Right Knee' },
      { id: 27, name: 'Left Ankle' },
      { id: 28, name: 'Right Ankle' },
    ];
    const missingRequiredJoints = keyJointDefs
      .filter(j => !landmarks[j.id] || (landmarks[j.id].visibility !== undefined && landmarks[j.id].visibility < 0.35))
      .map(j => j.name);

    // Depth percentage & angle need to bend
    // In front view, 160° -> 0%, 105° -> 100%
    // In side view, 160° -> 0%, 90° -> 100%
    const targetAngle = isFrontView ? 100 : 90;
    const topLockAngle = 160;
    const depthPercentage = Math.max(0, Math.min(100, Math.round(((topLockAngle - elbowAngle) / (topLockAngle - targetAngle)) * 100)));
    const needToBend = Math.max(0, Math.round(elbowAngle - targetAngle));

    return {
      elbowAngle: Math.round(elbowAngle),
      primaryAngle: Math.round(elbowAngle),
      leftElbowAngle: angL !== null ? Math.round(angL) : null,
      rightElbowAngle: angR !== null ? Math.round(angR) : null,
      leftShoulderAngle: angShoulderL !== null ? Math.round(angShoulderL) : 90,
      rightShoulderAngle: angShoulderR !== null ? Math.round(angShoulderR) : 90,
      kneeAngle: Math.round(kneeAngle),
      visibleLandmarksCount,
      missingRequiredJoints,
      dominantSide,
      dominantConfidence: Math.round(dominantConfidence * 100),
      isFrontView,
      shoulderY,
      hipY,
      wristY,
      hipAlignment,
      isElbowFlaring,
      depthPercentage,
      needToBend,
      targetAngle,
      jointLabel: 'Elbow'
    };
  }
};

// ============================================================================
// 2. SQUAT VALIDATOR
// ============================================================================
export const SquatValidator = {
  id: 'weighted-squats',
  name: 'Weighted Squats',

  thresholds: {
    topKneeMin: 140,        // Standing upright lockout (>= 140°)
    bottomKneeTarget: 90,   // Full parallel depth (~90°)
    bottomKneeMax: 115,     // Acceptable parallel (<= 115°)
    bottomKneeMin: 65,
    minTorsoAngle: 45,      // Do not collapse chest forward
    minRangeOfMotion: 30,
    topHoldDwellMs: 80,
    bottomDwellMs: 60
  },

  validateStartingPosition(landmarks) {
    const sL = landmarks[11];
    const hL = landmarks[23], hR = landmarks[24];
    const kL = landmarks[25], kR = landmarks[26];
    const aL = landmarks[27], aR = landmarks[28];

    if (!hL || !kL) {
      return { isValid: false, reason: 'Stand upright with full body in frame.' };
    }

    // Must be standing upright
    const angKneeL = (hL && kL && aL) ? getAngle(hL, kL, aL) : 170;
    const angKneeR = (hR && kR && aR) ? getAngle(hR, kR, aR) : 170;
    const avgKnee = (angKneeL + angKneeR) / 2;

    if (avgKnee < this.thresholds.topKneeMin - 10) {
      return { isValid: false, reason: 'Stand tall with knees extended to calibrate.' };
    }

    return { isValid: true, reason: '✓ Standing stance verified! Begin your squats.' };
  },

  validateTopPosition(landmarks, telemetry) {
    const knee = telemetry.kneeAngle || 170;
    const isExtended = knee >= this.thresholds.topKneeMin;
    return {
      isTop: isExtended,
      isAcceptable: isExtended,
      errors: isExtended ? [] : ['Stand upright and fully extend knees at the top.']
    };
  },

  validateBottomPosition(landmarks, telemetry) {
    const knee = telemetry.kneeAngle || 110;
    const reachedDepth = knee <= this.thresholds.bottomKneeMax;
    const isParallel = knee <= this.thresholds.bottomKneeTarget + 5;

    const errors = [];
    if (!reachedDepth) errors.push('Lower your hips until thighs are parallel to the floor.');
    if (telemetry.isKneeValgus) errors.push('Push your knees outward in line with your toes.');

    return {
      isBottom: reachedDepth,
      isOptimal: isParallel && !telemetry.isKneeValgus,
      errors
    };
  },

  computeTelemetry(landmarks) {
    if (!landmarks || landmarks.length < 29) {
      return {
        kneeAngle: 170,
        isKneeValgus: false,
        depthPercentage: 0,
        needToBend: 80,
        primaryAngle: 170,
        targetAngle: 90,
        jointLabel: 'Knee',
        leftElbowAngle: 160,
        rightElbowAngle: 160,
        leftShoulderAngle: 90,
        rightShoulderAngle: 90,
        hipAlignment: 170,
        visibleLandmarksCount: 0,
        missingRequiredJoints: ['Full Body Required']
      };
    }

    const hL = landmarks[23], hR = landmarks[24];
    const kL = landmarks[25], kR = landmarks[26];
    const aL = landmarks[27], aR = landmarks[28];
    const sL = landmarks[11], sR = landmarks[12];
    const eL = landmarks[13], eR = landmarks[14];
    const wL = landmarks[15], wR = landmarks[16];

    const angL = (hL && kL && aL) ? getAngle(hL, kL, aL) : null;
    const angR = (hR && kR && aR) ? getAngle(hR, kR, aR) : null;
    const kneeAngle = angL !== null && angR !== null ? (angL + angR) / 2 : (angL || angR || 170);

    const angElbowL = (sL && eL && wL) ? getAngle(sL, eL, wL) : 160;
    const angElbowR = (sR && eR && wR) ? getAngle(sR, eR, wR) : 160;
    const angShoulderL = (eL && sL && hL) ? getAngle(eL, sL, hL) : 90;
    const angShoulderR = (eR && sR && hR) ? getAngle(eR, sR, hR) : 90;
    const hipAlignment = (sL && hL && aL) ? getAngle(sL, hL, aL) : 170;

    let visibleLandmarksCount = 0;
    for (let i = 0; i < landmarks.length; i++) {
      if ((landmarks[i]?.visibility ?? 0.8) >= 0.35) visibleLandmarksCount++;
    }

    const keyJointDefs = [
      { id: 11, name: 'Left Shoulder' }, { id: 12, name: 'Right Shoulder' },
      { id: 13, name: 'Left Elbow' }, { id: 14, name: 'Right Elbow' },
      { id: 15, name: 'Left Wrist' }, { id: 16, name: 'Right Wrist' },
      { id: 23, name: 'Left Hip' }, { id: 24, name: 'Right Hip' },
      { id: 25, name: 'Left Knee' }, { id: 26, name: 'Right Knee' },
      { id: 27, name: 'Left Ankle' }, { id: 28, name: 'Right Ankle' },
    ];
    const missingRequiredJoints = keyJointDefs
      .filter(j => !landmarks[j.id] || (landmarks[j.id].visibility !== undefined && landmarks[j.id].visibility < 0.35))
      .map(j => j.name);

    // Valgus check: distance between knees vs distance between ankles
    let isKneeValgus = false;
    if (kL && kR && aL && aR) {
      const kneeDist = Math.abs(kR.x - kL.x);
      const ankleDist = Math.abs(aR.x - aL.x);
      if (kneeDist < ankleDist * 0.78 && kneeAngle < 125) {
        isKneeValgus = true;
      }
    }

    // Depth percentage: 148° = 0%, 90° = 100%
    const depthPercentage = Math.max(0, Math.min(100, Math.round(((148 - kneeAngle) / (148 - 90)) * 100)));
    const needToBend = Math.max(0, Math.round(kneeAngle - 90));

    return {
      kneeAngle: Math.round(kneeAngle),
      leftElbowAngle: Math.round(angElbowL),
      rightElbowAngle: Math.round(angElbowR),
      leftShoulderAngle: Math.round(angShoulderL),
      rightShoulderAngle: Math.round(angShoulderR),
      hipAlignment: Math.round(hipAlignment),
      visibleLandmarksCount,
      missingRequiredJoints,
      isKneeValgus,
      depthPercentage,
      needToBend,
      primaryAngle: Math.round(kneeAngle),
      targetAngle: 90,
      jointLabel: 'Knee'
    };
  }
};

// ============================================================================
// 3. UPRIGHT DUMBBELL ROW VALIDATOR
// ============================================================================
export const UprightRowValidator = {
  id: 'upright-dumbbell-row',
  name: 'Upright Dumbbell Row',

  thresholds: {
    topElbowHeightRatio: 0.60, // Elbows rise toward shoulder level
    bottomArmsExtended: 140,
    minRangeOfMotion: 40
  },

  validateStartingPosition(landmarks) {
    const sL = landmarks[11], wL = landmarks[15], hL = landmarks[23];
    if (!sL || !wL || !hL) return { isValid: false, reason: 'Stand in frame holding weights.' };

    const areArmsDown = wL.y > hL.y - 0.20;
    return {
      isValid: areArmsDown,
      reason: areArmsDown ? '✓ Starting stance locked! Begin rows.' : 'Hold weights down at thighs with tall posture.'
    };
  },

  validateTopPosition(landmarks, telemetry) {
    const isAtPeak = telemetry.pullProgress >= 70;
    return {
      isTop: isAtPeak,
      isAcceptable: isAtPeak,
      errors: isAtPeak ? [] : ['Drive your elbows up toward collarbone level.']
    };
  },

  validateBottomPosition(landmarks, telemetry) {
    const isDown = telemetry.pullProgress <= 25;
    return {
      isBottom: isDown,
      isOptimal: isDown,
      errors: isDown ? [] : ['Lower weights fully with control in front of thighs.']
    };
  },

  computeTelemetry(landmarks) {
    const sL = landmarks[11], sR = landmarks[12];
    const hL = landmarks[23], hR = landmarks[24];
    const wL = landmarks[15], wR = landmarks[16];

    const midShoulderY = ((sL?.y || 0) + (sR?.y || sL?.y || 0)) / 2;
    const midHipY = ((hL?.y || 0) + (hR?.y || hL?.y || 0)) / 2;
    const midWristY = ((wL?.y || 0) + (wR?.y || wL?.y || 0)) / 2;

    const torsoH = Math.max(0.12, midHipY - midShoulderY);
    const pullProgress = Math.max(0, Math.min(100, Math.round(((midHipY - midWristY) / (torsoH * 0.70)) * 100)));

    return {
      pullProgress,
      depthPercentage: pullProgress,
      needToBend: Math.max(0, 100 - pullProgress),
      primaryAngle: pullProgress,
      targetAngle: 100,
      jointLabel: 'Elbow Elevation'
    };
  }
};

// ============================================================================
// 4. BENT-OVER DUMBBELL ROW VALIDATOR
// ============================================================================
export const BentOverRowValidator = {
  id: 'forward-dumbbell-row',
  name: 'Forward Dumbbell Row',

  thresholds: {
    minHingeAngle: 35,
    maxHingeAngle: 65,
    peakPullElbowAngle: 85
  },

  validateStartingPosition(landmarks) {
    const sL = landmarks[11], hL = landmarks[23], wL = landmarks[15];
    if (!sL || !hL) return { isValid: false, reason: 'Stand in frame hinged at hips.' };

    const isHinged = (hL.y - sL.y) < 0.45;
    return {
      isValid: isHinged,
      reason: isHinged ? '✓ 45° Hip hinge locked! Begin rows.' : 'Hinge hips back at 45° with flat back.'
    };
  },

  validateTopPosition(landmarks, telemetry) {
    const isPeak = telemetry.pullProgress >= 70;
    return {
      isTop: isPeak,
      isAcceptable: isPeak,
      errors: isPeak ? [] : ['Drive elbows high past ribs and squeeze lats.']
    };
  },

  validateBottomPosition(landmarks, telemetry) {
    const isExtended = telemetry.pullProgress <= 25;
    return {
      isBottom: isExtended,
      isOptimal: isExtended,
      errors: isExtended ? [] : ['Extend arms fully downward without rounding spine.']
    };
  },

  computeTelemetry(landmarks) {
    const sL = landmarks[11], eL = landmarks[13], wL = landmarks[15];
    const elbowAngle = (sL && eL && wL) ? getAngle(sL, eL, wL) : 150;
    const pullProgress = Math.max(0, Math.min(100, Math.round(((160 - elbowAngle) / (160 - 80)) * 100)));

    return {
      pullProgress,
      depthPercentage: pullProgress,
      needToBend: Math.max(0, 100 - pullProgress),
      primaryAngle: Math.round(elbowAngle),
      targetAngle: 80,
      jointLabel: 'Lat Contraction'
    };
  }
};

// ============================================================================
// 5. SINGLE-HAND DUMBBELL ROW VALIDATOR
// ============================================================================
export const SingleRowValidator = {
  ...BentOverRowValidator,
  id: 'single-dumbbell-row',
  name: 'Single-Hand Dumbbell Row'
};

// ============================================================================
// 6. FORWARD LUNGES VALIDATOR
// ============================================================================
export const LungeValidator = {
  id: 'lunges',
  name: 'Forward Lunges',

  thresholds: {
    topKneeMin: 155,
    bottomKneeTarget: 90,
    bottomKneeMax: 112,
    minRangeOfMotion: 40
  },

  validateStartingPosition(landmarks) {
    const hL = landmarks[23], kL = landmarks[25];
    if (!hL || !kL) return { isValid: false, reason: 'Stand upright in frame.' };
    return { isValid: true, reason: '✓ Standing stance verified! Step into lunge.' };
  },

  validateTopPosition(landmarks, telemetry) {
    const isUpright = telemetry.primaryAngle >= this.thresholds.topKneeMin;
    return {
      isTop: isUpright,
      isAcceptable: isUpright,
      errors: isUpright ? [] : ['Step back and stand tall at the top.']
    };
  },

  validateBottomPosition(landmarks, telemetry) {
    const reached = telemetry.primaryAngle <= this.thresholds.bottomKneeMax;
    return {
      isBottom: reached,
      isOptimal: telemetry.primaryAngle <= 95,
      errors: reached ? [] : ['Lower hips until front knee reaches 90°.']
    };
  },

  computeTelemetry(landmarks) {
    const hL = landmarks[23], hR = landmarks[24];
    const kL = landmarks[25], kR = landmarks[26];
    const aL = landmarks[27], aR = landmarks[28];

    const angL = (hL && kL && aL) ? getAngle(hL, kL, aL) : 170;
    const angR = (hR && kR && aR) ? getAngle(hR, kR, aR) : 170;
    // Front knee is the one flexing more
    const kneeAngle = Math.min(angL, angR);
    const depthPercentage = Math.max(0, Math.min(100, Math.round(((165 - kneeAngle) / (165 - 90)) * 100)));

    return {
      kneeAngle: Math.round(kneeAngle),
      depthPercentage,
      needToBend: Math.max(0, Math.round(kneeAngle - 90)),
      primaryAngle: Math.round(kneeAngle),
      targetAngle: 90,
      jointLabel: 'Lunge Depth'
    };
  }
};

// ============================================================================
// 7. BICEP CURLS VALIDATOR
// ============================================================================
export const BicepCurlValidator = {
  id: 'bicep-curls',
  name: 'Bicep Curls',

  thresholds: {
    bottomElbowMin: 145,
    topElbowTarget: 50,
    topElbowMax: 70,
    minRangeOfMotion: 60
  },

  validateStartingPosition(landmarks) {
    const sL = landmarks[11], eL = landmarks[13], wL = landmarks[15];
    if (!sL || !eL || !wL) return { isValid: false, reason: 'Stand with weights at sides.' };
    return { isValid: true, reason: '✓ Arms extended at sides! Begin curling.' };
  },

  validateTopPosition(landmarks, telemetry) {
    const isCurled = telemetry.primaryAngle <= this.thresholds.topElbowMax;
    return {
      isTop: isCurled,
      isAcceptable: isCurled,
      errors: isCurled ? [] : ['Curl weights all the way to shoulder height.']
    };
  },

  validateBottomPosition(landmarks, telemetry) {
    const isExtended = telemetry.primaryAngle >= this.thresholds.bottomElbowMin;
    return {
      isBottom: isExtended,
      isOptimal: isExtended,
      errors: isExtended ? [] : ['Lower weights fully to arm lockout.']
    };
  },

  computeTelemetry(landmarks) {
    const sL = landmarks[11], sR = landmarks[12];
    const eL = landmarks[13], eR = landmarks[14];
    const wL = landmarks[15], wR = landmarks[16];

    const angL = (sL && eL && wL) ? getAngle(sL, eL, wL) : 160;
    const angR = (sR && eR && wR) ? getAngle(sR, eR, wR) : 160;
    const elbowAngle = (angL + angR) / 2;
    const curlProgress = Math.max(0, Math.min(100, Math.round(((160 - elbowAngle) / (160 - 50)) * 100)));

    return {
      elbowAngle: Math.round(elbowAngle),
      depthPercentage: curlProgress,
      needToBend: Math.max(0, Math.round(elbowAngle - 50)),
      primaryAngle: Math.round(elbowAngle),
      targetAngle: 50,
      jointLabel: 'Bicep Squeeze'
    };
  }
};

// ============================================================================
// 8. OVERHEAD SHOULDER PRESS VALIDATOR
// ============================================================================
export const ShoulderPressValidator = {
  id: 'shoulder-press',
  name: 'Overhead Shoulder Press',

  thresholds: {
    bottomElbowMax: 95,
    topElbowLockout: 160,
    minRangeOfMotion: 50
  },

  validateStartingPosition(landmarks) {
    return { isValid: true, reason: '✓ Weights at shoulder height. Press overhead!' };
  },

  validateTopPosition(landmarks, telemetry) {
    const isOverhead = telemetry.primaryAngle >= this.thresholds.topElbowLockout;
    return {
      isTop: isOverhead,
      isAcceptable: isOverhead,
      errors: isOverhead ? [] : ['Lock out arms fully overhead.']
    };
  },

  validateBottomPosition(landmarks, telemetry) {
    const isAtShoulders = telemetry.primaryAngle <= this.thresholds.bottomElbowMax;
    return {
      isBottom: isAtShoulders,
      isOptimal: isAtShoulders,
      errors: isAtShoulders ? [] : ['Lower elbows down to shoulder/ear level.']
    };
  },

  computeTelemetry(landmarks) {
    const sL = landmarks[11], sR = landmarks[12];
    const eL = landmarks[13], eR = landmarks[14];
    const wL = landmarks[15], wR = landmarks[16];

    const angL = (sL && eL && wL) ? getAngle(sL, eL, wL) : 120;
    const angR = (sR && eR && wR) ? getAngle(sR, eR, wR) : 120;
    const elbowAngle = (angL + angR) / 2;
    const pressProgress = Math.max(0, Math.min(100, Math.round(((elbowAngle - 85) / (165 - 85)) * 100)));

    return {
      elbowAngle: Math.round(elbowAngle),
      depthPercentage: pressProgress,
      needToBend: Math.max(0, Math.round(165 - elbowAngle)),
      primaryAngle: Math.round(elbowAngle),
      targetAngle: 165,
      jointLabel: 'Overhead Lock'
    };
  }
};

// ============================================================================
// 9. CORE PLANK VALIDATOR
// ============================================================================
export const PlankValidator = {
  id: 'planks',
  name: 'Core Plank Hold',

  thresholds: {
    minAlignment: 155
  },

  validateStartingPosition(landmarks) {
    return PushUpValidator.validateStartingPosition(landmarks);
  },

  validateTopPosition(landmarks, telemetry) {
    return { isTop: true, isAcceptable: true, errors: [] };
  },

  validateBottomPosition(landmarks, telemetry) {
    return { isBottom: true, isOptimal: true, errors: [] };
  },

  computeTelemetry(landmarks) {
    const sL = landmarks[11], sR = landmarks[12];
    const hL = landmarks[23], hR = landmarks[24];
    const aL = landmarks[27], aR = landmarks[28];

    const s = sL || sR;
    const h = hL || hR;
    const a = aL || aR;
    const alignment = (s && h && a) ? Math.round(calculateJointAngle(s, h, a)) : 175;

    return {
      hipAlignment: alignment,
      depthPercentage: Math.max(0, Math.min(100, Math.round((alignment / 180) * 100))),
      needToBend: 0,
      primaryAngle: alignment,
      targetAngle: 180,
      jointLabel: 'Plank Alignment'
    };
  }
};

/**
 * Returns the matching exercise validator
 */
export function getExerciseValidator(exerciseId) {
  switch (exerciseId) {
    case 'pushups':
      return PushUpValidator;
    case 'weighted-squats':
    case 'basic-squats':
    case 'squats':
      return SquatValidator;
    case 'lunges':
      return LungeValidator;
    case 'bicep-curls':
      return BicepCurlValidator;
    case 'shoulder-press':
      return ShoulderPressValidator;
    case 'planks':
      return PlankValidator;
    case 'upright-dumbbell-row':
      return UprightRowValidator;
    case 'forward-dumbbell-row':
      return BentOverRowValidator;
    case 'single-dumbbell-row':
      return SingleRowValidator;
    default:
      return SquatValidator;
  }
}

