// MediaPipe Pose Landmarker and Kinematic Detection Engine
import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision';

let landmarkerInstance = null;
let isInitializing = false;
let initFailed = false;
let lastInitError = null;
let lastVideoTimestamp = -1;

export function getInitError() {
  return lastInitError;
}

export function isLandmarkerReady() {
  return !!landmarkerInstance;
}

export function resetPoseLandmarker() {
  landmarkerInstance = null;
  isInitializing = false;
  initFailed = false;
  lastInitError = null;
  lastVideoTimestamp = -1;
}

/**
 * Initializes MediaPipe Pose Landmarker:
 * 1. Primary: Local /public assets (/wasm and /models/pose_landmarker_lite.task)
 * 2. Fallback: Official CDN assets if local files fail
 * 3. Gracefully tries GPU delegate first, then CPU delegate
 */
export async function initPoseLandmarker() {
  if (landmarkerInstance) return landmarkerInstance;
  if (isInitializing) {
    let count = 0;
    while (isInitializing && count < 35) {
      await new Promise(r => setTimeout(r, 100));
      count++;
    }
    return landmarkerInstance;
  }

  isInitializing = true;
  initFailed = false;
  lastInitError = null;

  const base = (typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL) || '/';
  const cleanBase = base.endsWith('/') ? base : `${base}/`;

  // Configurations to attempt: local first, then CDN
  const configs = [
    {
      name: 'Local /public bundle',
      wasmPath: `${cleanBase}wasm`,
      modelPath: `${cleanBase}models/pose_landmarker_lite.task`
    },
    {
      name: 'CDN Fallback',
      wasmPath: 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm',
      modelPath: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task'
    }
  ];

  for (const cfg of configs) {
    try {
      console.log(`[MediaPipe] Initializing using ${cfg.name}...`);
      const vision = await FilesetResolver.forVisionTasks(cfg.wasmPath);

      // Attempt GPU delegate first
      try {
        landmarkerInstance = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: cfg.modelPath,
            delegate: 'GPU'
          },
          runningMode: 'VIDEO',
          numPoses: 1,
          minPoseDetectionConfidence: 0.35,
          minPosePresenceConfidence: 0.35,
          minTrackingConfidence: 0.35
        });
        console.log(`✅ MediaPipe Pose Landmarker initialized successfully via ${cfg.name} (GPU Delegate)`);
        isInitializing = false;
        return landmarkerInstance;
      } catch (gpuErr) {
        console.warn(`[MediaPipe] GPU delegate failed for ${cfg.name}, trying CPU delegate...`, gpuErr);
        // Fallback to CPU delegate
        landmarkerInstance = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: cfg.modelPath,
            delegate: 'CPU'
          },
          runningMode: 'VIDEO',
          numPoses: 1,
          minPoseDetectionConfidence: 0.35,
          minPosePresenceConfidence: 0.35,
          minTrackingConfidence: 0.35
        });
        console.log(`✅ MediaPipe Pose Landmarker initialized successfully via ${cfg.name} (CPU Delegate)`);
        isInitializing = false;
        return landmarkerInstance;
      }
    } catch (cfgErr) {
      console.warn(`[MediaPipe] Attempt with ${cfg.name} failed:`, cfgErr.message);
      lastInitError = cfgErr;
    }
  }

  initFailed = true;
  isInitializing = false;
  console.error('❌ MediaPipe Pose Landmarker initialization failed on both local and CDN paths:', lastInitError);
  return null;
}

/**
 * Detects pose landmarks from a video element at a specific timestamp
 * Strictly enforces monotonically increasing timestamps required by MediaPipe Tasks-Vision.
 */
export function detectPoseForVideoFrame(videoElement, timestampMs) {
  if (!landmarkerInstance || !videoElement || videoElement.readyState < 2) {
    return null;
  }

  if (!videoElement.videoWidth || !videoElement.videoHeight) {
    return null;
  }

  // Ensure monotonically increasing timestamp for MediaPipe Video Mode
  const validTimestamp = Math.max(timestampMs, lastVideoTimestamp + 1);
  lastVideoTimestamp = validTimestamp;

  try {
    const results = landmarkerInstance.detectForVideo(videoElement, validTimestamp);
    if (results && results.landmarks && results.landmarks.length > 0) {
      return {
        landmarks: results.landmarks[0],
        mode: 'LIVE_MEDIAPIPE',
        timestamp: validTimestamp
      };
    }
  } catch (e) {
    console.warn('MediaPipe frame detection error:', e);
  }
  return null;
}

/**
 * Generates an anatomically correct synthetic landmark sequence for exercise demonstration
 * when running in Calibrated Benchmark Mode (DEMO MODE) or for reference previews.
 * Normalized coordinates (0 to 1).
 */
