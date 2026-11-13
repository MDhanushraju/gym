/**
 * Automated Push-up Replay Test Suite
 * 
 * Tests pure engine against real and benchmark landmark JSON recordings:
 * TEST 1: pushup_5reps.json -> Asserts exactly 5 verified push-ups
 * TEST 2: negative_random.json -> Asserts 0 repetitions on random movement / upright / hip pump
 * TEST 3: pushup_incomplete.json -> Asserts exactly 2 full reps counted, incomplete reps logged
 * TEST 4: user_recorded_pushup.json -> Asserts real recording is calibrated and verified
 */

import { PurePushupEngine } from '../../src/utils/purePushupEngine.js';
import fs from 'fs';
import path from 'path';

const FIXTURES_DIR = path.resolve('test/fixtures');

function loadFixture(filename) {
  const filePath = path.join(FIXTURES_DIR, filename);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Fixture file not found: ${filePath}`);
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

console.log('======================================================');
console.log('      OFFLINE PUSH-UP REPLAY TEST SUITE               ');
console.log('======================================================\n');

let passedTests = 0;
const totalTests = 4;

// ============================================================================
// TEST 1: 5 Repertoire Push-ups
// ============================================================================
{
  const frames = loadFixture('pushup_5reps.json');
  const engine = new PurePushupEngine();

  for (const f of frames) {
    if (f.has_pose) {
      engine.processFrame(f.landmarks, f.timestamp * 1000);
    }
  }

  const passed = engine.validReps === 5;
  console.log(`Test 1 [pushup_5reps.json]: ${passed ? '✓ PASSED' : '✗ FAILED'}`);
  console.log(`       Expected: 5 reps | Actual Counted: ${engine.validReps} (Clean: ${engine.cleanReps}, Imperfect: ${engine.imperfectReps})\n`);
  if (passed) passedTests++;
}

// ============================================================================
// TEST 2: Negative Movements (Zero Push-ups)
// ============================================================================
{
  const frames = loadFixture('negative_random.json');
  const engine = new PurePushupEngine();

  for (const f of frames) {
    if (f.has_pose) {
      engine.processFrame(f.landmarks, f.timestamp * 1000);
    }
  }

  const passed = engine.validReps === 0;
  console.log(`Test 2 [negative_random.json]: ${passed ? '✓ PASSED' : '✗ FAILED'}`);
  console.log(`       Expected: 0 reps | Actual Counted: ${engine.validReps} (Rejections: ${engine.rejectedCount}, Incomplete: ${engine.incompleteReps})\n`);
  if (passed) passedTests++;
}

// ============================================================================
// TEST 3: Incomplete Repetitions (2 full reps, 2 shallow/incomplete)
// ============================================================================
{
  const frames = loadFixture('pushup_incomplete.json');
  const engine = new PurePushupEngine();

  for (const f of frames) {
    if (f.has_pose) {
      engine.processFrame(f.landmarks, f.timestamp * 1000);
    }
  }

  const passed = engine.validReps === 2 && engine.incompleteReps >= 1;
  console.log(`Test 3 [pushup_incomplete.json]: ${passed ? '✓ PASSED' : '✗ FAILED'}`);
  console.log(`       Expected: 2 valid reps | Actual Counted: ${engine.validReps} (Incomplete logged: ${engine.incompleteReps})\n`);
  if (passed) passedTests++;
}

// ============================================================================
// TEST 4: Real User Video Recording
// ============================================================================
{
  const frames = loadFixture('user_recorded_pushup.json');
  const engine = new PurePushupEngine();

  for (const f of frames) {
    if (f.has_pose) {
      engine.processFrame(f.landmarks, f.timestamp * 1000);
    }
  }

  const passed = engine.validReps >= 1 && engine.isCalibrated === true;
  console.log(`Test 4 [user_recorded_pushup.json]: ${passed ? '✓ PASSED' : '✗ FAILED'}`);
  console.log(`       Expected: >=1 valid rep & calibrated | Actual Counted: ${engine.validReps} (Calibrated: ${engine.isCalibrated})\n`);
  if (passed) passedTests++;
}

console.log('======================================================');
console.log(`   SUITE RESULT: ${passedTests}/${totalTests} TESTS PASSED   `);
console.log('======================================================\n');

if (passedTests === totalTests) {
  console.log('ALL REPLAY BENCHMARK TESTS PASSED PERFECTLY!\n');
} else {
  process.exit(1);
}

