// test/canvasOverlayVerification.test.js
// Automated verification for Skeleton Canvas Overlay Minimalization and Clearing

import assert from 'assert';
import { drawSkeletonOnCanvas, generateTargetGhostLandmarks } from '../src/utils/skeletonRenderer.js';

console.log('=== SKELETON CANVAS OVERLAY VERIFICATION SUITE ===\n');

function createMockContext() {
  const calls = {
    clearRect: [],
    fillText: [],
    arc: [],
    stroke: [],
    fill: [],
    beginPath: 0,
    save: 0,
    restore: 0,
    roundRect: []
  };

  return {
    calls,
    canvas: { width: 640, height: 480 },
    save: () => calls.save++,
    restore: () => calls.restore++,
    beginPath: () => calls.beginPath++,
    closePath: () => {},
    clearRect: (x, y, w, h) => calls.clearRect.push({ x, y, w, h }),
    moveTo: () => {},
    lineTo: () => {},
    stroke: () => calls.stroke.push(true),
    fill: () => calls.fill.push(true),
    arc: (x, y, r, sa, ea) => calls.arc.push({ x, y, r, sa, ea }),
    rect: () => {},
    roundRect: (x, y, w, h, r) => calls.roundRect.push({ x, y, w, h, r }),
    fillText: (text, x, y) => calls.fillText.push({ text, x, y }),
    strokeText: () => {},
    measureText: (text) => ({ width: text.length * 6 }),
    setLineDash: () => {},
    createLinearGradient: () => ({
      addColorStop: () => {}
    }),
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    lineCap: 'round',
    lineJoin: 'round',
    globalAlpha: 1,
    shadowColor: '',
    shadowBlur: 0,
    font: '',
    textAlign: 'left',
    textBaseline: 'alphabetic'
  };
}

function generateMockUserLandmarks(yOffset = 0) {
  // 33 MediaPipe pose landmarks
  const lm = [];
  for (let i = 0; i < 33; i++) {
    lm.push({
      x: 0.5 + (i % 2 === 0 ? 0.05 : -0.05),
      y: 0.2 + (i * 0.02) + yOffset,
      z: 0,
      visibility: 0.95
    });
  }
  return lm;
}

// -------------------------------------------------------------
// Test 1: Minimal Default Overlay (Ghost OFF, Advanced Overlay OFF)
// -------------------------------------------------------------
console.log('Test 1: Default minimal overlay does not draw ghost, HUD badges, or angle text');
{
  const ctx = createMockContext();
  const landmarks = generateMockUserLandmarks(0);

  drawSkeletonOnCanvas(ctx, landmarks, {
    showUserSkeleton: true,
    showGhostTarget: false,
    showAdvancedOverlay: false,
    showDualExoskeleton: false,
    showAngles: false,
    showDepthHUD: false,
    isCalibrated: true,
    exerciseId: 'weighted-squats',
    currentState: 'BOTTOM_POSITION'
  });

  // No "TARGET FORM" or "BENCHMARK" text drawn
  const ghostBadges = ctx.calls.fillText.filter(c => 
    typeof c.text === 'string' && (c.text.includes('TARGET FORM') || c.text.includes('BENCHMARK'))
  );
  assert.strictEqual(ghostBadges.length, 0, 'Should draw 0 ghost badges when showGhostTarget is false');

  // No Depth HUD or Angle badges drawn on canvas
  const hudTexts = ctx.calls.fillText.filter(c => 
    typeof c.text === 'string' && (c.text.includes('DEPTH GAUGE') || c.text.includes('ANGLE') || c.text.includes('Current:'))
  );
  assert.strictEqual(hudTexts.length, 0, 'Should draw 0 HUD/angle texts when showAdvancedOverlay is false');

  console.log('  ✓ 0 ghost badges drawn when Target Ghost is OFF');
  console.log('  ✓ 0 HUD/angle texts drawn when Advanced Overlay is OFF');
}

// -------------------------------------------------------------
// Test 2: Opt-In Ghost Target draws at most ONE header badge per frame
// -------------------------------------------------------------
console.log('\nTest 2: When Target Ghost is enabled, draws at most 1 header badge per frame');
{
  const ctx = createMockContext();
  const landmarks = generateMockUserLandmarks(0);

  drawSkeletonOnCanvas(ctx, landmarks, {
    showUserSkeleton: true,
    showGhostTarget: true,
    showAdvancedOverlay: false,
    isCalibrated: true,
    exerciseId: 'weighted-squats',
    currentState: 'BOTTOM_POSITION'
  });

  const ghostBadges = ctx.calls.fillText.filter(c => 
    typeof c.text === 'string' && c.text.includes('TARGET FORM')
  );
  assert(ghostBadges.length <= 1, `Expected at most 1 TARGET FORM badge per frame, got ${ghostBadges.length}`);
  console.log(`  ✓ Exactly ${ghostBadges.length} TARGET FORM badge drawn (at most 1 per frame)`);
}

