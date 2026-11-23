// Canvas Dual Exoskeleton & Biomechanical Guidance Overlay Renderer
// Features:
// 1. Target Ghost Exoskeleton (Benchmark "Right Position")
// 2. User Live Exoskeleton (Current Athlete Position with dynamic color coding)
// 3. Dynamic Guidance Connectors ("You are here -> Bend till here")
// 4. Mirror-Aware Forward Text Rendering (Zero backwards/flipped text)

import { SKELETON_CONNECTIONS, calculateJointAngle } from './angleCalculator.js';

/**
 * Generates an anatomically aligned Target Ghost Exoskeleton ("Right Position")
 * scaled and aligned directly to the user's detected body dimensions.
 * Now reflects the target for the CURRENT EXERCISE PHASE (Top Lockout vs Bottom Inflection).
 */
export function generateTargetGhostLandmarks(userLandmarks, exerciseId = 'weighted-squats', currentPhase = 'BOTTOM_POSITION') {
  if (!userLandmarks || userLandmarks.length < 29) return null;

  const sL = userLandmarks[11], sR = userLandmarks[12];
  const eL = userLandmarks[13], eR = userLandmarks[14];
  const wL = userLandmarks[15], wR = userLandmarks[16];
  const hL = userLandmarks[23], hR = userLandmarks[24];
  const kL = userLandmarks[25], kR = userLandmarks[26];
  const aL = userLandmarks[27], aR = userLandmarks[28];

  // Clone user landmarks as foundation
  const target = userLandmarks.map(lm => ({ ...lm, visibility: 0.95 }));

  const isTopPhase = currentPhase === 'TOP_POSITION' || currentPhase === 'READY' || currentPhase === 'CALIBRATING';

  // 1. PUSHUPS TARGET EXOSKELETON
  if (exerciseId === 'pushups') {
    // Orientation Guard: If user is sitting/standing upright (not in plank), don't draw horizontal ghost over head
    if (sL && hL && (hL.y - sL.y > 0.35)) {
      return null;
    }

    const avgWristY = ((wL?.y || 0.72) + (wR?.y || 0.72)) / 2;
    const avgWristX = ((wL?.x || 0.40) + (wR?.x || 0.60)) / 2;
    const handSpread = Math.abs((wR?.x || 0.60) - (wL?.x || 0.40)) || 0.22;

    if (isTopPhase) {
      // Top Position: Arms fully extended in high plank
      const topShoulderY = Math.max(0.18, avgWristY - 0.28);
      const topElbowY = avgWristY - 0.14;

      if (target[11]) target[11] = { x: avgWristX - handSpread * 0.45, y: topShoulderY, z: 0.02, visibility: 1 };
      if (target[12]) target[12] = { x: avgWristX + handSpread * 0.45, y: topShoulderY, z: 0.02, visibility: 1 };
      if (target[13]) target[13] = { x: avgWristX - handSpread * 0.48, y: topElbowY, z: 0, visibility: 1 };
      if (target[14]) target[14] = { x: avgWristX + handSpread * 0.48, y: topElbowY, z: 0, visibility: 1 };

      const ankleY = ((aL?.y || 0.85) + (aR?.y || 0.85)) / 2;
      const targetHipY = topShoulderY + (ankleY - topShoulderY) * 0.45;
      if (target[23]) target[23] = { x: hL?.x || 0.46, y: targetHipY, z: 0, visibility: 1 };
      if (target[24]) target[24] = { x: hR?.x || 0.54, y: targetHipY, z: 0, visibility: 1 };
    } else {
      // Bottom Position: Chest descended to 90° chest-to-floor depth (~0.08 above floor)
      const targetShoulderY = Math.max(0.25, avgWristY - 0.08);
      const targetElbowY = targetShoulderY + 0.04;

      if (target[11]) target[11] = { x: avgWristX - handSpread * 0.45, y: targetShoulderY, z: 0.02, visibility: 1 };
      if (target[12]) target[12] = { x: avgWristX + handSpread * 0.45, y: targetShoulderY, z: 0.02, visibility: 1 };
      if (target[13]) target[13] = { x: avgWristX - handSpread * 0.65, y: targetElbowY, z: -0.05, visibility: 1 };
      if (target[14]) target[14] = { x: avgWristX + handSpread * 0.65, y: targetElbowY, z: -0.05, visibility: 1 };

      const ankleY = ((aL?.y || 0.85) + (aR?.y || 0.85)) / 2;
      const plankLength = Math.max(0.3, ankleY - targetShoulderY);
      const targetHipY = targetShoulderY + plankLength * 0.42;

      if (target[23]) target[23] = { x: (hL?.x || 0.46), y: targetHipY, z: 0, visibility: 1 };
      if (target[24]) target[24] = { x: (hR?.x || 0.54), y: targetHipY, z: 0, visibility: 1 };
      if (target[25]) target[25] = { x: (kL?.x || 0.47), y: targetHipY + plankLength * 0.30, z: 0, visibility: 1 };
      if (target[26]) target[26] = { x: (kR?.x || 0.53), y: targetHipY + plankLength * 0.30, z: 0, visibility: 1 };
    }

  // 2. SQUATS TARGET EXOSKELETON
  } else if (exerciseId === 'weighted-squats' || exerciseId === 'basic-squats' || exerciseId?.includes('squat')) {
    const avgAnkleY = ((aL?.y || 0.88) + (aR?.y || 0.88)) / 2;
    const stanceWidth = Math.abs((aR?.x || 0.60) - (aL?.x || 0.40)) || 0.22;
    const midX = ((aL?.x || 0.40) + (aR?.x || 0.60)) / 2;

    if (isTopPhase) {
      // Standing upright lockout
      const targetHipY = avgAnkleY - 0.46;
      const targetKneeY = avgAnkleY - 0.23;
      const targetShoulderY = targetHipY - 0.32;

      if (target[25]) target[25] = { x: midX - stanceWidth * 0.45, y: targetKneeY, z: 0, visibility: 1 };
      if (target[26]) target[26] = { x: midX + stanceWidth * 0.45, y: targetKneeY, z: 0, visibility: 1 };
      if (target[23]) target[23] = { x: midX - stanceWidth * 0.40, y: targetHipY, z: 0, visibility: 1 };
      if (target[24]) target[24] = { x: midX + stanceWidth * 0.40, y: targetHipY, z: 0, visibility: 1 };
      if (target[11]) target[11] = { x: midX - stanceWidth * 0.40, y: targetShoulderY, z: 0, visibility: 1 };
      if (target[12]) target[12] = { x: midX + stanceWidth * 0.40, y: targetShoulderY, z: 0, visibility: 1 };
    } else {
      // At parallel bottom position
      const targetKneeY = avgAnkleY - 0.22;
      const targetHipY = targetKneeY + 0.02; // parallel hip crease
      const targetShoulderY = targetHipY - 0.30;

      if (target[25]) target[25] = { x: (aL?.x || midX - stanceWidth * 0.5) - 0.02, y: targetKneeY, z: 0, visibility: 1 };
      if (target[26]) target[26] = { x: (aR?.x || midX + stanceWidth * 0.5) + 0.02, y: targetKneeY, z: 0, visibility: 1 };
      if (target[23]) target[23] = { x: midX - stanceWidth * 0.35, y: targetHipY, z: 0, visibility: 1 };
      if (target[24]) target[24] = { x: midX + stanceWidth * 0.35, y: targetHipY, z: 0, visibility: 1 };
      if (target[11]) target[11] = { x: midX - stanceWidth * 0.38, y: targetShoulderY, z: 0, visibility: 1 };
      if (target[12]) target[12] = { x: midX + stanceWidth * 0.38, y: targetShoulderY, z: 0, visibility: 1 };
    }
  }

  return target;
}

