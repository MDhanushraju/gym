import React, { useState } from 'react';
import { 
  Sparkles, Heart, Activity, Menu, X, ChevronRight, 
  Compass, Video, Target, Info, CheckCircle2 
} from 'lucide-react';

export default function Navbar({ 
  currentScreen, 
  onNavigate, 
  dailyGoal,
  onOpenAbout,
  onStartMoving
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navLinks = [
    { id: 'welcome', label: 'Home' },
    { id: 'exercises', label: 'Exercises' },
    { id: 'live-coach', label: 'Live Coach' },
    { id: 'my-progress', label: 'My Progress' },
    { id: 'back-camera-node', label: '📷 Join 2nd Cam' },
  ];

  const handleNavClick = (screenId) => {
    onNavigate(screenId);
    setMobileMenuOpen(false);
  };

  const completedReps = dailyGoal?.completedRepsToday || 0;
  const targetReps = dailyGoal?.targetReps || 12;
  const goalPercent = Math.min(100, Math.round((completedReps / targetReps) * 100));

  return (
    <header className="sticky top-0 z-40 w-full border-b border-[#3D406E] bg-[#2F3159] shadow-md transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
        
        {/* Brand Logo */}
        <div 
          onClick={() => handleNavClick('welcome')}
          className="flex items-center gap-3 cursor-pointer group"
        >
          <div className="w-11 h-11 rounded-2xl bg-[#7F00FF] text-white flex items-center justify-center shadow-md group-hover:scale-105 transition-transform duration-300">
            {/* Movement Icon */}
            <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2a9 9 0 0 1 9 9c0 4.97-4.03 9-9 9A9 9 0 0 1 3 11a9 9 0 0 1 9-9z"/>
              <path d="M7 12c2.5 0 4-2 5-5 1 3 2.5 5 5 5-2.5 0-4 2-5 5-1-3-2.5-5-5-5z"/>
            </svg>
          </div>
          <div>
            <div className="relative flex items-center gap-2">
             
              <span className="pointer-events-none absolute left-7 top-1/2 -translate-y-1/2 text-[1.65rem] font-black tracking-[0.18em] text-white/10 uppercase select-none">
                velioum
              </span>
              
            </div>
          </div>
        </div>

        {/* Desktop Navigation Links */}
        <nav className="hidden md:flex items-center gap-1 bg-[#242647] p-1.5 rounded-full border border-[#3D406E]">
          {navLinks.map((item) => {
            const isActive = currentScreen === item.id || 
              (item.id === 'exercises' && ['demo', 'upload', 'analysis'].includes(currentScreen)) ||
              (item.id === 'live-coach' && currentScreen === 'workout-summary');

            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className={`px-4 py-2 rounded-full text-xs font-semibold transition-all duration-300 ${
                  isActive
                    ? 'bg-[#7F00FF] text-white shadow-md'
                    : 'text-[#C5C8E6] hover:text-white hover:bg-[#3D406E]/70'
                }`}
              >
                {item.label}
              </button>
            );
          })}

          <button
            onClick={onOpenAbout}
            className="px-4 py-2 rounded-full text-xs font-medium text-[#C5C8E6] hover:text-white hover:bg-[#3D406E]/70 transition-all duration-300"
          >
            About
          </button>
        </nav>

        {/* Right Section: Daily Goal Pill & Primary CTA */}
        <div className="hidden sm:flex items-center gap-3">
          
          {/* Daily Goal Quick Pill */}
          <div 
            onClick={() => handleNavClick('my-progress')}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#242647] border border-[#3D406E] text-xs cursor-pointer hover:border-[#7F00FF] transition-colors"
            title="Click to view daily movement goal progress"
          >
            <div className="w-5 h-5 rounded-full bg-[#7F00FF] flex items-center justify-center text-[10px] font-bold text-white">
              {completedReps}
            </div>
            <span className="text-[#C5C8E6]">/ {targetReps} reps today</span>
            <div className="w-12 h-1.5 bg-[#3D406E] rounded-full overflow-hidden">
              <div 
                className="h-full bg-[#7F00FF] rounded-full transition-all duration-500" 
                style={{ width: `${goalPercent}%` }}
              />
            </div>
          </div>

          {/* Primary Action Button */}
          <button
            onClick={onStartMoving}
            className="px-5 py-2.5 rounded-full text-xs font-bold bg-[#7F00FF] text-white hover:bg-[#6E00DE] shadow-md hover:shadow-lg transition-all duration-300 flex items-center gap-2 hover:scale-[1.02]"
          >
            <Sparkles className="w-3.5 h-3.5 text-white" />
            <span>Start Moving</span>
          </button>
        </div>

        {/* Mobile Hamburger Button */}
        <div className="flex sm:hidden items-center gap-2">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2.5 rounded-xl bg-[#242647] border border-[#3D406E] text-white hover:bg-[#3D406E] transition-colors"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5 text-white" /> : <Menu className="w-5 h-5 text-white" />}
          </button>
        </div>

      </div>

      {/* Mobile Menu Drawer */}
      {mobileMenuOpen && (
        <div className="sm:hidden px-4 pt-2 pb-6 bg-[#2F3159] border-b border-[#3D406E] shadow-xl animate-slide-up">
          <nav className="flex flex-col gap-2">
            {navLinks.map((item) => (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className={`w-full py-3 px-4 rounded-xl text-left text-sm font-medium flex items-center justify-between ${
                  currentScreen === item.id
                    ? 'bg-[#7F00FF] text-white font-semibold'
                    : 'text-[#C5C8E6] hover:bg-[#242647] hover:text-white'
                }`}
              >
                <span>{item.label}</span>
                <ChevronRight className="w-4 h-4 text-[#A6A9D0]" />
              </button>
            ))}

            <button
              onClick={() => { onOpenAbout(); setMobileMenuOpen(false); }}
              className="w-full py-3 px-4 rounded-xl text-left text-sm font-medium text-[#C5C8E6] hover:bg-[#242647] hover:text-white flex items-center justify-between"
            >
              <span>About FormFit</span>
              <Info className="w-4 h-4 text-[#A6A9D0]" />
            </button>

            <div className="pt-3 border-t border-[#3D406E]">
              <button
                onClick={() => { onStartMoving(); setMobileMenuOpen(false); }}
                className="w-full py-3.5 rounded-xl font-bold text-sm bg-[#7F00FF] text-white flex items-center justify-center gap-2 shadow-md"
              >
                <Sparkles className="w-4 h-4 text-white" />
                <span>Start Moving</span>
              </button>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
