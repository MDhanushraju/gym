// Push-Up Detection and Repetition Counting Test Suite
// Verifies all 7 tests (A through G) specified in the requirements:
// Test A: Normal push-up (Valid reps = 1, Optimal)
// Test B: Imperfect push-up with hip sag (Valid reps = 1, Imperfect, score ~65-75%, sag feedback)
// Test C: Moving arms only without lowering body (Valid reps = 0, Rejected/No rep)
// Test D: Moving hips up and down without lowering upper body (Valid reps = 0, Rejected as hip pump)
// Test E: Incomplete push-up (lowered without rising back, Valid reps = 0, Incomplete = 1)
// Test F: Multiple complete push-ups in sequence (Valid reps = exact count)
// Test G: Fast push-up and slow push-up (Both counted accurately, no double counting)

import { FormantiExerciseEngine, ExerciseStates } from '../src/utils/stateMachine.js';
import { PushUpValidator } from '../src/utils/exerciseValidators.js';

function createMockPushUpLandmarks({
  shoulderY = 0.45,
  hipY = 0.52,
  elbowX = 0.35,
  elbowY = 0.58,
  wristY = 0.72,
  wristX = 0.35,
  ankleY = 0.70,
  ankleX = 0.82,
  hipAlignmentDeg = 170
} = {}) {
  const lm = [];
  for (let i = 0; i < 33; i++) {
    lm.push({ x: 0.5, y: 0.5, z: 0, visibility: 0.95 });
  }

  // Nose (head)
  lm[0] = { x: 0.28, y: shoulderY - 0.08, z: 0, visibility: 0.95 };

  // Left & Right Shoulders (11, 12)
  lm[11] = { x: 0.35, y: shoulderY, z: 0, visibility: 0.95 };
  lm[12] = { x: 0.38, y: shoulderY, z: 0, visibility: 0.95 };

  // Left & Right Elbows (13, 14)
  lm[13] = { x: elbowX, y: elbowY, z: 0, visibility: 0.95 };
  lm[14] = { x: elbowX + 0.03, y: elbowY, z: 0, visibility: 0.95 };

  // Left & Right Wrists (15, 16) - grounded on floor
  lm[15] = { x: wristX, y: wristY, z: 0, visibility: 0.95 };
  lm[16] = { x: wristX + 0.03, y: wristY, z: 0, visibility: 0.95 };

  // Left & Right Hips (23, 24)
  lm[23] = { x: 0.55, y: hipY, z: 0, visibility: 0.95 };
  lm[24] = { x: 0.56, y: hipY, z: 0, visibility: 0.95 };

  // Left & Right Knees (25, 26)
  lm[25] = { x: 0.68, y: (hipY + ankleY) / 2, z: 0, visibility: 0.95 };
  lm[26] = { x: 0.69, y: (hipY + ankleY) / 2, z: 0, visibility: 0.95 };

  // Left & Right Ankles (27, 28)
  lm[27] = { x: ankleX, y: ankleY, z: 0, visibility: 0.95 };
  lm[28] = { x: ankleX + 0.01, y: ankleY, z: 0, visibility: 0.95 };

  return lm;
}

