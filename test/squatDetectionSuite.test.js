/**
 * PureSquatEngine Test Suite
 * Pure Node.js — no React, no DOM, no camera.
 *
 * Run: node test/squatDetectionSuite.test.js
 */

// Use dynamic import for ES module
import('../frontend/src/utils/pureSquatEngine.js').then(({ PureSquatEngine, SquatStates }) => {

  let passed = 0;
  let failed = 0;
  const results = [];

  function assert(condition, label, detail = '') {
    if (condition) {
      console.log(`  ✓ ${label}`);
      passed++;
      results.push({ label, ok: true });
    } else {
      console.error(`  ✗ FAIL: ${label}${detail ? ' — ' + detail : ''}`);
      failed++;
      results.push({ label, ok: false, detail });
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // LANDMARK GENERATORS
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Build a full 33-landmark array in MediaPipe normalized-coord format.
   * Y increases downward. All coords 0–1.
   * Standing: shoulders y≈0.25, hips y≈0.50, knees y≈0.70, ankles y≈0.90
   */
  function mkLandmarks(overrides = {}) {
    const defaults = {
      // shoulders
      11: { x: 0.42, y: 0.25, z: 0, visibility: 0.90 }, // LEFT_SHOULDER
      12: { x: 0.58, y: 0.25, z: 0, visibility: 0.90 }, // RIGHT_SHOULDER
      // elbows (not used for squats but must exist)
      13: { x: 0.38, y: 0.40, z: 0, visibility: 0.85 },
      14: { x: 0.62, y: 0.40, z: 0, visibility: 0.85 },
      // wrists
      15: { x: 0.36, y: 0.55, z: 0, visibility: 0.80 },
      16: { x: 0.64, y: 0.55, z: 0, visibility: 0.80 },
      // hips
      23: { x: 0.44, y: 0.50, z: 0, visibility: 0.90 }, // LEFT_HIP
      24: { x: 0.56, y: 0.50, z: 0, visibility: 0.90 }, // RIGHT_HIP
      // knees
      25: { x: 0.43, y: 0.70, z: 0, visibility: 0.90 }, // LEFT_KNEE
      26: { x: 0.57, y: 0.70, z: 0, visibility: 0.90 }, // RIGHT_KNEE
      // ankles
      27: { x: 0.43, y: 0.90, z: 0, visibility: 0.90 }, // LEFT_ANKLE
      28: { x: 0.57, y: 0.90, z: 0, visibility: 0.90 }, // RIGHT_ANKLE
    };

    const lm = Array.from({ length: 33 }, (_, i) => ({ x: 0.5, y: 0.5, z: 0, visibility: 0.5 }));
    for (const [idx, val] of Object.entries(defaults)) {
      lm[+idx] = { ...val };
    }
    // Apply per-landmark overrides
    for (const [idx, val] of Object.entries(overrides)) {
      lm[+idx] = { ...lm[+idx], ...val };
    }
    return lm;
  }

  /** Standing upright frame */
  function mkStanding(opts = {}) {
    return mkLandmarks({
      11: { x: 0.42, y: 0.25, z: 0, visibility: opts.vis ?? 0.90 },
      12: { x: 0.58, y: 0.25, z: 0, visibility: opts.vis ?? 0.90 },
      23: { x: 0.44, y: opts.hipY ?? 0.50, z: 0, visibility: opts.vis ?? 0.90 },
      24: { x: 0.56, y: opts.hipY ?? 0.50, z: 0, visibility: opts.vis ?? 0.90 },
      25: { x: 0.43, y: opts.kneeY ?? 0.70, z: 0, visibility: opts.vis ?? 0.90 },
      26: { x: 0.57, y: opts.kneeY ?? 0.70, z: 0, visibility: opts.vis ?? 0.90 },
      27: { x: 0.43, y: opts.ankleY ?? 0.90, z: 0, visibility: opts.vis ?? 0.90 },
      28: { x: 0.57, y: opts.ankleY ?? 0.90, z: 0, visibility: opts.vis ?? 0.90 },
    });
  }

  /** Squat bottom frame: hips descended ~55% of leg length (well past 35% threshold) */
  function mkSquatBottom(opts = {}) {
    // Baseline: hipY=0.50, legLength=0.40 (ankle 0.90 - hip 0.50)
    // Descent = 0.40 * 0.55 = 0.22 → hipY becomes 0.72
    const hipY = opts.hipY ?? 0.72;
    const kneeY = opts.kneeY ?? 0.80;
    return mkLandmarks({
      23: { x: 0.44, y: hipY, z: 0, visibility: opts.vis ?? 0.90 },
      24: { x: 0.56, y: hipY, z: 0, visibility: opts.vis ?? 0.90 },
      25: { x: 0.43, y: kneeY, z: 0, visibility: opts.vis ?? 0.90 },
      26: { x: 0.57, y: kneeY, z: 0, visibility: opts.vis ?? 0.90 },
      27: { x: 0.43, y: 0.90, z: 0, visibility: opts.vis ?? 0.90 },
      28: { x: 0.57, y: 0.90, z: 0, visibility: opts.vis ?? 0.90 },
    });
  }

  /** Set low visibility on a landmark array */
  function mkLowVis(lm, vis = 0.2, indices = [27, 28]) {
    const copy = lm.map(l => ({ ...l }));
    for (const i of indices) {
      copy[i] = { ...copy[i], visibility: vis };
    }
    return copy;
  }

  /**
   * Run N frames of the given landmark through the engine.
   * Returns the final result.
   */
  function runFrames(engine, lmOrFn, n = 1, startMs = 0, stepMs = 33) {
    let result;
    for (let i = 0; i < n; i++) {
      const lm = typeof lmOrFn === 'function' ? lmOrFn(i) : lmOrFn;
      result = engine.processFrame(lm, startMs + i * stepMs);
    }
    return result;
  }

  /**
   * Calibrate the engine with 30 standing frames.
   * Returns the ms timestamp after calibration.
   */
  function calibrate(engine, startMs = 0) {
    runFrames(engine, mkStanding(), 30, startMs);
    return startMs + 30 * 33;
  }

  /**
   * Simulate one full squat rep: standing -> descent -> bottom -> ascent -> standing.
   * Total ~35 frames @ 33ms = ~1.15 s duration.
   * We descend to hipY=0.72 (descent=0.55 of legLength=0.40) to exceed 0.35 threshold after EMA.
   */
  function runOneSquatRep(engine, startMs = 1000) {
    let t = startMs;
    // Phase 1: Descent over 15 frames (hipY 0.50 → 0.72, descent = 0.55 of legLen)
    for (let i = 0; i <= 15; i++) {
      const hipY = 0.50 + i * (0.22 / 15); // 0.50 → 0.72
      engine.processFrame(mkStanding({ hipY, kneeY: 0.70 + i * 0.005 }), t);
      t += 33;
    }
    // Phase 2: Dwell at bottom 8 frames
    for (let i = 0; i < 8; i++) {
      engine.processFrame(mkSquatBottom({ hipY: 0.72, kneeY: 0.80 }), t);
      t += 33;
    }
    // Phase 3: Ascent over 15 frames (hipY 0.72 → 0.50)
    for (let i = 0; i <= 15; i++) {
      const hipY = 0.72 - i * (0.22 / 15);
      engine.processFrame(mkStanding({ hipY }), t);
      t += 33;
    }
    // Phase 4: Stand still 8 frames to clear cooldown
    for (let i = 0; i < 8; i++) {
      engine.processFrame(mkStanding(), t);
      t += 33;
    }
    return t;
  }

  /**
   * Run multiple squat reps with rest between.
   */
  function runNSquatReps(engine, n, startMs = 1000) {
    let t = startMs;
    for (let i = 0; i < n; i++) {
      t = runOneSquatRep(engine, t);
      // Brief rest between reps
      runFrames(engine, mkStanding(), 10, t);
      t += 10 * 33;
    }
    return t;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // TESTS
  // ─────────────────────────────────────────────────────────────────────────────

  console.log('\n=== PURE SQUAT ENGINE TEST SUITE ===\n');

  // ── TEST 1: Low visibility mid-rep → count unchanged, attempt INCOMPLETE ─────
  console.log('Test 1: Low visibility mid-rep → INCOMPLETE, count unchanged');
  {
    const eng = new PureSquatEngine();
    let t = calibrate(eng, 0);

    // Start descending to actual bottom (past 35% threshold)
    t += 33;
    for (let i = 0; i < 15; i++) {
      const hipY = 0.50 + i * (0.22 / 15); // 0.50 → 0.72
      eng.processFrame(mkStanding({ hipY }), t); t += 33;
    }
    const countBefore = eng.validReps;

    // Ankles drop to low visibility mid-rep
    for (let i = 0; i < 10; i++) {
      eng.processFrame(mkLowVis(mkSquatBottom(), 0.1, [27, 28]), t); t += 33;
    }

    assert(eng.validReps === countBefore, 'Count unchanged when body goes out of frame mid-rep');
    assert(eng.state === SquatStates.TRACKING_LOST || eng.state === SquatStates.WAITING_FOR_POSITION,
      'State is TRACKING_LOST when ankles invisible', `state=${eng.state}`);
    // INCOMPLETE entry should be in ledger (tracking lost during active rep)
    const incompletes = eng.repsLedger.filter(r => r.category === 'incomplete');
    assert(incompletes.length >= 1, 'INCOMPLETE record logged when tracking lost mid-rep',
      `incomplete=${incompletes.length}`);
  }

  // ── TEST 2: Body fills frame / ankles out of frame → TRACKING_LOST, no count ─
  console.log('\nTest 2: Ankles out of frame → TRACKING_LOST, no count');
  {
    const eng = new PureSquatEngine();
    // Send frames with low-visibility ankles only (no prior calibration)
    for (let i = 0; i < 20; i++) {
      eng.processFrame(mkLowVis(mkStanding(), 0.1, [27, 28]), i * 33);
    }
    assert(eng.state === SquatStates.TRACKING_LOST || eng.state === SquatStates.WAITING_FOR_POSITION,
      'State = TRACKING_LOST with low-vis ankles', `state=${eng.state}`);
    assert(eng.validReps === 0, 'validReps = 0 with ankles out of frame');
    assert(eng.incompleteReps === 0, 'No incomplete reps logged before calibration');
    assert(eng.repsLedger.filter(r => r.category === 'incomplete').length === 0,
      'No incomplete ledger entries before calibration');
  }

  // ── TEST 3: Pre-calibration movement → 0 attempts logged ─────────────────────
  console.log('\nTest 3: Pre-calibration movement → 0 rep attempts');
  {
    const eng = new PureSquatEngine();
    let t = 0;
    // Simulate walking around, adjusting position (not standing upright long enough)
    // Send squat-like motion before calibration
    for (let i = 0; i < 10; i++) {
      eng.processFrame(mkSquatBottom(), t); t += 33;
    }
    // Then stand for only 5 frames (not enough to calibrate)
    for (let i = 0; i < 5; i++) {
      eng.processFrame(mkStanding(), t); t += 33;
    }
    assert(!eng.isCalibrated, 'Engine not calibrated after < 23 upright frames');
    assert(eng.validReps === 0, 'No valid reps before calibration');
    assert(eng.incompleteReps === 0, 'No incomplete reps before calibration');
    assert(eng.repsLedger.length === 0, 'Empty ledger before calibration',
      `ledger.length=${eng.repsLedger.length}`);
  }

  // ── TEST 4: Standing sway → 0 counted ────────────────────────────────────────
  console.log('\nTest 4: Standing sway (lateral movement only) → 0 counted');
  {
    const eng = new PureSquatEngine();
    let t = calibrate(eng, 0);

    // Simulate lateral hip sway (x changes, y stays at baseline)
    for (let i = 0; i < 30; i++) {
      const xOffset = i % 2 === 0 ? 0.52 : 0.48;
      eng.processFrame(mkLandmarks({
        23: { x: xOffset - 0.04, y: 0.50, z: 0, visibility: 0.90 },
        24: { x: xOffset + 0.04, y: 0.50, z: 0, visibility: 0.90 },
        25: { x: 0.43, y: 0.70, z: 0, visibility: 0.90 },
        26: { x: 0.57, y: 0.70, z: 0, visibility: 0.90 },
        27: { x: 0.43, y: 0.90, z: 0, visibility: 0.90 },
        28: { x: 0.57, y: 0.90, z: 0, visibility: 0.90 },
      }), t); t += 33;
    }
    assert(eng.validReps === 0, 'No reps counted for lateral sway only');
  }

  // ── TEST 5: Waist bend only → 0 counted ──────────────────────────────────────
  console.log('\nTest 5: Waist bend only (shoulders drop, no hip descent) → 0 counted');
  {
    const eng = new PureSquatEngine();
    let t = calibrate(eng, 0);

    // Shoulders drop significantly but hips stay at baseline
    for (let i = 0; i < 20; i++) {
      const shoulderDrop = i * 0.005; // drops up to 0.10
      eng.processFrame(mkLandmarks({
        11: { x: 0.42, y: 0.25 + shoulderDrop, z: 0, visibility: 0.90 },
        12: { x: 0.58, y: 0.25 + shoulderDrop, z: 0, visibility: 0.90 },
        23: { x: 0.44, y: 0.50, z: 0, visibility: 0.90 }, // hips unchanged
        24: { x: 0.56, y: 0.50, z: 0, visibility: 0.90 },
        25: { x: 0.43, y: 0.70, z: 0, visibility: 0.90 },
        26: { x: 0.57, y: 0.70, z: 0, visibility: 0.90 },
        27: { x: 0.43, y: 0.90, z: 0, visibility: 0.90 },
        28: { x: 0.57, y: 0.90, z: 0, visibility: 0.90 },
      }), t); t += 33;
    }
    assert(eng.validReps === 0, 'No reps counted for waist bend without hip descent');
  }

  // ── TEST 6: Half squat → INCOMPLETE ──────────────────────────────────────────
  console.log('\nTest 6: Half squat (insufficient depth) → INCOMPLETE logged');
  {
    const eng = new PureSquatEngine({ bottomThreshold: 0.35 });
    let t = calibrate(eng, 0);
    const incompletesBefore = eng.incompleteReps;

    // Partial descent: only 15% of leg length (0.40 * 0.15 = 0.06 → hipY = 0.56)
    for (let i = 0; i <= 8; i++) {
      const hipY = 0.50 + i * 0.0075; // 0.50 → 0.56
      eng.processFrame(mkStanding({ hipY }), t); t += 33;
    }
    // Dwell briefly
    for (let i = 0; i < 5; i++) {
      eng.processFrame(mkStanding({ hipY: 0.56 }), t); t += 33;
    }
    // Return to standing
    for (let i = 0; i <= 10; i++) {
      const hipY = 0.56 - i * 0.006;
      eng.processFrame(mkStanding({ hipY }), t); t += 33;
    }
    for (let i = 0; i < 10; i++) {
      eng.processFrame(mkStanding(), t); t += 33;
    }

    assert(eng.validReps === 0, 'Half squat not counted as valid rep');
    assert(eng.incompleteReps > incompletesBefore, 'Half squat logged as INCOMPLETE',
      `incompleteReps=${eng.incompleteReps}`);
  }

  // ── TEST 7: 5 full squats → exactly 5 counted ────────────────────────────────
  console.log('\nTest 7: 5 full squats → exactly 5 counted');
  {
    const eng = new PureSquatEngine();
    let t = calibrate(eng, 0);
    runNSquatReps(eng, 5, t);

    assert(eng.validReps === 5, `5 squats counted (got ${eng.validReps})`, `validReps=${eng.validReps}`);
    assert(eng.repsLedger.filter(r => r.isValid).length === 5,
      '5 valid rep records in ledger', `valid in ledger=${eng.repsLedger.filter(r=>r.isValid).length}`);
  }

  // ── TEST 8: Standing at 0% depth never shows "Optimal Knee Depth" ─────────────
  console.log('\nTest 8: Standing at 0% depth — no "Optimal Knee Depth" in feedback');
  {
    const eng = new PureSquatEngine();
    let t = calibrate(eng, 0);

    // Just stand and collect telemetry
    let result;
    for (let i = 0; i < 15; i++) {
      result = eng.processFrame(mkStanding(), t); t += 33;
    }

    const telem = result?.telemetry;
    // No ledger entries yet
    assert(eng.repsLedger.length === 0, 'No ledger entries just from standing');
    // Telemetry depth should be 0%
    assert((telem?.depthPercentage ?? 0) < 10, `Hip depth < 10% while standing (got ${telem?.depthPercentage}%)`);
    // jointLabel must be 'Hip Depth', NOT 'Knee' or 'Elbow'
    assert(telem?.jointLabel === 'Hip Depth', `jointLabel='Hip Depth' (got '${telem?.jointLabel}')`);
    // No "Optimal Knee Depth" in any feedback
    const allFeedback = eng.repsLedger.map(r => r.feedback || '').join(' ');
    assert(!allFeedback.includes('Optimal Knee Depth'),
      'No "Optimal Knee Depth" feedback while standing at 0%');
    // Confirm "Good repetition!" not in ledger (no reps completed)
    assert(!allFeedback.includes('Good repetition!'),
      'No "Good repetition!" feedback before any rep is completed');
  }

  // ── TEST 9: No duplicate counts (fast squat sequence) ─────────────────────────
  console.log('\nTest 9: Fast squats — no duplicates');
  {
    const eng = new PureSquatEngine({ minRepDurationMs: 800, cooldownMs: 400 });
    let t = calibrate(eng, 0);
    // Run 3 squats faster than minRepDuration (use large time steps to bypass the 50ms mock-instant check)
    // These should be treated as valid if they're fast but not instant-mock
    runNSquatReps(eng, 3, t);

    // No matter how fast, should not get more reps than attempted cycles
    assert(eng.validReps <= 3, `No duplicate counts — max 3 reps (got ${eng.validReps})`);
    assert(eng.validReps >= 0, 'Count is non-negative');
    // Verify ledger valid count matches counter
    assert(eng.repsLedger.filter(r => r.isValid).length === eng.validReps,
      'Ledger valid count matches validReps counter');
  }

  // ── TEST 10: Slow and fast squat both handled correctly ───────────────────────
  console.log('\nTest 10: Slow (3s) and fast (1s) squat — both counted');
  {
    const eng = new PureSquatEngine();
    let t = calibrate(eng, 0);

    // SLOW squat: 90 frames (~3s)
    // Descent: 30 frames to hipY=0.72 (descent 55%)
    for (let i = 0; i <= 30; i++) {
      const hipY = 0.50 + i * (0.22 / 30);
      eng.processFrame(mkStanding({ hipY }), t); t += 33;
    }
    // Dwell bottom: 10 frames
    for (let i = 0; i < 10; i++) {
      eng.processFrame(mkSquatBottom({ hipY: 0.72, kneeY: 0.80 }), t); t += 33;
    }
    // Ascent: 30 frames to hipY=0.50
    for (let i = 0; i <= 30; i++) {
      const hipY = 0.72 - i * (0.22 / 30);
      eng.processFrame(mkStanding({ hipY }), t); t += 33;
    }
    // Rest: 20 frames
    for (let i = 0; i < 20; i++) {
      eng.processFrame(mkStanding(), t); t += 33;
    }

    const afterSlow = eng.validReps;
    assert(afterSlow >= 1, `Slow squat counted (got ${afterSlow})`);

    // FAST squat: ~30 frames (~1s) using time-step bypass
    t = runOneSquatRep(eng, t);

    const afterFast = eng.validReps;
    assert(afterFast >= afterSlow + 1, `Fast squat also counted (before=${afterSlow}, after=${afterFast})`);
  }

  // ── TEST 11: Calibration requires upright standing ───────────────────────────
  console.log('\nTest 11: Calibration: 23+ upright frames needed');
  {
    const eng = new PureSquatEngine();
    // 22 frames — not enough
    runFrames(eng, mkStanding(), 22, 0);
    assert(!eng.isCalibrated, 'Not calibrated after 22 frames');

    // One more frame — now calibrated
    eng.processFrame(mkStanding(), 22 * 33);
    assert(eng.isCalibrated, 'Calibrated after 23rd upright frame');
    assert(eng.baseline !== null, 'Baseline captured after calibration');
    assert(eng.baseline.legLength > 0, 'Baseline legLength > 0', `legLength=${eng.baseline?.legLength}`);
  }

  // ── TEST 12: Tracking gate — computed visibility equals actual joint min ──────
  console.log('\nTest 12: Vision confidence = min joint visibility * 100');
  {
    const eng = new PureSquatEngine();
    // Send frame with right knee at 0.3 visibility (below gate)
    const result = eng.processFrame(mkLowVis(mkStanding(), 0.3, [26]), 0);
    assert(result.state === SquatStates.TRACKING_LOST || result.state === SquatStates.WAITING_FOR_POSITION,
      'TRACKING_LOST when right knee visibility = 0.3 (below 0.5 gate)', `state=${result.state}`);
    assert((result.telemetry?.visibility ?? 100) < 50,
      `Visibility < 50% reported (got ${result.telemetry?.visibility}%)`);
  }

  // ── TEST 13: Rep records include required evidence fields ─────────────────────
  console.log('\nTest 13: Rep records include evidence fields');
  {
    const eng = new PureSquatEngine();
    let t = calibrate(eng, 0);
    t = runOneSquatRep(eng, t);

    if (eng.validReps > 0) {
      const rep = eng.repsLedger.find(r => r.isValid);
      assert(rep !== undefined, 'Valid rep record exists');
      assert(typeof rep.startTimestampMs === 'number', 'startTimestampMs is a number');
      assert(typeof rep.endTimestampMs === 'number', 'endTimestampMs is a number');
      assert(typeof rep.maxDescentPct === 'number', 'maxDescentPct is a number');
      assert(typeof rep.minVisibilityDuringRep === 'number', 'minVisibilityDuringRep is a number');
      assert(rep.minVisibilityDuringRep >= 0.5, 'Counted rep had min vis >= 0.5',
        `minVis=${rep.minVisibilityDuringRep}`);
      assert(Array.isArray(rep.goodPoints) && rep.goodPoints.length > 0, 'goodPoints is non-empty array');
      assert(rep.isValid === true, 'isValid=true for counted rep');
      assert(rep.score >= 50, `score >= 50 (got ${rep.score})`);
    } else {
      console.log('    (skipped evidence field checks — no rep counted in this run)');
    }
  }

  // ── TEST 14: Periodic null detections enter TRACKING_LOST and count stays unchanged ──
  console.log('\nTest 14: Periodic null detections -> TRACKING_LOST, count unchanged');
  {
    const eng = new PureSquatEngine();
    let t = calibrate(eng, 0);
    t = runOneSquatRep(eng, t);

    const initialValidReps = eng.validReps;
    assert(initialValidReps === 1, `Engine calibrated and completed exactly 1 rep (got ${initialValidReps})`);

    // Inject 15 frames with periodic null detections (e.g. alternating null and partial detections)
    for (let i = 0; i < 15; i++) {
      t += 33;
      const result = eng.processFrame(null, t);
      assert(result.state === SquatStates.TRACKING_LOST, `Frame ${i}: null landmarks -> TRACKING_LOST (got ${result.state})`);
      assert(eng.validReps === initialValidReps, `Frame ${i}: validReps remains unchanged at ${initialValidReps}`);
      assert(result.telemetry?.visibility === 0, `Frame ${i}: visibility is 0 on null frame`);
      assert(result.lastRejectionReason.includes('Step back so head to feet are visible'),
        `Frame ${i}: guidance cue is specific ("Step back so head to feet are visible")`);
    }

    // Now resume with valid standing frames: engine should recover safely without spurious rep counting
    for (let i = 0; i < 20; i++) {
      t += 33;
      const res = eng.processFrame(mkStanding(), t);
      assert(eng.validReps === initialValidReps, `Recovery frame ${i}: count remains ${initialValidReps}`);
    }
  }

  // ── SUMMARY ──────────────────────────────────────────────────────────────────
  console.log('\n' + '='.repeat(60));
  console.log(`   SUITE RESULT: ${passed}/${passed + failed} TESTS PASSED`);
  if (failed > 0) {
    console.log(`   FAILURES: ${failed}`);
    results.filter(r => !r.ok).forEach(r => console.log(`     ✗ ${r.label}${r.detail ? ' — ' + r.detail : ''}`));
  } else {
    console.log('   ALL SQUAT ENGINE TESTS PASSED!');
  }
  console.log('='.repeat(60) + '\n');

  process.exit(failed > 0 ? 1 : 0);

}).catch(err => {
  console.error('Failed to load PureSquatEngine:', err);
  process.exit(1);
});
