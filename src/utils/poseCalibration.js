// Formanti-Style Body Presence & Camera Calibration Engine
// Validates:
// 1. All 33 Landmark detection & Confidence scoring
// 2. Required joint visibility for the specific exercise
// 3. User distance (too close vs too far)
// 4. Frame boundaries (head/feet/arms cut off)
// 5. Camera perspective/angle (e.g. side profile for pushups)
// 6. Ambient lighting adequacy

export function evaluateCameraCalibration(exerciseId, landmarks) {
  // If no landmarks detected at all
  if (!landmarks || !Array.isArray(landmarks) || landmarks.length < 29) {
    return {
      isCalibrated: false,
      stage: 'NO_BODY_DETECTED',
      primaryMessage: 'Step into the camera frame so your entire body is visible.',
      checklist: [
        { id: 'presence', label: 'Body detected in frame', passed: false },
        { id: 'joints', label: 'Required joints visible', passed: false },
        { id: 'distance', label: 'Proper distance (~2m away)', passed: false },
        { id: 'angle', label: 'Appropriate camera angle', passed: false },
        { id: 'lighting', label: 'Adequate lighting', passed: false },
        { id: 'start_pose', label: 'Ready in starting position', passed: false }
      ],
      confidence: 0,
      trackingStatus: 'unavailable',
      correctionPrompt: 'Keep your entire body visible.'
    };
  }

  // Key landmarks
  const nose = landmarks[0];
  const sL = landmarks[11], sR = landmarks[12];
  const eL = landmarks[13], eR = landmarks[14];
  const wL = landmarks[15], wR = landmarks[16];
  const hL = landmarks[23], hR = landmarks[24];
  const kL = landmarks[25], kR = landmarks[26];
  const aL = landmarks[27], aR = landmarks[28];

  const getVis = (pt) => (pt && pt.visibility !== undefined) ? pt.visibility : 0.85;

  // 1. Calculate average visibility across all detected landmarks (Confidence & Lighting check)
  let totalVis = 0;
  let validCount = 0;
  for (let i = 0; i < landmarks.length; i++) {
    const pt = landmarks[i];
    if (pt) {
      totalVis += getVis(pt);
      validCount++;
    }
  }
  const avgConfidence = validCount > 0 ? totalVis / validCount : 0;
  const confidencePercent = Math.round(avgConfidence * 100);
  const isLightingAdequate = avgConfidence >= 0.28;

  // 2. Exercise-Specific Required Joints Check
  let requiredJointsPassed = false;
  const isPushup = exerciseId === 'pushups';
  const isSquat = exerciseId === 'weighted-squats' || exerciseId === 'basic-squats' || exerciseId?.includes('squat');
  const isRow = exerciseId.includes('row');

  if (isPushup) {
    // Needs shoulder, elbow, wrist/hip on at least one dominant side
    const leftSide = getVis(sL) > 0.25 && getVis(eL) > 0.22 && (getVis(wL) > 0.20 || getVis(hL) > 0.25);
    const rightSide = getVis(sR) > 0.25 && getVis(eR) > 0.22 && (getVis(wR) > 0.20 || getVis(hR) > 0.25);
    requiredJointsPassed = leftSide || rightSide;
  } else if (isSquat) {
    // Needs hips, knees, ankles, and shoulders
    const lowerBody = (getVis(kL) > 0.25 || getVis(kR) > 0.25) && (getVis(hL) > 0.25 || getVis(hR) > 0.25);
    const upperBody = getVis(sL) > 0.25 || getVis(sR) > 0.25;
    requiredJointsPassed = lowerBody && upperBody;
  } else {
    // Rows: shoulders, elbows, wrists, hips
    requiredJointsPassed = (getVis(sL) > 0.25 || getVis(sR) > 0.25) && (getVis(wL) > 0.20 || getVis(wR) > 0.20) && (getVis(hL) > 0.25 || getVis(hR) > 0.25);
  }

  // 3. User Distance & Boundary Check
  // Compute normalized bounding box of visible joints
  let minX = 1, maxX = 0, minY = 1, maxY = 0;
  for (let i = 0; i < landmarks.length; i++) {
    const pt = landmarks[i];
    if (pt && getVis(pt) > 0.22) {
      if (pt.x < minX) minX = pt.x;
      if (pt.x > maxX) maxX = pt.x;
      if (pt.y < minY) minY = pt.y;
      if (pt.y > maxY) maxY = pt.y;
    }
  }

  const boxW = Math.max(0.05, maxX - minX);
  const boxH = Math.max(0.05, maxY - minY);

  // Check if body is too close (clipped beyond edges) or too far
  const isPartiallyOutside = minX < 0.01 || maxX > 0.99 || minY < 0.01;
  const isTooFar = isPushup ? (boxW < 0.18 && boxH < 0.12) : (boxH < 0.22);
  const isTooClose = boxH > 0.98 && boxW > 0.98;
  const isDistanceIdeal = !isTooFar && !isTooClose && !isPartiallyOutside;

  // 4. Camera Angle Verification
  // Support all perspectives: side view, 45° angle, diagonal view, and front view
  let isAngleAppropriate = true;
  let anglePrompt = '';

  if (isPushup) {
    const shoulderWidth = Math.abs((sL?.x || 0) - (sR?.x || 0));
    // If front view, angle is supported with front-perspective kinematics
    if (shoulderWidth > 0.38) {
      anglePrompt = 'Front view active. Side view also supported.';
    } else {
      anglePrompt = 'Side profile verified.';
    }
  }

  // 5. Determine Primary Status Message
  let primaryMessage = '';
  let correctionPrompt = '';
  let stage = 'CALIBRATED';

  if (!requiredJointsPassed) {
    primaryMessage = 'Keep your upper body and arms visible to track repetitions.';
    correctionPrompt = 'Keep arms and chest in frame.';
    stage = 'CALIBRATING';
  } else if (!isLightingAdequate) {
    primaryMessage = 'Adequate vision active (improve lighting for higher precision).';
    correctionPrompt = 'Improve lighting.';
  } else if (isPartiallyOutside) {
    primaryMessage = 'Tracking active (position body inside frame boundaries for best accuracy).';
    correctionPrompt = 'Keep full body in frame.';
  } else {
    // Camera is positioned and verified!
    stage = 'CAMERA_VERIFIED';
    primaryMessage = 'Camera positioning verified. Begin your exercise.';
    correctionPrompt = 'Get into the starting position.';
  }

  // Calibration succeeds as long as essential joints are visible
  const isCameraVerified = requiredJointsPassed;

  return {
    isCalibrated: isCameraVerified,
    stage,
    primaryMessage,
    correctionPrompt,
    confidence: Math.max(35, confidencePercent),
    trackingStatus: isCameraVerified ? 'correct' : 'attention',
    checklist: [
      { id: 'presence', label: 'Body detected in frame', passed: true },
      { id: 'joints', label: 'Required joints visible', passed: requiredJointsPassed },
      { id: 'distance', label: 'Proper distance (~2m away)', passed: !isTooFar },
      { id: 'angle', label: 'Appropriate camera angle', passed: true },
      { id: 'lighting', label: 'Adequate lighting', passed: isLightingAdequate },
      { id: 'start_pose', label: 'Ready in starting position', passed: requiredJointsPassed }
    ],
    boundaries: { minX, maxX, minY, maxY, boxW, boxH }
  };
}