/**
 * Draws the complete dual exoskeleton visualization on canvas:
 * 1. Ghost Benchmark Exoskeleton ("Right Position")
 * 2. Active User Exoskeleton ("User Position")
 * 3. Directional Guidance Connectors ("You are here -> Bend till here")
 * Always renders text forward and readable (no mirror inversion).
 */
export function drawSkeletonOnCanvas(ctx, landmarks, options = {}) {
  if (!ctx || !landmarks || landmarks.length === 0) return;

  const width = ctx.canvas?.width || 640;
  const height = ctx.canvas?.height || 480;

  const {
    showDualExoskeleton = false,
    showGhostTarget = false,      // Default: OFF (Requirement 4)
    showUserSkeleton = true,
    showAdvancedOverlay = false,  // Default: OFF (Requirement 3 & 4)
    showAngles = false,
    showDepthHUD = false,
    isCalibrated = false,
    isMirrored = false,
    accentColor = '#7F00FF',
    warningColor = '#D97706',
    dangerColor = '#DC2626',
    highlightedJoints = [],
    exerciseId = 'weighted-squats',
    depthPercentage = 0,
    currentAngle = null,
    targetAngle = 90,
    needToBend = null,
    jointLabel = 'Elbow',
    currentState = 'BOTTOM_POSITION',
    formStatus = 'correct'
  } = options;

  ctx.save();

  // Object-cover crop mapping:
  // Video element uses CSS `object-cover`, scaling the native video (vw x vh) to cover the canvas (cw x ch).
  // Compute the cover scale and centering crop offsets so skeleton directly aligns with video limbs.
  const vw = options.videoWidth || width;
  const vh = options.videoHeight || height;
  const coverScale = Math.max(width / vw, height / vh);
  const offsetX = (width - vw * coverScale) / 2;
  const offsetY = (height - vh * coverScale) / 2;

  // Internal coordinate transformation that handles object-cover crop and selfie mirroring WITHOUT mirroring the text
  const toPixels = (lm) => {
    if (!lm) return { x: 0, y: 0, visibility: 0 };
    const rawX = isMirrored ? (1 - lm.x) : lm.x;
    const rawY = lm.y;
    return {
      x: rawX * vw * coverScale + offsetX,
      y: rawY * vh * coverScale + offsetY,
      visibility: lm.visibility !== undefined ? lm.visibility : 1
    };
  };

  // =========================================================================
  // LAYER 1: TARGET GHOST EXOSKELETON (OPT-IN ONLY)
  // =========================================================================
  // Draw ghost ONLY if user enabled it, calibration passed, and tracking is OK.
  // Hide during TRACKING_PAUSED, TRACKING_LOST, CALIBRATING, or WAITING states.
  const isInvalidStateForGhost = currentState === 'TRACKING_PAUSED' ||
    currentState === 'TRACKING_LOST' ||
    currentState === 'CALIBRATING' ||
    currentState === 'WAITING_FOR_START' ||
    currentState === 'WAITING_FOR_POSITION' ||
    formStatus === 'unavailable';

  const shouldDrawGhost = showGhostTarget && isCalibrated && !isInvalidStateForGhost;
  const ghostLandmarks = shouldDrawGhost
    ? generateTargetGhostLandmarks(landmarks, exerciseId, currentState)
    : null;

  if (ghostLandmarks) {
    ctx.save();
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = 'rgba(127, 0, 255, 0.40)'; // Semi-transparent subtle purple
    ctx.shadowBlur = 0;

    // Draw Ghost Bones
    for (const [idxA, idxB] of SKELETON_CONNECTIONS) {
      const gA = ghostLandmarks[idxA];
      const gB = ghostLandmarks[idxB];
      if (!gA || !gB) continue;

      const pA = toPixels(gA);
      const pB = toPixels(gB);

      ctx.beginPath();
      ctx.moveTo(pA.x, pA.y);
      ctx.lineTo(pB.x, pB.y);
      ctx.stroke();
    }

    // Ghost Target Joint Dots (small 3px dots, no giant glowing bullseyes)
    ctx.setLineDash([]);
    const keyTargetJoints = exerciseId.includes('squat') ? [25, 26, 23, 24] : [13, 14, 11, 12];
    for (const jIdx of keyTargetJoints) {
      const gNode = ghostLandmarks[jIdx];
      if (!gNode) continue;
      const p = toPixels(gNode);
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(127, 0, 255, 0.65)';
      ctx.fill();
    }

    // At most ONE single header badge for the ghost
    const ghostHead = ghostLandmarks[0] || ghostLandmarks[11];
    if (ghostHead) {
      const pHead = toPixels(ghostHead);
      drawGhostHeaderBadge(ctx, pHead.x, Math.max(22, pHead.y - 24), 'TARGET FORM');
    }

    ctx.restore();
  }

  // =========================================================================
  // LAYER 2: USER'S LIVE EXOSKELETON (MINIMAL DEFAULT OVERLAY)
  // =========================================================================
  // Small dots (3.5px), thin semi-transparent lines, visible joints only (>=0.5)
  // Nothing drawn over face area (indices 11-32 only).
  const isTrackingLost = formStatus === 'unavailable' || currentState === 'TRACKING_LOST' || currentState === 'TRACKING_PAUSED';
  if (showUserSkeleton && !isTrackingLost) {
    ctx.save();
    ctx.lineWidth = 1.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.shadowBlur = 0; // Protect view: zero shadow blur

    let baseColor = 'rgba(22, 163, 74, 0.45)'; // Semi-transparent green
    if (formStatus === 'incorrect') {
      baseColor = 'rgba(220, 38, 38, 0.55)';
    } else if (formStatus === 'attention') {
      baseColor = 'rgba(217, 119, 6, 0.50)';
    }

    // Draw connecting lines for tracked joints with visibility >= 0.5
    for (const [idxA, idxB] of SKELETON_CONNECTIONS) {
      const lmA = landmarks[idxA];
      const lmB = landmarks[idxB];
      if (!lmA || !lmB) continue;

      const visA = lmA.visibility !== undefined ? lmA.visibility : 1;
      const visB = lmB.visibility !== undefined ? lmB.visibility : 1;
      if (visA < 0.5 || visB < 0.5) continue; // Gate: hide low-visibility segments

      const pA = toPixels(lmA);
      const pB = toPixels(lmB);
      const isDanger = highlightedJoints.includes(idxA) || highlightedJoints.includes(idxB);

      ctx.beginPath();
      ctx.moveTo(pA.x, pA.y);
      ctx.lineTo(pB.x, pB.y);
      ctx.strokeStyle = isDanger ? 'rgba(220, 38, 38, 0.65)' : baseColor;
      ctx.stroke();
    }

    // Draw small joint nodes (3.5px) for body joints 11 to 32 only (No face area drawn)
    for (let i = 11; i <= 32; i++) {
      const lm = landmarks[i];
      if (!lm) continue;
      const vis = lm.visibility !== undefined ? lm.visibility : 1;
      if (vis < 0.5) continue; // Gate: visible joints only

      const p = toPixels(lm);
      const isFlagged = highlightedJoints.includes(i);

      let nodeColor;
      if (isFlagged) {
        nodeColor = '#DC2626';
      } else if (vis >= 0.70) {
        nodeColor = '#16A34A';
      } else {
        nodeColor = '#D97706';
      }

      ctx.beginPath();
      ctx.arc(p.x, p.y, 3.5, 0, 2 * Math.PI);
      ctx.fillStyle = nodeColor;
      ctx.fill();
    }

    ctx.restore();
  }

  // =========================================================================
  // LAYER 3 & 4: ADVANCED OVERLAY (OPT-IN ONLY)
  // =========================================================================
  // Only rendered if user explicitly enabled showAdvancedOverlay
  if (showAdvancedOverlay) {
    if (ghostLandmarks && showDualExoskeleton) {
      drawGuidanceConnectors(
        ctx,
        landmarks,
        ghostLandmarks,
        toPixels,
        exerciseId,
        depthPercentage,
        currentAngle,
        targetAngle,
        needToBend,
        jointLabel
      );
    }

    if (showDepthHUD) {
      drawDepthPercentageHUD(ctx, width, height, depthPercentage, currentAngle, targetAngle, needToBend, exerciseId);
    }
  }

  ctx.restore();
}

