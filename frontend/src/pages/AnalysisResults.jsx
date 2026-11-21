import React, { useState, useEffect, useRef } from 'react';
import VideoPlayer from '../components/VideoPlayer';
import ProgressCircle from '../components/ProgressCircle';
import BiomechanicalTable from '../components/BiomechanicalTable';
import MistakeCard from '../components/MistakeCard';
import { 
  Play, Pause, RotateCcw, ArrowLeft, RefreshCw, UploadCloud, 
  CheckCircle, AlertCircle, ShieldCheck, Download, Share2, 
  Sparkles, Award, Lightbulb, Activity, CheckCircle2, XCircle, 
  Volume2, VolumeX, Printer, TrendingUp, Compass, Layers, ToggleLeft, ToggleRight 
} from 'lucide-react';
import { DEMO_ANALYSIS_PROFILES } from '../data/demoAnalysis';
import { generateProceduralExerciseVideo } from '../utils/sampleVideos';
import { saveWorkoutSession } from '../utils/storage';
import confetti from 'canvas-confetti';

export default function AnalysisResults({
  exercise,
  uploadedVideoData,
  onAnalyzeAnotherExercise,
  onUploadAnotherVideo,
  onViewProgress
}) {
  const proPlayerRef = useRef(null);
  const userPlayerRef = useRef(null);

  const [proVideoUrl, setProVideoUrl] = useState('');
  const [isSyncPlaying, setIsSyncPlaying] = useState(false);
  const [syncSpeed, setSyncSpeed] = useState(1);
  const [isSpeaking, setIsSpeaking] = useState(false);

  // Optional Back Analysis Toggle
  const [includeBackCheck, setIncludeBackCheck] = useState(false);

  // Retrieve authentic analytical diagnostics from videoProcessor or fallback profile
  const realResult = uploadedVideoData?.analysisResult;
  const isMismatch = realResult?.isMismatch;
  const isInsufficientData = realResult?.isInsufficientData;

  const fallbackProfile = (exercise && DEMO_ANALYSIS_PROFILES[exercise.id]) || DEMO_ANALYSIS_PROFILES['weighted-squats'] || {};
  const analysisData = realResult || fallbackProfile;

  // Score depends on whether the optional Back check is included
  const calculatedScore = includeBackCheck 
    ? (analysisData.backAccuracy ? Math.round(((analysisData.frontAccuracy || 85) + analysisData.backAccuracy) / 2) : (analysisData.overallAccuracy || 85))
    : (analysisData.frontAccuracy || analysisData.overallAccuracy || 85);

  const formScore = (isMismatch || isInsufficientData)
    ? 0
    : (realResult 
      ? (includeBackCheck ? Math.round((realResult.score + (realResult.backAccuracy || realResult.score * 0.95)) / 2) : realResult.score)
      : (uploadedVideoData?.presetData ? (uploadedVideoData.presetData.isUserWithError ? calculatedScore : 94) : calculatedScore));

  const repCount = (isMismatch || isInsufficientData) ? 0 : (analysisData.repCountDetected || 0);
  const repsLedger = analysisData.repsLedger || [];

  // Filter mistakes depending on optional back toggle
  const visibleMistakes = (analysisData.mistakes || []).filter(m => {
    if (m.side === 'back' && !includeBackCheck) return false;
    return true;
  });

  // Filter comparison table rows
  const visibleTableRows = (analysisData.comparisonTable || []).filter(row => {
    if (row.side === 'back' && !includeBackCheck) return false;
    return true;
  });

  // Initialize reference video & save to history
  useEffect(() => {
    let isMounted = true;
    generateProceduralExerciseVideo(exercise.id, false, 5).then((url) => {
      if (isMounted) setProVideoUrl(url);
    });

    if (!isMismatch && !isInsufficientData) {
      saveWorkoutSession({
        exerciseId: exercise.id,
        exerciseName: exercise.name,
        durationSec: 150,
        repsCount: repCount,
        accuracyScore: formScore,
        correctCount: analysisData.correctCount,
        incorrectCount: visibleMistakes.length,
        mistakesDetected: visibleMistakes
      });
    }

    if (formScore >= 85 && !isMismatch && !isInsufficientData) {
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.6 },
        colors: ['#7F00FF', '#EDE9FE', '#2F3159', '#F1EBDD']
      });
    }

    return () => {
      isMounted = false;
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, [exercise.id, formScore, includeBackCheck]);

  // Synchronized Dual Playback Controls
  const toggleSyncPlay = () => {
    if (isSyncPlaying) {
      proPlayerRef.current?.pause();
      userPlayerRef.current?.pause();
      setIsSyncPlaying(false);
    } else {
      proPlayerRef.current?.play();
      userPlayerRef.current?.play();
      setIsSyncPlaying(true);
    }
  };

  const handleSyncRestart = () => {
    proPlayerRef.current?.seek(0);
    userPlayerRef.current?.seek(0);
    proPlayerRef.current?.play();
    userPlayerRef.current?.play();
    setIsSyncPlaying(true);
  };

  const handleSyncSpeed = (speed) => {
    setSyncSpeed(speed);
    proPlayerRef.current?.setSpeed(speed);
    userPlayerRef.current?.setSpeed(speed);
  };

  // Audio Coach using Web Speech API with gentle tone
  const handleToggleVoiceCoach = () => {
    if (!('speechSynthesis' in window)) return;

    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }

    const mistakesSummary = visibleMistakes
      .map(m => `${m.title}: ${m.howToCorrect}`)
      .join('. ');

    const textToSpeak = `Movement review completed for ${exercise.name}. Front view quality is ${formScore} percent. ${includeBackCheck ? 'Back view checks included.' : 'Back checks were optional and excluded.'} ${analysisData.statusSummary}. Key suggestions: ${mistakesSummary}`;

    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    utterance.rate = 0.95;
    utterance.pitch = 1.0;
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    window.speechSynthesis.speak(utterance);
    setIsSpeaking(true);
  };

  const handlePrintReport = () => {
    window.print();
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 print:p-0 animate-fade-in">
      
      {/* Top Header & Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 print:hidden">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#7F00FF]">
              Movement Performance Review
            </span>
            <span className="text-[#E2D9F3]">•</span>
            <span className="text-xs text-[#696C92]">Dual-Perspective Biomechanics</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-[#2F3159] tracking-tight">
            Your Movement Analysis
          </h1>
        </div>

        {/* Action Buttons Top */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleToggleVoiceCoach}
            className={`px-4 py-2 rounded-full text-xs font-semibold border flex items-center gap-2 transition-all shadow-sm ${
              isSpeaking
                ? 'bg-[#EDE9FE] text-[#2F3159] border-[#7F00FF]'
                : 'bg-[#FFFFFF] hover:bg-[#F3F0FF] text-[#2F3159] border-[#E2D9F3]'
            }`}
            title="Listen to gentle coaching overview"
          >
            {isSpeaking ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4 text-[#7F00FF]" />}
            <span>{isSpeaking ? 'Mute Audio Coach' : 'Audio Coach Overview'}</span>
          </button>

          <button
            onClick={handlePrintReport}
            className="px-4 py-2 rounded-full text-xs font-semibold bg-[#FFFFFF] hover:bg-[#F3F0FF] text-[#2F3159] border border-[#E2D9F3] flex items-center gap-2 transition-all shadow-sm"
            title="Export or print movement report"
          >
            <Printer className="w-4 h-4 text-[#696C92]" />
            <span className="hidden sm:inline">Export Report</span>
          </button>

          <button
            onClick={onUploadAnotherVideo}
            className="px-4 py-2 rounded-full text-xs font-semibold bg-[#FFFFFF] hover:bg-[#F3F0FF] text-[#2F3159] border border-[#E2D9F3] flex items-center gap-2 transition-all shadow-sm"
          >
            <UploadCloud className="w-4 h-4 text-[#7F00FF]" />
            <span>Upload Another Video</span>
          </button>

          <button
            onClick={onAnalyzeAnotherExercise}
            className="px-5 py-2 rounded-full text-xs font-semibold bg-[#7F00FF] text-white hover:bg-[#6E00DE] shadow-sm flex items-center gap-2 transition-all"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Try Another Movement</span>
          </button>
        </div>
      </div>

      {/* Exercise Mismatch Alert Banner */}
      {isMismatch && (
        <div className="mb-6 p-6 rounded-3xl bg-[#FFF8E1] border-2 border-[#FFE082] shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden animate-fade-in">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-2xl bg-[#FFE082]/60 text-[#D97706] flex items-center justify-center shrink-0 mt-0.5">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-[#D97706]">
                  Exercise Validation Notice
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#DC2626] text-white">
                  Mismatch Detected
                </span>
              </div>
              <h3 className="text-base font-extrabold text-[#2F3159] mt-0.5">
                Uploaded Video Shows {realResult.detectedExerciseName}, but {exercise.name} was Selected
              </h3>
              <p className="text-xs text-[#696C92] mt-1 leading-relaxed max-w-2xl">
                {realResult.mismatchReason} Computer-vision scoring has been withheld to prevent generating fabricated results against the wrong exercise benchmark.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={onUploadAnotherVideo}
              className="px-4 py-2 rounded-full text-xs font-semibold bg-[#FFFFFF] hover:bg-[#F3F0FF] text-[#2F3159] border border-[#FFE082] shadow-sm"
            >
              Upload {exercise.name} Video
            </button>
            <button
              onClick={onAnalyzeAnotherExercise}
              className="px-4 py-2 rounded-full text-xs font-semibold bg-[#7F00FF] hover:bg-[#6E00DE] text-white shadow-sm"
            >
              Select Matching Exercise
            </button>
          </div>
        </div>
      )}

      {/* Insufficient Data Warning Banner */}
      {isInsufficientData && (
        <div className="mb-6 p-6 rounded-3xl bg-[#FFF8E1] border-2 border-[#FFE082] shadow-sm flex items-start gap-3.5 print:hidden animate-fade-in">
          <div className="w-10 h-10 rounded-2xl bg-[#FFE082]/60 text-[#D97706] flex items-center justify-center shrink-0 mt-0.5">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-[#D97706]">
              Tracking Quality Notice
            </span>
            <h3 className="text-base font-extrabold text-[#2F3159] mt-0.5">
              Insufficient Data for Reliable Movement Scoring
            </h3>
            <p className="text-xs text-[#696C92] mt-1 leading-relaxed">
              {realResult?.warningMessage || 'The video has poor lighting or the body landmarks are partially hidden or outside the camera frame.'} Repetition counts and form scores are withheld rather than displaying fabricated results.
            </p>
          </div>
        </div>
      )}

      {/* Perspective Configuration Banner */}
      <div className="mb-6 p-4 rounded-2xl calm-surface flex flex-wrap items-center justify-between gap-4 print:hidden">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-[#EDE9FE] text-[#2F3159] flex items-center justify-center shrink-0">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <span className="text-xs font-bold text-[#2F3159] block">Observation Perspectives</span>
            <span className="text-xs text-[#696C92]">
              Front view is primary. Back / Posterior view is optional and can be toggled on/off.
            </span>
          </div>
        </div>

        {/* Back View Toggle Switch */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-[#696C92] font-medium">Include Back Check:</span>
          <button
            onClick={() => setIncludeBackCheck(!includeBackCheck)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold border flex items-center gap-1.5 transition-all ${
              includeBackCheck
                ? 'bg-[#EDE9FE] border-[#7F00FF] text-[#2F3159] shadow-sm'
                : 'bg-[#F3F0FF] border-[#E2D9F3] text-[#696C92]'
            }`}
          >
            {includeBackCheck ? <ToggleRight className="w-4 h-4 text-[#16A34A]" /> : <ToggleLeft className="w-4 h-4" />}
            <span>{includeBackCheck ? 'Back View: Included' : 'Back View: Optional (Off)'}</span>
          </button>
        </div>
      </div>

      {/* Synchronized Master Controls Bar */}
      <div className="mb-6 p-4 rounded-2xl calm-surface flex flex-wrap items-center justify-between gap-4 print:hidden">
        <div className="flex items-center gap-3">
          <button
            onClick={toggleSyncPlay}
            className="px-5 py-2.5 rounded-full font-semibold text-xs bg-[#7F00FF] hover:bg-[#6E00DE] text-white shadow-sm flex items-center gap-2 transition-all"
          >
            {isSyncPlaying ? <Pause className="w-4 h-4 fill-white" /> : <Play className="w-4 h-4 fill-white" />}
            <span>{isSyncPlaying ? 'Pause Dual Sync' : 'Synchronize Both Videos'}</span>
          </button>

          <button
            onClick={handleSyncRestart}
            className="p-2.5 rounded-full bg-[#F3F0FF] hover:bg-[#EDE9FE] text-[#2F3159] transition-colors"
            title="Restart Both Videos from Start"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          <div className="hidden sm:flex items-center gap-1 bg-[#F3F0FF] p-1 rounded-full border border-[#E2D9F3] text-xs">
            <span className="text-[10px] text-[#696C92] px-2 font-medium">Speed:</span>
            {[0.5, 0.75, 1.0].map((rate) => (
              <button
                key={rate}
                onClick={() => handleSyncSpeed(rate)}
                className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                  syncSpeed === rate ? 'bg-[#7F00FF] text-white' : 'text-[#696C92] hover:text-[#2F3159]'
                }`}
              >
                {rate}x
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <div className="w-2 h-2 rounded-full bg-[#7F00FF]" />
          <span className="text-[#696C92]">Exercise:</span>
          <span className="text-[#2F3159] font-bold">{exercise.name}</span>
        </div>
      </div>

      {/* SIDE-BY-SIDE DUAL VIDEO PLAYERS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-10 print:hidden">
        
        {/* LEFT PANEL: Reference */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-semibold text-[#16A34A] flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#16A34A]" />
              Left Panel: Professional Reference Movement
            </span>
            <span className="text-[11px] text-[#696C92]">Movement Benchmark</span>
          </div>

          <VideoPlayer
            ref={proPlayerRef}
            src={proVideoUrl}
            title="Reference Demonstration"
            exerciseId={exercise.id}
            isUserWithError={false}
            showSkeletonDefault={true}
            watermarkBadge="BENCHMARK"
            accentColor="#16A34A"
            autoPlay={false}
          />
        </div>

        {/* RIGHT PANEL: User */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-semibold text-[#D97706] flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#D97706]" />
              Right Panel: Your Uploaded Movement
            </span>
            <span className="text-[11px] text-[#696C92]">Observed Pose</span>
          </div>

          <VideoPlayer
            ref={userPlayerRef}
            src={uploadedVideoData?.url}
            title="Your Uploaded Session"
            exerciseId={exercise.id}
            isUserWithError={true}
            showSkeletonDefault={true}
            watermarkBadge="ATHLETE OBSERVATION"
            accentColor="#D97706"
            autoPlay={false}
            timeline={realResult?.timeline}
          />
        </div>

      </div>

      {/* SECTION 1: OVERALL FORM ACCURACY & FINAL RESULTS SUMMARY */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-10">
        
        {/* Circular Accuracy Gauge */}
        <div className="lg:col-span-4 calm-card p-6 sm:p-8 flex flex-col items-center justify-center text-center">
          <span className="text-xs font-semibold uppercase tracking-wider text-[#696C92] mb-4">
            {includeBackCheck ? 'Front & Back Combined Score' : 'Front View Score (Primary)'}
          </span>

          <ProgressCircle score={formScore} size={180} strokeWidth={12} />

          <p className="text-xs text-[#2F3159] mt-5 max-w-xs leading-relaxed">
            {analysisData.statusSummary}
          </p>
        </div>

        {/* Telemetry Metrics Grid */}
        <div className="lg:col-span-8 calm-card p-6 sm:p-8 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#7F00FF]">
                Movement Checkpoints ({includeBackCheck ? 'Front & Back' : 'Front Only'})
              </span>
              <span className="text-xs text-[#696C92]">
                Cadence: {analysisData?.avgTempo || '2.0s'}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="p-4 rounded-2xl bg-[#FFFFFF] border border-[#E2D9F3]">
                <div className="flex items-center gap-1.5 text-[#16A34A] mb-1">
                  <CheckCircle2 className="w-4 h-4" />
                  <span className="text-[11px] font-semibold">Balanced</span>
                </div>
                <div className="text-3xl font-extrabold text-[#2F3159]">
                  {includeBackCheck ? analysisData.correctCount : 3}
                </div>
                <span className="text-[11px] text-[#696C92]">Optimal alignments</span>
              </div>

              <div className="p-4 rounded-2xl bg-[#FFFFFF] border border-[#E2D9F3]">
                <div className="flex items-center gap-1.5 text-[#D97706] mb-1">
                  <AlertCircle className="w-4 h-4" />
                  <span className="text-[11px] font-semibold">Adjustments</span>
                </div>
                <div className="text-3xl font-extrabold text-[#D97706]">
                  {visibleMistakes.length}
                </div>
                <span className="text-[11px] text-[#696C92]">Areas to refine</span>
              </div>

              <div className="p-4 rounded-2xl bg-[#FFFFFF] border border-[#E2D9F3]">
                <div className="flex items-center gap-1.5 text-[#7F00FF] mb-1">
                  <Compass className="w-4 h-4" />
                  <span className="text-[11px] font-semibold">Perspective</span>
                </div>
                <div className="text-sm font-bold text-[#2F3159] mt-1">
                  {includeBackCheck ? 'Front + Back' : 'Front Only'}
                </div>
                <span className="text-[11px] text-[#696C92]">{includeBackCheck ? 'Back Included' : 'Back Optional'}</span>
              </div>

              <div className="p-4 rounded-2xl bg-[#FFFFFF] border border-[#E2D9F3]">
                <div className="flex items-center gap-1.5 text-[#2F3159] mb-1">
                  <Activity className="w-4 h-4" />
                  <span className="text-[11px] font-semibold">Repetitions</span>
                </div>
                <div className="text-3xl font-extrabold text-[#2F3159]">
                  {repCount}
                </div>
                <span className="text-[11px] text-[#696C92]">Observed reps</span>
              </div>
            </div>

            {/* Rep-by-Rep Quality & Fatigue Degradation */}
            <div className="mt-5 p-4 rounded-2xl bg-[#FFFFFF] border border-[#E2D9F3]">
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="text-[#696C92] font-medium flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5 text-[#7F00FF]" />
                  <span>Repetition Consistency Over Set</span>
                </span>
                <span className="text-[10px] text-[#D97706] font-semibold">
                  {repsLedger.length > 2 ? 'Measured over set' : 'Consistency Tracker'}
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                {repsLedger.length > 0 ? (
                  repsLedger.slice(0, 4).map((r, i) => (
                    <div key={i} className={`p-2 rounded-xl bg-white border ${
                      r.score >= 85 ? 'border-[#BBF7D0]' : r.score >= 70 ? 'border-[#FFE082]' : 'border-[#FFCDD2]'
                    }`}>
                      <span className="text-[10px] text-[#696C92] block">REP {r.repNumber || (i + 1)}</span>
                      <span className={`text-sm font-bold ${
                        r.score >= 85 ? 'text-[#16A34A]' : r.score >= 70 ? 'text-[#D97706]' : 'text-[#D32F2F]'
                      }`}>{r.score}%</span>
                    </div>
                  ))
                ) : (
                  <div className="col-span-4 py-3 text-xs text-[#696C92]">
                    {isMismatch 
                      ? 'No repetitions counted due to exercise mismatch.' 
                      : isInsufficientData 
                      ? 'Insufficient data for scoring.' 
                      : 'Zero completed repetitions observed in video timeline.'}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="mt-4 p-3.5 rounded-2xl bg-[#EDE9FE]/50 border border-[#EDE9FE] flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#7F00FF]" />
              <span className="text-[#2F3159]">
                Overall Assessment: <strong>{(isMismatch || isInsufficientData) ? 'Action Required' : analysisData.grade}</strong> ({includeBackCheck ? 'Dual Front + Back' : 'Front Focus'}).
              </span>
            </div>
            <button
              onClick={onViewProgress}
              className="text-[#2F3159] font-semibold hover:underline"
            >
              View in My Progress →
            </button>
          </div>

        </div>

      </div>

      {/* SECTION 2: INDIVIDUAL REPETITION BIOMECHANICAL BREAKDOWN */}
      <div className="mb-10 flex flex-col gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#7F00FF]">
              Granular Rep Telemetry
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-[#7F00FF]" />
            <span className="text-xs text-[#696C92]">Score out of 100% for each repetition</span>
          </div>
          <h3 className="text-xl sm:text-2xl font-bold text-[#2F3159] tracking-tight mt-0.5">
            Individual Repetition Analysis & Quality Breakdown
          </h3>
          <p className="text-xs text-[#696C92] mt-1">
            Biomechanical breakdown of what was performed well, observed errors, and targeted coaching cues for each repetition.
          </p>
        </div>

        <div className="space-y-4">
          {repsLedger.length > 0 ? (
            repsLedger.map((rep, i) => {
              const score = rep.score || 90;
              const isOptimal = score >= 90;
              const isGood = score >= 75 && score < 90;
              const scoreBadgeColor = isOptimal 
                ? 'text-[#16A34A] bg-[#DCFCE7] border-[#BBF7D0]' 
                : isGood 
                ? 'text-[#7F00FF] bg-[#EDE9FE]/50 border-[#7F00FF]/40' 
                : 'text-[#D97706] bg-[#FFF8E1] border-[#FFE082]';

              const progressColor = isOptimal ? 'bg-[#16A34A]' : isGood ? 'bg-[#7F00FF]' : 'bg-[#D97706]';
              const peakAngle = rep.peakAngle || 90;
              const durationSec = rep.duration || 2.4;
              
              const goodPoints = (!rep.faults || rep.faults.length === 0)
                ? [`Target joint inflection depth achieved (${peakAngle}°)`, 'Smooth, controlled tempo maintained', 'Consistent spinal alignment locked']
                : ['Completed full range of motion', 'Returned to starting lockout position'];

              const repMistakes = rep.faults || [];
              const improvementCue = repMistakes.length > 0
                ? `Focus on correcting: ${repMistakes[0]}`
                : 'Clean repetition! Maintain this steady pace and full range of motion.';

              return (
                <div
                  key={i}
                  className="p-5 sm:p-6 rounded-2xl bg-[#FFFFFF] border border-[#E2D9F3] hover:border-[#7F00FF]/50 transition-all shadow-sm"
                >
                  {/* Header Row */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#F0F4F1]">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-[#F3F0FF] border border-[#E2D9F3] flex items-center justify-center font-bold text-sm text-[#2F3159]">
                        #{i + 1}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-extrabold text-base text-[#2F3159]">
                            Repetition {i + 1}
                          </h4>
                          <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${scoreBadgeColor}`}>
                            {isOptimal ? 'Optimal Form' : isGood ? 'Good Form' : 'Needs Adjustment'}
                          </span>
                        </div>
                        <span className="text-[11px] text-[#696C92]">
                          Duration: {durationSec}s • Peak Joint Depth: {peakAngle}°
                        </span>
                      </div>
                    </div>

                    {/* Percentage Score */}
                    <div className="flex items-center gap-3 self-end sm:self-auto">
                      <div className="text-right">
                        <span className="text-2xl font-black text-[#2F3159]">{score}%</span>
                        <span className="text-[10px] text-[#696C92] block">out of 100</span>
                      </div>
                      <div className="w-16 h-2 rounded-full bg-[#E2D9F3] overflow-hidden">
                        <div className={`h-full ${progressColor}`} style={{ width: `${score}%` }} />
                      </div>
                    </div>
                  </div>

                  {/* 3 Pillars: Good, Mistakes, Improve */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 text-xs">
                    <div className="p-3.5 rounded-xl bg-[#FFFFFF] border border-[#E8F0EA]">
                      <div className="flex items-center gap-1.5 font-bold text-[#16A34A] mb-2">
                        <CheckCircle2 className="w-4 h-4 text-[#16A34A] shrink-0" />
                        <span>What You Did Good</span>
                      </div>
                      <ul className="space-y-1.5 text-[#2F3159]">
                        {goodPoints.map((gp, gIdx) => (
                          <li key={gIdx} className="flex items-start gap-1.5">
                            <span className="text-[#16A34A] font-bold">•</span>
                            <span className="leading-relaxed">{gp}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="p-3.5 rounded-xl bg-[#FFFFFF] border border-[#E8F0EA]">
                      <div className="flex items-center gap-1.5 font-bold text-[#D97706] mb-2">
                        <AlertCircle className="w-4 h-4 text-[#D97706] shrink-0" />
                        <span>Mistakes Observed</span>
                      </div>
                      <ul className="space-y-1.5 text-[#2F3159]">
                        {repMistakes.length > 0 ? (
                          repMistakes.map((m, mIdx) => (
                            <li key={mIdx} className="flex items-start gap-1.5">
                              <span className="text-[#D97706] font-bold">•</span>
                              <span className="leading-relaxed">{m}</span>
                            </li>
                          ))
                        ) : (
                          <li className="flex items-center gap-1.5 text-[#16A34A] font-medium">
                            <span>✓ Zero form deviations detected.</span>
                          </li>
                        )}
                      </ul>
                    </div>

                    <div className="p-3.5 rounded-xl bg-[#EDE9FE]/25 border border-[#EDE9FE]">
                      <div className="flex items-center gap-1.5 font-bold text-[#2F3159] mb-2">
                        <Lightbulb className="w-4 h-4 text-[#7F00FF] shrink-0" />
                        <span>Where You Need to Improve</span>
                      </div>
                      <p className="text-[#2F3159] leading-relaxed">
                        {improvementCue}
                      </p>
                    </div>
                  </div>

                </div>
              );
            })
          ) : (
            <div className="p-8 rounded-2xl bg-[#FFFFFF] border border-[#E2D9F3] text-center text-xs text-[#696C92]">
              <p className="font-bold text-[#2F3159] text-sm mb-1">
                {isMismatch 
                  ? 'No repetitions analyzed due to exercise mismatch.' 
                  : isInsufficientData
                  ? 'Insufficient tracking landmarks detected.'
                  : 'Zero completed repetitions observed in this recording.'}
              </p>
              <p>
                To register repetitions, start in the locked position, execute a complete lowering phase to full depth (~90°), and return to starting lockout.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* SECTION 3: MOVEMENT COMPARISON TABLE */}
      <div className="mb-10 flex flex-col gap-4">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-[#7F00FF]">
            Detailed Observations
          </span>
          <h3 className="text-xl sm:text-2xl font-bold text-[#2F3159] tracking-tight mt-0.5">
            Body Alignment vs. Movement Standard
          </h3>
          <p className="text-xs text-[#696C92] mt-1">
            Comparing observed kinematics from Front and Back perspectives.
          </p>
        </div>

        <BiomechanicalTable comparisonRows={visibleTableRows} />
      </div>

      {/* SECTION 3: MISTAKES DETECTED CARDS */}
      <div className="mb-10 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-[#D97706]">
              Refinement Opportunities
            </span>
            <h3 className="text-xl sm:text-2xl font-bold text-[#2F3159] tracking-tight mt-0.5">
              Observations Detected ({visibleMistakes.length})
            </h3>
          </div>
          <span className="text-xs text-[#696C92]">
            {includeBackCheck ? 'Front & Back Included' : 'Front View Only (Back Optional)'}
          </span>
        </div>

        <div className="grid grid-cols-1 gap-4">
          {visibleMistakes.map((mistake) => (
            <MistakeCard key={mistake.id} mistake={mistake} />
          ))}
        </div>
      </div>

      {/* SECTION 4: IMPROVEMENT RECOMMENDATIONS */}
      <div className="mb-12 p-6 sm:p-8 rounded-3xl calm-card flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#EDE9FE] text-[#2F3159] flex items-center justify-center">
            <Lightbulb className="w-5 h-5 text-[#7F00FF]" />
          </div>
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-[#7F00FF]">
              Mindful Practice Plan
            </span>
            <h3 className="text-xl font-bold text-[#2F3159]">
              Supportive Recommendations
            </h3>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
          {(analysisData?.recommendations || []).map((rec, idx) => (
            <div
              key={idx}
              className="p-4 rounded-2xl bg-[#FFFFFF] border border-[#E2D9F3] flex items-start gap-3"
            >
              <span className="w-6 h-6 rounded-full bg-[#EDE9FE] text-[#2F3159] flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                {idx + 1}
              </span>
              <p className="text-xs sm:text-sm text-[#2F3159] leading-relaxed">
                {rec}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* CLOSING CTAS & SESSION ACTIONS */}
      <div className="p-8 rounded-3xl calm-card text-center flex flex-col items-center justify-center gap-6 print:hidden">
        <div>
          <h3 className="text-2xl font-bold text-[#2F3159]">
            Ready to Continue Moving?
          </h3>
          <p className="text-sm text-[#696C92] mt-1 max-w-md">
            Review your progress over time, practice another exercise, or take a moment to rest.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-4">
          <button
            onClick={onViewProgress}
            className="w-full sm:w-auto px-8 py-3.5 rounded-full font-semibold text-xs bg-[#FFFFFF] hover:bg-[#F3F0FF] text-[#2F3159] border border-[#E2D9F3] shadow-sm flex items-center justify-center gap-2 transition-all"
          >
            <span>View My Movement Dashboard</span>
          </button>

          <button
            onClick={onAnalyzeAnotherExercise}
            className="w-full sm:w-auto px-8 py-3.5 rounded-full font-semibold text-xs bg-[#7F00FF] hover:bg-[#6E00DE] text-white shadow-sm flex items-center justify-center gap-2 transition-all hover:scale-[1.02]"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Try Another Movement</span>
          </button>
        </div>
      </div>

    </div>
  );
}