export function generateKinematicLandmarks(exerciseId, progressNormalized, isUserWithError = false, amplitude = 1.0) {
  // progressNormalized: 0 -> 1 representing a full repetition cycle (eccentric + concentric)
  // Biomechanical cycle: 0 at top starting position, 1 at bottom inflection, 0 at return to top lockout
  const depth = ((1 - Math.cos(progressNormalized * Math.PI * 2)) / 2) * amplitude;

  const landmarks = [];
  for (let i = 0; i < 33; i++) {
    landmarks.push({ x: 0.5, y: 0.5, z: 0, visibility: 0.95 });
  }

  if (exerciseId === 'weighted-squats' || exerciseId === 'basic-squats' || exerciseId?.includes('squat')) {
    // Base positions
    const headY = 0.22 + depth * 0.18;
    const shoulderY = 0.30 + depth * 0.20;
    const hipY = 0.52 + depth * 0.22;
    const kneeY = 0.70 + depth * 0.05;
    const ankleY = 0.88;

    // Head
    landmarks[0] = { x: 0.5, y: headY, z: 0, visibility: 1 };

    // Shoulders
    landmarks[11] = { x: 0.44, y: shoulderY, z: 0.02, visibility: 1 };
    landmarks[12] = { x: 0.56, y: shoulderY, z: -0.02, visibility: 1 };

    // Elbows & Wrists (holding weight in front)
    landmarks[13] = { x: 0.43, y: shoulderY + 0.09, z: 0.05, visibility: 1 };
    landmarks[14] = { x: 0.57, y: shoulderY + 0.09, z: 0.05, visibility: 1 };
    landmarks[15] = { x: 0.47, y: shoulderY + 0.06, z: 0.1, visibility: 1 };
    landmarks[16] = { x: 0.53, y: shoulderY + 0.06, z: 0.1, visibility: 1 };

    // Hips
    landmarks[23] = { x: 0.45, y: hipY, z: 0, visibility: 1 };
    landmarks[24] = { x: 0.55, y: hipY, z: 0, visibility: 1 };

    // Knees (if isUserWithError, knees collapse inward at depth!)
    const kneeCave = isUserWithError ? depth * 0.045 : 0;
    landmarks[25] = { x: 0.41 + kneeCave, y: kneeY, z: 0.05, visibility: 1 };
    landmarks[26] = { x: 0.59 - kneeCave, y: kneeY, z: 0.05, visibility: 1 };

    // Ankles
    landmarks[27] = { x: 0.42, y: ankleY, z: 0, visibility: 1 };
    landmarks[28] = { x: 0.58, y: ankleY, z: 0, visibility: 1 };

    // Feet
    landmarks[31] = { x: 0.40, y: ankleY + 0.03, z: 0.02, visibility: 1 };
    landmarks[32] = { x: 0.60, y: ankleY + 0.03, z: 0.02, visibility: 1 };
  } else if (exerciseId === 'upright-dumbbell-row') {
    // Upright Row: arms lift upwards
    const armLift = depth; // 0 = at thighs, 1 = at peak
    const elbowTooHigh = isUserWithError ? armLift * 0.08 : 0;
    const wristHyperflex = isUserWithError ? armLift * 0.05 : 0;

    landmarks[0] = { x: 0.5, y: 0.22, z: 0, visibility: 1 };

    // Shoulders
    landmarks[11] = { x: 0.43, y: 0.32, z: 0, visibility: 1 };
    landmarks[12] = { x: 0.57, y: 0.32, z: 0, visibility: 1 };

    // Elbows: rise from hips (y=0.52) to shoulders (y=0.32 or higher if error)
    const elbowY = 0.52 - armLift * 0.20 - elbowTooHigh;
    landmarks[13] = { x: 0.36 - armLift * 0.08, y: elbowY, z: 0, visibility: 1 };
    landmarks[14] = { x: 0.64 + armLift * 0.08, y: elbowY, z: 0, visibility: 1 };

    // Wrists: rise but should remain below elbows
    const wristY = 0.65 - armLift * 0.26 - wristHyperflex;
    landmarks[15] = { x: 0.46, y: wristY, z: 0.05, visibility: 1 };
    landmarks[16] = { x: 0.54, y: wristY, z: 0.05, visibility: 1 };

    // Hips
    landmarks[23] = { x: 0.45, y: 0.56, z: 0, visibility: 1 };
    landmarks[24] = { x: 0.55, y: 0.56, z: 0, visibility: 1 };

    // Knees & Ankles
    landmarks[25] = { x: 0.45, y: 0.74, z: 0, visibility: 1 };
    landmarks[26] = { x: 0.55, y: 0.74, z: 0, visibility: 1 };
    landmarks[27] = { x: 0.45, y: 0.90, z: 0, visibility: 1 };
    landmarks[28] = { x: 0.55, y: 0.90, z: 0, visibility: 1 };
  } else if (exerciseId === 'forward-dumbbell-row') {
    // Bent over row (side view or 3/4 view)
    const pullAmount = depth;
    const backRounding = isUserWithError ? 0.03 : 0;

    landmarks[0] = { x: 0.38, y: 0.36 + backRounding, z: 0, visibility: 1 };
    landmarks[11] = { x: 0.43, y: 0.42 + backRounding, z: 0, visibility: 1 };
    landmarks[12] = { x: 0.47, y: 0.44 + backRounding, z: 0, visibility: 1 };

    // Elbows drive backward and up
    const elbowY = 0.62 - pullAmount * 0.16;
    const elbowX = 0.44 + pullAmount * 0.06;
    landmarks[13] = { x: elbowX, y: elbowY, z: 0.05, visibility: 1 };
    landmarks[14] = { x: elbowX + 0.04, y: elbowY, z: 0.05, visibility: 1 };

    // Wrists
    const wristY = 0.74 - pullAmount * 0.18;
    landmarks[15] = { x: 0.45, y: wristY, z: 0, visibility: 1 };
    landmarks[16] = { x: 0.49, y: wristY, z: 0, visibility: 1 };

    // Hips (hinged back)
    landmarks[23] = { x: 0.58, y: 0.52, z: 0, visibility: 1 };
    landmarks[24] = { x: 0.62, y: 0.53, z: 0, visibility: 1 };

    // Knees & Ankles
    landmarks[25] = { x: 0.54, y: 0.72, z: 0, visibility: 1 };
    landmarks[26] = { x: 0.58, y: 0.73, z: 0, visibility: 1 };
    landmarks[27] = { x: 0.52, y: 0.88, z: 0, visibility: 1 };
    landmarks[28] = { x: 0.56, y: 0.89, z: 0, visibility: 1 };
  } else if (exerciseId === 'pushups') {
    // Standard Pushup: plank posture with upper-body press
    const pushDepth = depth; // 0 = at top lockout, 1 = chest near floor
    const hipSag = isUserWithError ? 0.06 * (1 - pushDepth * 0.5) : 0; // Hip sag error
    const elbowFlareOut = isUserWithError ? 0.05 : 0;

    const shoulderY = 0.48 + pushDepth * 0.16;
    const hipY = 0.50 + pushDepth * 0.16 + hipSag;
    const kneeY = 0.58 + pushDepth * 0.12;
    const ankleY = 0.70;

    landmarks[0] = { x: 0.28, y: shoulderY - 0.06, z: 0, visibility: 1 }; // Head

    // Shoulders
    landmarks[11] = { x: 0.38, y: shoulderY - 0.02, z: 0.02, visibility: 1 };
    landmarks[12] = { x: 0.42, y: shoulderY + 0.02, z: -0.02, visibility: 1 };

    // Elbows: flex backward (and flare out if error)
    const elbowY = shoulderY + 0.10 + pushDepth * 0.04;
    const elbowX = 0.34 - pushDepth * 0.04 - elbowFlareOut;
    landmarks[13] = { x: elbowX, y: elbowY, z: 0.04, visibility: 1 };
    landmarks[14] = { x: elbowX + 0.08, y: elbowY, z: -0.04, visibility: 1 };

    // Wrists grounded on floor
    landmarks[15] = { x: 0.38, y: 0.72, z: 0.05, visibility: 1 };
    landmarks[16] = { x: 0.44, y: 0.72, z: -0.05, visibility: 1 };

    // Hips
    landmarks[23] = { x: 0.58, y: hipY, z: 0, visibility: 1 };
    landmarks[24] = { x: 0.62, y: hipY, z: 0, visibility: 1 };

    // Knees & Ankles
    landmarks[25] = { x: 0.72, y: kneeY, z: 0, visibility: 1 };
    landmarks[26] = { x: 0.75, y: kneeY, z: 0, visibility: 1 };
    landmarks[27] = { x: 0.86, y: ankleY, z: 0, visibility: 1 };
    landmarks[28] = { x: 0.88, y: ankleY, z: 0, visibility: 1 };
  } else {
    // Single-Hand Row (side-on bench position)
    const pullAmount = depth;
    const chestRotation = isUserWithError ? pullAmount * 0.05 : 0;

    landmarks[0] = { x: 0.36, y: 0.38, z: 0, visibility: 1 };
    landmarks[11] = { x: 0.42, y: 0.44 - chestRotation, z: 0, visibility: 1 };
    landmarks[12] = { x: 0.46, y: 0.46 + chestRotation, z: 0, visibility: 1 };

    // Working arm (left) pulls up to hip
    landmarks[13] = { x: 0.45 + pullAmount * 0.08, y: 0.66 - pullAmount * 0.18, z: 0, visibility: 1 };
    landmarks[15] = { x: 0.48 + pullAmount * 0.04, y: 0.75 - pullAmount * 0.20, z: 0, visibility: 1 };

    // Supporting arm (right) braced on bench
    landmarks[14] = { x: 0.38, y: 0.56, z: 0, visibility: 1 };
    landmarks[16] = { x: 0.38, y: 0.68, z: 0, visibility: 1 };

    // Hips
    landmarks[23] = { x: 0.62, y: 0.52, z: 0, visibility: 1 };
    landmarks[24] = { x: 0.66, y: 0.53, z: 0, visibility: 1 };

    // Legs: one kneeling, one standing
    landmarks[25] = { x: 0.55, y: 0.66, z: 0, visibility: 1 };
    landmarks[27] = { x: 0.65, y: 0.66, z: 0, visibility: 1 };
    landmarks[26] = { x: 0.68, y: 0.74, z: 0, visibility: 1 };
    landmarks[28] = { x: 0.68, y: 0.88, z: 0, visibility: 1 };
  }

  return landmarks;
}

