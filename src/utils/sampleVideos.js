// Sample Video Providers and Procedural Exercise Video Synthesizer
// Calm, peaceful studio visualizer for offline-guaranteed playback

const generatedVideoCache = {};

/**
 * Creates a real, playable WebM video Blob via Canvas captureStream.
 * Guarantees 100% offline, zero-lag, zero-CORS playback on any browser.
 */
export function generateProceduralExerciseVideo(exerciseId, isUserWithError = false, durationSec = 4) {
  const cacheKey = `${exerciseId}-${isUserWithError ? 'user' : 'pro'}`;
  if (generatedVideoCache[cacheKey]) {
    return Promise.resolve(generatedVideoCache[cacheKey]);
  }

  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 480;
    const ctx = canvas.getContext('2d');

    const stream = canvas.captureStream(30);
    let mediaRecorder;

    try {
      mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp8' });
    } catch (e) {
      mediaRecorder = new MediaRecorder(stream);
    }

    const chunks = [];
    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    mediaRecorder.onstop = () => {
      const blob = new Blob(chunks, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      generatedVideoCache[cacheKey] = url;
      resolve(url);
    };

    mediaRecorder.start();

    const fps = 30;
    const totalFrames = fps * durationSec;
    let currentFrame = 0;

    const interval = setInterval(() => {
      const progress = (currentFrame % fps) / fps;
      renderSyntheticExerciseFrame(ctx, exerciseId, progress, isUserWithError);
      currentFrame++;

      if (currentFrame >= totalFrames) {
        clearInterval(interval);
        mediaRecorder.stop();
      }
    }, 1000 / fps);
  });
}

/**
 * Renders a peaceful, calm studio exercise visualization frame
 */
export function renderSyntheticExerciseFrame(ctx, exerciseId, progress, isUserWithError) {
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;

  // Background - Soft studio ivory & mint glow
  ctx.fillStyle = '#F3F0FF';
  ctx.fillRect(0, 0, w, h);

  // Gentle studio floor
  ctx.fillStyle = '#EBF2ED';
  ctx.fillRect(0, h * 0.76, w, h * 0.24);

  ctx.strokeStyle = '#D8E5DC';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, h * 0.76);
  ctx.lineTo(w, h * 0.76);
  ctx.stroke();

  // Soft natural ambient light
  const ambient = ctx.createRadialGradient(w / 2, h * 0.4, 20, w / 2, h * 0.4, 280);
  ambient.addColorStop(0, isUserWithError ? 'rgba(217, 119, 6, 0.08)' : 'rgba(141, 175, 154, 0.18)');
  ambient.addColorStop(1, 'transparent');
  ctx.fillStyle = ambient;
  ctx.fillRect(0, 0, w, h);

  // Phase calculation (sinusoidal rep movement: 0 to 1)
  const repCycle = Math.sin(progress * Math.PI * 2);
  const depth = (repCycle + 1) / 2; // 0 to 1

  // Athlete Figure
  ctx.save();
  ctx.translate(w / 2, h / 2);

  const athleteColor = isUserWithError ? '#D97706' : '#2F3159';
  const jointColor = '#7F00FF';

  const isSquat = exerciseId === 'weighted-squats' || exerciseId === 'basic-squats' || exerciseId?.includes('squat');

  if (isSquat) {
    renderSquatFigure(ctx, depth, isUserWithError, athleteColor, jointColor, exerciseId === 'weighted-squats');
  } else if (exerciseId === 'upright-dumbbell-row') {
    renderUprightRowFigure(ctx, depth, isUserWithError, athleteColor, jointColor);
  } else if (exerciseId === 'forward-dumbbell-row') {
    renderBentRowFigure(ctx, depth, isUserWithError, athleteColor, jointColor);
  } else if (exerciseId === 'pushups') {
    renderPushupFigure(ctx, depth, isUserWithError, athleteColor, jointColor);
  } else {
    renderSingleRowFigure(ctx, depth, isUserWithError, athleteColor, jointColor);
  }

  ctx.restore();

  // Top Watermark Pill Badge
  ctx.save();
  ctx.fillStyle = '#FFFFFF';
  ctx.strokeStyle = '#E2D9F3';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(16, 16, isUserWithError ? 175 : 185, 26, 8);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = isUserWithError ? '#D97706' : '#16A34A';
  ctx.beginPath();
  ctx.arc(28, 29, 3.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.font = '600 11px "Plus Jakarta Sans", sans-serif';
  ctx.fillStyle = '#2F3159';
  ctx.fillText(isUserWithError ? 'Athlete Session Clip' : 'Gold Standard Movement', 38, 33);
  ctx.restore();
}

