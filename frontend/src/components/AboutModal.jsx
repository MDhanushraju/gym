import React from 'react';
import { X, ShieldCheck, Heart, Sparkles, Cpu, Compass } from 'lucide-react';

export default function AboutModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-[#2F3159]/40 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
      <div className="w-full max-w-2xl bg-[#FFFFFF] rounded-3xl p-6 sm:p-8 border border-[#E2D9F3] shadow-xl relative max-h-[90vh] overflow-y-auto">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-6 right-6 p-2 rounded-full bg-[#F3F0FF] hover:bg-[#EDE9FE] text-[#2F3159] transition-colors"
          aria-label="Close dialog"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-2xl bg-[#EDE9FE] text-[#2F3159] flex items-center justify-center">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-mono uppercase tracking-wider text-[#7F00FF] font-semibold">
              Our Movement Philosophy
            </span>
            <h3 className="text-2xl font-bold text-[#2F3159]">
              About FormFit
            </h3>
          </div>
        </div>

        <p className="text-sm text-[#696C92] leading-relaxed mb-6">
          FormFit was born from a simple belief: exercise technology shouldn't feel loud, aggressive, or intimidating. Instead, movement should be peaceful, intelligent, and deeply supportive of your natural biomechanics.
        </p>

        {/* Core Pillars Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          
          <div className="p-4 rounded-2xl bg-[#FFFFFF] border border-[#E2D9F3]">
            <div className="flex items-center gap-2 text-[#2F3159] font-semibold text-sm mb-1.5">
              <ShieldCheck className="w-4 h-4 text-[#7F00FF]" />
              <span>100% On-Device Privacy</span>
            </div>
            <p className="text-xs text-[#696C92] leading-relaxed">
              Your camera feed never leaves your device. All MediaPipe AI pose detection runs locally in your browser.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-[#FFFFFF] border border-[#E2D9F3]">
            <div className="flex items-center gap-2 text-[#2F3159] font-semibold text-sm mb-1.5">
              <Compass className="w-4 h-4 text-[#7F00FF]" />
              <span>Anatomical Biomechanics</span>
            </div>
            <p className="text-xs text-[#696C92] leading-relaxed">
              Real-time vector angle math tracking 33 skeletal joints to protect your lower back, knees, and shoulders.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-[#FFFFFF] border border-[#E2D9F3]">
            <div className="flex items-center gap-2 text-[#2F3159] font-semibold text-sm mb-1.5">
              <Heart className="w-4 h-4 text-[#7F00FF]" />
              <span>Calm, Encouraging Coaching</span>
            </div>
            <p className="text-xs text-[#696C92] leading-relaxed">
              Constructive, friendly feedback that helps you build intuitive body awareness without stress or guilt.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-[#FFFFFF] border border-[#E2D9F3]">
            <div className="flex items-center gap-2 text-[#2F3159] font-semibold text-sm mb-1.5">
              <Cpu className="w-4 h-4 text-[#7F00FF]" />
              <span>Zero Backend Latency</span>
            </div>
            <p className="text-xs text-[#696C92] leading-relaxed">
              Pure client-side React & WebAssembly. Instant response times, smooth frame rates, and zero external logins.
            </p>
          </div>

        </div>

        <div className="pt-4 border-t border-[#E2D9F3] flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-full text-xs font-semibold bg-[#2F3159] text-white hover:bg-[#2F3159] transition-colors"
          >
            Close & Start Moving
          </button>
        </div>

      </div>
    </div>
  );
}

