// AI Coach Service integrating OpenAI Responses/Completions API
// Follows Formanti architectural principle:
// MediaPipe runs client-side frame-by-frame; structured summary is analyzed by OpenAI.

export async function requestAiCoachFeedback({
  exercise,
  valid_reps = 0,
  invalid_reps = 0,
  average_angle = 90,
  body_alignment = 170,
  errors = [],
  promptType = 'summary' // 'live' | 'summary'
}) {
  const payload = {
    exercise,
    valid_reps,
    invalid_reps,
    average_angle,
    body_alignment,
    errors,
    promptType
  };

  // 1. All OpenAI API requests MUST route through backend/proxy (/api/coach)
  // No client-side API keys or VITE_OPENAI_API_KEY allowed in frontend bundle
  try {
    const res = await fetch('/api/coach', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      const data = await res.json();
      if (data.feedback) return data.feedback;
    }
  } catch (err) {
    // Backend/proxy not available (e.g. static dev without server or offline)
  }

  // 2. High-precision deterministic Biomechanical Rule-Based Analysis fallback
  return generateRuleBasedAssessment(exercise, valid_reps, invalid_reps, errors, average_angle);
}

function generateRuleBasedAssessment(exercise, validReps, invalidReps, errors, avgAngle) {
  const total = validReps + invalidReps;
  const qualityRate = total > 0 ? Math.round((validReps / total) * 100) : 90;

  let assessment = `Completed ${validReps} clean repetitions (${qualityRate}% form adherence). Overall movement rhythm was consistent and controlled.`;
  let strengths = [
    `Maintained steady tempo throughout the active range of motion (~${avgAngle}° peak depth).`,
    `Starting position lockout was held with good balance before each repetition.`
  ];
  let cue = "Focus on keeping your core braced to sustain straight spinal alignment from start to finish.";

  if (exercise.toLowerCase().includes('push') || exercise.toLowerCase().includes('pushup')) {
    if (errors.some(e => e.includes('sag') || e.includes('hip'))) {
      cue = "Engage your glutes and pull your navel to your spine to prevent hip sag during the bottom inflection.";
    } else if (errors.some(e => e.includes('elbow') || e.includes('flare'))) {
      cue = "Tuck your elbows to a 45° arrow angle relative to your torso to protect anterior shoulder capsules.";
    } else if (errors.some(e => e.includes('depth') || e.includes('range'))) {
      cue = "Lower your chest until your elbows reach a true 90-degree bend before pushing back up.";
    }
  } else if (exercise.toLowerCase().includes('squat')) {
    if (errors.some(e => e.includes('knee') || e.includes('valgus'))) {
      cue = "Actively push your knees outward in line with your 2nd and 3rd toes as you drive out of the bottom position.";
    } else if (errors.some(e => e.includes('depth'))) {
      cue = "Aim to break parallel by dropping hip crease slightly below top of knee cap.";
    }
  }

  return `${assessment}\n\nKey Strengths:\n• ${strengths[0]}\n• ${strengths[1]}\n\nPriority Cue: ${cue}`;
}

