import React from 'react';
import { ChevronRight, Heart, Clock, Target, CheckCircle2 } from 'lucide-react';

export default function ExerciseCard({ 
  exercise, 
  onSelect, 
  isSelected, 
  isFavorite = false, 
  onToggleFavorite 
}) {
  const difficultyStyles = {
    Beginner: 'text-[#16A34A] bg-[#DCFCE7] border-[#BBF7D0]',
    Intermediate: 'text-[#D97706] bg-[#FFF8E1] border-[#FFE082]',
    Advanced: 'text-[#D32F2F] bg-[#FFEBEE] border-[#FFCDD2]'
  };

  const renderCardIllustration = () => {
    switch (exercise.id) {
      case 'basic-squats':
      case 'weighted-squats':
        return (
          <div className="w-full h-48 bg-[#E5F0F5]/50 relative flex items-center justify-center overflow-hidden rounded-t-2xl">
            {/* Subtle organic circles */}
            <div className="w-32 h-32 rounded-full bg-[#EDE9FE]/60 blur-xl absolute" />
            <svg className="w-24 h-24 text-[#2F3159] stroke-1 transform transition-transform group-hover:scale-105 duration-500" viewBox="0 0 100 100" fill="none" stroke="currentColor">
              <circle cx="50" cy="22" r="7" strokeWidth="2.5" />
              <path d="M50 30 v25 M32 36 h36 M50 55 l-18 20 l-2 15 M50 55 l18 20 l2 15" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              {exercise.id === 'weighted-squats' && (
                <>
                  <rect x="26" y="32" width="6" height="10" rx="2" fill="#7F00FF" />
                  <rect x="68" y="32" width="6" height="10" rx="2" fill="#7F00FF" />
                </>
              )}
            </svg>
            <div className="absolute bottom-3 left-4 flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FFFFFF]/90 backdrop-blur-sm text-[11px] font-medium text-[#2F3159] border border-[#E2D9F3] shadow-sm">
              <Target className="w-3 h-3 text-[#7F00FF]" />
              <span>Quadriceps & Glutes</span>
            </div>
          </div>
        );
      case 'upright-dumbbell-row':
        return (
          <div className="w-full h-48 bg-[#EDE9F5]/40 relative flex items-center justify-center overflow-hidden rounded-t-2xl">
            <div className="w-32 h-32 rounded-full bg-[#EDE9FE]/50 blur-xl absolute" />
            <svg className="w-24 h-24 text-[#2F3159] stroke-1 transform transition-transform group-hover:scale-105 duration-500" viewBox="0 0 100 100" fill="none" stroke="currentColor">
              <circle cx="50" cy="22" r="7" strokeWidth="2.5" />
              <path d="M50 30 v30 M50 35 l-22 10 l8 18 M50 35 l22 10 l-8 18 M42 60 v30 M58 60 v30" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              <rect x="32" y="58" width="8" height="8" rx="1.5" fill="#7F00FF" />
              <rect x="60" y="58" width="8" height="8" rx="1.5" fill="#7F00FF" />
            </svg>
            <div className="absolute bottom-3 left-4 flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FFFFFF]/90 backdrop-blur-sm text-[11px] font-medium text-[#2F3159] border border-[#E2D9F3] shadow-sm">
              <Target className="w-3 h-3 text-[#7F00FF]" />
              <span>Shoulders & Traps</span>
            </div>
          </div>
        );
      case 'forward-dumbbell-row':
        return (
          <div className="w-full h-48 bg-[#EDE9FE]/40 relative flex items-center justify-center overflow-hidden rounded-t-2xl">
            <div className="w-32 h-32 rounded-full bg-[#E5F0F5]/60 blur-xl absolute" />
            <svg className="w-24 h-24 text-[#2F3159] stroke-1 transform transition-transform group-hover:scale-105 duration-500" viewBox="0 0 100 100" fill="none" stroke="currentColor">
              <circle cx="36" cy="28" r="7" strokeWidth="2.5" />
              <path d="M42 35 l22 15 M64 50 l-8 22 l-2 18 M64 50 l6 22 l2 18 M50 40 l-5 16 l12 2" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              <rect x="52" y="52" width="10" height="8" rx="2" fill="#7F00FF" />
            </svg>
            <div className="absolute bottom-3 left-4 flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FFFFFF]/90 backdrop-blur-sm text-[11px] font-medium text-[#2F3159] border border-[#E2D9F3] shadow-sm">
              <Target className="w-3 h-3 text-[#7F00FF]" />
              <span>Lats & Mid-Back</span>
            </div>
          </div>
        );
      case 'pushups':
        return (
          <div className="w-full h-48 bg-[#E5F0F5]/50 relative flex items-center justify-center overflow-hidden rounded-t-2xl">
            <div className="w-32 h-32 rounded-full bg-[#EDE9FE]/60 blur-xl absolute" />
            <svg className="w-24 h-24 text-[#2F3159] stroke-1 transform transition-transform group-hover:scale-105 duration-500" viewBox="0 0 100 100" fill="none" stroke="currentColor">
              <line x1="12" y1="72" x2="88" y2="72" stroke="#A8B6AE" strokeWidth="1.5" strokeDasharray="3 3" />
              <circle cx="28" cy="46" r="6" strokeWidth="2.5" />
              <path d="M34 50 L58 54 L82 70" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M36 51 L30 60 L35 72" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              <rect x="31" y="70" width="8" height="4" rx="1.5" fill="#7F00FF" />
              <rect x="79" y="69" width="6" height="5" rx="1.5" fill="#7F00FF" />
            </svg>
            <div className="absolute bottom-3 left-4 flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FFFFFF]/90 backdrop-blur-sm text-[11px] font-medium text-[#2F3159] border border-[#E2D9F3] shadow-sm">
              <Target className="w-3 h-3 text-[#7F00FF]" />
              <span>Chest, Triceps & Core</span>
            </div>
          </div>
        );
      default:
        return (
          <div className="w-full h-48 bg-[#F1EBDD]/50 relative flex items-center justify-center overflow-hidden rounded-t-2xl">
            <div className="w-32 h-32 rounded-full bg-[#EDE9FE]/50 blur-xl absolute" />
            <svg className="w-24 h-24 text-[#2F3159] stroke-1 transform transition-transform group-hover:scale-105 duration-500" viewBox="0 0 100 100" fill="none" stroke="currentColor">
              <rect x="18" y="60" width="64" height="6" rx="2" fill="#A8B6AE" />
              <circle cx="30" cy="35" r="7" strokeWidth="2.5" />
              <path d="M35 42 l30 5 M35 42 l-6 18 M65 47 l-10 13 M65 47 l10 20 l-4 22 M52 45 l4 15" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              <rect x="52" y="58" width="9" height="7" rx="1.5" fill="#7F00FF" />
            </svg>
            <div className="absolute bottom-3 left-4 flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FFFFFF]/90 backdrop-blur-sm text-[11px] font-medium text-[#2F3159] border border-[#E2D9F3] shadow-sm">
              <Target className="w-3 h-3 text-[#7F00FF]" />
              <span>Unilateral Lat Flow</span>
            </div>
          </div>
        );
    }
  };

  return (
    <div className={`calm-card group flex flex-col justify-between overflow-hidden relative ${
      isSelected ? 'ring-2 ring-[#7F00FF] border-[#7F00FF]' : ''
    }`}>
      
      {/* Favorite Heart Toggle */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggleFavorite && onToggleFavorite(exercise.id);
        }}
        className="absolute top-4 right-4 z-10 p-2 rounded-full bg-[#FFFFFF]/90 hover:bg-[#FFFFFF] text-[#696C92] hover:text-[#D32F2F] shadow-sm transition-colors"
        aria-label={isFavorite ? "Remove from favorites" : "Save as favorite"}
      >
        <Heart className={`w-4 h-4 ${isFavorite ? 'fill-[#D32F2F] text-[#D32F2F]' : ''}`} />
      </button>

      {/* Visual Header */}
      {renderCardIllustration()}

      {/* Card Content */}
      <div className="p-6 flex-1 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-[11px] font-medium uppercase tracking-wider text-[#696C92]">
              {exercise.category}
            </span>
            <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${difficultyStyles[exercise.difficulty]}`}>
              {exercise.difficulty}
            </span>
          </div>

          <h3 className="text-xl font-bold text-[#2F3159] tracking-tight group-hover:text-[#7F00FF] transition-colors">
            {exercise.name}
          </h3>

          <p className="text-xs text-[#696C92] mt-2 line-clamp-2 leading-relaxed">
            {exercise.shortDescription}
          </p>

          {/* Muscle Tags & Estimated Duration */}
          <div className="flex flex-wrap items-center gap-1.5 mt-4">
            <span className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full bg-[#F3F0FF] text-[#2F3159] border border-[#E2D9F3]">
              <Clock className="w-3 h-3 text-[#696C92]" />
              <span>3 - 5 min</span>
            </span>

            {exercise.targetMuscles.slice(0, 2).map((muscle, idx) => (
              <span
                key={idx}
                className="text-[11px] px-2.5 py-1 rounded-full bg-[#EDE9FE]/50 text-[#2F3159] border border-[#EDE9FE]"
              >
                {muscle}
              </span>
            ))}
          </div>
        </div>

        {/* Action Button */}
        <div className="mt-6 pt-4 border-t border-[#E2D9F3]">
          <button
            onClick={() => onSelect(exercise)}
            className={`w-full py-3 px-4 rounded-full font-semibold text-xs flex items-center justify-center gap-2 transition-all duration-300 ${
              isSelected
                ? 'bg-[#EDE9FE] text-[#2F3159]'
                : 'bg-[#FFFFFF] hover:bg-[#7F00FF] hover:text-white text-[#2F3159] border border-[#E2D9F3]'
            }`}
          >
            {isSelected ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-[#2F3159]" />
                <span>Selected</span>
              </>
            ) : (
              <>
                <span>Select Movement</span>
                <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