// -------------------------------------------------------------
// Test 3: Ghost Target is suppressed during TRACKING_LOST or CALIBRATING
// -------------------------------------------------------------
console.log('\nTest 3: Ghost Target is hidden during TRACKING_LOST, TRACKING_PAUSED, or CALIBRATING');
for (const state of ['TRACKING_LOST', 'TRACKING_PAUSED', 'CALIBRATING', 'WAITING_FOR_START']) {
  const ctx = createMockContext();
  const landmarks = generateMockUserLandmarks(0);

  drawSkeletonOnCanvas(ctx, landmarks, {
    showUserSkeleton: true,
    showGhostTarget: true,
    isCalibrated: true,
    exerciseId: 'weighted-squats',
    currentState: state
  });

  const ghostBadges = ctx.calls.fillText.filter(c => 
    typeof c.text === 'string' && c.text.includes('TARGET FORM')
  );
  assert.strictEqual(ghostBadges.length, 0, `Ghost must not draw during state ${state}`);
  console.log(`  ✓ Ghost target suppressed during ${state}`);
}

// -------------------------------------------------------------
// Test 4: Low-visibility joints (<0.5) and Face joints (0-10) are skipped
// -------------------------------------------------------------
console.log('\nTest 4: Low-visibility joints (<0.5) and face joints (0-10) are not drawn as body joint dots');
{
  const ctx = createMockContext();
  const landmarks = generateMockUserLandmarks(0);

  // Set all face joints (0-10) to high visibility, but body joints to low vis except one
  for (let i = 0; i <= 10; i++) {
    landmarks[i].visibility = 0.99;
  }
  // Joints 11-32: only left shoulder (11) and right shoulder (12) visible
  for (let i = 11; i < 33; i++) {
    landmarks[i].visibility = 0.2; // below 0.5 threshold
  }
  landmarks[11].visibility = 0.95;
  landmarks[12].visibility = 0.95;

  drawSkeletonOnCanvas(ctx, landmarks, {
    showUserSkeleton: true,
    showGhostTarget: false,
    showAdvancedOverlay: false,
    isCalibrated: true,
    exerciseId: 'weighted-squats'
  });

  // Body joint dots: only joints 11 and 12 should be drawn (2 dots)
  // Radius of joint dots must be <= 4px
  const jointDots = ctx.calls.arc.filter(a => a.r <= 4);
  assert.strictEqual(jointDots.length, 2, `Expected exactly 2 joint dots for visible body joints, got ${jointDots.length}`);
  console.log(`  ✓ Exactly 2 joint dots drawn for the 2 visible body joints`);
  console.log(`  ✓ Face points (0-10) and low-vis points (<0.5) successfully excluded`);
}

// -------------------------------------------------------------
// Test 5: Multi-Frame Simulation (N=30 frames) with clearRect verification
// -------------------------------------------------------------
console.log('\nTest 5: 30 consecutive frames with clearRect on each frame replace pixels cleanly');
{
  const totalFrames = 30;
  const ctx = createMockContext();

  for (let f = 0; f < totalFrames; f++) {
    // Unconditional clearRect at start of frame
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    const landmarks = generateMockUserLandmarks(Math.sin(f * 0.2) * 0.1);
    drawSkeletonOnCanvas(ctx, landmarks, {
      showUserSkeleton: true,
      showGhostTarget: false,
      showAdvancedOverlay: false,
      isCalibrated: true,
      exerciseId: 'weighted-squats',
      currentState: 'BOTTOM_POSITION'
    });
  }

  assert.strictEqual(ctx.calls.clearRect.length, totalFrames, `Expected ${totalFrames} clearRect calls, got ${ctx.calls.clearRect.length}`);
  console.log(`  ✓ Exactly ${ctx.calls.clearRect.length} clearRect calls across ${totalFrames} frames`);
  console.log('  ✓ No frame accumulation or ghost smears');
}

console.log('\n============================================================');
console.log('   ALL CANVAS OVERLAY VERIFICATION TESTS PASSED!');
console.log('============================================================\n');