/**
 * Draws dynamic directional connector arrows from User joint to Target Ghost joint
 * informing the athlete: "You are at X° -> Bend Y° more to reach 100%"
 */
function drawGuidanceConnectors(
  ctx,
  userLm,
  ghostLm,
  toPixels,
  exerciseId,
  depthPercentage,
  currentAngle,
  targetAngle,
  needToBend,
  jointLabel
) {
  const isSquat = exerciseId === 'weighted-squats' || exerciseId === 'basic-squats' || exerciseId?.includes('squat');
  let jointIdx = 13;
  if (isSquat) {
    const kLvis = userLm[25]?.visibility ?? 0.8;
    const kRvis = userLm[26]?.visibility ?? 0.8;
    jointIdx = kRvis > kLvis ? 26 : 25;
  } else {
    const eLvis = userLm[13]?.visibility ?? 0.8;
    const eRvis = userLm[14]?.visibility ?? 0.8;
    jointIdx = eRvis > eLvis ? 14 : 13;
  }

  const userPoint = userLm[jointIdx] ? toPixels(userLm[jointIdx]) : null;
  const ghostPoint = ghostLm[jointIdx] ? toPixels(ghostLm[jointIdx]) : null;

  if (!userPoint || !ghostPoint) return;

  const dx = ghostPoint.x - userPoint.x;
  const dy = ghostPoint.y - userPoint.y;
  const dist = Math.sqrt(dx * dx + dy * dy);

  // If user is already at target depth (< 18px away), show success lock badge
  if (depthPercentage >= 70 || dist < 18) {
    ctx.save();
    drawSuccessTargetBadge(ctx, userPoint.x, userPoint.y - 20, `✓ Optimal ${jointLabel} Depth! (100%)`);
    ctx.restore();
    return;
  }

  ctx.save();

  // 1. Animated Dashed Vector Line from User joint to Target Ghost joint
  ctx.setLineDash([4, 4]);
  ctx.strokeStyle = '#7F00FF'; // Vibrant Electric Purple
  ctx.lineWidth = 2.5;
  ctx.shadowColor = 'rgba(127, 0, 255, 0.4)';
  ctx.shadowBlur = 6;

  ctx.beginPath();
  ctx.moveTo(userPoint.x, userPoint.y);
  ctx.lineTo(ghostPoint.x, ghostPoint.y);
  ctx.stroke();

  // 2. Arrowhead pointing to Target Position
  const angle = Math.atan2(dy, dx);
  const headLen = 9;
  ctx.setLineDash([]);
  ctx.fillStyle = '#7F00FF';
  ctx.beginPath();
  ctx.moveTo(ghostPoint.x, ghostPoint.y);
  ctx.lineTo(
    ghostPoint.x - headLen * Math.cos(angle - Math.PI / 6),
    ghostPoint.y - headLen * Math.sin(angle - Math.PI / 6)
  );
  ctx.lineTo(
    ghostPoint.x - headLen * Math.cos(angle + Math.PI / 6),
    ghostPoint.y - headLen * Math.sin(angle + Math.PI / 6)
  );
  ctx.closePath();
  ctx.fill();

  // 3. User Position Tag: "You: 145°"
  const userTagText = currentAngle !== null ? `You: ${currentAngle}° (${depthPercentage}%)` : `You are here (${depthPercentage}%)`;
  drawPillTag(ctx, userPoint.x - 10, userPoint.y - 18, userTagText, '#2F3159', '#F3F0FF', '#7F00FF');

  // 4. Vector Midpoint Guidance: "Bend 55° lower"
  const midX = (userPoint.x + ghostPoint.x) / 2;
  const midY = (userPoint.y + ghostPoint.y) / 2;
  const deltaText = needToBend !== null && needToBend > 0
    ? `⬇ Bend ${needToBend}° lower`
    : `⬇ Bend toward target`;
  drawPillTag(ctx, midX + 16, midY, deltaText, '#7F00FF', '#FFFFFF', '#7F00FF');

  // 5. Target Position Tag: "Target: 90°"
  const targetTagText = `Target: ${targetAngle}° (Bend here)`;
  drawPillTag(ctx, ghostPoint.x + 12, ghostPoint.y + 14, targetTagText, '#16A34A', '#DCFCE7', '#16A34A');

  ctx.restore();
}

