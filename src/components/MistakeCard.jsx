import React, { useState } from 'react';
import { AlertCircle, CheckCircle, ChevronDown, ChevronUp, Sparkles, Compass } from 'lucide-react';

export default function MistakeCard({ mistake }) {
  const [isExpanded, setIsExpanded] = useState(true);

  const severityStyles = {
    High: {
      badge: 'bg-[#FFEBEE] text-[#D32F2F] border-[#FFCDD2]',
      border: 'border-[#FFCDD2]',
      icon: <AlertCircle className="w-4 h-4 text-[#D32F2F] shrink-0" />
    },
    Medium: {
      badge: 'bg-[#FFF8E1] text-[#D97706] border-[#FFE082]',
      border: 'border-[#FFE082]',
      icon: <AlertCircle className="w-4 h-4 text-[#D97706] shrink-0" />
    },
    Low: {
      badge: 'bg-[#E5F0F5] text-[#2F3159] border-[#C5DCE6]',
      border: 'border-[#C5DCE6]',
      icon: <Compass className="w-4 h-4 text-[#7F00FF] shrink-0" />
    }
  };

  const style = severityStyles[mistake.severity] || severityStyles.Medium;

  return (
    <div className={`calm-card overflow-hidden transition-all duration-300`}>
      {/* Header Row */}
      <div 
        onClick={() => setIsExpanded(!isExpanded)}
        className="p-5 flex items-center justify-between cursor-pointer select-none bg-[#FFFFFF] hover:bg-[#FFFFFF] transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-[#F3F0FF] border border-[#E2D9F3]">
            {style.icon}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-medium uppercase tracking-wider text-[#696C92]">
                {mistake.bodyPart}
              </span>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${style.badge}`}>
                {mistake.severity} Attention
              </span>
            </div>
            <h4 className="text-base sm:text-lg font-bold text-[#2F3159] tracking-tight mt-0.5">
              {mistake.title}
            </h4>
          </div>
        </div>

        <button className="p-1 rounded-full text-[#696C92] hover:text-[#2F3159] transition-colors">
          {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </button>
      </div>

      {/* Expanded Diagnostic Body */}
      {isExpanded && (
        <div className="p-5 border-t border-[#E2D9F3] flex flex-col gap-4 bg-[#FFFFFF]/50 text-sm">
          
          {/* Grid: What Happened & Movement Consequence */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* What Happened */}
            <div className="p-4 rounded-2xl bg-[#FFFFFF] border border-[#E2D9F3]">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#696C92] block mb-1">
                1. Observation
              </span>
              <p className="text-[#2F3159] leading-relaxed text-xs sm:text-sm">
                {mistake.whatHappened}
              </p>
            </div>

            {/* Why Wrong */}
            <div className="p-4 rounded-2xl bg-[#FFFFFF] border border-[#E2D9F3]">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#696C92] block mb-1">
                2. Biomechanical Impact
              </span>
              <p className="text-[#2F3159] leading-relaxed text-xs sm:text-sm">
                {mistake.whyWrong}
              </p>
            </div>

          </div>

          {/* Corrective Guidance */}
          <div className="p-4 rounded-2xl bg-[#EDE9FE]/40 border border-[#EDE9FE]">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#2F3159] flex items-center gap-1.5 mb-1">
              <CheckCircle className="w-4 h-4 text-[#16A34A]" />
              <span>3. Suggested Adjustment</span>
            </span>
            <p className="text-[#2F3159] leading-relaxed text-xs sm:text-sm font-medium">
              {mistake.howToCorrect}
            </p>
          </div>

          {/* Coach Mental Cue */}
          {mistake.quickTip && (
            <div className="flex items-start gap-2.5 px-3.5 py-2.5 rounded-xl bg-[#FFFFFF] border border-[#E2D9F3] text-xs text-[#696C92]">
              <Sparkles className="w-4 h-4 text-[#7F00FF] shrink-0 mt-0.5" />
              <span><strong className="text-[#2F3159]">Coach's Thought:</strong> {mistake.quickTip}</span>
            </div>
          )}

        </div>
      )}
    </div>
  );
}