function renderSquatFigure(ctx, depth, isError, color, jointColor, hasWeights = true) {
  const hipY = -20 + depth * 55;
  const kneeY = 40 + depth * 15;
  const footY = 110;
  const kneeSpread = isError ? 40 - depth * 22 : 46 + depth * 5; // Knee cave error!

  // Head & Torso
  ctx.fillStyle = jointColor;
  ctx.beginPath();
  ctx.arc(0, hipY - 75, 14, 0, Math.PI * 2);
  ctx.fill();

  // Torso
  ctx.strokeStyle = color;
  ctx.lineWidth = 11;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, hipY - 60);
  ctx.lineTo(0, hipY);
  ctx.stroke();

  if (hasWeights) {
    // Dumbbells at shoulders
    ctx.fillStyle = '#696C92';
    ctx.fillRect(-35, hipY - 65, 12, 22);
    ctx.fillRect(23, hipY - 65, 12, 22);
  } else {
    // Basic bodyweight squat: hands joined in front for natural balance
    ctx.strokeStyle = color;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(-16, hipY - 48);
    ctx.lineTo(0, hipY - 32);
    ctx.lineTo(16, hipY - 48);
    ctx.stroke();
    ctx.fillStyle = jointColor;
    ctx.beginPath();
    ctx.arc(0, hipY - 32, 4.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Legs (Left & Right)
  ctx.lineWidth = 9;
  ctx.beginPath();
  // Left leg
  ctx.moveTo(-15, hipY);
  ctx.lineTo(-kneeSpread, kneeY);
  ctx.lineTo(-35, footY);
  // Right leg
  ctx.moveTo(15, hipY);
  ctx.lineTo(kneeSpread, kneeY);
  ctx.lineTo(35, footY);
  ctx.stroke();

  // Feet
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(-45, footY);
  ctx.lineTo(-25, footY);
  ctx.moveTo(25, footY);
  ctx.lineTo(45, footY);
  ctx.stroke();
}

function renderUprightRowFigure(ctx, depth, isError, color, jointColor) {
  const pullHeight = depth;
  const elbowExcess = isError ? pullHeight * 25 : 0;

  // Head
  ctx.fillStyle = jointColor;
  ctx.beginPath();
  ctx.arc(0, -90, 14, 0, Math.PI * 2);
  ctx.fill();

  // Torso
  ctx.strokeStyle = color;
  ctx.lineWidth = 11;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, -75);
  ctx.lineTo(0, 0);
  ctx.stroke();

  // Arms & Dumbbells
  const shoulderY = -65;
  const elbowY = -15 - pullHeight * 50 - elbowExcess;
  const handY = 5 - pullHeight * 60;

  ctx.lineWidth = 7.5;
  ctx.beginPath();
  // Left arm
  ctx.moveTo(-16, shoulderY);
  ctx.lineTo(-45 - pullHeight * 15, elbowY);
  ctx.lineTo(-15, handY);
  // Right arm
  ctx.moveTo(16, shoulderY);
  ctx.lineTo(45 + pullHeight * 15, elbowY);
  ctx.lineTo(15, handY);
  ctx.stroke();

  // Dumbbells
  ctx.fillStyle = '#696C92';
  ctx.fillRect(-22, handY - 6, 14, 12);
  ctx.fillRect(8, handY - 6, 14, 12);

  // Legs
  ctx.lineWidth = 9;
  ctx.beginPath();
  ctx.moveTo(-10, 0);
  ctx.lineTo(-15, 60);
  ctx.lineTo(-15, 110);
  ctx.moveTo(10, 0);
  ctx.lineTo(15, 60);
  ctx.lineTo(15, 110);
  ctx.stroke();
}

function renderBentRowFigure(ctx, depth, isError, color, jointColor) {
  const pull = depth;
  const backBend = isError ? 12 : 0;

  // Torso (Bent 45 deg)
  ctx.strokeStyle = color;
  ctx.lineWidth = 11;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-35, -20 + backBend);
  ctx.lineTo(25, 0);
  ctx.stroke();

  // Head
  ctx.fillStyle = jointColor;
  ctx.beginPath();
  ctx.arc(-55, -35 + backBend, 14, 0, Math.PI * 2);
  ctx.fill();

  // Row Arm
  const elbowY = 30 - pull * 45;
  const elbowX = -5 + pull * 15;
  const handY = 55 - pull * 50;

  ctx.lineWidth = 7.5;
  ctx.beginPath();
  ctx.moveTo(-30, -15);
  ctx.lineTo(elbowX, elbowY);
  ctx.lineTo(-15, handY);
  ctx.stroke();

  // Dumbbell
  ctx.fillStyle = '#696C92';
  ctx.fillRect(-22, handY - 8, 16, 16);

  // Legs
  ctx.lineWidth = 9;
  ctx.beginPath();
  ctx.moveTo(25, 0);
  ctx.lineTo(15, 55);
  ctx.lineTo(15, 110);
  ctx.stroke();
}