/**
 * Floating glassmorphism HUD Gauge on canvas displaying real-time depth percentage
 */
function drawDepthPercentageHUD(ctx, width, height, depthPct, currentAngle, targetAngle, needToBend, exerciseId) {
  ctx.save();

  const cardW = 210;
  const cardH = 68;
  const cardX = width - cardW - 16;
  const cardY = 16;

  // Background glass card
  ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
  ctx.shadowColor = 'rgba(47, 49, 89, 0.15)';
  ctx.shadowBlur = 12;
  ctx.strokeStyle = '#E2D9F3';
  ctx.lineWidth = 1.2;

  ctx.beginPath();
  ctx.roundRect(cardX, cardY, cardW, cardH, 14);
  ctx.fill();
  ctx.stroke();

  // Header Title
  ctx.font = 'bold 9.5px "Plus Jakarta Sans", sans-serif';
  ctx.fillStyle = '#696C92';
  ctx.fillText('DUAL EXOSKELETON • DEPTH GAUGE', cardX + 12, cardY + 16);

  // Big Percentage Display
  ctx.font = '900 22px "Plus Jakarta Sans", sans-serif';
  const isFullDepth = depthPct >= 70;
  ctx.fillStyle = isFullDepth ? '#16A34A' : depthPct >= 35 ? '#7F00FF' : '#2F3159';
  ctx.fillText(`${depthPct}%`, cardX + 12, cardY + 40);

  // Status / Delta Text
  ctx.font = '600 10px "Plus Jakarta Sans", sans-serif';
  ctx.fillStyle = isFullDepth ? '#16A34A' : '#2F3159';
  const statusMsg = isFullDepth
    ? '✓ 100% Target Depth Reached!'
    : (needToBend !== null && needToBend > 0)
      ? `Bend ${needToBend}° more`
      : 'Lower body to target';
  ctx.fillText(statusMsg, cardX + 68, cardY + 32);

  // Target Angle label
  ctx.font = '500 9.5px "Plus Jakarta Sans", sans-serif';
  ctx.fillStyle = '#696C92';
  ctx.fillText(`Joint: ${currentAngle || 160}° | Target: ${targetAngle}°`, cardX + 68, cardY + 44);

  // Progress Bar Container
  const barX = cardX + 12;
  const barY = cardY + 52;
  const barW = cardW - 24;
  const barH = 6;

  ctx.fillStyle = '#EDE9FE';
  ctx.beginPath();
  ctx.roundRect(barX, barY, barW, barH, 3);
  ctx.fill();

  // Progress Bar Fill
  const fillW = Math.max(4, (depthPct / 100) * barW);
  ctx.fillStyle = isFullDepth ? '#16A34A' : '#7F00FF';
  ctx.beginPath();
  ctx.roundRect(barX, barY, fillW, barH, 3);
  ctx.fill();

  ctx.restore();
}

