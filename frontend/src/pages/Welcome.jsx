import React from 'react';
import { 
  ArrowRight, ShieldCheck, Heart, Sparkles, ChevronRight, 
  Activity, CheckCircle2, Compass, Wind, Smile, Play 
} from 'lucide-react';
import { EXERCISES } from '../data/exercises';

export default function Welcome({ 
  onStartMoving, 
  onExploreExercises, 
  onSelectExerciseDirectly,
  dailyGoal
}) {
  const completedReps = dailyGoal?.completedRepsToday || 0;
  const targetReps = dailyGoal?.targetReps || 12;

  return (
    <div className="relative min-h-[calc(100vh-5rem)] flex flex-col justify-between overflow-hidden bg-calm-gradient">
      
      {/* Gentle Floating Organic Background Elements */}
      <div className="absolute top-12 left-10 w-96 h-96 rounded-full bg-[#EDE9FE]/40 blur-3xl pointer-events-none animate-wave-slow" />
      <div className="absolute top-48 right-10 w-80 h-80 rounded-full bg-[#E5F0F5]/50 blur-3xl pointer-events-none animate-float-gentle" />
      <div className="absolute bottom-20 left-1/3 w-72 h-72 rounded-full bg-[#F1EBDD]/40 blur-3xl pointer-events-none" />

      {/* Main Hero Section */}
      <section className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-20 flex flex-col lg:flex-row items-center justify-between gap-12 z-10">
        
        {/* Left Column: Heading, Supporting Text & CTAs */}
        <div className="flex-1 max-w-2xl text-center lg:text-left">
          
          {/* Calm Eyebrow Pill */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#EDE9FE] text-[#2F3159] text-xs font-semibold mb-6 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-[#16A34A]" />
            <span className="tracking-wide">A Smarter, Calmer Movement Companion</span>
          </div>

          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-[#2F3159] font-sans leading-[1.15]">
            Move Better. <br />
            <span className="text-[#7F00FF]">
              Feel Better. Every Day.
            </span>
          </h1>

          <p className="mt-6 text-base sm:text-lg text-[#696C92] leading-relaxed max-w-xl">
            Your personal movement companion. Understand your form, improve your technique and build healthier movement habits.
          </p>

          {/* Primary & Secondary Buttons */}
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4">
            <button
              onClick={onStartMoving}
              className="w-full sm:w-auto px-8 py-4 rounded-full font-semibold text-sm bg-[#7F00FF] hover:bg-[#6E00DE] text-white shadow-sm hover:shadow-md transition-all duration-300 flex items-center justify-center gap-2.5 hover:scale-[1.02] active:scale-[0.98]"
            >
              <span>Start Moving</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              onClick={onExploreExercises}
              className="w-full sm:w-auto px-8 py-4 rounded-full font-semibold text-sm bg-[#FFFFFF] hover:bg-[#F3F0FF] text-[#2F3159] border border-[#E2D9F3] flex items-center justify-center gap-2 transition-all duration-300 shadow-sm"
            >
              <span>Explore Exercises</span>
              <ChevronRight className="w-4 h-4 text-[#696C92]" />
            </button>
          </div>

          {/* Calming Trust Elements */}
          <div className="mt-12 pt-8 border-t border-[#E2D9F3] grid grid-cols-3 gap-6 text-center lg:text-left">
            <div>
              <div className="text-2xl font-bold font-sans text-[#2F3159]">33</div>
              <p className="text-xs text-[#696C92] mt-0.5">Joints Tracked</p>
            </div>
            <div>
              <div className="text-2xl font-bold font-sans text-[#16A34A]">100%</div>
              <p className="text-xs text-[#696C92] mt-0.5">On-Device Privacy</p>
            </div>
            <div>
              <div className="text-2xl font-bold font-sans text-[#2F3159]">Gentle</div>
              <p className="text-xs text-[#696C92] mt-0.5">Supportive Cues</p>
            </div>
          </div>

        </div>

        {/* Right Column: Apple Fitness / Scandinavian Movement Card */}
        <div className="flex-1 w-full max-w-lg lg:max-w-none relative">
          
          <div className="calm-card p-6 sm:p-8 bg-[#FFFFFF] border-[#E2D9F3] shadow-soft-lg">
            
            {/* Top Bar */}
            <div className="flex items-center justify-between pb-4 border-b border-[#E2D9F3]">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-[#7F00FF]" />
                <span className="text-xs font-semibold text-[#2F3159]">Live Movement Harmony</span>
              </div>
              <span className="px-3 py-1 rounded-full bg-[#DCFCE7] text-[#16A34A] text-xs font-semibold">
                94% Movement Balance
              </span>
            </div>

            {/* Visual Movement Studio Viewport */}
            <div className="my-5 rounded-2xl bg-[#F3F0FF] aspect-[16/10] relative overflow-hidden border border-[#E2D9F3] flex items-center justify-center p-6">
              
              {/* Soft organic glowing gradient */}
              <div className="absolute inset-0 bg-radial-gradient from-[#EDE9FE]/50 to-transparent opacity-60" />

              {/* Natural Athlete Wireframe Silhouette */}
              <div className="relative z-10 flex flex-col items-center">
                <svg className="w-44 h-44 text-[#2F3159] animate-float-gentle" viewBox="0 0 100 100" fill="none" stroke="currentColor">
                  {/* Head */}
                  <circle cx="50" cy="18" r="7" strokeWidth="2.5" />
                  {/* Spine */}
                  <path d="M50 25 L50 55" strokeWidth="2.5" strokeLinecap="round" />
                  {/* Arms & Weights */}
                  <path d="M50 32 L28 42 L34 58" strokeWidth="2" strokeLinecap="round" />
                  <path d="M50 32 L72 42 L66 58" strokeWidth="2" strokeLinecap="round" />
                  <rect x="28" y="56" width="12" height="6" rx="1.5" fill="#7F00FF" />
                  <rect x="60" y="56" width="12" height="6" rx="1.5" fill="#7F00FF" />
                  {/* Squat Legs */}
                  <path d="M50 55 L30 68 L32 88" strokeWidth="2.5" strokeLinecap="round" />
                  <path d="M50 55 L70 68 L68 88" strokeWidth="2.5" strokeLinecap="round" />
                  {/* Joint nodes */}
                  <circle cx="30" cy="68" r="3" fill="#FFFFFF" stroke="#16A34A" strokeWidth="1.5" />
                  <circle cx="70" cy="68" r="3" fill="#FFFFFF" stroke="#16A34A" strokeWidth="1.5" />
                </svg>
              </div>

              {/* Gentle Floating Feedback Pills */}
              <div className="absolute top-3 left-3 px-3 py-1 rounded-full bg-[#FFFFFF]/90 backdrop-blur-sm border border-[#E2D9F3] text-[11px] font-medium text-[#2F3159] shadow-sm">
                Knee Tracking: <span className="text-[#16A34A] font-semibold">Centered</span>
              </div>
              <div className="absolute bottom-3 right-3 px-3 py-1 rounded-full bg-[#FFFFFF]/90 backdrop-blur-sm border border-[#E2D9F3] text-[11px] font-medium text-[#2F3159] shadow-sm">
                Spine: <span className="text-[#16A34A] font-semibold">Neutral</span>
              </div>
            </div>

            {/* Daily Goal Progress Bar inside Hero Card */}
            <div className="p-4 rounded-2xl bg-[#FFFFFF] border border-[#E2D9F3] flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-[#2F3159] block">Today's Movement Intention</span>
                <span className="text-xs text-[#696C92]">{completedReps} of {targetReps} repetitions completed</span>
              </div>
              <div className="w-24 h-2 bg-[#E2D9F3] rounded-full overflow-hidden">
                <div 
                  className="h-full bg-[#7F00FF] rounded-full" 
                  style={{ width: `${Math.min(100, Math.round((completedReps / targetReps) * 100))}%` }} 
                />
              </div>
            </div>

          </div>
        </div>

      </section>

      {/* Three Simple Steps Section */}
      <section className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 z-10 w-full border-t border-[#E2D9F3]">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <span className="text-xs font-semibold uppercase tracking-wider text-[#7F00FF]">
            How FormFit Works
          </span>
          <h2 className="text-2xl sm:text-3xl font-bold text-[#2F3159] mt-1">
            Three Steps to Natural, Confident Movement
          </h2>
          <p className="text-sm text-[#696C92] mt-2">
            No expensive sensors, wearables, or confusing gym jargon. Just you and thoughtful visual guidance.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          <div className="calm-card p-8 text-left flex flex-col justify-between">
            <div>
              <span className="text-xs font-mono font-bold text-[#7F00FF] px-3 py-1 rounded-full bg-[#EDE9FE]/60 inline-block mb-4">
                01
              </span>
              <h3 className="text-lg font-bold text-[#2F3159] mb-2">
                Choose Your Movement
              </h3>
              <p className="text-xs text-[#696C92] leading-relaxed">
                Select from foundational bodyweight movements like Basic Squats or Standard Pushups with step-by-step guidance.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-[#E2D9F3] text-xs font-medium text-[#2F3159] flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#7F00FF]" />
              <span>Full posture breakdown</span>
            </div>
          </div>

          <div className="calm-card p-8 text-left flex flex-col justify-between">
            <div>
              <span className="text-xs font-mono font-bold text-[#7F00FF] px-3 py-1 rounded-full bg-[#EDE9FE]/60 inline-block mb-4">
                02
              </span>
              <h3 className="text-lg font-bold text-[#2F3159] mb-2">
                Let FormFit Observe
              </h3>
              <p className="text-xs text-[#696C92] leading-relaxed">
                Position your phone, tablet, or laptop camera. FormFit maps 33 joints privately in real time.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-[#E2D9F3] text-xs font-medium text-[#2F3159] flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-[#7F00FF]" />
              <span>100% On-device privacy</span>
            </div>
          </div>

          <div className="calm-card p-8 text-left flex flex-col justify-between">
            <div>
              <span className="text-xs font-mono font-bold text-[#7F00FF] px-3 py-1 rounded-full bg-[#EDE9FE]/60 inline-block mb-4">
                03
              </span>
              <h3 className="text-lg font-bold text-[#2F3159] mb-2">
                Improve With Guidance
              </h3>
              <p className="text-xs text-[#696C92] leading-relaxed">
                Receive calm, supportive cues to adjust your knees, spine, and elbows to protect joints and build strength.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-[#E2D9F3] text-xs font-medium text-[#2F3159] flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[#7F00FF]" />
              <span>Friendly audio & visual cues</span>
            </div>
          </div>

        </div>
      </section>

      {/* Featured Exercises Preview */}
      <section className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20 z-10 w-full">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-[#7F00FF]">
              Essential Library
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold text-[#2F3159] mt-1">
              Explore Available Movements
            </h2>
          </div>
          <button
            onClick={onExploreExercises}
            className="text-xs font-semibold text-[#2F3159] hover:text-[#7F00FF] flex items-center gap-1 transition-colors"
          >
            <span>View All {EXERCISES.length} Exercises</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-4xl mx-auto">
          {EXERCISES.map((exercise) => (
            <div
              key={exercise.id}
              onClick={() => onSelectExerciseDirectly(exercise)}
              className="p-5 rounded-2xl calm-card cursor-pointer group flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between text-[11px] text-[#696C92] mb-2">
                  <span>{exercise.category}</span>
                  <span className="text-[#16A34A] font-medium">{exercise.difficulty}</span>
                </div>
                <h3 className="text-base font-bold text-[#2F3159] group-hover:text-[#7F00FF] transition-colors">
                  {exercise.name}
                </h3>
                <p className="text-xs text-[#696C92] mt-1.5 line-clamp-2 leading-relaxed">
                  {exercise.shortDescription}
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-[#E2D9F3] flex items-center justify-between text-xs font-semibold text-[#7F00FF]">
                <span>Start Practice</span>
                <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Peaceful Closing Footer */}
      <footer className="border-t border-[#E2D9F3] bg-[#FFFFFF] py-8 px-4 text-center text-xs text-[#696C92]">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-bold text-[#2F3159]">FormFit</span>
            <span>• A Smarter, Calmer Fitness Experience</span>
          </div>
          <p className="text-[#696C92]">
            Runs 100% client-side with on-device MediaPipe pose intelligence.
          </p>
        </div>
      </footer>

    </div>
  );
}
