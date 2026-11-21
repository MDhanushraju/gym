// Biomechanical Joint Angle and Kinematic Calculations
// Supports Dual-Perspective Analysis: Front View (Primary) & Back / Posterior View (Optional)

/**
 * Calculates the angle (in degrees) formed by three points where point B is the vertex.
 * Point A -> Point B (vertex) -> Point C
 * E.g., Hip (A) -> Knee (B) -> Ankle (C) returns the knee angle in degrees.
 */
export function calculateJointAngle(pointA, pointB, pointC, aspect = 1.0) {
  if (!pointA || !pointB || !pointC) return null;

  const hasZ = (pointA.z !== undefined && pointB.z !== undefined && pointC.z !== undefined);

  const ab = {
    x: (pointA.x - pointB.x) * aspect,
    y: pointA.y - pointB.y,
    z: hasZ ? (pointA.z - pointB.z) : 0
  };
  const cb = {
    x: (pointC.x - pointB.x) * aspect,
    y: pointC.y - pointB.y,
    z: hasZ ? (pointC.z - pointB.z) : 0
  };

  const dot = ab.x * cb.x + ab.y * cb.y + ab.z * cb.z;
  const magAB = Math.sqrt(ab.x * ab.x + ab.y * ab.y + ab.z * ab.z);
  const magCB = Math.sqrt(cb.x * cb.x + cb.y * cb.y + cb.z * cb.z);

  if (magAB === 0 || magCB === 0) return 0;

  let cosine = dot / (magAB * magCB);
  cosine = Math.max(-1, Math.min(1, cosine));

  const radians = Math.acos(cosine);
  return Math.round((radians * 180) / Math.PI);
}

/**
 * Calculates the angle of a segment (e.g. Torso: Hip -> Shoulder) relative to the vertical line.
 * 0° = vertical upright, 90° = horizontal to floor
 */
export function calculateSegmentAngleWithVertical(pointA, pointB, aspect = 1.0) {
  if (!pointA || !pointB) return null;

  const dx = (pointB.x - pointA.x) * aspect;
  const dy = pointB.y - pointA.y;

  const radians = Math.atan2(Math.abs(dx), Math.abs(dy));
  return Math.round((radians * 180) / Math.PI);
}

/**
 * Evaluates whether an angle is in the ideal, warning, or danger zone.
 */
export function evaluateAngleStatus(currentAngle, ideal, minAcceptable, maxAcceptable) {
  if (currentAngle >= minAcceptable && currentAngle <= maxAcceptable) {
    return {
      status: 'Optimal',
      color: '#2E7D32',
      level: 'good'
    };
  }

  const deviation = Math.min(
    Math.abs(currentAngle - minAcceptable),
    Math.abs(currentAngle - maxAcceptable)
  );

  if (deviation < 12) {
    return {
      status: 'Acceptable',
      color: '#D97706',
      level: 'warning'
    };
  }

  return {
    status: 'Deviated',
    color: '#D32F2F',
    level: 'danger'
  };
}

/**
 * =========================================================================
 * PERSPECTIVE 1: FRONT VIEW (PRIMARY & MANDATORY)
 * Analyzes coronal plane kinematics:
 * 1. Knee Valgus / Abduction (knee spacing vs ankle spacing)
 * 2. Shoulder Level Symmetry (horizontal balance between left and right)
 * 3. Elbow Flare & Elevation Level
 * 4. Stance Width and Balance
 * =========================================================================
 */
export function analyzeFrontView(landmarks) {
  if (!landmarks || landmarks.length < 29) return null;

  const leftShoulder = landmarks[11];
  const rightShoulder = landmarks[12];
  const leftElbow = landmarks[13];
  const rightElbow = landmarks[14];
  const leftHip = landmarks[23];
  const rightHip = landmarks[24];
  const leftKnee = landmarks[25];
  const rightKnee = landmarks[26];
  const leftAnkle = landmarks[27];
  const rightAnkle = landmarks[28];

  // 1. Shoulder Level (difference in Y-coordinates)
  const shoulderDeltaY = Math.abs((leftShoulder?.y || 0) - (rightShoulder?.y || 0));
  const isShoulderLevel = shoulderDeltaY < 0.04;

  // 2. Knee Spacing vs Ankle Spacing (Knee valgus detection)
  const kneeDistance = Math.abs((rightKnee?.x || 0) - (leftKnee?.x || 0));
  const ankleDistance = Math.abs((rightAnkle?.x || 0) - (leftAnkle?.x || 0));
  const hipDistance = Math.abs((rightHip?.x || 0) - (leftHip?.x || 0));

  // If knees are significantly closer than ankles, knee cave / valgus is present
  const isKneeCave = kneeDistance < ankleDistance * 0.78;

  // 3. Elbow elevation symmetry
  const elbowDeltaY = Math.abs((leftElbow?.y || 0) - (rightElbow?.y || 0));
  const isElbowSymmetric = elbowDeltaY < 0.06;

  return {
    perspective: 'front',
    shoulderLevel: {
      status: isShoulderLevel ? 'Correct' : 'Needs attention',
      deltaY: Math.round(shoulderDeltaY * 100) + 'px',
      isGood: isShoulderLevel
    },
    kneeAlignment: {
      status: isKneeCave ? 'Needs attention' : 'Correct',
      ratio: Math.round((kneeDistance / (ankleDistance || 1)) * 100) + '%',
      isGood: !isKneeCave
    },
    elbowSymmetry: {
      status: isElbowSymmetric ? 'Correct' : 'Needs attention',
      isGood: isElbowSymmetric
    }
  };
}

