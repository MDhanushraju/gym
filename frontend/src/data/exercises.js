// FormFit Exercise Knowledge Base and Curated Demonstration Data
// Focused strictly on the core movements: Basic Squats and Standard Pushups

export const EXERCISES = [
  {
    id: 'basic-squats',
    name: 'Basic Squats',
    category: 'Legs & Lower Body',
    difficulty: 'Beginner',
    targetMuscles: ['Quadriceps', 'Gluteus Maximus', 'Hamstrings', 'Core & Hip Flexors'],
    repRange: '10 - 15 Reps',
    tempo: '2-1-2 (Controlled descent, smooth drive)',
    shortDescription: 'The foundational bodyweight lower-body movement. Builds natural hip mobility, leg endurance, and balanced squat mechanics without external weights.',
    instructions: {
      startingPosition: 'Stand tall with feet shoulder-width apart, toes pointing forward or angled slightly outward 10-20 degrees. Extend arms forward for balance or clasp hands in front of your chest.',
      bodyPosture: 'Keep your chest proud, shoulders relaxed down, and core engaged. Maintain natural neutral lumbar curve with gaze straight ahead.',
      handPositioning: 'Hold hands loosely in front of your chest (prayer position) or straight ahead at shoulder height to assist in keeping an upright torso.',
      movementDirection: 'Hinge hips backward and bend knees simultaneously as if sitting down into a chair. Descend until thighs are parallel to the floor (approx. 90° knee angle), keeping knees tracked over toes. Drive through heels and midfoot back to standing.',
      breathing: 'Inhale smoothly as you lower into the squat; exhale steadily as you drive through the floor to return to full standing lockout.',
      commonMistakes: [
        'Knees caving inward (valgus collapse) during descent or ascent',
        'Lifting heels off the ground or shifting weight forward onto toes',
        'Rounding the lower back or collapsing the chest forward',
        'Cutting depth short before reaching parallel'
      ]
    },
    keyMovementPoints: [
      'Maintain tripod foot balance: equal weight on your heels, big toe, and outer foot.',
      'Actively track knees outward in line with your second and third toes throughout.',
      'Descend until thighs are parallel to the floor (approx. 90° knee flexion).',
      'Keep your chest open and upright with natural neutral spine.',
      'Squeeze glutes at the top to complete full hip extension.'
    ],
    biomechanicalAngles: {
      kneeFlexionAtDepth: { ideal: 90, min: 75, max: 100, unit: '°' },
      hipFlexionAngle: { ideal: 85, min: 75, max: 95, unit: '°' },
      torsoInclinationAngle: { ideal: 70, min: 60, max: 80, unit: '°' }
    },
    accentColor: '#10b981'
  },
  {
    id: 'pushups',
    name: 'Standard Pushups',
    category: 'Chest & Core',
    difficulty: 'Beginner',
    targetMuscles: ['Pectoralis Major', 'Triceps Brachii', 'Anterior Deltoids', 'Core & Abdominals'],
    repRange: '10 - 15 Reps',
    tempo: '2-1-1 (Controlled lowering, explosive push)',
    shortDescription: 'The gold-standard upper-body pushing movement developing chest power, triceps endurance, and total-body plank stability.',
    instructions: {
      startingPosition: 'Begin in a high plank position with hands positioned slightly wider than shoulder-width, fingers spread, feet together or hip-width apart.',
      bodyPosture: 'Maintain a straight, unbroken line from your head through your spine, hips, and down to your heels. Squeeze your glutes and brace your abdominals.',
      handPositioning: 'Place palms flat beneath your shoulders with fingers pointing forward or angled slightly outward. Screw your hands into the floor to engage lats.',
      movementDirection: 'Lower your entire body as one unit by bending your elbows backwards at a 45-degree angle (arrow shape, not a T-shape). Descend until your chest is roughly 2 to 3 inches off the floor, then press through palms to return to full lockout.',
      breathing: 'Inhale steadily as you lower your chest toward the floor; exhale forcefully as you drive through your palms back up to high plank.',
      commonMistakes: [
        'Flaring elbows out at 90 degrees, stressing the anterior shoulder capsule',
        'Sagging hips or lower back hyperextension due to disengaged core',
        'Piking hips upward into a pike or downward dog position',
        'Craning the neck toward the floor (leading with chin instead of chest)',
        'Incomplete range of motion, stopping before reaching 90-degree elbow depth'
      ]
    },
    keyMovementPoints: [
      'Maintain an unbroken rigid plank line from head to heels throughout the repetition.',
      'Tuck elbows at a 45° angle to your ribs rather than flaring out wide.',
      'Achieve chest-to-floor depth (elbows flexed to 90° or deeper).',
      'Keep neck neutral with gaze directed 6 inches ahead of your hands.',
      'Press through full palm surface to achieve full scapular protraction at the top.'
    ],
    biomechanicalAngles: {
      elbowFlexionAtDepth: { ideal: 90, min: 80, max: 100, unit: '°' },
      elbowFlareAngle: { ideal: 45, min: 35, max: 55, unit: '°' },
      torsoPlankAlignment: { ideal: 180, min: 172, max: 180, unit: '°' }
    },
    accentColor: '#3b82f6'
  }
];

export const GET_EXERCISE_BY_ID = (id) => {
  return EXERCISES.find(ex => ex.id === id) || EXERCISES[0];
};
