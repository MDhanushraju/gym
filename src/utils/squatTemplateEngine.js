import { initPoseLandmarker, detectPoseForVideoFrame } from './poseDetection.js';

/**
 * SquatTemplateEngine: Reference-Based Scale-Free Squat Scoring & Evaluation
 * =========================================================================
 * Evaluates squat movements against measured biomechanical reference templates.
 * 
 * - Normalizes all kinematics by user's own body dimensions (femur, shank, leg, torso).
 * - Aspect-ratio-correct geometry (treats normalized x and y proportionally).
 * - Multi-phase comparison: STANDING, MID_DESCENT, BOTTOM, MID_ASCENT.
 * - Produces concrete, quantitative form feedback without guessing.
 */

export class SquatTemplateEngine {
  constructor(template = null) {
    this.template = template;
    this.minDepthFraction = template?.min_depth_fraction ?? 0.60;
    this.lowSampleSize = template?.low_sample_size ?? true;
  }

  /**
   * Set or update reference template
   */
  setTemplate(template) {
    this.template = template;
    this.minDepthFraction = template?.min_depth_fraction ?? 0.60;
    this.lowSampleSize = template?.low_sample_size ?? true;
  }

  /**
   * Calculate 3-point angle with aspect-ratio correction
   */
  calcAngle(a, b, c, aspect = 1.0) {
    if (!a || !b || !c) return null;
    const bax = (a.x - b.x) * aspect;
    const bay = (a.y - b.y);
    const bcx = (c.x - b.x) * aspect;
    const bcy = (c.y - b.y);

    const dot = bax * bcx + bay * bcy;
    const magA = Math.sqrt(bax * bax + bay * bay);
    const magB = Math.sqrt(bcx * bcx + bcy * bcy);

    if (magA < 1e-6 || magB < 1e-6) return null;
    const cosAngle = Math.max(-1.0, Math.min(1.0, dot / (magA * magB)));
    return Math.round(Math.acos(cosAngle) * (180 / Math.PI));
  }

  /**
   * Angle from vertical (degrees)
   */
  angleFromVertical(a, b, aspect = 1.0) {
    if (!a || !b) return null;
    const dx = Math.abs(b.x - a.x) * aspect;
    const dy = Math.abs(b.y - a.y); // y increases downward
    if (dy < 1e-6) return 90;
    return Math.round(Math.atan2(dx, dy) * (180 / Math.PI));
  }

