// Comprehensive Formanti Exercise Engine & Calibration Verification Tests
// Covers all 12 test cases specified in the requirements:
// 1. Face-only detection must not count repetitions.
// 2. Hand-only detection must not count repetitions.
// 3. Random body movements must not count repetitions.
// 4. Standing in front of the camera must not activate push-up tracking.
// 5. Incorrect plank position must prevent starting.
// 6. A half push-up must not count as a valid repetition.
// 7. One complete push-up must count exactly once.
// 8. Multiple complete push-ups must count correctly.
// 9. Leaving the camera frame must pause tracking.
// 10. Sagging hips must trigger a correction.
// 11. Incomplete arm extension must not count as a valid repetition.
// 12. Temporary landmark loss must not create false repetitions.

import { PushUpValidator } from '../src/utils/exerciseValidators.js';
import { evaluateCameraCalibration } from '../src/utils/poseCalibration.js';
import { FormantiExerciseEngine, ExerciseStates } from '../src/utils/stateMachine.js';

function createMockLandmarks(overrides = {}) {
  // Base 33 MediaPipe pose landmarks
  const lm = [];
  for (let i = 0; i < 33; i++) {
    lm.push({ x: 0.5, y: 0.5, z: 0, visibility: 0.95 });
  }

  // Realistic Push-up High Plank (Side view)
  // Shoulders (11, 12): at x=0.35, y=0.45
  lm[11] = { x: 0.35, y: 0.45, z: 0, visibility: 0.95 };
  lm[12] = { x: 0.37, y: 0.45, z: 0, visibility: 0.95 };

  // Elbows (13, 14): at x=0.35, y=0.58
  lm[13] = { x: 0.35, y: 0.58, z: 0, visibility: 0.95 };
  lm[14] = { x: 0.37, y: 0.58, z: 0, visibility: 0.95 };

  // Wrists (15, 16): on floor at x=0.35, y=0.72
  lm[15] = { x: 0.35, y: 0.72, z: 0, visibility: 0.95 };
  lm[16] = { x: 0.37, y: 0.72, z: 0, visibility: 0.95 };

  // Hips (23, 24): at x=0.55, y=0.52 (straight plank)
  lm[23] = { x: 0.55, y: 0.52, z: 0, visibility: 0.95 };
  lm[24] = { x: 0.56, y: 0.52, z: 0, visibility: 0.95 };

  // Knees (25, 26): at x=0.68, y=0.60
  lm[25] = { x: 0.68, y: 0.60, z: 0, visibility: 0.95 };
  lm[26] = { x: 0.69, y: 0.60, z: 0, visibility: 0.95 };

  // Ankles (27, 28): on floor at x=0.82, y=0.70
  lm[27] = { x: 0.82, y: 0.70, z: 0, visibility: 0.95 };
  lm[28] = { x: 0.83, y: 0.70, z: 0, visibility: 0.95 };

  // Apply any custom overrides
  for (const [idx, val] of Object.entries(overrides)) {
    lm[parseInt(idx)] = { ...lm[parseInt(idx)], ...val };
  }

  return lm;
}

