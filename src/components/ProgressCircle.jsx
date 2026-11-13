import React, { useEffect, useState } from 'react';

export default function ProgressCircle({ score = 78, size = 180, strokeWidth = 12 }) {
  const [animatedScore, setAnimatedScore] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimatedScore(score);
    }, 150);
    return () => clearTimeout(timer);
  }, [score]);

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (animatedScore / 100) * circumference;

  // Accessible peaceful status colors
  let statusColor = '#16A34A'; // Accessible green
  let badgeText = 'Natural Balanced Form';
  let badgeBg = 'bg-[#DCFCE7] text-[#16A34A] border-[#BBF7D0]';

  if (score < 65) {
    statusColor = '#D32F2F'; // Soft red
    badgeText = 'Needs Guidance';
    badgeBg = 'bg-[#FFEBEE] text-[#D32F2F] border-[#FFCDD2]';
  } else if (score < 85) {
    statusColor = '#D97706'; // Warm amber
    badgeText = 'Gentle Adjustments';
    badgeBg = 'bg-[#FFF8E1] text-[#D97706] border-[#FFE082]';
  }

  return (
    <div className="flex flex-col items-center justify-center">
      <div className="relative" style={{ width: size, height: size }}>
        
        {/* Soft Background Track */}
        <svg className="w-full h-full -rotate-90 transform" viewBox={`0 0 ${size} ${size}`}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="#E2D9F3"
            strokeWidth={strokeWidth}
            fill="transparent"
          />
          {/* Animated Stroke */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={statusColor}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className="transition-all duration-1000 ease-out"
            fill="transparent"
          />
        </svg>

        {/* Center Percentage Display */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <div className="flex items-baseline">
            <span className="text-4xl sm:text-5xl font-black font-sans tracking-tight text-[#2F3159]">
              {animatedScore}
            </span>
            <span className="text-xl font-bold text-[#696C92] ml-0.5">%</span>
          </div>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[#696C92] -mt-1">
            Movement Quality
          </span>
        </div>
      </div>

      {/* Status Badge */}
      <div className="mt-4">
        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${badgeBg}`}>
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: statusColor }} />
          {badgeText}
        </span>
      </div>
    </div>
  );
}
