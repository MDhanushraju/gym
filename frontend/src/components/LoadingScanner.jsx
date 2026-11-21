import React, { useEffect, useState } from 'react';
import { Sparkles, CheckCircle, Compass, Heart } from 'lucide-react';

export default function LoadingScanner({ 
  onComplete, 
  exerciseName = "Weighted Squats",
  progress: externalProgress = null,
  statusMessage = ""
}) {
  const [internalProgress, setInternalProgress] = useState(10);
  const [activeStep, setActiveStep] = useState(0);

  const isControlled = externalProgress !== null;
  const progress = isControlled ? externalProgress : internalProgress;

  const steps = [
    { label: 'Harmonizing video resolution and lighting', threshold: 25 },
    { label: 'Observing 33 anatomical joint landmarks via MediaPipe', threshold: 55 },
    { label: 'Understanding joint angles and movement symmetry', threshold: 80 },
    { label: 'Crafting thoughtful coaching recommendations', threshold: 100 }
  ];

  useEffect(() => {
    if (isControlled) return;
    const timer = setInterval(() => {
      setInternalProgress((prev) => {
        if (prev >= 100) {
          clearInterval(timer);
          setTimeout(() => {
            onComplete();
          }, 350);
          return 100;
        }
        const next = prev + Math.floor(Math.random() * 8) + 6;
        return next > 100 ? 100 : next;
      });
    }, 170);

    return () => clearInterval(timer);
  }, [onComplete, isControlled]);

  useEffect(() => {
    if (progress < 25) setActiveStep(0);
    else if (progress < 55) setActiveStep(1);
    else if (progress < 80) setActiveStep(2);
    else setActiveStep(3);
  }, [progress]);

  return (
    <div className="fixed inset-0 z-50 bg-[#2F3159]/40 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
      <div className="w-full max-w-md bg-[#FFFFFF] rounded-3xl p-8 border border-[#E2D9F3] shadow-xl text-center relative overflow-hidden flex flex-col items-center">
        
        {/* Soft Organic Pulse Rings */}
        <div className="w-24 h-24 relative flex items-center justify-center mb-5">
          <div className="absolute inset-0 rounded-full border-2 border-[#7F00FF]/30 animate-ping opacity-60" />
          <div className="w-20 h-20 rounded-full bg-[#EDE9FE] flex items-center justify-center text-[#2F3159] shadow-sm">
            <Compass className="w-8 h-8 text-[#2F3159] animate-spin" style={{ animationDuration: '8s' }} />
          </div>
        </div>

        <h3 className="text-xl font-bold text-[#2F3159] tracking-tight">
          Observing Your Movement
        </h3>
        <p className="text-xs text-[#696C92] mt-1 flex items-center gap-1.5 justify-center">
          <Sparkles className="w-3.5 h-3.5 text-[#7F00FF]" />
          <span>Understanding {exerciseName}</span>
        </p>

        {/* Progress Bar & Percentage */}
        <div className="w-full mt-6">
          <div className="flex items-center justify-between text-xs mb-2">
            <span className="text-[#696C92] font-medium">ANALYZING BIOMECHANICS</span>
            <span className="text-[#2F3159] font-bold">{progress}%</span>
          </div>
          <div className="w-full h-2 bg-[#F3F0FF] rounded-full overflow-hidden border border-[#E2D9F3]">
            <div
              className="h-full bg-[#7F00FF] rounded-full transition-all duration-200"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Step Checklist */}
        <div className="w-full mt-6 flex flex-col gap-2.5 text-left">
          {steps.map((step, idx) => {
            const isDone = progress >= step.threshold;
            const isCurrent = activeStep === idx;

            return (
              <div
                key={idx}
                className={`p-3 rounded-xl border text-xs flex items-center gap-2.5 transition-all ${
                  isDone
                    ? 'bg-[#DCFCE7] border-[#BBF7D0] text-[#16A34A]'
                    : isCurrent
                    ? 'bg-[#EDE9FE]/50 border-[#7F00FF] text-[#2F3159] font-semibold'
                    : 'bg-[#FFFFFF] border-[#E2D9F3] text-[#696C92]/60'
                }`}
              >
                {isDone ? (
                  <CheckCircle className="w-4 h-4 text-[#16A34A] shrink-0" />
                ) : (
                  <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                    isCurrent ? 'border-[#7F00FF]' : 'border-[#E2D9F3]'
                  }`}>
                    {isCurrent && <span className="w-1.5 h-1.5 bg-[#7F00FF] rounded-full" />}
                  </div>
                )}
                <span className="truncate">{step.label}</span>
              </div>
            );
          })}
        </div>

      </div>
    </div>
  );
}