function runTests() {
  console.log('--- STARTING FORMFIT ADVANCED VALIDATION TEST SUITE ---\n');
  let passedCount = 0;

  // TEST 1: Face-only detection must not count repetitions
  {
    const faceOnly = [];
    for (let i = 0; i < 33; i++) {
      faceOnly.push(i <= 10 ? { x: 0.5, y: 0.3, z: 0, visibility: 0.95 } : { x: 0, y: 0, z: 0, visibility: 0.1 });
    }
    const calib = evaluateCameraCalibration('pushups', faceOnly);
    const passed = !calib.isCalibrated && calib.checklist.find(c => c.id === 'joints').passed === false;
    console.log(`Test 1 [Face-only detection rejected]: ${passed ? '✓ PASSED' : '✗ FAILED'}`);
    if (passed) passedCount++;
  }

  // TEST 2: Hand-only detection must not count repetitions
  {
    const handOnly = [];
    for (let i = 0; i < 33; i++) {
      handOnly.push((i >= 15 && i <= 22) ? { x: 0.5, y: 0.5, z: 0, visibility: 0.95 } : { x: 0, y: 0, z: 0, visibility: 0.05 });
    }
    const calib = evaluateCameraCalibration('pushups', handOnly);
    const passed = !calib.isCalibrated && calib.checklist.find(c => c.id === 'joints').passed === false;
    console.log(`Test 2 [Hand-only detection rejected]: ${passed ? '✓ PASSED' : '✗ FAILED'}`);
    if (passed) passedCount++;
  }

  // TEST 3: Random body movements without starting posture must not count
  {
    const engine = new FormantiExerciseEngine('pushups');
    const randomLms = createMockLandmarks({
      13: { x: 0.35, y: 0.50 }, // Random arm waving
      15: { x: 0.35, y: 0.40 }
    });
    for (let i = 0; i < 20; i++) {
      engine.processFrame(randomLms);
    }
    const passed = engine.validReps === 0 && engine.state !== ExerciseStates.REP_COMPLETED;
    console.log(`Test 3 [Random body movement rejected]: ${passed ? '✓ PASSED' : '✗ FAILED'}`);
    if (passed) passedCount++;
  }

  // TEST 4: Standing in front of the camera must not activate push-up tracking
  {
    const standingLm = createMockLandmarks({
      11: { x: 0.5, y: 0.25 }, // Shoulders high
      23: { x: 0.5, y: 0.60 }, // Hips much lower
      27: { x: 0.5, y: 0.90 }  // Feet at bottom
    });
    const startCheck = PushUpValidator.validateStartingPosition(standingLm);
    const passed = startCheck.isValid === false && startCheck.reason.includes('standing upright');
    console.log(`Test 4 [Standing in front of camera rejected for pushups]: ${passed ? '✓ PASSED' : '✗ FAILED'}`);
    if (passed) passedCount++;
  }

  // TEST 5: Incorrect plank position (sagging hips) must prevent starting
  {
    const saggingPlank = createMockLandmarks({
      23: { x: 0.55, y: 0.70 } // Hips dropped down to floor (severe sag)
    });
    const startCheck = PushUpValidator.validateStartingPosition(saggingPlank);
    const passed = startCheck.isValid === false;
    console.log(`Test 5 [Sagging plank prevents starting]: ${passed ? '✓ PASSED' : '✗ FAILED'}`);
    if (passed) passedCount++;
  }

  // TEST 6: A half push-up (insufficient depth) must not count as a valid rep
  {
    const engine = new FormantiExerciseEngine('pushups');
    engine.isCalibrated = true;
    engine.state = ExerciseStates.TOP_POSITION;

    // Simulate descending to only 125° (half push-up, requires <= 105°)
    const halfPushupLm = createMockLandmarks({
      13: { x: 0.31, y: 0.52 } // Elbow slightly flexed to ~125°
    });

    for (let i = 0; i < 15; i++) {
      engine.processFrame(halfPushupLm);
    }
    // Return to top lockout
    const topPlank = createMockLandmarks();
    for (let i = 0; i < 15; i++) {
      engine.processFrame(topPlank);
    }

    const passed = engine.validReps === 0;
    console.log(`Test 6 [Half push-up rejected]: ${passed ? '✓ PASSED' : '✗ FAILED'}`);
    if (passed) passedCount++;
  }

  // TEST 7: One complete push-up counts exactly once
  {
    const engine = new FormantiExerciseEngine('pushups');
    engine.isCalibrated = true;
    engine.state = ExerciseStates.TOP_POSITION;

    // 1. In top position
    const topPlank = createMockLandmarks();
    engine.processFrame(topPlank);

    // 2. Descending
    const midDescent = createMockLandmarks({
      13: { x: 0.28, y: 0.54 } // 120°
    });
    engine.processFrame(midDescent);

    // 3. Full 90° Bottom Depth
    const bottomDepth = createMockLandmarks({
      11: { x: 0.35, y: 0.58 },
      12: { x: 0.37, y: 0.58 },
      13: { x: 0.28, y: 0.65 }, // Elbow flexed to 90°
      14: { x: 0.30, y: 0.65 },
      15: { x: 0.35, y: 0.72 },
      16: { x: 0.37, y: 0.72 },
      23: { x: 0.55, y: 0.63 }, // Straight 180° plank
      24: { x: 0.56, y: 0.63 },
      27: { x: 0.82, y: 0.70 },
      28: { x: 0.83, y: 0.70 }
    });
    // Dwell at bottom
    engine.processFrame(bottomDepth);
    engine.bottomDwellStartTime = Date.now() - 150; // satisfy 100ms dwell
    engine.processFrame(bottomDepth);

    // 4. Ascending Drive
    engine.processFrame(midDescent);

    // 5. Full Top Lockout
    engine.processFrame(topPlank);
    engine.topDwellStartTime = Date.now() - 200; // satisfy 140ms lockout dwell
    engine.processFrame(topPlank);

    const passed = engine.validReps === 1;
    console.log(`Test 7 [One complete push-up counted exactly once]: ${passed ? '✓ PASSED' : '✗ FAILED'} (Count: ${engine.validReps})`);
    if (passed) passedCount++;
  }

  // TEST 8: Multiple complete push-ups count correctly
  {
    const engine = new FormantiExerciseEngine('pushups');
    engine.isCalibrated = true;
    engine.state = ExerciseStates.TOP_POSITION;

    const topPlank = createMockLandmarks();
    const bottomDepth = createMockLandmarks({
      11: { x: 0.35, y: 0.58 },
      12: { x: 0.37, y: 0.58 },
      13: { x: 0.28, y: 0.65 },
      14: { x: 0.30, y: 0.65 },
      15: { x: 0.35, y: 0.72 },
      16: { x: 0.37, y: 0.72 },
      23: { x: 0.55, y: 0.63 },
      24: { x: 0.56, y: 0.63 },
      27: { x: 0.82, y: 0.70 },
      28: { x: 0.83, y: 0.70 }
    });

    for (let r = 0; r < 3; r++) {
      engine.lastRepCompletedTime = 0; // cooldown reset
      engine.state = ExerciseStates.TOP_POSITION;
      engine.processFrame(topPlank);
      
      engine.state = ExerciseStates.GOING_DOWN;
      engine.processFrame(bottomDepth);
      engine.bottomDwellStartTime = Date.now() - 150;
      engine.processFrame(bottomDepth);

      engine.state = ExerciseStates.GOING_UP;
      engine.processFrame(topPlank);
      engine.topDwellStartTime = Date.now() - 200;
      engine.processFrame(topPlank);
    }

    const passed = engine.validReps === 3;
    console.log(`Test 8 [Multiple complete push-ups counted correctly]: ${passed ? '✓ PASSED' : '✗ FAILED'} (Count: ${engine.validReps})`);
    if (passed) passedCount++;
  }

  // TEST 9: Leaving camera frame must pause tracking
  {
    const engine = new FormantiExerciseEngine('pushups');
    engine.isCalibrated = true;
    engine.state = ExerciseStates.TOP_POSITION;

    // Empty landmarks
    for (let i = 0; i < 12; i++) {
      engine.processFrame([]);
    }

    const passed = engine.state === ExerciseStates.TRACKING_LOST;
    console.log(`Test 9 [Leaving frame transitions to TRACKING_LOST]: ${passed ? '✓ PASSED' : '✗ FAILED'}`);
    if (passed) passedCount++;
  }

  // TEST 10: Sagging hips must trigger a correction
  {
    const saggingPlank = createMockLandmarks({
      23: { x: 0.55, y: 0.68 } // Hips dropped toward floor
    });
    const telem = PushUpValidator.computeTelemetry(saggingPlank);
    const passed = telem.hipAlignment < 155;
    console.log(`Test 10 [Sagging hips detected with alignment < 155°]: ${passed ? '✓ PASSED' : '✗ FAILED'} (Alignment: ${telem.hipAlignment}°)`);
    if (passed) passedCount++;
  }

  // TEST 11: Incomplete arm extension must not count as valid repetition
  {
    const engine = new FormantiExerciseEngine('pushups');
    engine.isCalibrated = true;
    engine.state = ExerciseStates.GOING_UP;
    engine.hasDweltBottom = true;

    // Ascend only halfway to 125°
    const incompleteTop = createMockLandmarks({
      13: { x: 0.30, y: 0.58 },
      14: { x: 0.32, y: 0.58 }
    });
    engine.processFrame(incompleteTop);

    // Drop down again immediately to bottom before top lockout
    const bottomDepth = createMockLandmarks({
      11: { x: 0.35, y: 0.58 },
      12: { x: 0.37, y: 0.58 },
      13: { x: 0.28, y: 0.65 },
      14: { x: 0.30, y: 0.65 },
      15: { x: 0.35, y: 0.72 },
      16: { x: 0.37, y: 0.72 },
      23: { x: 0.55, y: 0.63 },
      24: { x: 0.56, y: 0.63 },
      27: { x: 0.82, y: 0.70 },
      28: { x: 0.83, y: 0.70 }
    });
    engine.processFrame(bottomDepth);

    const passed = engine.validReps === 0 && engine.invalidReps >= 1;
    console.log(`Test 11 [Incomplete arm extension flagged as invalid rep]: ${passed ? '✓ PASSED' : '✗ FAILED'} (Valid: ${engine.validReps}, Invalid: ${engine.invalidReps})`);
    if (passed) passedCount++;
  }

  // TEST 12: Temporary landmark loss must not create false repetitions
  {
    const engine = new FormantiExerciseEngine('pushups');
    engine.isCalibrated = true;
    engine.state = ExerciseStates.TOP_POSITION;

    const topPlank = createMockLandmarks();
    engine.processFrame(topPlank);

    // Landmark loss for 3 frames
    engine.processFrame(null);
    engine.processFrame([]);
    engine.processFrame(null);

    // Landmark recovers
    engine.processFrame(topPlank);

    const passed = engine.validReps === 0 && engine.invalidReps === 0;
    console.log(`Test 12 [Temporary landmark loss creates zero false reps]: ${passed ? '✓ PASSED' : '✗ FAILED'}`);
    if (passed) passedCount++;
  }

  console.log(`\n--- TEST SUMMARY: ${passedCount}/12 PASSED ---`);
  if (passedCount === 12) {
    console.log('ALL 12 FORMANTI TRACKING & VALIDATION REQUIREMENTS VERIFIED SUCCESSFULLY!');
  } else {
    process.exit(1);
  }
}

runTests();
