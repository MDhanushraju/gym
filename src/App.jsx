import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import AboutModal from './components/AboutModal';
import ErrorBoundary from './components/ErrorBoundary';
import Welcome from './pages/Welcome';
import ExerciseSelection from './pages/ExerciseSelection';
import ExerciseDemo from './pages/ExerciseDemo';
import LiveCoachSession from './pages/LiveCoachSession';
import VideoUpload from './pages/VideoUpload';
import AnalysisResults from './pages/AnalysisResults';
import WorkoutSummary from './pages/WorkoutSummary';
import MyProgress from './pages/MyProgress';
import { EXERCISES } from './data/exercises';
import { initPoseLandmarker } from './utils/poseDetection';
import { getDailyGoal } from './utils/storage';

export default function App() {
  // Navigation State:
  // 'welcome' | 'exercises' | 'demo' | 'live-coach' | 'upload' | 'analysis' | 'workout-summary' | 'my-progress'
  const [currentScreen, setCurrentScreen] = useState('welcome');
  
  // Active Exercise Selection
  const [selectedExercise, setSelectedExercise] = useState(EXERCISES[0]); // Default: Basic Squats
  
  // Uploaded User Video State
  const [uploadedVideoData, setUploadedVideoData] = useState(null);

  // Completed Workout Summary Data
  const [summaryData, setSummaryData] = useState(null);

  // Daily Movement Goal State
  const [dailyGoal, setDailyGoal] = useState(getDailyGoal());

  // About Philosophy Modal State
  const [aboutModalOpen, setAboutModalOpen] = useState(false);

  // Initialize MediaPipe Pose Landmarker in the background
  useEffect(() => {
    initPoseLandmarker().catch(() => {});
  }, []);

  // Refresh daily goal on screen transition
  useEffect(() => {
    setDailyGoal(getDailyGoal());
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [currentScreen]);

  // Navigation Handlers
  const handleStartMoving = () => {
    setCurrentScreen('exercises');
  };

  const handleExploreExercises = () => {
    setCurrentScreen('exercises');
  };

  const handleSelectExercise = (exercise) => {
    setSelectedExercise(exercise);
    setCurrentScreen('demo');
  };

  const handleStartLiveSession = () => {
    setCurrentScreen('live-coach');
  };

  const handleProceedToUpload = () => {
    setCurrentScreen('upload');
  };

  const handleAnalysisComplete = () => {
    setCurrentScreen('analysis');
  };

  const handleFinishWorkout = (summary) => {
    setSummaryData(summary);
    setDailyGoal(getDailyGoal());
    setCurrentScreen('workout-summary');
  };

  const handleViewProgress = () => {
    setCurrentScreen('my-progress');
  };

  const handleAnalyzeAnotherExercise = () => {
    setCurrentScreen('exercises');
  };

  const handleUploadAnotherVideo = () => {
    setCurrentScreen('upload');
  };

  const handleReturnHome = () => {
    setCurrentScreen('welcome');
  };

  return (
    <div className="min-h-screen bg-[#F3F0FF] text-[#2F3159] flex flex-col font-sans selection:bg-[#EDE9FE] selection:text-[#7F00FF]">
      
      {/* Peaceful Global Navbar */}
      <Navbar
        currentScreen={currentScreen}
        onNavigate={setCurrentScreen}
        dailyGoal={dailyGoal}
        onOpenAbout={() => setAboutModalOpen(true)}
        onStartMoving={handleStartMoving}
      />

      {/* Main Dynamic Viewport */}
      <main className="flex-1 w-full">
        <ErrorBoundary onReset={handleReturnHome}>
        {currentScreen === 'welcome' && (
          <Welcome
            onStartMoving={handleStartMoving}
            onExploreExercises={handleExploreExercises}
            onSelectExerciseDirectly={handleSelectExercise}
            dailyGoal={dailyGoal}
          />
        )}

        {currentScreen === 'exercises' && (
          <ExerciseSelection
            selectedExercise={selectedExercise}
            onSelectExercise={handleSelectExercise}
            onBack={handleReturnHome}
          />
        )}

        {currentScreen === 'demo' && selectedExercise && (
          <ExerciseDemo
            exercise={selectedExercise}
            onStartLiveSession={handleStartLiveSession}
            onProceedToUpload={handleProceedToUpload}
            onBack={() => setCurrentScreen('exercises')}
          />
        )}

        {currentScreen === 'live-coach' && selectedExercise && (
          <LiveCoachSession
            exercise={selectedExercise}
            onFinishWorkout={handleFinishWorkout}
            onBack={() => setCurrentScreen('demo')}
          />
        )}

        {currentScreen === 'upload' && selectedExercise && (
          <VideoUpload
            exercise={selectedExercise}
            uploadedVideoData={uploadedVideoData}
            setUploadedVideoData={setUploadedVideoData}
            onAnalysisComplete={handleAnalysisComplete}
            onBack={() => setCurrentScreen('demo')}
          />
        )}

        {currentScreen === 'analysis' && selectedExercise && (
          <AnalysisResults
            exercise={selectedExercise}
            uploadedVideoData={uploadedVideoData}
            onAnalyzeAnotherExercise={handleAnalyzeAnotherExercise}
            onUploadAnotherVideo={handleUploadAnotherVideo}
            onViewProgress={handleViewProgress}
          />
        )}

        {currentScreen === 'workout-summary' && (
          <WorkoutSummary
            summaryData={summaryData}
            onViewProgress={handleViewProgress}
            onTryAnotherExercise={handleAnalyzeAnotherExercise}
            onReturnHome={handleReturnHome}
            onViewAnalysis={() => setCurrentScreen('analysis')}
          />
        )}

        {currentScreen === 'my-progress' && (
          <MyProgress
            onSelectExercise={handleSelectExercise}
            onStartWorkout={handleStartMoving}
          />
        )}
        </ErrorBoundary>
      </main>

      {/* About Philosophy Dialog */}
      <AboutModal
        isOpen={aboutModalOpen}
        onClose={() => setAboutModalOpen(false)}
      />

    </div>
  );
}
