import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  UploadCloud, FileVideo, CheckCircle2, AlertCircle, 
  Trash2, Play, Pause, Sparkles, PlayCircle, Camera, Video, StopCircle 
} from 'lucide-react';
import { SAMPLE_WORKOUT_PRESETS, generateProceduralExerciseVideo } from '../utils/sampleVideos';

export default function VideoUploader({
  selectedExercise,
  onVideoSelected,
  uploadedVideoUrl,
  onClearVideo
}) {
  const [activeMode, setActiveMode] = useState('upload'); // 'upload' | 'camera'
  const [isDragging, setIsDragging] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isGeneratingPreset, setIsGeneratingPreset] = useState(false);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);

  // Webcam states
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [countdown, setCountdown] = useState(null);

  const previewVideoRef = useRef(null);
  const fileInputRef = useRef(null);
  const webcamVideoRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const recordedChunksRef = useRef([]);
  const timerIntervalRef = useRef(null);

  const supportedFormats = ['video/mp4', 'video/webm', 'video/quicktime'];

  // Callback ref to attach stream as soon as video element is mounted in DOM
  const attachWebcamRef = useCallback((node) => {
    webcamVideoRef.current = node;
    if (node && streamRef.current) {
      node.srcObject = streamRef.current;
      node.play().catch(e => console.warn('Webcam video play error:', e));
    }
  }, []);

  // Ensure webcam stream stays attached if activeMode changes
  useEffect(() => {
    if (activeMode === 'camera' && isCameraActive && webcamVideoRef.current && streamRef.current) {
      if (webcamVideoRef.current.srcObject !== streamRef.current) {
        webcamVideoRef.current.srcObject = streamRef.current;
        webcamVideoRef.current.play().catch(e => console.warn('Webcam video play error:', e));
      }
    }
  }, [activeMode, isCameraActive]);

  const handleFile = (file) => {
    if (!file) return;
    setErrorMsg('');

    const ext = file.name.split('.').pop().toLowerCase();
    const isSupported = supportedFormats.includes(file.type) || ['mp4', 'webm', 'mov'].includes(ext);

    if (!isSupported) {
      setErrorMsg('Please upload a supported video format: MP4, WebM, or MOV.');
      return;
    }

    if (file.size > 100 * 1024 * 1024) {
      setErrorMsg('Video file size exceeds 100MB limit.');
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    onVideoSelected({
      url: objectUrl,
      fileName: file.name,
      fileSize: (file.size / (1024 * 1024)).toFixed(1) + ' MB',
      isPreset: false
    });
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleSelectPreset = async (preset) => {
    setIsGeneratingPreset(true);
    setErrorMsg('');
    try {
      const videoUrl = await generateProceduralExerciseVideo(
        selectedExercise?.id || 'weighted-squats',
        preset.isUserWithError
      );

      onVideoSelected({
        url: videoUrl,
        fileName: `${preset.title}.webm`,
        fileSize: 'Synthetic Kinematic Capture',
        isPreset: true,
        presetData: preset
      });
    } catch (err) {
      setErrorMsg('Could not initialize sample clip. Please try another or upload your file.');
    } finally {
      setIsGeneratingPreset(false);
    }
  };

  // Webcam Controls with Fallbacks
  const startCamera = async () => {
    setErrorMsg('');
    try {
      let stream = null;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
          audio: false
        });
      } catch (e1) {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      }

      streamRef.current = stream;
      setIsCameraActive(true);

      if (webcamVideoRef.current) {
        webcamVideoRef.current.srcObject = stream;
        webcamVideoRef.current.play().catch(() => {});
      }
    } catch (err) {
      console.error('Camera access error:', err);
      setErrorMsg('Camera access is unavailable. Please verify browser permissions or upload a video file instead.');
      setIsCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (webcamVideoRef.current) {
      webcamVideoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
    setIsRecording(false);
    clearInterval(timerIntervalRef.current);
  };

  const startCountdownAndRecord = () => {
    setCountdown(3);
    const countInterval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(countInterval);
          setCountdown(null);
          beginRecording();
          return null;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const beginRecording = () => {
    if (!streamRef.current) return;
    recordedChunksRef.current = [];

    const recorder = new MediaRecorder(streamRef.current, { mimeType: 'video/webm' });
    mediaRecorderRef.current = recorder;

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        recordedChunksRef.current.push(e.data);
      }
    };

    recorder.onstop = () => {
      const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
      const objectUrl = URL.createObjectURL(blob);
      stopCamera();
      onVideoSelected({
        url: objectUrl,
        fileName: `webcam-${selectedExercise?.id || 'movement'}.webm`,
        fileSize: (blob.size / (1024 * 1024)).toFixed(1) + ' MB',
        isPreset: false
      });
    };

    recorder.start();
    setIsRecording(true);
    setRecordSeconds(0);

    timerIntervalRef.current = setInterval(() => {
      setRecordSeconds(s => s + 1);
    }, 1000);
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      clearInterval(timerIntervalRef.current);
    }
  };

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const togglePreviewPlay = () => {
    if (!previewVideoRef.current) return;
    if (isPlayingPreview) {
      previewVideoRef.current.pause();
      setIsPlayingPreview(false);
    } else {
      previewVideoRef.current.play();
      setIsPlayingPreview(true);
    }
  };

  return (
    <div className="w-full flex flex-col gap-6">
      
      {/* If Video is NOT yet uploaded, show Mode Selector, Dropzone/Camera & 1-Click Presets */}
      {!uploadedVideoUrl ? (
        <>
          {/* Mode Tabs: File Upload vs Camera */}
          <div className="flex items-center gap-2 p-1.5 rounded-full bg-[#F3F0FF] border border-[#E2D9F3] self-start">
            <button
              onClick={() => { setActiveMode('upload'); stopCamera(); }}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold transition-all ${
                activeMode === 'upload'
                  ? 'bg-[#FFFFFF] text-[#2F3159] shadow-sm'
                  : 'text-[#696C92] hover:text-[#2F3159]'
              }`}
            >
              <UploadCloud className="w-4 h-4 text-[#7F00FF]" />
              <span>Upload Video File</span>
            </button>

            <button
              onClick={() => { setActiveMode('camera'); startCamera(); }}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold transition-all ${
                activeMode === 'camera'
                  ? 'bg-[#FFFFFF] text-[#2F3159] shadow-sm'
                  : 'text-[#696C92] hover:text-[#2F3159]'
              }`}
            >
              <Camera className="w-4 h-4 text-[#7F00FF]" />
              <span>Record with Camera</span>
            </button>
          </div>

          {/* TAB 1: File Dropzone */}
          {activeMode === 'upload' && (
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-3xl p-8 sm:p-12 text-center cursor-pointer transition-all flex flex-col items-center justify-center relative overflow-hidden ${
                isDragging
                  ? 'border-[#7F00FF] bg-[#EDE9FE]/30 scale-[1.01]'
                  : 'border-[#E2D9F3] hover:border-[#7F00FF] bg-[#FFFFFF] hover:bg-[#FFFFFF]'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".mp4,.webm,.mov,video/*"
                className="hidden"
                onChange={(e) => e.target.files && handleFile(e.target.files[0])}
              />

              <div className="w-16 h-16 rounded-2xl bg-[#EDE9FE] text-[#2F3159] flex items-center justify-center mb-4 shadow-sm group-hover:scale-105 transition-transform">
                <UploadCloud className="w-8 h-8 text-[#2F3159]" />
              </div>

              <h3 className="text-xl font-bold text-[#2F3159] tracking-tight">
                Select Your Workout Video
              </h3>
              <p className="text-sm text-[#696C92] mt-2 max-w-md">
                Drag your video here, or <span className="text-[#7F00FF] font-semibold underline underline-offset-4">browse your device</span>.
              </p>

              <div className="flex items-center gap-3 mt-4 text-xs font-medium text-[#696C92]">
                <span className="px-2.5 py-0.5 rounded-full bg-[#F3F0FF] border border-[#E2D9F3]">MP4</span>
                <span className="px-2.5 py-0.5 rounded-full bg-[#F3F0FF] border border-[#E2D9F3]">WebM</span>
                <span className="px-2.5 py-0.5 rounded-full bg-[#F3F0FF] border border-[#E2D9F3]">MOV</span>
                <span>• Max 100MB</span>
              </div>

              {errorMsg && (
                <div className="mt-4 flex items-center gap-2 px-4 py-2 rounded-xl bg-[#FFEBEE] border border-[#FFCDD2] text-[#D32F2F] text-xs font-medium">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: Live Webcam Viewfinder & Recording */}
          {activeMode === 'camera' && (
            <div className="calm-card p-6 flex flex-col items-center">
              <div className="relative aspect-video max-h-[420px] w-full rounded-2xl overflow-hidden bg-[#1A1B35] flex items-center justify-center border border-[#E2D9F3]">
                <video
                  ref={attachWebcamRef}
                  autoPlay
                  playsInline
                  muted
                  onLoadedMetadata={(e) => e.target.play().catch(() => {})}
                  className="w-full h-full object-cover -scale-x-100"
                />

                {/* Countdown Overlay */}
                {countdown !== null && (
                  <div className="absolute inset-0 bg-[#2F3159]/50 backdrop-blur-sm flex items-center justify-center z-30">
                    <span className="text-7xl font-bold font-sans text-white animate-ping">
                      {countdown}
                    </span>
                  </div>
                )}

                {/* Recording HUD */}
                {isRecording && (
                  <div className="absolute top-4 left-4 z-20 flex items-center gap-2 px-3 py-1 rounded-full bg-[#FFFFFF]/90 border border-[#D32F2F] text-[#D32F2F] text-xs font-semibold shadow-sm">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#D32F2F] animate-ping" />
                    <span>REC {Math.floor(recordSeconds / 60)}:{(recordSeconds % 60).toString().padStart(2, '0')}</span>
                  </div>
                )}
              </div>

              {errorMsg && (
                <div className="mt-4 flex items-center gap-2 px-4 py-2 rounded-xl bg-[#FFEBEE] border border-[#FFCDD2] text-[#D32F2F] text-xs font-medium w-full max-w-md">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Camera Controls */}
              <div className="mt-6 flex items-center gap-4">
                {!isRecording ? (
                  <button
                    onClick={startCountdownAndRecord}
                    className="px-6 py-3 rounded-full font-semibold text-xs bg-[#D32F2F] hover:bg-[#C2185B] text-white flex items-center gap-2 shadow-sm transition-all"
                  >
                    <Video className="w-4 h-4" />
                    <span>Start Recording Reps</span>
                  </button>
                ) : (
                  <button
                    onClick={stopRecording}
                    className="px-6 py-3 rounded-full font-semibold text-xs bg-[#2F3159] hover:bg-[#2F3159] text-white flex items-center gap-2 shadow-sm transition-all animate-pulse"
                  >
                    <StopCircle className="w-4 h-4 fill-white" />
                    <span>Finish & Ingest Clip</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Quick-Test 1-Click Sample Presets */}
          <div className="calm-card p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#7F00FF]" />
                <h4 className="text-sm font-bold text-[#2F3159]">Don't have a video handy? Try an Instant Demo Clip</h4>
              </div>
              <span className="text-[11px] font-medium text-[#696C92]">1-Click Test</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {SAMPLE_WORKOUT_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  disabled={isGeneratingPreset}
                  onClick={() => handleSelectPreset(preset)}
                  className="flex items-start gap-3 p-3.5 rounded-2xl bg-[#FFFFFF] hover:bg-[#F3F0FF] border border-[#E2D9F3] hover:border-[#7F00FF] text-left transition-all duration-300 group"
                >
                  <div className="w-10 h-10 rounded-xl bg-[#EDE9FE] flex items-center justify-center shrink-0 text-[#2F3159] group-hover:scale-105 transition-transform">
                    <PlayCircle className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs font-bold text-[#2F3159] truncate group-hover:text-[#7F00FF]">
                        {preset.title}
                      </span>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                        preset.isUserWithError 
                          ? 'text-[#D97706] bg-[#FFF8E1] border-[#FFE082]' 
                          : 'text-[#16A34A] bg-[#DCFCE7] border-[#BBF7D0]'
                      }`}>
                        {preset.formScore}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#696C92] mt-0.5 line-clamp-1">
                      {preset.description}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </>
      ) : (
        /* Video Preview Screen when video is loaded */
        <div className="calm-card p-6 flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-[#E2D9F3] pb-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#16A34A]">
              <CheckCircle2 className="w-4 h-4" />
              <span>Video Ready for Movement Analysis</span>
            </div>

            <button
              onClick={onClearVideo}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium text-[#D32F2F] hover:bg-[#FFEBEE] transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Remove & Re-upload</span>
            </button>
          </div>

          {/* Interactive Preview Video Player */}
          <div className="relative aspect-video max-h-[380px] w-full rounded-2xl overflow-hidden bg-[#F3F0FF] flex items-center justify-center">
            <video
              ref={previewVideoRef}
              src={uploadedVideoUrl.url}
              className="w-full h-full object-contain"
              playsInline
              loop
              onPlay={() => setIsPlayingPreview(true)}
              onPause={() => setIsPlayingPreview(false)}
            />

            <button
              onClick={togglePreviewPlay}
              className="absolute z-10 w-14 h-14 rounded-full bg-[#7F00FF] hover:bg-[#6E00DE] text-white flex items-center justify-center shadow-lg hover:scale-105 transition-all"
            >
              {isPlayingPreview ? (
                <Pause className="w-6 h-6 fill-white" />
              ) : (
                <Play className="w-6 h-6 fill-white ml-0.5" />
              )}
            </button>
          </div>

          {/* Video Metadata specs */}
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-[#696C92] pt-1">
            <div className="flex items-center gap-2">
              <FileVideo className="w-4 h-4 text-[#7F00FF]" />
              <span className="text-[#2F3159] font-semibold">{uploadedVideoUrl.fileName}</span>
              <span>({uploadedVideoUrl.fileSize})</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#16A34A]" />
              <span className="text-[#16A34A] font-medium">Ready for on-device pose tracking</span>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
