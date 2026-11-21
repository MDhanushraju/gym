import React, { useState, useEffect, useMemo } from 'react';
import { 
  Activity, Calendar, TrendingUp, Award, Clock, Repeat, 
  Trash2, Sparkles, CheckCircle2, AlertCircle, ArrowUpRight, 
  Edit3, ChevronRight, Heart, BarChart3, Info 
} from 'lucide-react';
import { 
  getWorkoutHistory, clearWorkoutHistory, getDailyGoal, 
  updateDailyGoalSettings 
} from '../utils/storage';

export default function MyProgress({ onSelectExercise, onStartWorkout }) {
  const [history, setHistory] = useState([]);
  const [dailyGoal, setDailyGoal] = useState(getDailyGoal());
  const [isEditingGoal, setIsEditingGoal] = useState(false);
  const [goalRepsInput, setGoalRepsInput] = useState(dailyGoal.targetReps || 12);
  const [goalMinsInput, setGoalMinsInput] = useState(dailyGoal.targetMinutes || 15);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  useEffect(() => {
    setHistory(getWorkoutHistory());
    setDailyGoal(getDailyGoal());
  }, []);

  // Compute aggregate stats from real stored sessions
  const stats = useMemo(() => {
    const totalSessions = history.length;
    const totalReps = history.reduce((sum, s) => sum + (s.repsCount || 0), 0);
    const uniqueExercises = new Set(history.map(s => s.exerciseId)).size;
    const avgScore = totalSessions > 0
      ? Math.round(history.reduce((sum, s) => sum + (s.accuracyScore || 0), 0) / totalSessions)
      : 85;

    return { totalSessions, totalReps, uniqueExercises, avgScore };
  }, [history]);

  // Weekly Activity Array (Past 7 Days)
  const weeklyDays = useMemo(() => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const today = new Date();
    const result = [];

    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const hasWorkout = history.some(s => s.date && s.date.startsWith(dateStr));
      result.push({
        dayName: days[d.getDay()],
        dayNum: d.getDate(),
        isToday: i === 0,
        hasWorkout
      });
    }
    return result;
  }, [history]);

  // Frequently detected mistakes analysis
  const frequentMistakes = useMemo(() => {
    const counts = {};
    history.forEach(s => {
      if (s.mistakesDetected) {
        s.mistakesDetected.forEach(m => {
          counts[m.title] = (counts[m.title] || 0) + 1;
        });
      }
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 3);
  }, [history]);

  // Improvement trends based on data
  const improvementTrend = useMemo(() => {
    if (history.length >= 2) {
      const recent = history.slice(0, 3);
      const older = history.slice(3, 6);
      if (older.length > 0) {
        const recentAvg = recent.reduce((sum, s) => sum + s.accuracyScore, 0) / recent.length;
        const olderAvg = older.reduce((sum, s) => sum + s.accuracyScore, 0) / older.length;
        if (recentAvg >= olderAvg) {
          return `Your movement balance has improved by +${Math.round(recentAvg - olderAvg)}% across recent sessions.`;
        }
      }
      return `Consistent effort: You've completed ${history.length} movement sessions with an average quality of ${stats.avgScore}%.`;
    }
    return "Complete your first 2 sessions to unlock personalized movement improvement trends.";
  }, [history, stats.avgScore]);

  const handleSaveGoal = (e) => {
    e.preventDefault();
    const updated = updateDailyGoalSettings(parseInt(goalRepsInput) || 12, parseInt(goalMinsInput) || 15);
    setDailyGoal(updated);
    setIsEditingGoal(false);
  };

  const handleClear = () => {
    clearWorkoutHistory();
    setHistory([]);
    setShowClearConfirm(false);
  };

  const completedReps = dailyGoal.completedRepsToday || 0;
  const targetReps = dailyGoal.targetReps || 12;
  const goalProgressPercent = Math.min(100, Math.round((completedReps / targetReps) * 100));

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 animate-fade-in">
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-[#7F00FF]">
            Personal Health Dashboard
          </span>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-[#2F3159] tracking-tight">
            My Movement
          </h1>
          <p className="text-sm text-[#696C92] mt-1">
            Track your movement consistency, joint alignment habits, and progress over time.
          </p>
        </div>

        <button
          onClick={onStartWorkout}
          className="px-6 py-3 rounded-full font-semibold text-xs bg-[#7F00FF] hover:bg-[#6E00DE] text-white shadow-sm flex items-center gap-2 self-start sm:self-auto transition-all"
        >
          <Sparkles className="w-4 h-4" />
          <span>Start Today's Session</span>
        </button>
      </div>

      {/* Aggregate Statistics Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        
        <div className="calm-card p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold uppercase text-[#696C92]">Total Sessions</span>
            <Activity className="w-4 h-4 text-[#7F00FF]" />
          </div>
          <div className="text-3xl font-extrabold font-sans text-[#2F3159]">{stats.totalSessions}</div>
          <span className="text-xs text-[#696C92] mt-1 block">Completed workouts</span>
        </div>

        <div className="calm-card p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold uppercase text-[#696C92]">Total Repetitions</span>
            <Repeat className="w-4 h-4 text-[#7F00FF]" />
          </div>
          <div className="text-3xl font-extrabold font-sans text-[#2F3159]">{stats.totalReps}</div>
          <span className="text-xs text-[#696C92] mt-1 block">Full movement cycles</span>
        </div>

        <div className="calm-card p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold uppercase text-[#696C92]">Movement Quality</span>
            <TrendingUp className="w-4 h-4 text-[#16A34A]" />
          </div>
          <div className="text-3xl font-extrabold font-sans text-[#16A34A]">{stats.avgScore}%</div>
          <span className="text-xs text-[#696C92] mt-1 block">Average form balance</span>
        </div>

        <div className="calm-card p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold uppercase text-[#696C92]">Movements Mastered</span>
            <Award className="w-4 h-4 text-[#7F00FF]" />
          </div>
          <div className="text-3xl font-extrabold font-sans text-[#2F3159]">{Math.min(2, stats.uniqueExercises)} / 2</div>
          <span className="text-xs text-[#696C92] mt-1 block">Exercise varieties</span>
        </div>

      </div>

      {/* Main Grid: Weekly Activity & Daily Goal (Left) + Improvement Trends (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-10">
        
        {/* Left Column (7 cols): Weekly Calendar & Daily Goal Card */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          
          {/* Daily Goal Card */}
          <div className="calm-card p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[#7F00FF]" />
                <h3 className="text-sm font-bold text-[#2F3159]">Daily Movement Intention</h3>
              </div>
              <button
                onClick={() => setIsEditingGoal(!isEditingGoal)}
                className="text-xs text-[#7F00FF] hover:text-[#2F3159] font-semibold flex items-center gap-1 transition-colors"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>{isEditingGoal ? 'Cancel' : 'Edit Goal'}</span>
              </button>
            </div>

            {isEditingGoal ? (
              <form onSubmit={handleSaveGoal} className="p-4 rounded-2xl bg-[#FFFFFF] border border-[#E2D9F3] mb-4 space-y-3">
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block text-[#696C92] mb-1 font-medium">Target Repetitions</label>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={goalRepsInput}
                      onChange={(e) => setGoalRepsInput(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-[#FFFFFF] border border-[#E2D9F3] text-[#2F3159] font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block text-[#696C92] mb-1 font-medium">Target Minutes</label>
                    <input
                      type="number"
                      min="1"
                      max="120"
                      value={goalMinsInput}
                      onChange={(e) => setGoalMinsInput(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-[#FFFFFF] border border-[#E2D9F3] text-[#2F3159] font-semibold"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-full text-xs font-semibold bg-[#7F00FF] text-white hover:bg-[#6E00DE] transition-colors"
                >
                  Save Intention
                </button>
              </form>
            ) : null}

            {/* Goal Progress Bar & Metrics */}
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-3xl font-extrabold text-[#2F3159]">{completedReps}</span>
                  <span className="text-xs text-[#696C92]">/ {targetReps} reps today</span>
                </div>
                <p className="text-xs text-[#696C92] mt-0.5">
                  {goalProgressPercent >= 100 
                    ? 'Goal achieved! Wonderful consistency today.' 
                    : `${targetReps - completedReps} more reps to reach your daily movement intention.`}
                </p>
              </div>

              <div className="w-16 h-16 rounded-full bg-[#EDE9FE]/50 flex items-center justify-center font-bold text-xs text-[#2F3159] shrink-0 border border-[#EDE9FE]">
                {goalProgressPercent}%
              </div>
            </div>

            <div className="w-full h-2 bg-[#E2D9F3] rounded-full overflow-hidden mt-4">
              <div 
                className="h-full bg-[#7F00FF] rounded-full transition-all duration-500" 
                style={{ width: `${goalProgressPercent}%` }}
              />
            </div>
          </div>

          {/* Weekly Consistency Ring Strip */}
          <div className="calm-card p-6">
            <h3 className="text-sm font-bold text-[#2F3159] mb-1">Weekly Activity Rhythm</h3>
            <p className="text-xs text-[#696C92] mb-4">Days you completed movement practice this week:</p>

            <div className="grid grid-cols-7 gap-2">
              {weeklyDays.map((day, idx) => (
                <div
                  key={idx}
                  className={`p-3 rounded-2xl text-center border transition-all ${
                    day.hasWorkout
                      ? 'bg-[#EDE9FE] border-[#7F00FF] text-[#2F3159]'
                      : day.isToday
                      ? 'bg-[#FFFFFF] border-[#7F00FF] text-[#2F3159]'
                      : 'bg-[#FFFFFF] border-[#E2D9F3] text-[#696C92]'
                  }`}
                >
                  <span className="text-[10px] font-semibold block uppercase">{day.dayName}</span>
                  <span className="text-sm font-bold block my-0.5">{day.dayNum}</span>
                  <div className="flex justify-center mt-1">
                    <span className={`w-2 h-2 rounded-full ${day.hasWorkout ? 'bg-[#16A34A]' : 'bg-[#E2D9F3]'}`} />
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* Right Column (5 cols): Improvement Trends & Common Observations */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          
          {/* Trend Card */}
          <div className="calm-card p-6 bg-[#FFFFFF]">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-4 h-4 text-[#7F00FF]" />
              <h3 className="text-sm font-bold text-[#2F3159]">Personal Progress Insight</h3>
            </div>
            <p className="text-xs sm:text-sm text-[#2F3159] leading-relaxed">
              {improvementTrend}
            </p>

            <div className="mt-4 pt-3 border-t border-[#E2D9F3] flex items-center justify-between text-xs text-[#696C92]">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#16A34A]" />
                <span>Verified by local session data</span>
              </span>
              <span className="font-semibold text-[#7F00FF]">Private to you</span>
            </div>
          </div>

          {/* Common Adjustments Card */}
          <div className="calm-card p-6 flex flex-col gap-3">
            <h3 className="text-sm font-bold text-[#2F3159]">Patterns for Mindful Practice</h3>
            <p className="text-xs text-[#696C92] -mt-1">
              Frequent movement observations flagged across your sessions:
            </p>

            {frequentMistakes.length > 0 ? (
              <div className="space-y-2 mt-1">
                {frequentMistakes.map(([title, count], idx) => (
                  <div key={idx} className="p-3 rounded-xl bg-[#FFFFFF] border border-[#E2D9F3] flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-[#FFF8E1] text-[#D97706] flex items-center justify-center font-bold text-[10px]">
                        {idx + 1}
                      </span>
                      <span className="font-semibold text-[#2F3159]">{title}</span>
                    </div>
                    <span className="text-[#696C92] text-[11px]">{count} observation{count > 1 ? 's' : ''}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-[#696C92] italic">
                No repeated movement flaws detected yet! Keep moving smoothly.
              </p>
            )}
          </div>

        </div>

      </div>

      {/* Recent Workout History Table Section */}
      <div className="calm-card p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
          <div>
            <h3 className="text-lg font-bold text-[#2F3159]">Workout History</h3>
            <p className="text-xs text-[#696C92] mt-0.5">
              Chronological log of your recorded practice sessions.
            </p>
          </div>

          {history.length > 0 && (
            <button
              onClick={() => setShowClearConfirm(true)}
              className="text-xs text-[#D32F2F] hover:text-red-700 font-medium flex items-center gap-1.5 self-start sm:self-auto"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear Stored History</span>
            </button>
          )}
        </div>

        {showClearConfirm && (
          <div className="p-4 mb-4 rounded-2xl bg-[#FFEBEE] border border-[#FFCDD2] flex items-center justify-between text-xs">
            <span className="text-[#D32F2F] font-semibold">
              Are you sure you want to clear your local workout history? This cannot be undone.
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={handleClear}
                className="px-3 py-1 rounded-full bg-[#D32F2F] text-white font-semibold"
              >
                Yes, Clear
              </button>
              <button
                onClick={() => setShowClearConfirm(false)}
                className="px-3 py-1 rounded-full bg-white text-[#696C92]"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {history.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#E2D9F3] text-[11px] font-semibold uppercase text-[#696C92]">
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Exercise</th>
                  <th className="py-3 px-4">Repetitions</th>
                  <th className="py-3 px-4">Duration</th>
                  <th className="py-3 px-4">Form Quality</th>
                  <th className="py-3 px-4 text-right">Data Source</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2D9F3] text-xs">
                {history.map((session) => (
                  <tr key={session.id} className="hover:bg-[#FFFFFF] transition-colors">
                    <td className="py-3.5 px-4 text-[#696C92] whitespace-nowrap">
                      {new Date(session.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-[#2F3159]">
                      {session.exerciseName}
                    </td>
                    <td className="py-3.5 px-4 text-[#2F3159] font-medium">
                      {session.repsCount} reps
                    </td>
                    <td className="py-3.5 px-4 text-[#696C92]">
                      {Math.floor(session.durationSec / 60)}m {session.durationSec % 60}s
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={`px-2.5 py-0.5 rounded-full font-semibold ${
                        session.accuracyScore >= 85
                          ? 'bg-[#DCFCE7] text-[#16A34A]'
                          : 'bg-[#FFF8E1] text-[#D97706]'
                      }`}>
                        {session.accuracyScore}%
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-[#F3F0FF] text-[#696C92]">
                        {session.isSample ? 'Demo Benchmark' : 'User Session'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8 text-[#696C92] text-xs">
            No sessions recorded yet. Start your first movement practice!
          </div>
        )}
      </div>

    </div>
  );
}

