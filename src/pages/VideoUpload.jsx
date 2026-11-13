import React, { useState } from 'react';
import VideoUploader from '../components/VideoUploader';
import LoadingScanner from '../components/LoadingScanner';
import { ArrowLeft, Sparkles, Activity, ShieldCheck, Compass, AlertCircle } from 'lucide-react';
import { analyzeUploadedVideo } from '../utils/videoProcessor';

export default function VideoUpload({
  exercise,
  onAnalysisComplete,
  onBack,
  uploadedVideoData,
  setUploadedVideoData
}) {
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(10);
  const [scanStatus, setScanStatus] = useState('');
  const [analysisError, setAnalysisError] = useState('');

  const handleStartAnalysis = async () => {
    if (!uploadedVideoData?.url) return;
    setIsScanning(true);
    setAnalysisError('');
    setScanProgress(10);
    setScanStatus('Initializing MediaPipe Pose Landmarker...');

    try {
      const result = await analyzeUploadedVideo(
        uploadedVideoData.url,
        exercise,
        (progress, status) => {
          setScanProgress(progress);
          setScanStatus(status);
        }
      );

      // Attach authentic computer-vision analysis to the video state
      setUploadedVideoData(prev => ({
        ...prev,
        analysisResult: result
      }));

      setTimeout(() => {
        setIsScanning(false);
        onAnalysisComplete();
      }, 400);
    } catch (err) {
      console.error('Video analysis failed:', err);
      setIsScanning(false);
      setAnalysisError(err.message || 'Failed to analyze video. Please verify video format and retry.');
    }
  };

  const handleAnalysisFinished = () => {
    setIsScanning(false);
    onAnalysisComplete();
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 animate-fade-in">
      
      {/* Top Navigation */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={onBack}
          className="p-2.5 rounded-full bg-[#FFFFFF] hover:bg-[#F3F0FF] border border-[#E2D9F3] text-[#2F3159] transition-colors shadow-sm"
          title="Back to Exercise Demonstration"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-[#7F00FF]">
            Video Observation
          </span>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-[#2F3159] tracking-tight">
            Let's Analyze Your Movement
          </h1>
        </div>
      </div>

      {/* Subheading & Selected Exercise Badge */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <p className="text-base text-[#696C92] max-w-xl leading-relaxed">
          Upload a video of yourself performing the selected exercise, or select a demo recording. Ensure your full body is visible for clear joint observation.
        </p>

        <div className="flex items-center gap-2.5 px-4 py-2 rounded-full bg-[#FFFFFF] border border-[#E2D9F3] self-start sm:self-auto shrink-0 shadow-sm">
          <div className="w-2.5 h-2.5 rounded-full bg-[#7F00FF]" />
          <span className="text-xs text-[#696C92]">Exercise:</span>
          <span className="text-xs font-bold text-[#2F3159]">{exercise.name}</span>
        </div>
      </div>

      {/* Main Upload Dropzone & Quick Presets Component */}
      <VideoUploader
        selectedExercise={exercise}
        onVideoSelected={(videoData) => setUploadedVideoData(videoData)}
        uploadedVideoUrl={uploadedVideoData}
        onClearVideo={() => setUploadedVideoData(null)}
      />

      {/* Analysis Error Alert */}
      {analysisError && (
        <div className="mt-6 p-4 rounded-2xl bg-[#FFF8E1] border border-[#FFE082] text-xs text-[#2F3159] flex items-center gap-3 shadow-sm">
          <AlertCircle className="w-5 h-5 text-[#D97706] shrink-0" />
          <div>
            <span className="font-bold text-[#D97706] block">Analysis Notice:</span>
            <span>{analysisError}</span>
          </div>
        </div>
      )}

      {/* Primary Action Button: "Analyze My Movement" */}
      {uploadedVideoData && (
        <div className="mt-8 flex flex-col items-center gap-3">
          <button
            onClick={handleStartAnalysis}
            disabled={isScanning}
            className="w-full max-w-md py-4 px-8 rounded-full font-semibold text-sm bg-[#7F00FF] hover:bg-[#6E00DE] text-white shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-2.5 hover:scale-[1.01] disabled:opacity-50"
          >
            <Compass className="w-4 h-4" />
            <span>{isScanning ? 'Processing Video...' : 'Analyze My Movement'}</span>
            <Sparkles className="w-4 h-4 text-white" />
          </button>
          <p className="text-xs text-[#696C92]">
            Extracting 33 MediaPipe 3D joint landmarks • Zero cloud upload
          </p>
        </div>
      )}

      {/* High-Tech Analysis Loading Modal */}
      {isScanning && (
        <LoadingScanner
          exerciseName={exercise.name}
          onComplete={handleAnalysisFinished}
          progress={scanProgress}
          statusMessage={scanStatus}
        />
      )}

      {/* Filming Guidelines Banner */}
      <div className="mt-12 p-6 rounded-3xl calm-card grid grid-cols-1 sm:grid-cols-3 gap-6 text-xs text-[#696C92]">
        <div className="flex items-start gap-3">
          <span className="w-6 h-6 rounded-full bg-[#EDE9FE] flex items-center justify-center font-bold text-[#2F3159] shrink-0">
            1
          </span>
          <div>
            <h4 className="font-bold text-[#2F3159] mb-0.5">Camera Distance</h4>
            <p className="leading-relaxed">
              Place device at hip height, 6 to 8 feet away so your feet to head stay in frame.
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <span className="w-6 h-6 rounded-full bg-[#EDE9FE] flex items-center justify-center font-bold text-[#2F3159] shrink-0">
            2
          </span>
          <div>
            <h4 className="font-bold text-[#2F3159] mb-0.5">Natural Stance</h4>
            <p className="leading-relaxed">
              Stand with comfortable tripod foot pressure and complete your repetitions at natural cadence.
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <span className="w-6 h-6 rounded-full bg-[#EDE9FE] flex items-center justify-center font-bold text-[#2F3159] shrink-0">
            3
          </span>
          <div>
            <h4 className="font-bold text-[#2F3159] mb-0.5">100% Privacy</h4>
            <p className="leading-relaxed">
              Video frames remain strictly in your browser memory. No servers or recording databases.
            </p>
          </div>
        </div>
      </div>

    </div>
  );
}
