import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Camera, SwitchCamera, Wifi, WifiOff, CheckCircle2, 
  AlertCircle, ArrowLeft, RefreshCw, ShieldCheck, Activity, Smartphone
} from 'lucide-react';
import { dualCameraClient } from '../utils/dualCameraClient';
import { initPoseLandmarker, detectPoseForVideoFrame, isLandmarkerReady } from '../utils/poseDetection';
import { drawSkeletonOnCanvas } from '../utils/skeletonRenderer';

export default function BackCameraNode({
  initialSessionCode = '',
  onBack
}) {
  const [sessionCodeInput, setSessionCodeInput] = useState(initialSessionCode);
  const [activeSessionId, setActiveSessionId] = useState(initialSessionCode ? initialSessionCode.toUpperCase() : '');
  const [isJoined, setIsJoined] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  
  // Camera & Tracking states
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isLoadingCamera, setIsLoadingCamera] = useState(false);
  const [facingMode, setFacingMode] = useState('environment'); // default to rear camera on mobile
  const [cameraFps, setCameraFps] = useState(30);
  const [isPoseDetected, setIsPoseDetected] = useState(false);
  const [primaryStatus, setPrimaryStatus] = useState({ repCount: 0, state: 'WAITING' });
  
  // Synchronized countdown overlay
  const [countdown, setCountdown] = useState(null); // null or number (3, 2, 1, 0)

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const animFrameRef = useRef(null);
  const facingModeRef = useRef('environment');
  const fpsTimerRef = useRef({ count: 0, lastTime: performance.now() });

  // 1. Join session when code is confirmed
  const handleJoinSession = async (codeToJoin = sessionCodeInput) => {
    const code = (codeToJoin || '').trim().toUpperCase();
    if (!code) {
      setErrorMessage('Please enter a valid workout join code.');
      return;
    }

    setIsConnecting(true);
    setErrorMessage('');

    try {
      await dualCameraClient.joinSession(code, {
        videoDimensions: {
          w: videoRef.current?.videoWidth || 1280,
          h: videoRef.current?.videoHeight || 720
        },
        cameraLabel: 'Back Camera'
      });
      setActiveSessionId(code);
    } catch (err) {
      setIsConnecting(false);
      setErrorMessage(err.message || 'Failed to connect to workout session.');
    }
  };

  // 2. Camera Management with facingMode support (defaults to rear)
  const startCamera = useCallback(async (targetFacing = facingModeRef.current) => {
    setIsLoadingCamera(true);
    setErrorMessage('');

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current && videoRef.current.srcObject) {
      const s = videoRef.current.srcObject;
      if (s.getTracks) s.getTracks().forEach(t => t.stop());
      videoRef.current.srcObject = null;
    }

    try {
      let stream = null;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: targetFacing },
            width: { ideal: 1280 },
            height: { ideal: 720 }
          },
          audio: false
        });
      } catch (err1) {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: targetFacing },
          audio: false
        });
      }

      if (stream && videoRef.current) {
        const activeTrack = stream.getVideoTracks()[0];
        let actualFacing = targetFacing;
        if (activeTrack && activeTrack.getSettings) {
          const s = activeTrack.getSettings();
          if (s.facingMode) actualFacing = s.facingMode;
        }

        setFacingMode(actualFacing);
        facingModeRef.current = actualFacing;

        videoRef.current.srcObject = stream;
        streamRef.current = stream;

        await new Promise(resolve => {
          if (videoRef.current.readyState >= 2) resolve();
          else videoRef.current.onloadedmetadata = () => resolve();
        });

        try {
          await videoRef.current.play();
        } catch (e) {}

        await initPoseLandmarker().catch(() => {});
        setIsCameraActive(true);
        setIsLoadingCamera(false);
      }
    } catch (err) {
      console.warn('Back camera error:', err);
      setIsLoadingCamera(false);
      setErrorMessage(`Camera notice: ${err.message || 'Unable to open camera.'}`);
    }
  }, []);

  const handleSwitchCamera = () => {
    const nextFacing = facingModeRef.current === 'environment' ? 'user' : 'environment';
    startCamera(nextFacing);
  };

  // 3. WebSocket event subscriptions
  useEffect(() => {
    const unsubJoined = dualCameraClient.on('session_joined', (msg) => {
      setIsJoined(true);
      setIsConnecting(false);
    });

    const unsubPeerDisconnected = dualCameraClient.on('peer_disconnected', (msg) => {
      if (msg.peerRole === 'primary') {
        setErrorMessage('Primary workout device ended the session.');
        setIsJoined(false);
      }
    });

    const unsubCountdown = dualCameraClient.on('countdown_started', (msg) => {
      let count = msg.durationSeconds || 3;
      setCountdown(count);
      const timer = setInterval(() => {
        count--;
        if (count < 0) {
          clearInterval(timer);
          setCountdown(null);
        } else {
          setCountdown(count);
        }
      }, 1000);
    });

    const unsubSync = dualCameraClient.on('primary_status_sync', (msg) => {
      setPrimaryStatus({
        repCount: msg.repCount || 0,
        state: msg.state || 'TRACKING'
      });
    });

    const unsubError = dualCameraClient.on('error', (msg) => {
      setIsConnecting(false);
      setErrorMessage(msg.error || 'Connection error.');
    });

    return () => {
      unsubJoined();
      unsubPeerDisconnected();
      unsubCountdown();
      unsubSync();
      unsubError();
      dualCameraClient.disconnect();
    };
  }, []);

  // 4. Initial mount
  useEffect(() => {
    startCamera('environment');
    if (initialSessionCode) {
      handleJoinSession(initialSessionCode);
    }
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, []);

  // 5. Pose Detection & Telemetry Relay Loop
  useEffect(() => {
    const runDetection = () => {
      if (videoRef.current && videoRef.current.readyState >= 2 && canvasRef.current && isCameraActive) {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');

        if (canvas.width !== video.clientWidth || canvas.height !== video.clientHeight) {
          canvas.width = video.clientWidth || 640;
          canvas.height = video.clientHeight || 480;
        }

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // FPS calculation
        fpsTimerRef.current.count++;
        const now = performance.now();
        if (now - fpsTimerRef.current.lastTime >= 1000) {
          setCameraFps(Math.round((fpsTimerRef.current.count * 1000) / (now - fpsTimerRef.current.lastTime)));
          fpsTimerRef.current.count = 0;
          fpsTimerRef.current.lastTime = now;
        }

        if (isLandmarkerReady()) {
          const timestamp = performance.now();
          const result = detectPoseForVideoFrame(video, timestamp);

          if (result && result.landmarks && result.landmarks.length > 0) {
            const rawLandmarks = result.landmarks[0];
            setIsPoseDetected(true);

            // Transmit minimal landmark telemetry to primary device via WebSocket
            dualCameraClient.sendPoseTelemetry(
              rawLandmarks,
              1.0,
              { w: video.videoWidth || 1280, h: video.videoHeight || 720 }
            );

            // Render skeleton overlay on back camera view
            drawSkeletonOnCanvas(ctx, rawLandmarks, {
              showUserSkeleton: true,
              showGhostTarget: false,
              isMirrored: facingModeRef.current === 'user',
              videoWidth: video.videoWidth || 640,
              videoHeight: video.videoHeight || 480,
              exerciseId: 'basic-squats'
            });
          } else {
            setIsPoseDetected(false);
          }
        }
      }

      animFrameRef.current = requestAnimationFrame(runDetection);
    };

    animFrameRef.current = requestAnimationFrame(runDetection);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isCameraActive]);

  return (
    <div className="min-h-screen bg-[#1A1B35] text-white p-4 sm:p-6 flex flex-col justify-between">
      
      {/* Top Header Bar */}
      <div className="flex items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              dualCameraClient.disconnect();
              if (onBack) onBack();
            }}
            className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#16A34A] animate-pulse" />
              <span className="text-xs font-bold text-[#A5B4FC] uppercase tracking-wider">
                Secondary Back Camera Node
              </span>
            </div>
            <h1 className="text-lg sm:text-xl font-black text-white">
              {isJoined ? `Connected to Session ${activeSessionId}` : 'Pair with Primary Workout'}
            </h1>
          </div>
        </div>

        {/* Camera Switcher Button */}
        <button
          onClick={handleSwitchCamera}
          disabled={isLoadingCamera}
          className="px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-xs font-semibold flex items-center gap-1.5 transition-all touch-manipulation min-h-[36px]"
          title="Switch between rear and front camera"
        >
          <SwitchCamera className="w-4 h-4 text-[#C084FC]" />
          <span>{facingMode === 'environment' ? 'Rear Cam' : 'Front Cam'}</span>
        </button>
      </div>

      {/* Main Viewport Container */}
      <div className="relative flex-1 w-full max-w-4xl mx-auto rounded-3xl overflow-hidden bg-black border border-white/10 shadow-2xl flex items-center justify-center min-h-[360px] sm:min-h-[480px]">
        
        {/* Video Feed */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`w-full h-full object-cover ${facingMode === 'user' ? '-scale-x-100' : ''}`}
        />

        {/* Skeleton Canvas Overlay */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full pointer-events-none z-10"
        />

        {/* Synchronized Countdown Overlay */}
        {countdown !== null && (
          <div className="absolute inset-0 bg-black/70 backdrop-blur-md z-30 flex flex-col items-center justify-center animate-fade-in">
            <span className="text-xs font-bold uppercase tracking-widest text-[#BBF7D0] mb-2">
              Synchronized Workout Starting
            </span>
            <div className="text-7xl sm:text-9xl font-black text-white animate-bounce">
              {countdown === 0 ? 'GO!' : countdown}
            </div>
          </div>
        )}

        {/* Top Floating Badges */}
        <div className="absolute top-4 left-4 z-20 flex flex-wrap items-center gap-2">
          <div className="px-3 py-1 rounded-full bg-black/60 backdrop-blur-sm border border-white/20 text-xs font-semibold flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${isPoseDetected ? 'bg-[#16A34A]' : 'bg-[#EF4444]'}`} />
            <span>{isPoseDetected ? 'Back Pose Tracked' : 'Position Back to Camera'}</span>
          </div>

          <div className="px-3 py-1 rounded-full bg-black/60 backdrop-blur-sm border border-white/20 text-xs font-mono text-[#BBF7D0]">
            FPS: {cameraFps}
          </div>

          {isJoined && (
            <div className="px-3 py-1 rounded-full bg-[#16A34A]/80 backdrop-blur-sm text-xs font-bold flex items-center gap-1">
              <Wifi className="w-3.5 h-3.5" />
              <span>Streaming Telemetry</span>
            </div>
          )}
        </div>

        {/* Join Session Prompt Card if not joined yet */}
        {!isJoined && (
          <div className="absolute inset-0 bg-[#0F1020]/85 backdrop-blur-md z-20 flex flex-col items-center justify-center p-6 text-center">
            <div className="w-12 h-12 rounded-2xl bg-[#EDE9FE] text-[#7F00FF] flex items-center justify-center mb-3">
              <Smartphone className="w-6 h-6 text-[#7F00FF]" />
            </div>
            <h2 className="text-xl font-bold text-white mb-1">
              Join Workout as Back Camera
            </h2>
            <p className="text-xs text-white/70 max-w-sm mb-4 leading-relaxed">
              Enter the 6-character code displayed on the primary workout device to start synchronized posterior tracking.
            </p>

            <div className="flex flex-col sm:flex-row items-center gap-2 w-full max-w-xs mb-3">
              <input
                type="text"
                placeholder="e.g. FF-8921"
                value={sessionCodeInput}
                onChange={(e) => setSessionCodeInput(e.target.value.toUpperCase())}
                className="w-full px-4 py-2.5 rounded-2xl bg-white/10 border border-white/20 text-center font-mono text-lg font-bold text-white placeholder-white/30 focus:outline-none focus:border-[#7F00FF]"
              />
              <button
                onClick={() => handleJoinSession()}
                disabled={isConnecting}
                className="w-full sm:w-auto px-6 py-2.5 rounded-2xl bg-[#7F00FF] hover:bg-[#6E00DE] active:scale-95 text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-1.5 shrink-0"
              >
                {isConnecting ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Connect'}
              </button>
            </div>

            {errorMessage && (
              <div className="p-2.5 rounded-xl bg-red-500/20 border border-red-500/40 text-red-200 text-xs flex items-center gap-1.5 max-w-xs">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}
          </div>
        )}

      </div>

      {/* Bottom Info Bar */}
      <div className="mt-4 p-4 rounded-2xl bg-white/5 border border-white/10 flex flex-wrap items-center justify-between gap-3 text-xs text-white/70">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-[#16A34A]" />
          <span>
            <strong>Zero Video Transmission:</strong> MediaPipe processes posture locally on this phone. Only joint coordinates are relayed.
          </span>
        </div>

        {isJoined && (
          <div className="flex items-center gap-4 text-xs font-mono">
            <span>Primary Reps: <strong className="text-[#BBF7D0]">{primaryStatus.repCount}</strong></span>
            <span>Status: <strong className="text-white">{primaryStatus.state}</strong></span>
          </div>
        )}
      </div>

    </div>
  );
}
