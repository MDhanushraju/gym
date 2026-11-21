// Biomechanical analysis profiles with Front (Primary) and Back (Optional) view checkpoints

export const DEMO_ANALYSIS_PROFILES = {
  'basic-squats': {
    exerciseId: 'basic-squats',
    overallAccuracy: 88,
    frontAccuracy: 92,
    backAccuracy: 84,
    grade: 'Natural Balanced Form',
    statusSummary: 'Solid depth and posture. Front view shows clean parallel knee depth, while maintaining upright spinal balance throughout the repetition.',
    repCountDetected: 3,
    avgTempo: '2.8s rep duration',
    correctCount: 4,
    incorrectCount: 1,
    mistakesCount: 2,
    comparisonTable: [
      {
        bodyPart: 'Knees & Valgus Alignment',
        side: 'front',
        referenceMovement: 'Knees track outward in line with 2nd & 3rd toes',
        yourMovement: 'Clean knee alignment with minimal inward drift',
        status: 'Optimal',
        statusType: 'success'
      },
      {
        bodyPart: 'Shoulder Level & Symmetry',
        side: 'front',
        referenceMovement: 'Shoulders horizontally level throughout full rep',
        yourMovement: 'Even shoulder alignment maintained',
        status: 'Optimal',
        statusType: 'success'
      },
      {
        bodyPart: 'Hip Descent & Parallel Depth',
        side: 'front',
        referenceMovement: 'Thighs parallel to floor (>=90° depth)',
        yourMovement: 'Full parallel depth achieved (92°)',
        status: 'Optimal',
        statusType: 'success'
      },
      {
        bodyPart: 'Spine & Torso Posture',
        side: 'back',
        referenceMovement: 'Spine straight and neutral without excessive forward tilt',
        yourMovement: 'Natural neutral curvature maintained',
        status: 'Optimal',
        statusType: 'success'
      }
    ],
    mistakes: [
      {
        id: 'squat-depth',
        title: 'Deep Hip Inflection Range',
        severity: 'minor',
        description: 'Slight hesitation at the bottom transition before driving upward.',
        timestampSec: 2.1,
        correctionCue: 'Drive smoothly through heels to initiate immediate concentric ascent.'
      }
    ]
  },
  'weighted-squats': {
    exerciseId: 'weighted-squats',
    overallAccuracy: 88,
    frontAccuracy: 92,
    backAccuracy: 84,
    grade: 'Natural Balanced Form',
    statusSummary: 'Solid depth and posture. Front view shows slight inward knee movement on ascent, while optional back view indicates minor lumbar flexion at depth.',
    repCountDetected: 3,
    avgTempo: '3.2s rep duration',
    correctCount: 4,
    incorrectCount: 1,
    mistakesCount: 2,
    comparisonTable: [
      // FRONT VIEW CHECKS (Primary)
      {
        bodyPart: 'Knees & Valgus Alignment',
        side: 'front',
        referenceMovement: 'Knees track outward in line with 2nd & 3rd toes',
        yourMovement: 'Gentle inward knee drift during ascending drive',
        status: 'Needs improvement',
        statusType: 'warning'
      },
      {
        bodyPart: 'Shoulder Level & Symmetry',
        side: 'front',
        referenceMovement: 'Shoulders horizontally level throughout full rep',
        yourMovement: 'Even shoulder alignment maintained',
        status: 'Correct',
        statusType: 'success'
      },
      {
        bodyPart: 'Feet & Stance Width',
        side: 'front',
        referenceMovement: 'Tripod foot contact, heels grounded shoulder-width',
        yourMovement: 'Stable base with grounded heels',
        status: 'Correct',
        statusType: 'success'
      },
      {
        bodyPart: 'Elbow & Rack Stability',
        side: 'front',
        referenceMovement: 'Elbows pinned downward under dumbbell load',
        yourMovement: 'Elbows stayed firm without flaring',
        status: 'Correct',
        statusType: 'success'
      },
      // BACK VIEW CHECKS (Optional)
      {
        bodyPart: 'Spinal Column Neutrality (Back View)',
        side: 'back',
        isOptional: true,
        referenceMovement: 'Neutral vertical spine alignment from neck to sacrum',
        yourMovement: 'Lateral spine tilt < 2° (well centered)',
        status: 'Correct',
        statusType: 'success'
      },
      {
        bodyPart: 'Lumbar & Pelvic Tilt (Back View)',
        side: 'back',
        isOptional: true,
        referenceMovement: 'Pelvis neutral at parallel, zero butt wink',
        yourMovement: 'Minor posterior pelvic tuck at maximum depth',
        status: 'Needs improvement',
        statusType: 'warning'
      }
    ],
    mistakes: [
      {
        id: 'squat-knee-valgus',
        title: 'Knee Valgus (Inward Knee Drift)',
        bodyPart: 'Knees & Adductors (Front View)',
        side: 'front',
        severity: 'Medium',
        whatHappened: 'Your knees drifted slightly inward toward each other during the drive out of the bottom position.',
        whyWrong: 'Places shear force on medial knee ligaments and reduces gluteus medius activation.',
        howToCorrect: 'Actively cue yourself to "screw your feet into the floor" and guide knees outward along your toes.',
        quickTip: 'Think "push the floor apart" as you stand up.'
      },
      {
        id: 'squat-lumbar-flexion',
        title: 'Minor Lumbar Flexion at Depth',
        bodyPart: 'Lower Back / Pelvis (Back View - Optional)',
        side: 'back',
        isOptional: true,
        severity: 'Low',
        whatHappened: 'At maximum depth, your pelvis tucked under slightly, causing minor lower back rounding.',
        whyWrong: 'Transfers load from the hips onto lumbar spinal ligaments.',
        howToCorrect: 'Descend to parallel, stopping just before your pelvis begins to tuck.',
        quickTip: 'Keep your belly braced 360-degrees throughout the bottom transition.'
      }
    ],
    recommendations: [
      'Warm up with gentle banded glute bridges to fire hip abductors before squatting.',
      'Maintain an active outward knee cue throughout the ascending movement.',
      'Check your depth in front of a mirror or side camera to confirm neutral lumbar posture.'
    ]
  },

  'upright-dumbbell-row': {
    exerciseId: 'upright-dumbbell-row',
    overallAccuracy: 82,
    frontAccuracy: 80,
    backAccuracy: 86,
    grade: 'Gentle Adjustments',
    statusSummary: 'Smooth rhythm. Front view detected elbows pulling slightly above shoulder plane, while optional back view verified steady thoracic posture.',
    repCountDetected: 4,
    avgTempo: '2.4s rep duration',
    correctCount: 4,
    incorrectCount: 1,
    mistakesCount: 2,
    comparisonTable: [
      // FRONT VIEW CHECKS (Primary)
      {
        bodyPart: 'Elbow Elevation & Lead',
        side: 'front',
        referenceMovement: 'Parallel to shoulders (max 90° elevation)',
        yourMovement: 'Elbows rose slightly higher than shoulder plane',
        status: 'Needs improvement',
        statusType: 'warning'
      },
      {
        bodyPart: 'Wrist Position (Front View)',
        side: 'front',
        referenceMovement: 'Wrists relaxed, below elbow joint line',
        yourMovement: 'Slight wrist flexion at top of pull',
        status: 'Needs improvement',
        statusType: 'warning'
      },
      {
        bodyPart: 'Shoulder Elevation Symmetry',
        side: 'front',
        referenceMovement: 'Traps engage evenly without early shrugging',
        yourMovement: 'Even shoulder alignment maintained',
        status: 'Correct',
        statusType: 'success'
      },
      // BACK VIEW CHECKS (Optional)
      {
        bodyPart: 'Spinal Alignment (Back View)',
        side: 'back',
        isOptional: true,
        referenceMovement: 'Torso motionless, neutral spine throughout',
        yourMovement: 'Steady torso with zero backward rocking',
        status: 'Correct',
        statusType: 'success'
      },
      {
        bodyPart: 'Scapular Retraction (Back View)',
        side: 'back',
        isOptional: true,
        referenceMovement: 'Smooth scapular rotation without hyper-elevation',
        yourMovement: 'Controlled scapular glide observed',
        status: 'Correct',
        statusType: 'success'
      }
    ],
    mistakes: [
      {
        id: 'upright-elbow-too-high',
        title: 'Elbows Elevated Past Shoulder Line',
        bodyPart: 'Shoulders & Delts (Front View)',
        side: 'front',
        severity: 'Medium',
        whatHappened: 'You raised your elbows past parallel with your collarbones into a high internal rotation zone.',
        whyWrong: 'Pinches the rotator cuff tendons against the acromion bone.',
        howToCorrect: 'Stop the upward pull as soon as your upper arms reach shoulder height.',
        quickTip: 'Think "elbows to the walls" rather than "elbows to the ceiling".'
      },
      {
        id: 'upright-wrist-hyperflexion',
        title: 'Wrist Leading the Pull',
        bodyPart: 'Wrists (Front View)',
        side: 'front',
        severity: 'Low',
        whatHappened: 'Your wrists bent into flexion trying to pull weights higher than your elbows.',
        whyWrong: 'Transfers tension away from the lateral deltoids into forearm flexors.',
        howToCorrect: 'Keep your wrists neutral and relaxed like hooks.',
        quickTip: 'Imagine puppet strings attached to your elbows doing the pulling.'
      }
    ],
    recommendations: [
      'Stop the range of motion at lower-chest level instead of chin level.',
      'Keep your hands slightly wider to give your rotator cuffs natural clearance.'
    ]
  },

  'forward-dumbbell-row': {
    exerciseId: 'forward-dumbbell-row',
    overallAccuracy: 86,
    frontAccuracy: 90,
    backAccuracy: 82,
    grade: 'Good Form',
    statusSummary: 'Great 45° hip hinge and lat engagement. Frontal balance was centered; optional back view detected mild upper back relaxation in the last rep.',
    repCountDetected: 4,
    avgTempo: '2.8s rep duration',
    correctCount: 4,
    incorrectCount: 1,
    mistakesCount: 1,
    comparisonTable: [
      // FRONT VIEW CHECKS (Primary)
      {
        bodyPart: 'Bilateral Arm Symmetry',
        side: 'front',
        referenceMovement: 'Both dumbbells rise and lower at identical cadence',
        yourMovement: 'Symmetric pull speed and arm path',
        status: 'Correct',
        statusType: 'success'
      },
      {
        bodyPart: 'Knee Stance & Width',
        side: 'front',
        referenceMovement: 'Knees bent 150°, shoulder-width centered',
        yourMovement: 'Stable balanced lower body stance',
        status: 'Correct',
        statusType: 'success'
      },
      // BACK VIEW CHECKS (Optional)
      {
        bodyPart: 'Torso Hinge Angle (Back View)',
        side: 'back',
        isOptional: true,
        referenceMovement: 'Consistent 45° hip hinge angle',
        yourMovement: '44° hinge maintained cleanly',
        status: 'Correct',
        statusType: 'success'
      },
      {
        bodyPart: 'Thoracic Spine Alignment (Back View)',
        side: 'back',
        isOptional: true,
        referenceMovement: 'Flat upper back with active scapular retraction',
        yourMovement: 'Upper back rounded slightly as weight descended on final rep',
        status: 'Needs improvement',
        statusType: 'warning'
      }
    ],
    mistakes: [
      {
        id: 'forward-row-thoracic-rounding',
        title: 'Mild Upper Back Softening',
        bodyPart: 'Upper Back & Rhomboids (Back View - Optional)',
        side: 'back',
        isOptional: true,
        severity: 'Medium',
        whatHappened: 'As the dumbbells were lowered, your shoulders slumped forward slightly on the eccentric phase.',
        whyWrong: 'Loss of scapular tension shifts load onto passive spinal ligaments.',
        howToCorrect: 'Think "proud chest" even at the bottom of the rep.',
        quickTip: 'Squeeze an imaginary tennis ball between your shoulder blades.'
      }
    ],
    recommendations: [
      'Pause for 1 second at the top of the contraction to feel the lat muscles working.',
      'Engage glutes and hamstrings actively to create a solid base of support.'
    ]
  },

  'single-hand-dumbbell-row': {
    exerciseId: 'single-hand-dumbbell-row',
    overallAccuracy: 88,
    frontAccuracy: 92,
    backAccuracy: 84,
    grade: 'Good Form',
    statusSummary: 'Solid unilateral lat pull and steady support arm. Front view was clean; optional back view observed mild torso rotation at peak contraction.',
    repCountDetected: 4,
    avgTempo: '2.5s rep duration',
    correctCount: 4,
    incorrectCount: 1,
    mistakesCount: 1,
    comparisonTable: [
      // FRONT VIEW CHECKS (Primary)
      {
        bodyPart: 'Shoulder Level & Anti-Rotation',
        side: 'front',
        referenceMovement: 'Shoulders parallel to bench; zero lateral twist',
        yourMovement: 'Shoulder dipped slightly at bottom stretch',
        status: 'Correct',
        statusType: 'success'
      },
      {
        bodyPart: 'Supporting Arm Stability',
        side: 'front',
        referenceMovement: 'Support arm stacked vertically beneath shoulder',
        yourMovement: 'Solid 3-point support base',
        status: 'Correct',
        statusType: 'success'
      },
      // BACK VIEW CHECKS (Optional)
      {
        bodyPart: 'Pelvic & Lumbar Level (Back View)',
        side: 'back',
        isOptional: true,
        referenceMovement: 'Level hips, neutral lumbar alignment',
        yourMovement: 'Hips stayed square to the bench',
        status: 'Correct',
        statusType: 'success'
      },
      {
        bodyPart: 'Torso Rotation at Peak (Back View)',
        side: 'back',
        isOptional: true,
        referenceMovement: 'Chest remains pointing straight down at bench',
        yourMovement: 'Chest rotated open 10° at peak pull',
        status: 'Needs improvement',
        statusType: 'warning'
      }
    ],
    mistakes: [
      {
        id: 'single-row-torso-rotation',
        title: 'Torso Rotation at Peak Contraction',
        bodyPart: 'Torso & Obliques (Back View - Optional)',
        side: 'back',
        isOptional: true,
        severity: 'Medium',
        whatHappened: 'At the top of the pull, your pulling shoulder twisted upward, rotating your chest toward the room.',
        whyWrong: 'Uses spinal rotation rather than pure lat adduction to lift the weight.',
        howToCorrect: 'Keep both shoulders parallel to the bench at all times.',
        quickTip: 'Imagine balancing a glass of water on your mid-back without spilling a single drop.'
      }
    ],
    recommendations: [
      'Focus on keeping your chest pointed directly at the bench throughout every rep.',
      'Squeeze the lat at the top for a two-count without twisting.'
    ]
  },
  'pushups': {
    exerciseId: 'pushups',
    overallAccuracy: 86,
    frontAccuracy: 90,
    backAccuracy: 82,
    grade: 'Strong Upper Body Drive',
    statusSummary: 'Solid pressing power and depth. Front view shows slight 75° elbow flare, while optional back view indicates minor hip sagging in the final repetition.',
    repCountDetected: 4,
    avgTempo: '2.4s rep duration',
    correctCount: 4,
    incorrectCount: 1,
    mistakesCount: 2,
    comparisonTable: [
      // FRONT VIEW CHECKS (Primary)
      {
        bodyPart: 'Hand Placement & Wrist Stack',
        side: 'front',
        referenceMovement: 'Hands placed slightly wider than shoulder-width, fingers spread',
        yourMovement: 'Even hand placement under shoulder joints',
        status: 'Correct',
        statusType: 'success'
      },
      {
        bodyPart: 'Elbow Flare Angle (Front View)',
        side: 'front',
        referenceMovement: 'Elbows track at 45° arrow angle relative to torso',
        yourMovement: 'Elbows flared outward to 75° on final two reps',
        status: 'Needs improvement',
        statusType: 'warning'
      },
      {
        bodyPart: 'Shoulder Level Symmetry',
        side: 'front',
        referenceMovement: 'Left and right shoulders depress and press symmetrically',
        yourMovement: 'Bilateral shoulder balance maintained',
        status: 'Correct',
        statusType: 'success'
      },
      {
        bodyPart: 'Chest-to-Floor Depth',
        side: 'front',
        referenceMovement: 'Elbows flex to 90° or deeper at bottom transition',
        yourMovement: 'Reached 92° depth with clean chest clearance',
        status: 'Correct',
        statusType: 'success'
      },
      // BACK VIEW CHECKS (Optional)
      {
        bodyPart: 'Plank Spine & Hip Alignment (Back View)',
        side: 'back',
        isOptional: true,
        referenceMovement: 'Rigid straight line from cervical spine to heels',
        yourMovement: 'Gentle lumbar hyperextension (hip dip) on rep 4',
        status: 'Needs improvement',
        statusType: 'warning'
      },
      {
        bodyPart: 'Scapular Movement Rhythm (Back View)',
        side: 'back',
        isOptional: true,
        referenceMovement: 'Retraction at bottom, smooth protraction at top lockout',
        yourMovement: 'Scapulae tracked naturally without winging',
        status: 'Correct',
        statusType: 'success'
      }
    ],
    mistakes: [
      {
        id: 'pushup-elbow-flare',
        title: 'Excessive Elbow Flaring (T-Shape)',
        bodyPart: 'Elbows & Shoulders (Front View)',
        side: 'front',
        severity: 'Medium',
        whatHappened: 'Your elbows flared outwards at roughly 75° to 80° relative to your ribs instead of tucking to 45°.',
        whyWrong: 'Places undue shear stress on the anterior shoulder capsule and rotator cuff tendons.',
        howToCorrect: 'Think of creating an arrow shape with your body rather than a letter T. Screw your hands into the floor to lock in lat tension.',
        quickTip: 'Turn your fingers slightly outward and guide your elbows towards your hips as you descend.'
      },
      {
        id: 'pushup-hip-sag',
        title: 'Lumbar Hyperextension (Sagging Hips)',
        bodyPart: 'Lumbar Spine & Core (Back View - Optional)',
        side: 'back',
        isOptional: true,
        severity: 'Medium',
        whatHappened: 'In the bottom transition, your core relaxed slightly, causing your hips to drop below your shoulder-to-heel line.',
        whyWrong: 'Transfers bodyweight strain directly into the lumbar vertebrae instead of working the core abdominals.',
        howToCorrect: 'Engage a subtle posterior pelvic tilt by squeezing your glutes tightly and pulling your belly button toward your spine.',
        quickTip: 'Treat every pushup as a moving plank. Move your shoulders and hips simultaneously as a single rigid beam.'
      }
    ],
    recommendations: [
      'Maintain continuous glute and quad tension to keep your plank locked.',
      'Tuck elbows to 45 degrees to optimize pectoral recruitment and safeguard your shoulders.',
      'Exhale forcefully through pursed lips as you press back up to high plank.'
    ]
  }
};
