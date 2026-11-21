// Computer-Vision Exercise Recognition & Kinematic Classifier
// Analyzes landmark sequences across time to detect actual exercise performed,
// preventing mismatching or random movement analysis.

import { calculateJointAngle } from './angleCalculator.js';

function getAngle(a, b, c) {
  if (!a || !b || !c) return 180;
  return calculateJointAngle(a, b, c);
}

/**
 * Classifies an exercise from a sequence of video landmark frames.
 * @param {Array} frames - Array of { timestamp, landmarks, confidence }
 * @param {string} selectedExerciseId - The exercise the user claimed to perform
 * @returns {Object} Classification result with detectedExercise, confidence, isMismatch, reason
 */
export function classifyExerciseFromLandmarks(frames, selectedExerciseId = 'pushups') {
  if (!frames || frames.length < 5) {
    return {
      detectedExercise: 'insufficient-data',
      detectedExerciseName: 'Insufficient Data',
      confidence: 0,
      isMismatch: false,
      reason: 'Video duration or landmark presence is too brief to identify the exercise.',
      isInsufficientData: true
    };
  }

  // Filter valid frames with minimum visible landmarks
  const validFrames = frames.filter(f => f.landmarks && f.landmarks.length >= 29);
  if (validFrames.length < 5) {
    return {
      detectedExercise: 'insufficient-data',
      detectedExerciseName: 'Insufficient Data',
      confidence: 0,
      isMismatch: false,
      reason: 'Body is partially hidden or lighting is too low to accurately detect joints.',
      isInsufficientData: true
    };
  }

  // Sample measurements across frames
  const orientations = []; // Angle from horizontal (0° = flat plank, 90° = vertical standing)
  const elbowAngles = [];
  const kneeAngles = [];
  const hipHeights = [];
  const wristHeights = [];
  const shoulderHeights = [];
  const ankleSeparations = [];

  for (const frame of validFrames) {
    const lm = frame.landmarks;
    const sL = lm[11], sR = lm[12];
    const eL = lm[13], eR = lm[14];
    const wL = lm[15], wR = lm[16];
    const hL = lm[23], hR = lm[24];
    const kL = lm[25], kR = lm[26];
    const aL = lm[27], aR = lm[28];

    const s = sL || sR;
    const h = hL || hR;
    const e = eL || eR;
    const w = wL || wR;
    const k = kL || kR;
    const a = aL || aR;

    if (s && h) {
      // Torso angle from horizontal
      const dx = Math.abs(h.x - s.x);
      const dy = Math.abs(h.y - s.y);
      const angleFromHorizontal = Math.atan2(dy, dx) * (180 / Math.PI);
      orientations.push(angleFromHorizontal);
      hipHeights.push(h.y);
      shoulderHeights.push(s.y);
    }

    if (s && e && w) {
      elbowAngles.push(getAngle(s, e, w));
      wristHeights.push(w.y);
    }

    if (h && k && a) {
      kneeAngles.push(getAngle(h, k, a));
    }

    if (aL && aR) {
      const splitY = Math.abs(aL.y - aR.y);
      const splitX = Math.abs(aL.x - aR.x);
      ankleSeparations.push({ splitX, splitY });
    }
  }

  // Statistical calculations
  const avgOrientation = orientations.length > 0 
    ? orientations.reduce((a, b) => a + b, 0) / orientations.length 
    : 75;

  const minElbow = elbowAngles.length > 0 ? Math.min(...elbowAngles) : 160;
  const maxElbow = elbowAngles.length > 0 ? Math.max(...elbowAngles) : 160;
  const elbowROM = maxElbow - minElbow;

  const minKnee = kneeAngles.length > 0 ? Math.min(...kneeAngles) : 170;
  const maxKnee = kneeAngles.length > 0 ? Math.max(...kneeAngles) : 170;
  const kneeROM = maxKnee - minKnee;

  const minHip = hipHeights.length > 0 ? Math.min(...hipHeights) : 0.5;
  const maxHip = hipHeights.length > 0 ? Math.max(...hipHeights) : 0.5;
  const hipDisplacement = maxHip - minHip;

  const minWrist = wristHeights.length > 0 ? Math.min(...wristHeights) : 0.6;
  const maxWrist = wristHeights.length > 0 ? Math.max(...wristHeights) : 0.6;
  const avgShoulder = shoulderHeights.length > 0 
    ? shoulderHeights.reduce((a, b) => a + b, 0) / shoulderHeights.length 
    : 0.35;

  const isWristsAboveHead = minWrist < (avgShoulder - 0.08);

  // Check split stance for lunges
  const avgSplitY = ankleSeparations.length > 0
    ? ankleSeparations.reduce((acc, v) => acc + v.splitY, 0) / ankleSeparations.length
    : 0;

  // Check movement smoothness / erratic jitter
  let totalJitter = 0;
  let jitterCount = 0;
  for (let i = 2; i < validFrames.length; i++) {
    const pPrev2 = validFrames[i - 2].landmarks[0];
    const pPrev1 = validFrames[i - 1].landmarks[0];
    const pCurr = validFrames[i].landmarks[0];
    if (pPrev2 && pPrev1 && pCurr) {
      const aX = (pCurr.x - pPrev1.x) - (pPrev1.x - pPrev2.x);
      const aY = (pCurr.y - pPrev1.y) - (pPrev1.y - pPrev2.y);
      totalJitter += Math.sqrt(aX * aX + aY * aY);
      jitterCount++;
    }
  }
  const avgJitter = jitterCount > 0 ? totalJitter / jitterCount : 0;

  // Exercise Decision Logic:
  let detectedExercise = 'unknown';
  let detectedExerciseName = 'Unknown Movement';
  let confidence = 85;

  // Erratic jitter indicates unstructured or random movement
  if (avgJitter > 0.045) {
    detectedExercise = 'random-movement';
    detectedExerciseName = 'Random Body Movements';
    confidence = 90;
  }
  // 1. Horizontal Body Orientation (< 42° from horizontal)
  else if (avgOrientation < 42) {
    if (elbowROM >= 24) {
      detectedExercise = 'pushups';
      detectedExerciseName = 'Push-ups';
      confidence = Math.min(98, Math.round(75 + elbowROM * 0.4));
    } else {
      detectedExercise = 'planks';
      detectedExerciseName = 'Plank Hold';
      confidence = 90;
    }

  // 2. Vertical Body Orientation (Standing or Upright)
  } else {
    // Check if body is stationary
    if (kneeROM < 12 && elbowROM < 14 && hipDisplacement < 0.04) {
      detectedExercise = 'standing-still';
      detectedExerciseName = 'Standing Still';
      confidence = 95;
    }
    // Squat vs Lunge (Hip vertical descent dominant in both front and side views)
    else if ((hipDisplacement >= 0.06) || (kneeROM >= 18 && hipDisplacement >= 0.04)) {
      if (avgSplitY > 0.10) {
        detectedExercise = 'lunges';
        detectedExerciseName = 'Forward Lunges';
        confidence = 88;
      } else {
        detectedExercise = 'weighted-squats';
        detectedExerciseName = 'Squats';
        confidence = Math.min(98, Math.round(75 + Math.max(kneeROM * 0.4, hipDisplacement * 200)));
      }
    }
    // Overhead Press (Wrists driving above shoulder / head)
    else if (isWristsAboveHead && elbowROM >= 25) {
      detectedExercise = 'shoulder-press';
      detectedExerciseName = 'Overhead Shoulder Press';
      confidence = 90;
    }
    // Bicep Curl (Elbows flexing while staying beside hips/torso)
    else if (elbowROM >= 28 && kneeROM < 15 && hipDisplacement < 0.05) {
      detectedExercise = 'bicep-curls';
      detectedExerciseName = 'Bicep Curls';
      confidence = 88;
    }
    // Dumbbell Row (Bent-over pulling)
    else if (avgOrientation >= 40 && avgOrientation <= 65 && elbowROM >= 20) {
      detectedExercise = 'forward-dumbbell-row';
      detectedExerciseName = 'Dumbbell Row';
      confidence = 82;
    }
    // Random or uncoordinated body movements
    else {
      detectedExercise = 'random-movement';
      detectedExerciseName = 'Random Body Movements';
      confidence = 75;
    }
  }

  // Handle exercise alias matching (e.g. 'squats' vs 'weighted-squats')
  const isMatch = (
    detectedExercise === selectedExerciseId ||
    (selectedExerciseId.includes('squat') && detectedExercise.includes('squat')) ||
    (selectedExerciseId.includes('row') && detectedExercise.includes('row'))
  );

  let mismatchReason = '';
  if (!isMatch) {
    if (detectedExercise === 'standing-still') {
      mismatchReason = 'No active exercise movement was detected. The person appears to be standing stationary without performing repetitions.';
    } else if (detectedExercise === 'random-movement') {
      mismatchReason = 'The video contains unstructured or random movements rather than an identifiable exercise cycle.';
    } else {
      mismatchReason = `Exercise Mismatch Detected: The uploaded video shows a ${detectedExerciseName} movement, but ${formatExerciseName(selectedExerciseId)} was selected. Please select "${detectedExerciseName}" or upload a video containing ${formatExerciseName(selectedExerciseId)}.`;
    }
  }

  return {
    detectedExercise,
    detectedExerciseName,
    confidence,
    isMismatch: !isMatch,
    mismatchReason,
    isInsufficientData: false,
    metrics: {
      avgOrientation: Math.round(avgOrientation),
      elbowROM: Math.round(elbowROM),
      kneeROM: Math.round(kneeROM),
      hipDisplacement: Math.round(hipDisplacement * 100),
      isWristsAboveHead
    }
  };
}

function formatExerciseName(id) {
  if (!id) return 'the selected exercise';
  if (id === 'pushups') return 'Push-ups';
  if (id.includes('squat')) return 'Squats';
  if (id === 'lunges') return 'Lunges';
  if (id === 'bicep-curls') return 'Bicep Curls';
  if (id === 'shoulder-press') return 'Shoulder Press';
  if (id === 'planks') return 'Planks';
  return id.replace(/-/g, ' ');
}