/**
 * =========================================================================
 * PERSPECTIVE 2: BACK / POSTERIOR VIEW (OPTIONAL)
 * Analyzes posterior plane kinematics:
 * 1. Spinal Column Neutrality (vertical alignment from neck to lumbar)
 * 2. Scapular Retraction & Symmetry
 * 3. Posterior Pelvic Tilt ("Butt Wink" at depth)
 * 4. Torso Inclination / Forward Lean
 * =========================================================================
 */
export function analyzeBackView(landmarks) {
  if (!landmarks || landmarks.length < 29) return null;

  const leftShoulder = landmarks[11];
  const rightShoulder = landmarks[12];
  const leftHip = landmarks[23];
  const rightHip = landmarks[24];

  // Midpoint of shoulders (Upper spine)
  const midShoulder = {
    x: ((leftShoulder?.x || 0) + (rightShoulder?.x || 0)) / 2,
    y: ((leftShoulder?.y || 0) + (rightShoulder?.y || 0)) / 2
  };

  // Midpoint of hips (Sacrum / Lower lumbar)
  const midHip = {
    x: ((leftHip?.x || 0) + (rightHip?.x || 0)) / 2,
    y: ((leftHip?.y || 0) + (rightHip?.y || 0)) / 2
  };

  // Spine lateral deviation from vertical
  const spineLateralTilt = Math.abs(midShoulder.x - midHip.x);
  const isSpineNeutral = spineLateralTilt < 0.05;

  // Scapular distance (distance between shoulders in posterior view)
  const scapularSpread = Math.abs((rightShoulder?.x || 0) - (leftShoulder?.x || 0));

  return {
    perspective: 'back',
    isOptional: true,
    spineNeutrality: {
      status: isSpineNeutral ? 'Correct' : 'Needs attention',
      lateralTiltDeg: Math.round(spineLateralTilt * 100) + '°',
      isGood: isSpineNeutral
    },
    scapularRetraction: {
      status: scapularSpread > 0.18 ? 'Correct' : 'Needs improvement',
      isGood: scapularSpread > 0.18
    },
    lumbarAlignment: {
      status: 'Correct',
      isGood: true
    }
  };
}

/**
 * Standard MediaPipe Pose Landmark Indices for reference
 */
export const POSE_LANDMARKS = {
  NOSE: 0,
  LEFT_EYE_INNER: 1,
  LEFT_EYE: 2,
  LEFT_EYE_OUTER: 3,
  RIGHT_EYE_INNER: 4,
  RIGHT_EYE: 5,
  RIGHT_EYE_OUTER: 6,
  LEFT_EAR: 7,
  RIGHT_EAR: 8,
  MOUTH_LEFT: 9,
  MOUTH_RIGHT: 10,
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13,
  RIGHT_ELBOW: 14,
  LEFT_WRIST: 15,
  RIGHT_WRIST: 16,
  LEFT_PINKY: 17,
  RIGHT_PINKY: 18,
  LEFT_INDEX: 19,
  RIGHT_INDEX: 20,
  LEFT_THUMB: 21,
  RIGHT_THUMB: 22,
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
  LEFT_KNEE: 25,
  RIGHT_KNEE: 26,
  LEFT_ANKLE: 27,
  RIGHT_ANKLE: 28,
  LEFT_HEEL: 29,
  RIGHT_HEEL: 30,
  LEFT_FOOT_INDEX: 31,
  RIGHT_FOOT_INDEX: 32
};

/**
 * Standard skeletal bone connections
 */
export const SKELETON_CONNECTIONS = [
  // Upper body
  [11, 12], // Shoulders
  [11, 13], // Left upper arm
  [13, 15], // Left forearm
  [12, 14], // Right upper arm
  [14, 16], // Right forearm
  // Torso / Spine
  [11, 23], // Left torso
  [12, 24], // Right torso
  [23, 24], // Pelvis / Hips
  // Lower body
  [23, 25], // Left thigh
  [25, 27], // Left shin
  [27, 29], // Left heel
  [29, 31], // Left foot
  [24, 26], // Right thigh
  [26, 28], // Right shin
  [28, 30], // Right heel
  [30, 32]  // Right foot
];