/**
 * Draws a clean pill tag with high contrast
 */
function drawPillTag(ctx, x, y, text, textColor, bgColor, borderColor) {
  ctx.save();
  ctx.font = 'bold 10px "Plus Jakarta Sans", sans-serif';
  const textWidth = ctx.measureText(text).width;
  const padX = 7;
  const h = 18;

  ctx.fillStyle = bgColor;
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.roundRect(x - textWidth / 2 - padX, y - h / 2, textWidth + padX * 2, h, 6);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = textColor;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y);
  ctx.restore();
}

/**
 * Success Depth Confirmation Tag
 */
function drawSuccessTargetBadge(ctx, x, y, text) {
  ctx.save();
  ctx.font = 'bold 11px "Plus Jakarta Sans", sans-serif';
  const textWidth = ctx.measureText(text).width;
  const padX = 9;
  const h = 22;

  ctx.fillStyle = '#DCFCE7';
  ctx.strokeStyle = '#16A34A';
  ctx.lineWidth = 1.5;
  ctx.shadowColor = 'rgba(22, 163, 74, 0.4)';
  ctx.shadowBlur = 6;

  ctx.beginPath();
  ctx.roundRect(x - textWidth / 2 - padX, y - h / 2, textWidth + padX * 2, h, 7);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#16A34A';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y);
  ctx.restore();
}

