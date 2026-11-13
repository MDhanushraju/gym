/**
 * SQUAT TEMPLATE ENGINE TEST SUITE
 * ================================
 * Validates reference-based squat template matching, scale-free ratios,
 * translation/scale/proportion invariance, and quantitative form scoring.
 */

import { SquatTemplateEngine } from '../src/utils/squatTemplateEngine.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ ${message}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failed++;
  }
}

console.log('=== SQUAT TEMPLATE ENGINE TEST SUITE ===\n');

// Load template JSON
const templatePath = path.resolve(__dirname, '../reference/squat_template.json');
assert(fs.existsSync(templatePath), 'squat_template.json exists on disk');

const template = JSON.parse(fs.readFileSync(templatePath, 'utf8'));
const engine = new SquatTemplateEngine(template);

// Test 1: Template Structure & Integrity
console.log('Test 1: Template Structure & Integrity');
assert(typeof template.version === 'string', 'Template has version string');
assert(template.rep_count >= 1, `Template has measured reference reps (got ${template.rep_count})`);
assert(template.low_sample_size === true, 'Template properly flags low_sample_size when reps < 10');
assert(template.phases && typeof template.phases.BOTTOM === 'object', 'Template has BOTTOM phase statistics');
assert(template.phases.BOTTOM.hip_descent_ratio != null, 'Template has hip_descent_ratio at BOTTOM');

// Helper to build synthetic landmarks
function makeSkeleton({ hipY = 0.50, kneeY = 0.70, ankleY = 0.90, shoY = 0.30, scale = 1.0, offsetX = 0, offsetY = 0, kneeWidth = 0.20, shoWidth = 0.30 } = {}) {
  const lms = [];
  for (let i = 0; i < 33; i++) lms.push({ x: 0.5 + offsetX, y: 0.5 + offsetY, z: 0, visibility: 0.95 });

  const midX = 0.5 + offsetX;
  const hy = (hipY + offsetY) * scale;
  const ky = (kneeY + offsetY) * scale;
  const ay = (ankleY + offsetY) * scale;
  const sy = (shoY + offsetY) * scale;

  lms[11] = { x: midX - shoWidth / 2, y: sy, z: 0, visibility: 0.95 }; // L_SHOULDER
  lms[12] = { x: midX + shoWidth / 2, y: sy, z: 0, visibility: 0.95 }; // R_SHOULDER
  lms[23] = { x: midX - 0.10, y: hy, z: 0, visibility: 0.95 };          // L_HIP
  lms[24] = { x: midX + 0.10, y: hy, z: 0, visibility: 0.95 };          // R_HIP
  lms[25] = { x: midX - kneeWidth / 2, y: ky, z: 0, visibility: 0.95 }; // L_KNEE
  lms[26] = { x: midX + kneeWidth / 2, y: ky, z: 0, visibility: 0.95 }; // R_KNEE
  lms[27] = { x: midX - 0.12, y: ay, z: 0, visibility: 0.95 };          // L_ANKLE
  lms[28] = { x: midX + 0.12, y: ay, z: 0, visibility: 0.95 };          // R_ANKLE
  return lms;
}

// Test 2: Scale Invariance (0.7x vs 1.0x vs 1.4x body size)
console.log('\nTest 2: Scale Invariance across different camera distances');
const calib1 = engine.calibrateUser(makeSkeleton({ scale: 1.0 }), 1.0);
const calib07 = engine.calibrateUser(makeSkeleton({ scale: 0.7 }), 1.0);
const calib14 = engine.calibrateUser(makeSkeleton({ scale: 1.4 }), 1.0);

const m1 = engine.computeFrameMetrics(makeSkeleton({ hipY: 0.65, scale: 1.0 }), calib1, 1.0);
const m07 = engine.computeFrameMetrics(makeSkeleton({ hipY: 0.65, scale: 0.7 }), calib07, 1.0);
const m14 = engine.computeFrameMetrics(makeSkeleton({ hipY: 0.65, scale: 1.4 }), calib14, 1.0);

assert(Math.abs(m1.hipDescentRatio - m07.hipDescentRatio) < 0.01, `Scale 1.0x vs 0.7x descent ratio match (${m1.hipDescentRatio} vs ${m07.hipDescentRatio})`);
assert(Math.abs(m1.hipDescentRatio - m14.hipDescentRatio) < 0.01, `Scale 1.0x vs 1.4x descent ratio match (${m1.hipDescentRatio} vs ${m14.hipDescentRatio})`);