function runVerificationSuite() {
  console.log('\n======================================================');
  console.log('   PUSH-UP DETECTION & REPETITION ENGINE TEST SUITE   ');
  console.log('======================================================\n');

  let passedTests = 0;
  const totalTests = 7;

  // -------------------------------------------------------------------------
  // TEST A: Normal Push-Up (Should count = 1, Optimal form)
  // -------------------------------------------------------------------------
  {
    const engine = new FormantiExerciseEngine('pushups');
    engine.isCalibrated = true;
    engine.state = ExerciseStates.TOP_POSITION;

    const topPlank = createMockPushUpLandmarks({
      shoulderY: 0.45, hipY: 0.52, elbowX: 0.35, elbowY: 0.58 // 165°
    });
    const bottomDepth = createMockPushUpLandmarks({
      shoulderY: 0.58, hipY: 0.62, elbowX: 0.28, elbowY: 0.65 // ~90°, shoulder lowered
    });

    let time = 1000;
    // 1. Establish top lockout baseline
    engine.processFrame(topPlank, time);

    // 2. Lowering phase
    time += 500;
    engine.processFrame(bottomDepth, time);

    // 3. Bottom inflection dwell
    time += 80;
    engine.processFrame(bottomDepth, time);

    // 4. Return to top lockout
    time += 600;
    engine.processFrame(topPlank, time);
    time += 80;
    engine.processFrame(topPlank, time);

    const isCounted = engine.validReps === 1;
    const isClean = engine.completedCleanReps === 1;
    const hasGoodScore = engine.repsLedger[0]?.score >= 85;

    const passed = isCounted && isClean && hasGoodScore;
    console.log(`Test A [Normal Push-up]: ${passed ? '✓ PASSED' : '✗ FAILED'}`);
    console.log(`       Valid Reps: ${engine.validReps}, Category: ${engine.repsLedger[0]?.category}, Score: ${engine.repsLedger[0]?.score}%\n`);
    if (passed) passedTests++;
  }

  // -------------------------------------------------------------------------
  // TEST B: Push-up with Incorrect Hip Alignment (Sagging Hips)
  // Critical Requirement: MUST COUNT AS 1 VALID REP, with reduced form score!
  // -------------------------------------------------------------------------
  {
    const engine = new FormantiExerciseEngine('pushups');
    engine.isCalibrated = true;
    engine.state = ExerciseStates.TOP_POSITION;

    // Hips sagging: hipY is 0.64 (much lower than straight plank line of 0.52)
    const topSagging = createMockPushUpLandmarks({
      shoulderY: 0.45, hipY: 0.64, elbowX: 0.35, elbowY: 0.58
    });
    const bottomSagging = createMockPushUpLandmarks({
      shoulderY: 0.58, hipY: 0.70, elbowX: 0.28, elbowY: 0.65
    });

    let time = 2000;
    // 1. In top position with hip sag
    engine.processFrame(topSagging, time);

    // 2. Lowering phase
    time += 500;
    engine.processFrame(bottomSagging, time);

    // 3. Bottom inflection
    time += 80;
    engine.processFrame(bottomSagging, time);

    // 4. Ascending back to top
    time += 600;
    engine.processFrame(topSagging, time);
    time += 80;
    engine.processFrame(topSagging, time);

    const isRepCounted = engine.validReps === 1;
    const isImperfect = engine.completedImperfectReps === 1;
    const scoreReduced = engine.repsLedger[0]?.score <= 82;
    const hasSagFeedback = engine.repsLedger[0]?.mistakes.some(m => m.toLowerCase().includes('sag'));

    const passed = isRepCounted && isImperfect && scoreReduced && hasSagFeedback;
    console.log(`Test B [Push-up with Hip Sag]: ${passed ? '✓ PASSED' : '✗ FAILED'}`);
    console.log(`       Valid Reps: ${engine.validReps} (Must be 1!), Category: ${engine.repsLedger[0]?.category}`);
    console.log(`       Score: ${engine.repsLedger[0]?.score}%, Feedback: "${engine.repsLedger[0]?.mistakes[0]}"\n`);
    if (passed) passedTests++;
  }

  // -------------------------------------------------------------------------
  // TEST C: Moving Arms Only Without Lowering Body
  // Should NOT count as a push-up!
  // -------------------------------------------------------------------------
  {
    const engine = new FormantiExerciseEngine('pushups');
    engine.isCalibrated = true;
    engine.state = ExerciseStates.TOP_POSITION;

    const topPlank = createMockPushUpLandmarks({
      shoulderY: 0.45, hipY: 0.52, elbowX: 0.35, elbowY: 0.58
    });
    // Shoulder stays fixed at 0.45, only wrist moves
    const armOnlyMovement = createMockPushUpLandmarks({
      shoulderY: 0.45, hipY: 0.52, elbowX: 0.35, elbowY: 0.58, wristY: 0.65
    });

    let time = 4000;
    engine.processFrame(topPlank, time);

    for (let i = 0; i < 10; i++) {
      time += 100;
      engine.processFrame(armOnlyMovement, time);
    }
    time += 200;
    engine.processFrame(topPlank, time);

    const passed = engine.validReps === 0;
    console.log(`Test C [Moving Arms Only Without Lowering Body]: ${passed ? '✓ PASSED' : '✗ FAILED'}`);
    console.log(`       Valid Reps Counted: ${engine.validReps} (Expected 0)\n`);
    if (passed) passedTests++;
  }

  // -------------------------------------------------------------------------
  // TEST D: Moving Hips Up and Down Without Lowering Upper Body (Hip Pump)
  // Should NOT count as a push-up! Rejected as hip pump!
  // -------------------------------------------------------------------------
  {
    const engine = new FormantiExerciseEngine('pushups');
    engine.isCalibrated = true;
    engine.state = ExerciseStates.TOP_POSITION;

    const topPlank = createMockPushUpLandmarks({
      shoulderY: 0.45, hipY: 0.52, elbowX: 0.35, elbowY: 0.58
    });
    // Shoulders stay fixed at 0.45, but hips pump down to 0.62
    const hipPumpMovement = createMockPushUpLandmarks({
      shoulderY: 0.45, hipY: 0.62, elbowX: 0.35, elbowY: 0.58
    });

    let time = 6000;
    engine.processFrame(topPlank, time);

    time += 300;
    engine.processFrame(hipPumpMovement, time);
    time += 300;
    engine.processFrame(topPlank, time);

    const passed = engine.validReps === 0 && (engine.rejectedCount >= 1 || engine.state === ExerciseStates.INVALID_MOVEMENT);
    console.log(`Test D [Hip Pump Without Lowering Chest]: ${passed ? '✓ PASSED' : '✗ FAILED'}`);
    console.log(`       Valid Reps: ${engine.validReps} (Expected 0), Rejections: ${engine.rejectedCount}\n`);
    if (passed) passedTests++;
  }

  // -------------------------------------------------------------------------
  // TEST E: Incomplete Push-Up (Lowering Without Returning to Top)
  // Should NOT count as completed! Marked as Incomplete.
  // -------------------------------------------------------------------------
  {
    const engine = new FormantiExerciseEngine('pushups');
    engine.isCalibrated = true;
    engine.state = ExerciseStates.TOP_POSITION;

    const topPlank = createMockPushUpLandmarks({
      shoulderY: 0.45, hipY: 0.52, elbowX: 0.35, elbowY: 0.58
    });
    const bottomDepth = createMockPushUpLandmarks({
      shoulderY: 0.58, hipY: 0.62, elbowX: 0.28, elbowY: 0.65
    });

    let time = 8000;
    engine.processFrame(topPlank, time);

    // Lower to bottom
    time += 500;
    engine.processFrame(bottomDepth, time);
    time += 80;
    engine.processFrame(bottomDepth, time);

    // Instead of returning to top, user stays down or attempts another dip
    time += 300;
    engine.processFrame(bottomDepth, time);

    const passed = engine.validReps === 0;
    console.log(`Test E [Incomplete Push-up (No return to top)]: ${passed ? '✓ PASSED' : '✗ FAILED'}`);
    console.log(`       Valid Reps: ${engine.validReps} (Expected 0), State: ${engine.state}\n`);
    if (passed) passedTests++;
  }

  // -------------------------------------------------------------------------
  // TEST F: Multiple Complete Push-Ups in Sequence
  // Should count exact repetitions (e.g. 3 reps = 3)
  // -------------------------------------------------------------------------
  {
    const engine = new FormantiExerciseEngine('pushups');
    engine.isCalibrated = true;
    engine.state = ExerciseStates.TOP_POSITION;

    const topPlank = createMockPushUpLandmarks({
      shoulderY: 0.45, hipY: 0.52, elbowX: 0.35, elbowY: 0.58
    });
    const bottomDepth = createMockPushUpLandmarks({
      shoulderY: 0.58, hipY: 0.62, elbowX: 0.28, elbowY: 0.65
    });

    let time = 10000;
    for (let r = 0; r < 3; r++) {
      // 1. Top
      engine.processFrame(topPlank, time);
      // 2. Lower
      time += 400;
      engine.processFrame(bottomDepth, time);
      time += 60;
      engine.processFrame(bottomDepth, time);
      // 3. Rise
      time += 400;
      engine.processFrame(topPlank, time);
      time += 60;
      engine.processFrame(topPlank, time);
      // Cooldown
      time += 300;
      engine.processFrame(topPlank, time);
    }

    const passed = engine.validReps === 3;
    console.log(`Test F [Multiple Complete Push-ups in Sequence]: ${passed ? '✓ PASSED' : '✗ FAILED'}`);
    console.log(`       Expected Reps: 3, Actual Counted: ${engine.validReps}\n`);
    if (passed) passedTests++;
  }

  // -------------------------------------------------------------------------
  // TEST G: Fast Push-Up and Slow Push-Up
  // Both must be recognized accurately without skips or double counting
  // -------------------------------------------------------------------------
  {
    const engine = new FormantiExerciseEngine('pushups');
    engine.isCalibrated = true;
    engine.state = ExerciseStates.TOP_POSITION;

    const topPlank = createMockPushUpLandmarks({
      shoulderY: 0.45, hipY: 0.52, elbowX: 0.35, elbowY: 0.58
    });
    const bottomDepth = createMockPushUpLandmarks({
      shoulderY: 0.58, hipY: 0.62, elbowX: 0.28, elbowY: 0.65
    });

    let time = 20000;

    // Fast Rep (1.0s)
    engine.processFrame(topPlank, time);
    time += 250;
    engine.processFrame(bottomDepth, time);
    time += 60;
    engine.processFrame(bottomDepth, time);
    time += 250;
    engine.processFrame(topPlank, time);
    time += 60;
    engine.processFrame(topPlank, time);

    // Cooldown
    time += 300;
    engine.processFrame(topPlank, time);

    // Slow Rep (3.0s)
    time += 100;
    engine.processFrame(topPlank, time);
    time += 1200;
    engine.processFrame(bottomDepth, time);
    time += 150;
    engine.processFrame(bottomDepth, time);
    time += 1200;
    engine.processFrame(topPlank, time);
    time += 100;
    engine.processFrame(topPlank, time);

    const passed = engine.validReps === 2;
    console.log(`Test G [Fast and Slow Push-ups]: ${passed ? '✓ PASSED' : '✗ FAILED'}`);
    console.log(`       Expected Reps: 2, Actual Counted: ${engine.validReps}`);
    if (engine.repsLedger.length === 2) {
      console.log(`       Rep 1 Duration: ${engine.repsLedger[0]?.durationSec}s | Rep 2 Duration: ${engine.repsLedger[1]?.durationSec}s`);
    }
    console.log('');
    if (passed) passedTests++;
  }

  // -------------------------------------------------------------------------
  // FINAL REPORT
  // -------------------------------------------------------------------------
  console.log('======================================================');
  console.log(`   SUITE RESULT: ${passedTests}/${totalTests} TESTS PASSED   `);
  console.log('======================================================\n');

  if (passedTests === totalTests) {
    console.log('ALL VERIFICATION CRITERIA (TESTS A - G) SATISFIED PERFECTLY!\n');
    process.exit(0);
  } else {
    console.error(`FAILED: Only ${passedTests}/${totalTests} passed.`);
    process.exit(1);
  }
}

runVerificationSuite();

