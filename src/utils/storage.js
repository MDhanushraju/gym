// FormFit Local Storage & Progress Management

const KEYS = {
  HISTORY: 'formfit_workout_history',
  DAILY_GOAL: 'formfit_daily_goal',
  FAVORITES: 'formfit_favorites',
  COACH_PREFS: 'formfit_coach_prefs'
};

// Default Daily Goal
const DEFAULT_DAILY_GOAL = {
  targetReps: 12,
  targetMinutes: 15,
  completedRepsToday: 0,
  completedMinutesToday: 0,
  lastUpdatedDate: new Date().toISOString().split('T')[0]
};

// Default Coach Preferences
const DEFAULT_COACH_PREFS = {
  voiceEnabled: true,
  soundEffects: true,
  speechRate: 0.95, // gentle calm pace
  frequency: 'balanced', // 'gentle' | 'balanced' | 'detailed'
};

// Initial Seed History (Demonstration Data until the user completes their own workouts)
const INITIAL_DEMO_SESSIONS = [
  {
    id: 'demo-session-1',
    exerciseId: 'weighted-squats',
    exerciseName: 'Weighted Squats',
    date: new Date(Date.now() - 86400000 * 2).toISOString(),
    durationSec: 180,
    repsCount: 8,
    accuracyScore: 84,
    status: 'Needs improvement',
    primaryMistake: 'Slight knee cave during ascent',
    isSample: true
  },
  {
    id: 'demo-session-2',
    exerciseId: 'weighted-squats',
    exerciseName: 'Weighted Squats',
    date: new Date(Date.now() - 86400000).toISOString(),
    durationSec: 210,
    repsCount: 10,
    accuracyScore: 89,
    status: 'Good Form',
    primaryMistake: 'Subtle lumbar flexion at depth',
    isSample: true
  },
  {
    id: 'demo-session-3',
    exerciseId: 'forward-dumbbell-row',
    exerciseName: 'Forward Dumbbell Row',
    date: new Date(Date.now() - 86400000 * 4).toISOString(),
    durationSec: 160,
    repsCount: 12,
    accuracyScore: 92,
    status: 'Elite Form',
    primaryMistake: 'None detected',
    isSample: true
  }
];

export function getWorkoutHistory() {
  try {
    const raw = localStorage.getItem(KEYS.HISTORY);
    if (!raw) {
      // Seed with initial sample history
      localStorage.setItem(KEYS.HISTORY, JSON.stringify(INITIAL_DEMO_SESSIONS));
      return INITIAL_DEMO_SESSIONS;
    }
    return JSON.parse(raw);
  } catch (e) {
    return INITIAL_DEMO_SESSIONS;
  }
}

export function saveWorkoutSession(sessionData) {
  try {
    const history = getWorkoutHistory();
    const newSession = {
      id: `session-${Date.now()}`,
      date: new Date().toISOString(),
      isSample: false,
      ...sessionData
    };
    const updated = [newSession, ...history];
    localStorage.setItem(KEYS.HISTORY, JSON.stringify(updated));

    // Also update daily goal progress
    updateDailyGoalProgress(sessionData.repsCount || 0, Math.round((sessionData.durationSec || 60) / 60));

    return newSession;
  } catch (e) {
    console.error('Failed to save workout session to localStorage', e);
    return null;
  }
}

export function clearWorkoutHistory() {
  try {
    localStorage.setItem(KEYS.HISTORY, JSON.stringify([]));
    return true;
  } catch (e) {
    return false;
  }
}

export function getDailyGoal() {
  try {
    const raw = localStorage.getItem(KEYS.DAILY_GOAL);
    if (!raw) {
      localStorage.setItem(KEYS.DAILY_GOAL, JSON.stringify(DEFAULT_DAILY_GOAL));
      return DEFAULT_DAILY_GOAL;
    }
    const goal = JSON.parse(raw);
    const today = new Date().toISOString().split('T')[0];

    // Reset daily counters if it's a new day
    if (goal.lastUpdatedDate !== today) {
      goal.completedRepsToday = 0;
      goal.completedMinutesToday = 0;
      goal.lastUpdatedDate = today;
      localStorage.setItem(KEYS.DAILY_GOAL, JSON.stringify(goal));
    }
    return goal;
  } catch (e) {
    return DEFAULT_DAILY_GOAL;
  }
}

export function updateDailyGoalSettings(targetReps, targetMinutes) {
  try {
    const goal = getDailyGoal();
    goal.targetReps = targetReps;
    goal.targetMinutes = targetMinutes;
    localStorage.setItem(KEYS.DAILY_GOAL, JSON.stringify(goal));
    return goal;
  } catch (e) {
    return DEFAULT_DAILY_GOAL;
  }
}

export function updateDailyGoalProgress(repsAdded, minutesAdded) {
  try {
    const goal = getDailyGoal();
    goal.completedRepsToday = (goal.completedRepsToday || 0) + repsAdded;
    goal.completedMinutesToday = (goal.completedMinutesToday || 0) + minutesAdded;
    goal.lastUpdatedDate = new Date().toISOString().split('T')[0];
    localStorage.setItem(KEYS.DAILY_GOAL, JSON.stringify(goal));
    return goal;
  } catch (e) {
    return DEFAULT_DAILY_GOAL;
  }
}

export function getFavorites() {
  try {
    const raw = localStorage.getItem(KEYS.FAVORITES);
    return raw ? JSON.parse(raw) : ['weighted-squats'];
  } catch (e) {
    return ['weighted-squats'];
  }
}

export function toggleFavorite(exerciseId) {
  try {
    const favs = getFavorites();
    let updated;
    if (favs.includes(exerciseId)) {
      updated = favs.filter(id => id !== exerciseId);
    } else {
      updated = [...favs, exerciseId];
    }
    localStorage.setItem(KEYS.FAVORITES, JSON.stringify(updated));
    return updated;
  } catch (e) {
    return [];
  }
}

export function getCoachPreferences() {
  try {
    const raw = localStorage.getItem(KEYS.COACH_PREFS);
    return raw ? JSON.parse(raw) : DEFAULT_COACH_PREFS;
  } catch (e) {
    return DEFAULT_COACH_PREFS;
  }
}

export function saveCoachPreferences(prefs) {
  try {
    const updated = { ...getCoachPreferences(), ...prefs };
    localStorage.setItem(KEYS.COACH_PREFS, JSON.stringify(updated));
    return updated;
  } catch (e) {
    return DEFAULT_COACH_PREFS;
  }
}