// Test 3: Translation Invariance (X and Y offsets)
console.log('\nTest 3: Translation Invariance (shifting in frame)');
const calibShifted = engine.calibrateUser(makeSkeleton({ offsetX: 0.15, offsetY: 0.08 }), 1.0);
const mShifted = engine.computeFrameMetrics(makeSkeleton({ hipY: 0.65, offsetX: 0.15, offsetY: 0.08 }), calibShifted, 1.0);
assert(Math.abs(m1.hipDescentRatio - mShifted.hipDescentRatio) < 0.01, 'Translation in frame preserves identical descent ratio');

// Test 4: Different Body Proportions (Long Femur vs Short Femur)
console.log('\nTest 4: Adaptation across different femur/shank proportions');
const longFemurStanding = makeSkeleton({ hipY: 0.45, kneeY: 0.75, ankleY: 0.90 }); // 30% femur, 15% shank
const calibLongFemur = engine.calibrateUser(longFemurStanding, 1.0);
assert(calibLongFemur.femurLength > calibLongFemur.shankLength, 'Correctly detected longer femur ratio');
const mLongFemur = engine.computeFrameMetrics(makeSkeleton({ hipY: 0.62, kneeY: 0.75, ankleY: 0.90 }), calibLongFemur, 1.0);
assert(mLongFemur.hipDescentRatio > 0.30, 'Properly computes descent ratio for long femur proportion');

// Test 5: Depth Gate (Full parallel depth vs shallow squat)
console.log('\nTest 5: Depth Gate Verification');
const fullSquatMetrics = { hipDescentRatio: 0.45, torsoInclination: 20, isKneeCave: false, isUnevenHip: false };
const shallowSquatMetrics = { hipDescentRatio: 0.18, torsoInclination: 20, isKneeCave: false, isUnevenHip: false };

assert(engine.reachedMinDepth(fullSquatMetrics.hipDescentRatio), 'Full squat (0.45 descent) reaches min depth');
assert(!engine.reachedMinDepth(shallowSquatMetrics.hipDescentRatio), 'Shallow squat (0.18 descent) rejected by depth gate');

// Test 6: Form Evaluation & Feedback Generation
console.log('\nTest 6: Form Evaluation & Feedback Generation');
const evalClean = engine.evaluateRepForm(fullSquatMetrics);
assert(evalClean.isClean === true, 'Clean full squat marked as clean form');
assert(evalClean.score >= 85, `Optimal score for clean squat (got ${evalClean.score}%)`);
assert(evalClean.faults.length === 0, 'No faults for clean squat');

const valgusSquatMetrics = { hipDescentRatio: 0.42, torsoInclination: 22, isKneeCave: true, isUnevenHip: false };
const evalValgus = engine.evaluateRepForm(valgusSquatMetrics);
assert(evalValgus.faults.some(f => f.includes('valgus') || f.includes('Knee')), 'Valgus fault identified when knees cave');
assert(evalValgus.score < evalClean.score, 'Valgus reduces quality score without blocking rep');

const excessiveLeanMetrics = { hipDescentRatio: 0.40, torsoInclination: 68, isKneeCave: false, isUnevenHip: false };
const evalLean = engine.evaluateRepForm(excessiveLeanMetrics);
assert(evalLean.warnings.some(w => w.includes('Torso') || w.includes('chest')), 'Warns when forward torso lean exceeds reference band');

// Test 7: Low Visibility Gate
console.log('\nTest 7: Low Visibility Gate');
const lowVisLms = makeSkeleton();
lowVisLms[25].visibility = 0.2; // Left knee obscured
const mLowVis = engine.computeFrameMetrics(lowVisLms, calib1, 1.0);
assert(mLowVis === null, 'computeFrameMetrics returns null when key joint visibility < 0.35');

// Test 8: Aspect Ratio Correction
console.log('\nTest 8: Aspect Ratio Math (Portrait vs Landscape)');
const pA = { x: 0.4, y: 0.5 };
const pB = { x: 0.5, y: 0.5 };
const pC = { x: 0.6, y: 0.6 }; // diagonal
const angleSquare = engine.calcAngle(pA, pB, pC, 1.0);
const angleLandscape = engine.calcAngle(pA, pB, pC, 1.77);
assert(angleSquare != null, 'Calculated angle on square aspect');
assert(angleLandscape !== angleSquare, `Landscape aspect (${angleLandscape}°) adjusts diagonal angle relative to square (${angleSquare}°)`);

console.log('\n============================================================');
console.log(`   SUITE RESULT: ${passed}/${passed + failed} TESTS PASSED`);
if (failed === 0) {
  console.log('   ALL SQUAT TEMPLATE ENGINE TESTS PASSED!');
} else {
  console.error(`   ${failed} TESTS FAILED.`);
  process.exit(1);
}
console.log('============================================================\n');
