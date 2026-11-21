import React, { useState, useEffect } from 'react';
import VideoPlayer from '../components/VideoPlayer';
import { 
  ArrowLeft, ArrowRight, CheckCircle2, AlertCircle, 
  Wind, ShieldCheck, Sparkles, Compass, Eye, Activity, 
  CheckSquare, Square, Video, UploadCloud, Info 
} from 'lucide-react';
import { generateProceduralExerciseVideo } from '../utils/sampleVideos';

export default function ExerciseDemo({
  exercise,
  onStartLiveSession,
  onProceedToUpload,
  onBack
}) {
  const [demoVideoUrl, setDemoVideoUrl] = useState('');
  const [checkedPoints, setCheckedPoints] = useState({});
  const [activeTab, setActiveTab] = useState('instructions');
  const [activeJointHighlight, setActiveJointHighlight] = useState('all');

  useEffect(() => {
    let isMounted = true;
    generateProceduralExerciseVideo(exercise.id, false, 5).then((url) => {
      if (isMounted) setDemoVideoUrl(url);
    });
    return () => { isMounted = false; };
  }, [exercise.id]);

  const togglePointCheck = (idx) => {
    setCheckedPoints(prev => ({ ...prev, [idx]: !prev[idx] }));
  };

  // Tracked joints for this exercise
  const trackedJoints = exercise.id === 'pushups' ? [
    { id: 'elbows', name: 'Elbows', role: 'Maintains 45° arrow angle relative to ribs; flexes to 90° chest-to-floor depth', idealAngle: '90° at bottom' },
    { id: 'wrists', name: 'Wrists & Hands', role: 'Placed directly beneath shoulders with even palm pressure to distribute pushing force', idealAngle: 'Stacked base' },
    { id: 'hips', name: 'Hips & Core', role: 'Maintains rigid unbroken plank line; eliminates hip sag or piking', idealAngle: '180° plank' },
    { id: 'shoulders', name: 'Shoulders & Scapulae', role: 'Retracts at chest depth; protracts smoothly at high plank lockout', idealAngle: 'Smooth glide' }
  ] : [
    { id: 'hips', name: 'Hips & Pelvis', role: 'Maintains neutral hinge and prevents posterior pelvic tuck ("butt wink")', idealAngle: '85° - 90°' },
    { id: 'knees', name: 'Knees', role: 'Tracks directly over 2nd & 3rd toes; prevents inward valgus collapse', idealAngle: '88° at depth' },
    { id: 'ankles', name: 'Ankles & Feet', role: 'Grounds tripod foot pressure; ensures heels remain firmly planted', idealAngle: 'Stable base' },
    { id: 'shoulders', name: 'Shoulders & Spine', role: 'Retracts scapulae and braces cervical spine against excessive flexion', idealAngle: '0° spinal torque' }
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 animate-fade-in">
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2.5 rounded-full bg-[#FFFFFF] hover:bg-[#F3F0FF] border border-[#E2D9F3] text-[#2F3159] transition-colors shadow-sm"
            title="Back to Exercise Selection"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-[#7F00FF]">
              Step-by-Step Preparation
            </span>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-[#2F3159] tracking-tight">
              Learn the Movement
            </h1>
          </div>
        </div>

        {/* Selected Exercise Pill */}
        <div className="flex items-center gap-2.5 px-4 py-2 rounded-full bg-[#FFFFFF] border border-[#E2D9F3] shadow-sm self-start sm:self-auto">
          <div className="w-2.5 h-2.5 rounded-full bg-[#7F00FF]" />
          <span className="text-xs text-[#696C92]">Active Movement:</span>
          <span className="text-xs font-bold text-[#2F3159]">{exercise.name}</span>
        </div>
      </div>

      {/* Main Grid: Video Player (Left) & Instructions / Joint Guide (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left Column (7 cols): Reference Exercise Video Player */}
        <div className="lg:col-span-7 flex flex-col gap-5">
          <div className="calm-card p-2 bg-[#FFFFFF] overflow-hidden">
            {demoVideoUrl ? (
              <VideoPlayer
                src={demoVideoUrl}
                title={`Movement Demonstration – ${exercise.name}`}
                exerciseId={exercise.id}
                isUserWithError={false}
                showSkeletonDefault={true}
                watermarkBadge="REFERENCE STANDARD"
                accentColor="#16A34A"
                autoPlay={true}
              />
            ) : (
              <div className="aspect-video w-full rounded-2xl bg-[#F3F0FF] flex items-center justify-center text-xs text-[#696C92]">
                Preparing studio demonstration...
              </div>
            )}
          </div>

          {/* Interactive Joint Guide Box */}
          <div className="calm-card p-6">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Compass className="w-4 h-4 text-[#7F00FF]" />
                <h3 className="text-sm font-bold text-[#2F3159]">Key Tracked Anatomical Joints</h3>
              </div>
              <span className="text-[11px] text-[#696C92]">MediaPipe 3D Landmarks</span>
            </div>

            <p className="text-xs text-[#696C92] mb-4">
              During {exercise.name}, FormFit actively observes four major joint systems to safeguard your body and verify optimal mechanics:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {trackedJoints.map((joint) => (
                <div 
                  key={joint.id}
                  onClick={() => setActiveJointHighlight(joint.id)}
                  className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
                    activeJointHighlight === joint.id
                      ? 'bg-[#EDE9FE]/50 border-[#7F00FF] shadow-sm'
                      : 'bg-[#FFFFFF] border-[#E2D9F3] hover:border-[#7F00FF]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="text-xs font-bold text-[#2F3159]">{joint.name}</span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#FFFFFF] text-[#16A34A] border border-[#E2D9F3]">
                      {joint.idealAngle}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#696C92] leading-relaxed">
                    {joint.role}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column (5 cols): Instructions & Practice Start */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          
          {/* Tabs */}
          <div className="flex items-center gap-1.5 p-1 rounded-full bg-[#F3F0FF] border border-[#E2D9F3]">
            <button
              onClick={() => setActiveTab('instructions')}
              className={`flex-1 py-2 text-xs font-semibold rounded-full transition-all ${
                activeTab === 'instructions'
                  ? 'bg-[#FFFFFF] text-[#2F3159] shadow-sm'
                  : 'text-[#696C92] hover:text-[#2F3159]'
              }`}
            >
              1. Form Guidelines
            </button>
            <button
              onClick={() => setActiveTab('checkpoints')}
              className={`flex-1 py-2 text-xs font-semibold rounded-full transition-all ${
                activeTab === 'checkpoints'
                  ? 'bg-[#FFFFFF] text-[#2F3159] shadow-sm'
                  : 'text-[#696C92] hover:text-[#2F3159]'
              }`}
            >
              2. Checklist ({Object.values(checkedPoints).filter(Boolean).length}/{exercise.keyMovementPoints.length})
            </button>
          </div>

          {/* TAB 1: Detailed Instructions */}
          {activeTab === 'instructions' && (
            <div className="flex flex-col gap-3.5 text-sm">
              
              {/* Starting Position */}
              <div className="p-4 rounded-2xl bg-[#FFFFFF] border border-[#E2D9F3] shadow-sm">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#7F00FF] block mb-1">
                  1. Starting Position
                </span>
                <p className="text-[#2F3159] text-xs sm:text-sm leading-relaxed">
                  {exercise.instructions.startingPosition}
                </p>
              </div>

              {/* Body Posture */}
              <div className="p-4 rounded-2xl bg-[#FFFFFF] border border-[#E2D9F3] shadow-sm">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#7F00FF] block mb-1">
                  2. Balanced Posture
                </span>
                <p className="text-[#2F3159] text-xs sm:text-sm leading-relaxed">
                  {exercise.instructions.bodyPosture}
                </p>
              </div>

              {/* Hand Positioning & Movement Direction */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-4 rounded-2xl bg-[#FFFFFF] border border-[#E2D9F3] shadow-sm">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[#696C92] block mb-1">
                    3. Hand Placement
                  </span>
                  <p className="text-[#2F3159] text-xs leading-relaxed">
                    {exercise.instructions.handPositioning}
                  </p>
                </div>
                <div className="p-4 rounded-2xl bg-[#FFFFFF] border border-[#E2D9F3] shadow-sm">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[#696C92] block mb-1">
                    4. Movement Flow
                  </span>
                  <p className="text-[#2F3159] text-xs leading-relaxed">
                    {exercise.instructions.movementDirection}
                  </p>
                </div>
              </div>

              {/* Breathing Technique */}
              <div className="p-4 rounded-2xl bg-[#E5F0F5]/50 border border-[#C5DCE6] flex items-start gap-3">
                <Wind className="w-5 h-5 text-[#7F00FF] shrink-0 mt-0.5" />
                <div>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[#2F3159] block mb-0.5">
                    5. Breathwork Cadence
                  </span>
                  <p className="text-[#2F3159] text-xs leading-relaxed">
                    {exercise.instructions.breathing}
                  </p>
                </div>
              </div>

              {/* Common Mistakes & Safety Tips */}
              <div className="p-4 rounded-2xl bg-[#FFF8E1] border border-[#FFE082]">
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle className="w-4 h-4 text-[#D97706]" />
                  <span className="text-xs font-bold text-[#D97706] uppercase tracking-wide">
                    6. Safety Guidance
                  </span>
                </div>
                <ul className="space-y-1.5 text-xs text-[#2F3159]">
                  {exercise.instructions.commonMistakes.map((mistake, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-[#D97706] font-bold">•</span>
                      <span>{mistake}</span>
                    </li>
                  ))}
                </ul>
              </div>

            </div>
          )}

          {/* TAB 2: Checkpoint Checklist */}
          {activeTab === 'checkpoints' && (
            <div className="calm-card p-6 flex flex-col gap-4">
              <div>
                <h3 className="text-sm font-bold text-[#2F3159]">Movement Awareness Checklist</h3>
                <p className="text-xs text-[#696C92] mt-0.5">
                  Check each item as you embody the posture before starting your camera session.
                </p>
              </div>

              <div className="space-y-2.5">
                {exercise.keyMovementPoints.map((point, idx) => {
                  const isChecked = !!checkedPoints[idx];
                  return (
                    <div
                      key={idx}
                      onClick={() => togglePointCheck(idx)}
                      className={`p-3.5 rounded-2xl border cursor-pointer transition-all flex items-start gap-3 select-none ${
                        isChecked
                          ? 'bg-[#EDE9FE]/50 border-[#7F00FF] text-[#2F3159]'
                          : 'bg-[#FFFFFF] border-[#E2D9F3] hover:border-[#7F00FF] text-[#2F3159]'
                      }`}
                    >
                      <button className="mt-0.5 shrink-0 text-[#7F00FF]">
                        {isChecked ? (
                          <CheckSquare className="w-4 h-4 fill-[#EDE9FE]" />
                        ) : (
                          <Square className="w-4 h-4 text-[#696C92]" />
                        )}
                      </button>
                      <span className={`text-xs leading-relaxed ${isChecked ? 'line-through text-[#696C92]' : ''}`}>
                        {point}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* "Ready to Begin?" Actions */}
          <div className="calm-card p-6 bg-[#FFFFFF] flex flex-col gap-3">
            <h4 className="text-sm font-bold text-[#2F3159]">Ready to Begin?</h4>
            <p className="text-xs text-[#696C92] -mt-1">
              Choose how you would like to analyze your movement today:
            </p>

            <button
              onClick={onProceedToUpload}
              className="w-full py-3.5 px-6 rounded-full font-semibold text-xs bg-[#2F3159] hover:bg-[#2F3159] text-white shadow-sm flex items-center justify-center gap-2 transition-all hover:scale-[1.01]"
            >
              <UploadCloud className="w-4 h-4 text-[#7F00FF]" />
              <span>I Understand – Upload My Video</span>
            </button>

            <button
              onClick={onStartLiveSession}
              className="w-full py-3 px-6 rounded-full font-semibold text-xs bg-[#F3F0FF] hover:bg-[#E2D9F3] text-[#2F3159] border border-[#E2D9F3] flex items-center justify-center gap-2 transition-colors"
            >
              <Video className="w-4 h-4 text-[#7F00FF]" />
              <span>Or Start Live Session (Real-Time Camera)</span>
            </button>
          </div>

        </div>

      </div>

    </div>
  );
}