function renderSingleRowFigure(ctx, depth, isError, color, jointColor) {
  const pull = depth;
  const twist = isError ? pull * 15 : 0;

  // Bench
  ctx.fillStyle = '#C8D6CE';
  ctx.fillRect(-80, 20, 160, 12);
  ctx.fillRect(-60, 32, 10, 75);
  ctx.fillRect(50, 32, 10, 75);

  // Torso (horizontal on bench)
  ctx.strokeStyle = color;
  ctx.lineWidth = 11;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-40, -10 - twist);
  ctx.lineTo(35, -5);
  ctx.stroke();

  // Head
  ctx.fillStyle = jointColor;
  ctx.beginPath();
  ctx.arc(-60, -15, 14, 0, Math.PI * 2);
  ctx.fill();

  // Supporting Hand
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(-35, -5);
  ctx.lineTo(-40, 20);
  ctx.stroke();

  // Working Row Arm
  const elbowY = 15 - pull * 40;
  const handY = 35 - pull * 42;
  ctx.beginPath();
  ctx.moveTo(-25, -10 - twist);
  ctx.lineTo(5 + pull * 10, elbowY);
  ctx.lineTo(-5, handY);
  ctx.stroke();

  // Dumbbell
  ctx.fillStyle = '#696C92';
  ctx.fillRect(-12, handY - 6, 16, 14);

  // Kneeling leg
  ctx.lineWidth = 8.5;
  ctx.beginPath();
  ctx.moveTo(30, -5);
  ctx.lineTo(25, 20);
  ctx.lineTo(55, 20);
  // Standing foot
  ctx.moveTo(35, -5);
  ctx.lineTo(60, 55);
  ctx.lineTo(60, 105);
  ctx.stroke();
}

function renderPushupFigure(ctx, depth, isError, color, jointColor) {
  const press = depth; // 0 = at top plank, 1 = chest near floor
  const hipSag = isError ? 16 * (1 - press * 0.4) : 0;
  const flare = isError ? 12 : 0;

  const floorY = 95;
  const handX = -45;
  const feetX = 75;

  const shoulderY = floorY - 60 + press * 36;
  const shoulderX = handX + 10;
  const hipY = floorY - 62 + press * 36 + hipSag;
  const hipX = 15;

  // Head
  ctx.fillStyle = jointColor;
  ctx.beginPath();
  ctx.arc(shoulderX - 25, shoulderY - 8, 13, 0, Math.PI * 2);
  ctx.fill();

  // Torso / Plank Line (Shoulder -> Hip)
  ctx.strokeStyle = color;
  ctx.lineWidth = 11;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(shoulderX, shoulderY);
  ctx.lineTo(hipX, hipY);
  ctx.stroke();

  // Legs (Hip -> Feet)
  ctx.lineWidth = 9;
  ctx.beginPath();
  ctx.moveTo(hipX, hipY);
  ctx.lineTo(feetX, floorY);
  ctx.stroke();

  // Arms: Shoulder -> Elbow -> Hand
  const elbowY = shoulderY + (isError ? 10 : 18) - press * 10;
  const elbowX = shoulderX - 18 - flare;

  ctx.lineWidth = 7.5;
  ctx.beginPath();
  ctx.moveTo(shoulderX, shoulderY);
  ctx.lineTo(elbowX, elbowY);
  ctx.lineTo(handX, floorY);
  ctx.stroke();

  // Hands on floor
  ctx.fillStyle = '#696C92';
  ctx.fillRect(handX - 6, floorY - 3, 14, 6);

  // Toes on floor
  ctx.fillRect(feetX - 4, floorY - 3, 10, 6);
}

export const SAMPLE_WORKOUT_PRESETS = [
  {
    id: 'sample-squat-valgus',
    exerciseId: 'basic-squats',
    title: 'Squat – Knee Alignment Check (78% Form)',
    description: 'Realistic session with gentle inward knee movement on ascent.',
    duration: '0:04',
    formScore: '78%',
    isUserWithError: true
  },
  {
    id: 'sample-squat-good',
    exerciseId: 'basic-squats',
    title: 'Squat – Natural Balanced Movement (94% Form)',
    description: 'Smooth parallel depth, balanced stance, and clean knee tracking.',
    duration: '0:04',
    formScore: '94%',
    isUserWithError: false
  },
  {
    id: 'sample-pushup-flare',
    exerciseId: 'pushups',
    title: 'Pushup – Elbow Flare & Hip Sag Check (74% Form)',
    description: 'Elbows flared outward at 90 degrees with gentle core sag.',
    duration: '0:04',
    formScore: '74%',
    isUserWithError: true
  },
  {
    id: 'sample-pushup-good',
    exerciseId: 'pushups',
    title: 'Pushup – Neutral Plank & 45° Elbows (95% Form)',
    description: 'Crisp rigid plank line, chest to floor depth, and clean 45° elbow path.',
    duration: '0:04',
    formScore: '95%',
    isUserWithError: false
  }
];