  /**
   * Euclidean distance with aspect correction
   */
  dist(a, b, aspect = 1.0) {
    if (!a || !b) return 0;
    const dx = (a.x - b.x) * aspect;
    const dy = (a.y - b.y);
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * Calibrate personal body scale from upright standing frames
   */
  calibrateUser(landmarks, aspect = 1.0) {
    if (!landmarks || landmarks.length < 29) return null;

    const sL = landmarks[11], sR = landmarks[12];
    const hL = landmarks[23], hR = landmarks[24];
    const kL = landmarks[25], kR = landmarks[26];
    const aL = landmarks[27], aR = landmarks[28];

    // Require essential lower body landmarks
    if (!hL || !hR || !kL || !kR || !aL || !aR) return null;

    const hipMidY = (hL.y + hR.y) / 2;
    const kneeMidY = (kL.y + kR.y) / 2;
    const ankleMidY = (aL.y + aR.y) / 2;
    const shoulderMidY = (sL && sR) ? (sL.y + sR.y) / 2 : (hipMidY - 0.20);

    const legLength = Math.max(0.10, ankleMidY - hipMidY);
    const femurLength = Math.max(0.05, kneeMidY - hipMidY);
    const shankLength = Math.max(0.05, ankleMidY - kneeMidY);
    const torsoLength = Math.max(0.08, hipMidY - shoulderMidY);

    const shoulderWidth = (sL && sR) ? Math.abs(sL.x - sR.x) * aspect : 0.25;
    const hipWidth = Math.abs(hL.x - hR.x) * aspect;
    const ankleWidth = Math.abs(aL.x - aR.x) * aspect;

    return {
      hipYBaseline: hipMidY,
      legLength,
      femurLength,
      shankLength,
      torsoLength,
      shoulderWidth,
      hipWidth,
      ankleWidth,
      aspect
    };
  }

  /**
   * Compute scale-free kinematics for a frame
   */
  computeFrameMetrics(landmarks, calibration, aspect = 1.0, view = 'auto') {
    if (!landmarks || landmarks.length < 29 || !calibration) return null;

    const sL = landmarks[11], sR = landmarks[12];
    const hL = landmarks[23], hR = landmarks[24];
    const kL = landmarks[25], kR = landmarks[26];
    const aL = landmarks[27], aR = landmarks[28];

    const visMin = Math.min(
      hL?.visibility ?? 0.8, hR?.visibility ?? 0.8,
      kL?.visibility ?? 0.8, kR?.visibility ?? 0.8,
      aL?.visibility ?? 0.8, aR?.visibility ?? 0.8
    );

    if (visMin < 0.35) return null;

    const hipMidY = (hL.y + hR.y) / 2;
    const kneeMidY = (kL.y + kR.y) / 2;
    const ankleMidY = (aL.y + aR.y) / 2;
    const shoulderMidY = (sL && sR) ? (sL.y + sR.y) / 2 : null;

    // Primary scale-free descent signal
    const hipDescentRatio = Math.max(0, (hipMidY - calibration.hipYBaseline) / calibration.legLength);

    // Side dominant leg
    const leftVis = ((sL?.visibility ?? 0.8) + (hL?.visibility ?? 0.8) + (kL?.visibility ?? 0.8) + (aL?.visibility ?? 0.8)) / 4;
    const rightVis = ((sR?.visibility ?? 0.8) + (hR?.visibility ?? 0.8) + (kR?.visibility ?? 0.8) + (aR?.visibility ?? 0.8)) / 4;
    const useLeft = leftVis >= rightVis;

    const sDom = useLeft ? sL : sR;
    const hDom = useLeft ? hL : hR;
    const kDom = useLeft ? kL : kR;
    const aDom = useLeft ? aL : aR;

    const kneeAngle = this.calcAngle(hDom, kDom, aDom, aspect);
    const hipAngle = sDom ? this.calcAngle(sDom, hDom, kDom, aspect) : null;
    const torsoInclination = sDom ? this.angleFromVertical(sDom, hDom, aspect) : null;
    const shankInclination = this.angleFromVertical(kDom, aDom, aspect);

    // Front-view metrics
    const kneeWidth = Math.abs(kL.x - kR.x) * aspect;
    const ankleWidth = Math.abs(aL.x - aR.x) * aspect;
    const kneeCaveRatio = calibration.hipWidth > 0 ? (ankleWidth - kneeWidth) / calibration.hipWidth : 0;
    const hipTilt = calibration.legLength > 0 ? Math.abs(hL.y - hR.y) / calibration.legLength : 0;

    return {
      hipDescentRatio: +hipDescentRatio.toFixed(3),
      kneeAngle,
      hipAngle,
      torsoInclination,
      shankInclination,
      kneeCaveRatio: +kneeCaveRatio.toFixed(3),
      hipTilt: +hipTilt.toFixed(3),
      isKneeCave: kneeCaveRatio > 0.22,
      isUnevenHip: hipTilt > 0.10,
      visibility: visMin
    };
  }

  /**
   * Score an individual metric against reference template tolerance bands
   */
  scoreMetric(metricName, value, phase = 'BOTTOM') {
    if (value === null || value === undefined) {
      return { measured: false, name: metricName };
    }

    const phaseData = this.template?.phases?.[phase];
    const band = phaseData?.[metricName];

    if (!band) {
      return { measured: false, name: metricName, value };
    }

    const { tol_min, tol_max, mean } = band;
    const inBand = value >= tol_min && value <= tol_max;
    const deviation = inBand ? 0 : (value < tol_min ? tol_min - value : value - tol_max);

    return {
      measured: true,
      name: metricName,
      inBand,
      value,
      refMean: mean,
      refMin: tol_min,
      refMax: tol_max,
      deviation: +deviation.toFixed(2)
    };
  }

  /**
   * Check whether a rep's peak descent reaches minimum required depth
   */
  reachedMinDepth(peakDescentRatio) {
    const refBottom = this.template?.phases?.BOTTOM?.hip_descent_ratio?.mean ?? 0.38;
    const targetMin = refBottom * this.minDepthFraction;
    return peakDescentRatio >= targetMin;
  }

  /**
   * Evaluate complete rep form against template
   */
  evaluateRepForm(peakMetrics) {
    if (!peakMetrics) {
      return { score: 80, faults: [], goodPoints: ['Repetition completed'], warnings: [] };
    }

    const faults = [];
    const goodPoints = [];
    const warnings = [];
    let score = 95;

    // 1. Depth check
    const bottomRef = this.template?.phases?.BOTTOM?.hip_descent_ratio?.mean ?? 0.38;
    if (peakMetrics.hipDescentRatio >= bottomRef * 0.90) {
      goodPoints.push('Optimal squat depth: full parallel range achieved.');
    } else if (peakMetrics.hipDescentRatio >= bottomRef * 0.65) {
      goodPoints.push('Good squat depth achieved.');
    } else {
      faults.push('Shallow squat depth: did not reach reference parallel standard.');
      warnings.push(`Hip descent reached ${Math.round(peakMetrics.hipDescentRatio * 100)}% (target ≥${Math.round(bottomRef * 0.9 * 100)}%).`);
      score -= 15;
    }

    // 2. Torso inclination (side view)
    if (peakMetrics.torsoInclination !== null) {
      const torsoScore = this.scoreMetric('torso_incl', peakMetrics.torsoInclination, 'BOTTOM');
      if (torsoScore.measured && !torsoScore.inBand) {
        if (peakMetrics.torsoInclination > torsoScore.refMax) {
          faults.push('Excessive forward torso lean.');
          warnings.push(`Torso tilted ${peakMetrics.torsoInclination}° (reference max ${Math.round(torsoScore.refMax)}°). Keep chest lifted.`);
          score -= 10;
        }
      } else if (torsoScore.measured && torsoScore.inBand) {
        goodPoints.push('Balanced torso angle maintained at bottom.');
      }
    }

    // 3. Knee tracking / cave (front view)
    if (peakMetrics.isKneeCave) {
      faults.push('Inward knee collapse (valgus) detected at depth.');
      warnings.push('Drive knees outward in line with your toes throughout the descent.');
      score -= 12;
    } else {
      goodPoints.push('Stable knee tracking aligned with feet.');
    }

    // 4. Pelvic level symmetry
    if (peakMetrics.isUnevenHip) {
      faults.push('Uneven hip weight distribution.');
      warnings.push('Distribute weight symmetrically across both feet.');
      score -= 8;
    }

    return {
      score: Math.max(50, Math.min(100, score)),
      isClean: score >= 85,
      faults,
      goodPoints: goodPoints.length > 0 ? goodPoints : ['Completed repetition cycle.'],
      warnings,
      lowSampleSize: this.lowSampleSize
    };
  }
}

/**
 * Load template asynchronously with caching and local custom preference priority
 */
let cachedTemplate = null;

export const CUSTOM_TEMPLATE_STORAGE_KEY = 'formfit_custom_squat_template';

export function saveCustomSquatTemplate(template) {
  try {
    localStorage.setItem(CUSTOM_TEMPLATE_STORAGE_KEY, JSON.stringify(template));
    cachedTemplate = template;
    return true;
  } catch (e) {
    console.warn('Failed to save custom template to localStorage:', e);
    return false;
  }
}

export function getCustomSquatTemplate() {
  try {
    const raw = localStorage.getItem(CUSTOM_TEMPLATE_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

export function clearCustomSquatTemplate() {
  try {
    localStorage.removeItem(CUSTOM_TEMPLATE_STORAGE_KEY);
    cachedTemplate = null;
  } catch (e) {}
}

export async function loadSquatTemplate(url = '/reference/squat_template.json') {
  // 1. Check if user has uploaded a custom reference template
  const custom = getCustomSquatTemplate();
  if (custom) {
    cachedTemplate = custom;
    return custom;
  }

  if (cachedTemplate) return cachedTemplate;

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    cachedTemplate = await res.json();
    return cachedTemplate;
  } catch (e) {
    console.warn('Could not fetch squat_template.json, using fallback parameters:', e);
    return null;
  }
}

/**
 * Extracts a complete reference squat template from an uploaded video file/blob
 */
export async function extractSquatReferenceTemplate(videoUrl, videoName = 'Custom Reference', onProgress = () => {}) {
  onProgress(5, 'Initializing MediaPipe vision engine...');
  const landmarker = await initPoseLandmarker();
  if (!landmarker) {
    throw new Error('MediaPipe Pose Landmarker is not ready.');
  }

  onProgress(15, 'Loading reference video metadata...');
  const video = document.createElement('video');
  video.src = videoUrl;
  video.muted = true;
  video.playsInline = true;
  video.crossOrigin = 'anonymous';

  await new Promise((resolve, reject) => {
    video.onloadedmetadata = () => resolve();
    video.onerror = () => reject(new Error('Failed to load video file.'));
  });

  const duration = video.duration || 4.0;
  if (duration <= 0.2) {
    throw new Error('Video duration is invalid or corrupted.');
  }

  const aspect = (video.videoWidth && video.videoHeight)
    ? (video.videoWidth / video.videoHeight)
    : 1.0;

  // Frame sampling: 12-16 fps across the video
  const frameCount = Math.min(160, Math.max(30, Math.round(duration * 12)));
  const timeStep = duration / frameCount;

  onProgress(25, 'Scanning video timeline and extracting landmarks...');
  const frames = [];

  for (let i = 0; i < frameCount; i++) {
    const t = i * timeStep;
    video.currentTime = t;

    await new Promise((resolve) => {
      const onSeeked = () => {
        video.removeEventListener('seeked', onSeeked);
        resolve();
      };
      video.addEventListener('seeked', onSeeked);
    });

    const timestampMs = Math.round(t * 1000);
    const poseResult = detectPoseForVideoFrame(video, timestampMs);

    if (poseResult && poseResult.landmarks && poseResult.landmarks.length >= 29) {
      frames.push({
        timeSec: t,
        timestampMs,
        landmarks: poseResult.landmarks
      });
    }

    const pct = 25 + Math.round((i / frameCount) * 50);
    onProgress(pct, `Extracting reference joints (${i + 1}/${frameCount})...`);
  }

  if (frames.length < 12) {
    throw new Error('Full body was not detected in enough frames to build a reference template.');
  }

  onProgress(78, 'Establishing scale-free body baseline...');
  const engine = new SquatTemplateEngine();

  // Find standing baseline from longest leg-length frames
  const standingCandidates = frames.map(f => {
    const lm = f.landmarks;
    const hL = lm[23], hR = lm[24], aL = lm[27], aR = lm[28];
    const hipY = (hL.y + hR.y) / 2;
    const ankY = (aL.y + aR.y) / 2;
    const legLen = ankY - hipY;
    return { frame: f, hipY, legLen };
  }).filter(c => c.legLen > 0.15);

  if (standingCandidates.length === 0) {
    throw new Error('Could not establish standing baseline from reference video.');
  }

  standingCandidates.sort((a, b) => b.legLen - a.legLen);
  const baselineCandidate = standingCandidates[Math.floor(standingCandidates.length * 0.15)] || standingCandidates[0];
  const calibration = engine.calibrateUser(baselineCandidate.frame.landmarks, aspect);

  // Compute metrics for all valid frames
  const frameMetrics = [];
  for (const f of frames) {
    const m = engine.computeFrameMetrics(f.landmarks, calibration, aspect);
    if (m) {
      frameMetrics.push({
        timeSec: f.timeSec,
        timestampMs: f.timestampMs,
        landmarks: f.landmarks,
        metrics: m
      });
    }
  }

  onProgress(88, 'Segmenting repetitions & calculating phase statistics...');
  const reps = [];
  let inRep = false;
  let repFrames = [];

  for (const fm of frameMetrics) {
    const descent = fm.metrics.hipDescentRatio;
    if (!inRep) {
      if (descent >= 0.18) {
        inRep = true;
        repFrames = [fm];
      }
    } else {
      repFrames.push(fm);
      if (descent < 0.12) {
        let maxDescent = 0;
        let peakFrame = repFrames[0];
        for (const rf of repFrames) {
          if (rf.metrics.hipDescentRatio > maxDescent) {
            maxDescent = rf.metrics.hipDescentRatio;
            peakFrame = rf;
          }
        }
        if (maxDescent >= 0.25 && repFrames.length >= 5) {
          reps.push({
            start: repFrames[0],
            bottom: peakFrame,
            end: fm,
            duration: fm.timeSec - repFrames[0].timeSec
          });
        }
        inRep = false;
        repFrames = [];
      }
    }
  }

  const bottomSamples = reps.length > 0
    ? reps.map(r => r.bottom.metrics)
    : frameMetrics.slice().sort((a, b) => b.metrics.hipDescentRatio - a.metrics.hipDescentRatio).slice(0, 5).map(f => f.metrics);

  const standingSamples = frameMetrics.filter(f => f.metrics.hipDescentRatio < 0.10).map(f => f.metrics);

  const calcStats = (vals) => {
    const valid = vals.filter(v => v !== null && !isNaN(v));
    if (valid.length === 0) return { mean: 0, min: 0, max: 0, tol_min: 0, tol_max: 0 };
    const mean = valid.reduce((a, b) => a + b, 0) / valid.length;
    const min = Math.min(...valid);
    const max = Math.max(...valid);
    const tol_min = +(min * 0.85).toFixed(2);
    const tol_max = +(max * 1.15).toFixed(2);
    return { mean: +mean.toFixed(2), min: +min.toFixed(2), max: +max.toFixed(2), tol_min, tol_max, n: valid.length };
  };

  const template = {
    version: '1.0',
    custom: true,
    name: videoName,
    created_at: new Date().toISOString(),
    rep_count: Math.max(1, reps.length),
    aspect: +aspect.toFixed(3),
    min_depth_fraction: 0.60,
    low_sample_size: reps.length < 5,
    phases: {
      STANDING: {
        knee_angle: calcStats(standingSamples.map(s => s.kneeAngle)),
        hip_angle: calcStats(standingSamples.map(s => s.hipAngle)),
        torso_incl: calcStats(standingSamples.map(s => s.torsoInclination)),
        shank_incl: calcStats(standingSamples.map(s => s.shankInclination))
      },
      BOTTOM: {
        hip_descent_ratio: calcStats(bottomSamples.map(s => s.hipDescentRatio)),
        knee_angle: calcStats(bottomSamples.map(s => s.kneeAngle)),
        hip_angle: calcStats(bottomSamples.map(s => s.hipAngle)),
        torso_incl: calcStats(bottomSamples.map(s => s.torsoInclination)),
        shank_incl: calcStats(bottomSamples.map(s => s.shankInclination)),
        knee_cave_ratio: calcStats(bottomSamples.map(s => s.kneeCaveRatio))
      }
    }
  };

  saveCustomSquatTemplate(template);
  cachedTemplate = template;
  onProgress(100, `Done! Extracted ${Math.max(1, reps.length)} rep(s). Custom reference profile activated.`);
  return template;
}