/**
 * Ghost Skeleton Header Tag
 */
function drawGhostHeaderBadge(ctx, x, y, text) {
  ctx.save();
  ctx.font = 'bold 9.5px "Plus Jakarta Sans", sans-serif';
  const textWidth = ctx.measureText(text).width;
  const padX = 8;
  const h = 18;

  ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
  ctx.strokeStyle = '#7F00FF';
  ctx.lineWidth = 1.2;

  ctx.beginPath();
  ctx.roundRect(x - textWidth / 2 - padX, y - h / 2, textWidth + padX * 2, h, 5);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#2F3159';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y);
  ctx.restore();
}

/**
 * =========================================================================
 * LAYER 5: SECONDARY CAMERA PICTURE-IN-PICTURE (PIP) EXOSKELETON RENDERER
 * =========================================================================
 * Renders live back-view skeleton telemetry received from Phone #2 onto a
 * high-contrast dark biomechanical radar canvas for real-time dual-view guidance.
 */
export function drawSecondaryExoskeletonPIP(ctx, landmarks, options = {}) {
  if (!ctx) return;
  const canvas = ctx.canvas;
  const width = options.width || canvas?.width || 260;
  const height = options.height || canvas?.height || 160;

  // 1. Draw live camera preview if available, otherwise dark obsidian cybernetic grid
  ctx.clearRect(0, 0, width, height);

  const previewImg = options.previewImage;
  const hasLivePreview = previewImg && (previewImg.complete || previewImg.width > 0) && (previewImg.naturalWidth > 0 || previewImg.width > 0);

  if (hasLivePreview) {
    try {
      ctx.drawImage(previewImg, 0, 0, width, height);
      // Subtle darkening overlay so the skeleton pops with high contrast
      ctx.fillStyle = 'rgba(15, 23, 42, 0.35)';
      ctx.fillRect(0, 0, width, height);
    } catch (e) {
      ctx.fillStyle = '#0F172A';
      ctx.fillRect(0, 0, width, height);
    }
  } else {
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, '#0F172A'); // Slate-900
    grad.addColorStop(1, '#020617'); // Slate-950
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    // Subtle crosshair grid
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.lineWidth = 1;
    const gridSize = 24;
    for (let x = gridSize; x < width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = gridSize; y < height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
  }

  // Central Vertical Reference Guideline (Plumb line for spinal vertical alignment)
  ctx.strokeStyle = hasLivePreview ? 'rgba(56, 189, 248, 0.4)' : 'rgba(56, 189, 248, 0.25)';
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  ctx.moveTo(width / 2, 8);
  ctx.lineTo(width / 2, height - 8);
  ctx.stroke();
  ctx.setLineDash([]);

  // Empty state if no landmarks yet
  if (!landmarks || landmarks.length === 0) {
    if (!hasLivePreview) {
      ctx.fillStyle = 'rgba(148, 163, 184, 0.65)';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Awaiting Back-View Pose...', width / 2, height / 2 - 8);
      ctx.font = '9px sans-serif';
      ctx.fillStyle = 'rgba(148, 163, 184, 0.4)';
      ctx.fillText('Position Phone #2 behind you', width / 2, height / 2 + 10);
    } else {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Step into back camera view', width / 2, height - 20);
    }
    return;
  }

  // Coordinate projection to PIP viewport
  const toPipPixels = (lm) => {
    if (!lm) return { x: 0, y: 0, visibility: 0 };
    return {
      x: lm.x * width,
      y: lm.y * height,
      visibility: lm.visibility !== undefined ? lm.visibility : 1
    };
  };

  const isSpineGood = options.isSpineGood !== false;
  const spineColor = isSpineGood ? '#10B981' : '#EF4444'; // Emerald green vs Alert red

  // 2. Draw Skeleton Limbs and Bones
  ctx.lineWidth = 2.2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  for (const [idxA, idxB] of SKELETON_CONNECTIONS) {
    const lmA = landmarks[idxA];
    const lmB = landmarks[idxB];
    if (!lmA || !lmB) continue;

    const visA = lmA.visibility !== undefined ? lmA.visibility : 1;
    const visB = lmB.visibility !== undefined ? lmB.visibility : 1;
    if (visA < 0.25 || visB < 0.25) continue;

    const pA = toPipPixels(lmA);
    const pB = toPipPixels(lmB);

    // Torso and spine framing
    const isTorsoBone = (idxA === 11 && idxB === 12) || 
                        (idxA === 23 && idxB === 24) || 
                        (idxA === 11 && idxB === 23) || 
                        (idxA === 12 && idxB === 24);

    ctx.beginPath();
    ctx.moveTo(pA.x, pA.y);
    ctx.lineTo(pB.x, pB.y);
    ctx.strokeStyle = isTorsoBone ? spineColor : 'rgba(56, 189, 248, 0.75)'; // vibrant cyan
    ctx.stroke();
  }

  // 3. Highlight Posterior Spine Column (Upper Spine to Sacrum)
  const leftShoulder = landmarks[11];
  const rightShoulder = landmarks[12];
  const leftHip = landmarks[23];
  const rightHip = landmarks[24];

  if (leftShoulder && rightShoulder && leftHip && rightHip) {
    const midShoulderX = ((leftShoulder.x + rightShoulder.x) / 2) * width;
    const midShoulderY = ((leftShoulder.y + rightShoulder.y) / 2) * height;
    const midHipX = ((leftHip.x + rightHip.x) / 2) * width;
    const midHipY = ((leftHip.y + rightHip.y) / 2) * height;

    // Glowing spinal column line
    ctx.save();
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = spineColor;
    ctx.shadowColor = spineColor;
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.moveTo(midShoulderX, midShoulderY);
    ctx.lineTo(midHipX, midHipY);
    ctx.stroke();
    ctx.restore();

    // Upper and lower spine anchor points
    ctx.beginPath();
    ctx.arc(midShoulderX, midShoulderY, 4, 0, 2 * Math.PI);
    ctx.fillStyle = spineColor;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(midHipX, midHipY, 4, 0, 2 * Math.PI);
    ctx.fillStyle = spineColor;
    ctx.fill();
  }

  // 4. Draw Joint Nodes (Body joints 11 to 32)
  for (let i = 11; i <= 32; i++) {
    const lm = landmarks[i];
    if (!lm) continue;
    const vis = lm.visibility !== undefined ? lm.visibility : 1;
    if (vis < 0.3) continue;

    const p = toPipPixels(lm);
    const isCore = (i === 11 || i === 12 || i === 23 || i === 24);
    ctx.beginPath();
    ctx.arc(p.x, p.y, isCore ? 3.5 : 2.5, 0, 2 * Math.PI);
    ctx.fillStyle = isCore ? '#FACC15' : '#38BDF8';
    ctx.fill();
  }

  // 5. Minimal Corner Watermark
  ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
  ctx.font = '8px monospace';
  ctx.textAlign = 'left';
  ctx.fillText('POSTERIOR 3D', 8, 14);
}
