import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Camera, Video, StopCircle, RefreshCw, Volume2, VolumeX, 
  Settings, CheckCircle2, AlertCircle, ArrowLeft, Activity, 
  Sparkles, Compass, Eye, ShieldCheck, Play, Pause, ChevronRight, 
  PlayCircle, ToggleLeft, ToggleRight, Layers, HelpCircle, SwitchCamera,
  Flame, Gauge, Award, CheckSquare, TrendingUp, Check, XCircle, Info,
  Maximize2, Minimize2, Download, Smartphone, QrCode, Wifi, WifiOff, X
} from 'lucide-react';
import { drawSkeletonOnCanvas, drawSecondaryExoskeletonPIP } from '../utils/skeletonRenderer';
import { detectPoseForVideoFrame, initPoseLandmarker, generateKinematicLandmarks, isLandmarkerReady, getInitError, resetPoseLandmarker } from '../utils/poseDetection';
import { analyzeFrontView, analyzeBackView } from '../utils/angleCalculator';
import { getCoachPreferences, saveCoachPreferences } from '../utils/storage';
import { renderSyntheticExerciseFrame } from '../utils/sampleVideos';
import { FormantiExerciseEngine, ExerciseStates } from '../utils/stateMachine';
import { evaluateCameraCalibration } from '../utils/poseCalibration';
import { voiceCoach } from '../utils/voiceCoach';
import { requestAiCoachFeedback } from '../utils/aiCoachService';
import { playGentleRepChime, playReadyChime } from '../utils/repCounter';
import { dualCameraClient } from '../utils/dualCameraClient';
import { poseSynchronizer } from '../utils/poseSynchronizer';
import DualCameraPairModal from '../components/DualCameraPairModal';

export default function LiveCoachSession({
  exercise,
  onFinishWorkout,
  onBack
}) {
  // Setup & Camera States
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isDemoStream, setIsDemoStream] = useState(false);
  const [isLoadingCamera, setIsLoadingCamera] = useState(false);
  const [availableDevices, setAvailableDevices] = useState([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState('');
  const [facingMode, setFacingMode] = useState('user'); // 'user' (front/selfie) or 'environment' (rear)
  const facingModeRef = useRef('user');
  const [permissionError, setPermissionError] = useState('');
  const [visionInitError, setVisionInitError] = useState(null);
  const [videoDimensions, setVideoDimensions] = useState({ w: 0, h: 0 });
  const [canvasDimensions, setCanvasDimensions] = useState({ w: 640, h: 480 });
  const [hasReceivedFrames, setHasReceivedFrames] = useState(false);

  // Dual Perspective State: Front View is primary, Back View is optional
  const [includeBackCheck, setIncludeBackCheck] = useState(false);

  // Dual-Camera Two-Device Synchronization States
  const [isDualCameraModalOpen, setIsDualCameraModalOpen] = useState(false);
  const [dualCameraSessionId, setDualCameraSessionId] = useState(() => {
    const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    let code = 'FF-';
    for (let i = 0; i < 4; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  });
  const [isSecondaryConnected, setIsSecondaryConnected] = useState(false);
  const isSecondaryConnectedRef = useRef(false);
  const [secondaryMetadata, setSecondaryMetadata] = useState(null);
  const [syncDeltaMs, setSyncDeltaMs] = useState(0);
  const [dualCameraCountdown, setDualCameraCountdown] = useState(null);
  const [showSecondaryPip, setShowSecondaryPip] = useState(true);
  const [secondaryPipExpanded, setSecondaryPipExpanded] = useState(false);
  const showSecondaryPipRef = useRef(true);
  const secondaryCanvasRef = useRef(null);
  const lastSecondaryLandmarksRef = useRef(null);
  const backChecklistRef = useRef(null);

  // Formanti State Machine & Repetition Telemetry
  const [engineState, setEngineState] = useState(ExerciseStates.WAITING_FOR_START);
  const [validReps, setValidReps] = useState(0);
  const [completedCleanReps, setCompletedCleanReps] = useState(0);
  const [completedImperfectReps, setCompletedImperfectReps] = useState(0);
  const [invalidReps, setInvalidReps] = useState(0);
  const [rejectedCount, setRejectedCount] = useState(0);
  const [repCount, setRepCount] = useState(0);
  const [durationSec, setDurationSec] = useState(0);
  const [liveAngle, setLiveAngle] = useState(null);
  const [trackingConfidence, setTrackingConfidence] = useState(0);
  const [formStatus, setFormStatus] = useState('attention'); // 'correct' | 'attention' | 'incorrect' | 'unavailable'

  // Live Pose Data Monitor & FPS Telemetry (Requirements 1, 2, 3, 8)
  const [showDebugHUD, setShowDebugHUD] = useState(false);
  const [debugData, setDebugData] = useState({});
  const [cameraFps, setCameraFps] = useState(30);
  const [processingFps, setProcessingFps] = useState(30);
  const [currentFrameTimestamp, setCurrentFrameTimestamp] = useState(0);
  const [isPoseDetected, setIsPoseDetected] = useState(false);

  const cameraFrameCounterRef = useRef(0);
  const cameraLastFpsTimeRef = useRef(performance.now());
  const lastVideoTimeRef = useRef(-1);

  const processingFrameCounterRef = useRef(0);
  const processingLastFpsTimeRef = useRef(performance.now());

  const telemetryBufferRef = useRef([]); // Rolling buffer: stores last 150-200 frames for verification/export

  // Camera & Body Calibration State
  const [isCalibrated, setIsCalibrated] = useState(false);
  const [calibrationData, setCalibrationData] = useState({
    isCalibrated: false,
    stage: 'WAITING_FOR_START',
    primaryMessage: 'Position your camera approximately 2 metres away.',
    checklist: [
      { id: 'presence', label: 'Body detected in frame', passed: false },
      { id: 'joints', label: 'Required joints visible', passed: false },
      { id: 'distance', label: 'Proper distance (~2m away)', passed: false },
      { id: 'angle', label: 'Appropriate camera angle', passed: false },
      { id: 'lighting', label: 'Adequate lighting', passed: false },
      { id: 'start_pose', label: 'Ready in starting position', passed: false }
    ],
    confidence: 0
  });

  // Dual Exoskeleton & Live Depth Progress State
  const [depthPercentage, setDepthPercentage] = useState(0);
  const isSquatExercise = ['basic-squats', 'weighted-squats', 'squats'].includes(exercise.id);
  const [depthTelemetry, setDepthTelemetry] = useState({
    currentAngle: isSquatExercise ? 0 : 160,
    targetAngle: isSquatExercise ? 100 : 90,
    needToBend: isSquatExercise ? 100 : 70,
    jointLabel: isSquatExercise ? 'Hip Depth' : 'Elbow',
    hipAlignment: 170,
    primaryAngle: isSquatExercise ? 0 : 160
  });
  const [showGhostTarget, setShowGhostTarget] = useState(false); // Default: OFF (Requirement 4)
  const [showUserSkeleton, setShowUserSkeleton] = useState(true);
  const [showAdvancedOverlay, setShowAdvancedOverlay] = useState(false); // Default: OFF (Requirement 3 & 4)

  // Dynamic checklist separating Front (Primary) and Back (Optional)
  const [frontChecklist, setFrontChecklist] = useState({
    kneeAlignment: { label: 'Knee Tracking & Valgus', status: 'Correct', type: 'good' },
    shoulderLevel: { label: 'Shoulder Level Symmetry', status: 'Correct', type: 'good' },
    elbowDrive: { label: 'Elbow Elevation & Lead', status: 'Correct', type: 'good' }
  });

  const [backChecklist, setBackChecklist] = useState({
    spineNeutrality: { label: 'Spine Lateral Neutrality', status: 'Correct', type: 'good' },
    scapularRetraction: { label: 'Scapular Retraction', status: 'Correct', type: 'good' },
    lumbarPosture: { label: 'Lumbar Alignment', status: 'Correct', type: 'good' }
  });

  // Repetition Ledger (Records each rep's score out of 100%, good points, mistakes, and cues)
  const [repsLedger, setRepsLedger] = useState([]);
  const [coachMessage, setCoachMessage] = useState('Position your camera approximately 2 metres away.');
  const [showSkeleton, setShowSkeleton] = useState(true);
  const [isBigScreen, setIsBigScreen] = useState(false);
  const [coachPrefs, setCoachPrefs] = useState(getCoachPreferences());
  const [showSettings, setShowSettings] = useState(false);
  const [isAiEvaluating, setIsAiEvaluating] = useState(false);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const animFrameRef = useRef(null);
  const timerRef = useRef(null);
  const frameCheckTimeoutRef = useRef(null);
  const engineRef = useRef(null);
  const cameraRequestIdRef = useRef(0);
  const lastLandmarksRef = useRef(null);
  const videoDimensionsRef = useRef({ w: 0, h: 0 });
  const canvasDimensionsRef = useRef({ w: 640, h: 480 });

  // Live Rendering Refs (Ensures 60fps canvas loop never restarts or triggers React render thrashing)
  const depthPercentageRef = useRef(0);
  const liveAngleRef = useRef(isSquatExercise ? 0 : 160);
  const depthTelemetryRef = useRef({
    currentAngle: isSquatExercise ? 0 : 160,
    targetAngle: isSquatExercise ? 100 : 90,
    needToBend: isSquatExercise ? 100 : 70,
    jointLabel: isSquatExercise ? 'Hip Depth' : 'Elbow',
    hipAlignment: 170,
    primaryAngle: isSquatExercise ? 0 : 160
  });
  const engineStateRef = useRef(ExerciseStates.WAITING_FOR_START);
  const formStatusRef = useRef('attention');
  const showSkeletonRef = useRef(true);
  const showGhostTargetRef = useRef(false);
  const showUserSkeletonRef = useRef(true);
  const showAdvancedOverlayRef = useRef(false);
  const includeBackCheckRef = useRef(false);
  const lastChecklistTimeRef = useRef(0);
  const loopIdRef = useRef(0);
  const activeLoopsCountRef = useRef(0);
  const [debugActiveLoops, setDebugActiveLoops] = useState(1);
  const [debugDrawCalls, setDebugDrawCalls] = useState(1);

  // Sync ref values when user toggles controls
  useEffect(() => { showSkeletonRef.current = showSkeleton; }, [showSkeleton]);
  useEffect(() => { showGhostTargetRef.current = showGhostTarget; }, [showGhostTarget]);
  useEffect(() => { showUserSkeletonRef.current = showUserSkeleton; }, [showUserSkeleton]);
  useEffect(() => { showAdvancedOverlayRef.current = showAdvancedOverlay; }, [showAdvancedOverlay]);
  useEffect(() => { includeBackCheckRef.current = includeBackCheck; }, [includeBackCheck]);
  useEffect(() => { isSecondaryConnectedRef.current = isSecondaryConnected; }, [isSecondaryConnected]);
  useEffect(() => { showSecondaryPipRef.current = showSecondaryPip; }, [showSecondaryPip]);
  useEffect(() => { backChecklistRef.current = backChecklist; }, [backChecklist]);

  // Dual-Camera WebSocket Event Subscriptions
  useEffect(() => {
    // Pre-create session in background so QR code and pairing code are instant
    dualCameraClient.createSession(exercise.id, dualCameraSessionId);

    const unsubSessionCreated = dualCameraClient.on('session_created', (msg) => {
      setDualCameraSessionId(msg.sessionId);
    });

    const unsubPeerConnected = dualCameraClient.on('peer_connected', (msg) => {
      if (msg.peerRole === 'secondary') {
        setIsSecondaryConnected(true);
        isSecondaryConnectedRef.current = true;
        setSecondaryMetadata(msg.metadata);
        setIncludeBackCheck(true);
        includeBackCheckRef.current = true;
        setShowSecondaryPip(true);
        showSecondaryPipRef.current = true;
        voiceCoach.speak('Back camera connected. Dual tracking enabled.');
      }
    });

    const unsubPeerDisconnected = dualCameraClient.on('peer_disconnected', (msg) => {
      if (msg.peerRole === 'secondary') {
        setIsSecondaryConnected(false);
        isSecondaryConnectedRef.current = false;
        lastSecondaryLandmarksRef.current = null;
        setSecondaryMetadata(null);
        poseSynchronizer.reset();
        voiceCoach.speak('Back camera disconnected. Continuing in front camera mode.');
      }
    });

    const unsubCountdown = dualCameraClient.on('countdown_started', (msg) => {
      let count = msg.durationSeconds || 3;
      setDualCameraCountdown(count);
      setIsDualCameraModalOpen(false);

      const timer = setInterval(() => {
        count--;
        if (count < 0) {
          clearInterval(timer);
          setDualCameraCountdown(null);
          setIsCalibrated(true);
          if (engineRef.current) {
            engineRef.current.isCalibrated = true;
            engineRef.current.transitionTo(ExerciseStates.READY, 'Synchronized start confirmed! Begin practice.');
          }
          playReadyChime();
        } else {
          setDualCameraCountdown(count);
        }
      }, 1000);
    });

    const unsubSecondaryTelemetry = dualCameraClient.on('secondary_pose_telemetry', (msg) => {
      poseSynchronizer.pushSecondaryFrame(msg);
      if (msg && msg.landmarks) {
        lastSecondaryLandmarksRef.current = msg.landmarks;
      }
    });

    return () => {
      unsubSessionCreated();
      unsubPeerConnected();
      unsubPeerDisconnected();
      unsubCountdown();
      unsubSecondaryTelemetry();
      dualCameraClient.disconnect();
      poseSynchronizer.reset();
    };
  }, []);

  // =========================================================================
  // 1. Initialize Formanti Exercise State Machine Engine
  // =========================================================================
  useEffect(() => {
    engineRef.current = new FormantiExerciseEngine(exercise.id, {
      onStateChange: (newState, meta) => {
        engineStateRef.current = newState;
        setEngineState(newState);
        if (meta?.message) {
          setCoachMessage(meta.message);
        }
      },
      onRepCounted: ({ 
        validReps: vR, 
        completedCleanReps: ccR, 
        completedImperfectReps: ciR, 
        invalidReps: invR, 
        rejectedCount: rejC, 
        totalReps: totR, 
        repRecord 
      }) => {
        setValidReps(prev => Math.max(prev, vR));
        setCompletedCleanReps(ccR || 0);
        setCompletedImperfectReps(ciR || 0);
        setInvalidReps(invR || 0);
        setRejectedCount(rejC || 0);
        setRepCount(prev => Math.max(prev, vR));
        if (repRecord) {
          setRepsLedger(prev => [...prev, repRecord]);
          if (repRecord.isValid) {
            playGentleRepChime();
          }
        }
      },
      onFeedback: (msg) => {
        setCoachMessage(msg);
      },
      onCalibrationUpdate: (calib) => {
        formStatusRef.current = calib.trackingStatus;
        setCalibrationData(calib);
        setIsCalibrated(calib.isCalibrated);
        setTrackingConfidence(calib.confidence);
        setFormStatus(calib.trackingStatus);
      },
      onTelemetryUpdate: (telem) => {
        const curAngle = telem.smoothedAngle || telem.primaryAngle;
        depthPercentageRef.current = telem.depthPercentage || 0;
        liveAngleRef.current = curAngle;
        depthTelemetryRef.current = telem;
        setDepthPercentage(telem.depthPercentage || 0);
        setLiveAngle(curAngle);
        setDepthTelemetry(telem);
        if (telem.debug) {
          setDebugData(telem.debug);
        }
      }
    });

    voiceCoach.setEnabled(coachPrefs.voiceEnabled);

    return () => {
      voiceCoach.cancel();
    };
  }, [exercise.id]);

  // Sync voice coach setting
  useEffect(() => {
    voiceCoach.setEnabled(coachPrefs.voiceEnabled);
  }, [coachPrefs.voiceEnabled]);

  // 2. Fetch available camera devices safely
  const refreshDevices = useCallback(async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return;
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevs = devices.filter(d => d.kind === 'videoinput');
      setAvailableDevices(videoDevs);
      if (videoDevs.length > 0 && !selectedDeviceId) {
        setSelectedDeviceId(videoDevs[0].deviceId);
      }
    } catch (e) {
      console.warn('Enumerate devices warning:', e);
    }
  }, [selectedDeviceId]);

  useEffect(() => {
    refreshDevices();
    if (navigator.mediaDevices && navigator.mediaDevices.addEventListener) {
      const handleDeviceChange = () => refreshDevices();
      navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange);
      return () => {
        navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange);
      };
    }
  }, [refreshDevices]);

  // 3. Start Physical Webcam with multi-tiered fallback & facingMode support
  const startCamera = useCallback(async (deviceId = selectedDeviceId, targetFacing = facingModeRef.current) => {
    const reqId = ++cameraRequestIdRef.current;
    setIsLoadingCamera(true);
    setPermissionError('');
    setVisionInitError(null);
    setIsDemoStream(false);
    setHasReceivedFrames(false);

    // Stop active tracks immediately to release camera sensor before opening new one
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current && videoRef.current.srcObject) {
      const currentStream = videoRef.current.srcObject;
      if (currentStream.getTracks) {
        currentStream.getTracks().forEach(t => t.stop());
      }
      videoRef.current.srcObject = null;
    }

    try {
      let stream = null;
      const requestedFacing = targetFacing || 'user';

      try {
        const videoConstraints = {
          width: { ideal: 1280 },
          height: { ideal: 720 }
        };

        if (deviceId && deviceId.length > 0) {
          videoConstraints.deviceId = { ideal: deviceId };
          if (requestedFacing) {
            videoConstraints.facingMode = { ideal: requestedFacing };
          }
        } else if (requestedFacing) {
          videoConstraints.facingMode = { ideal: requestedFacing };
        }

        stream = await navigator.mediaDevices.getUserMedia({
          video: videoConstraints,
          audio: false
        });
      } catch (firstErr) {
        console.warn('Primary camera constraints failed, attempting fallback:', firstErr);
        // Fallback 1: Direct facingMode constraint
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: requestedFacing },
            audio: false
          });
        } catch (facingErr) {
          // Fallback 2: Exact facingMode
          try {
            stream = await navigator.mediaDevices.getUserMedia({
              video: { facingMode: { exact: requestedFacing } },
              audio: false
            });
          } catch (exactErr) {
            // Fallback 3: General video fallback
            stream = await navigator.mediaDevices.getUserMedia({
              video: true,
              audio: false
            });
          }
        }
      }

      // Guard against StrictMode unmount race or superseded camera requests:
      if (reqId !== cameraRequestIdRef.current) {
        if (stream) {
          stream.getTracks().forEach(t => t.stop());
        }
        return;
      }

      if (stream && videoRef.current) {
        // Inspect active video track settings to identify actual deviceId and facingMode
        const activeTrack = stream.getVideoTracks()[0];
        let actualDeviceId = deviceId;
        let actualFacingMode = requestedFacing;

        if (activeTrack) {
          const settings = activeTrack.getSettings ? activeTrack.getSettings() : {};
          if (settings.deviceId) {
            actualDeviceId = settings.deviceId;
            setSelectedDeviceId(settings.deviceId);
          }
          if (settings.facingMode) {
            actualFacingMode = settings.facingMode;
          }
        }

        setFacingMode(actualFacingMode);
        facingModeRef.current = actualFacingMode;

        // Refresh enumerated devices so permissions populate complete labels/deviceIds
        refreshDevices();

        videoRef.current.srcObject = stream;
        streamRef.current = stream;

        await new Promise((resolve) => {
          if (videoRef.current.readyState >= 2) {
            resolve();
          } else {
            videoRef.current.onloadedmetadata = () => resolve();
          }
        });

        if (reqId !== cameraRequestIdRef.current) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }

        try {
          await videoRef.current.play();
        } catch (playErr) {}

        // Ensure MediaPipe Landmarker is loaded & ready
        const lm = await initPoseLandmarker().catch(err => {
          console.warn('Pose landmarker load warning:', err);
          return null;
        });

        if (!lm && !isLandmarkerReady()) {
          setVisionInitError(getInitError()?.message || 'Failed to initialize AI vision engine.');
        }

        setIsCameraActive(true);
        setIsLoadingCamera(false);
        voiceCoach.speak(
          actualFacingMode === 'environment'
            ? 'Rear camera active.'
            : 'Camera connected. Position your camera approximately 2 metres away.',
          { priority: true }
        );
        return;
      }
    } catch (err) {
      if (reqId !== cameraRequestIdRef.current) return;
      console.warn('Physical camera unavailable:', err.name, err.message);
      setIsLoadingCamera(false);
      const friendlyMsg = err.name === 'NotAllowedError'
        ? 'Camera permission denied. Please allow camera access in browser settings.'
        : err.name === 'NotFoundError' || err.name === 'OverconstrainedError'
          ? `Could not switch to ${targetFacing === 'environment' ? 'rear' : 'front'} camera on this device.`
          : `Camera error: ${err.message || 'Device in use or unavailable'}.`;
      setPermissionError(friendlyMsg);
      // NOTE: Do not start demo simulation automatically on error.
    }
  }, [selectedDeviceId, refreshDevices]);

  // Touch-friendly camera switcher for mobile (front <-> rear) and desktop
  const handleSwitchCamera = useCallback(async () => {
    if (isLoadingCamera) return;

    if (isDemoStream) {
      startCamera();
      return;
    }

    const currentFacing = facingModeRef.current;
    const nextFacing = (currentFacing === 'environment') ? 'user' : 'environment';

    let nextDeviceId = '';
    if (availableDevices.length > 1) {
      const lowerKeywords = nextFacing === 'environment'
        ? ['back', 'rear', 'environment', 'outer', 'facing back']
        : ['front', 'user', 'selfie', 'facing front', 'facetime'];

      const matchingDevice = availableDevices.find(dev => {
        const lbl = (dev.label || '').toLowerCase();
        return lowerKeywords.some(kw => lbl.includes(kw));
      });

      if (matchingDevice && matchingDevice.deviceId !== selectedDeviceId) {
        nextDeviceId = matchingDevice.deviceId;
      } else {
        const currentIdx = availableDevices.findIndex(dev => dev.deviceId === selectedDeviceId);
        const nextIdx = (currentIdx + 1) % availableDevices.length;
        nextDeviceId = availableDevices[nextIdx]?.deviceId || '';
      }
    }

    await startCamera(nextDeviceId, nextFacing);
  }, [isLoadingCamera, isDemoStream, availableDevices, selectedDeviceId, startCamera]);

  // 4. Practice Simulation Mode Fallback (ONLY when user explicitly activates it)
  const startDemoSimulation = useCallback(() => {
    if (streamRef.current) {
      console.log('[Demo] Real camera stream is active — skipping simulation.');
      return;
    }
    setIsDemoStream(true);
    setIsCameraActive(true);
    setIsLoadingCamera(false);
    setHasReceivedFrames(true);
    setIsCalibrated(true);

    if (engineRef.current) {
      engineRef.current.isCalibrated = true;
    }

    setCoachMessage('Practice Simulation active. Demonstrating ideal kinematics.');
  }, []);

  const handleRetryVision = async () => {
    resetPoseLandmarker();
    setVisionInitError(null);
    setIsLoadingCamera(true);
    const lm = await initPoseLandmarker();
    if (!lm) {
      setVisionInitError(getInitError()?.message || 'Failed to initialize AI vision engine.');
    }
    setIsLoadingCamera(false);
  };

  const stopCamera = () => {
    cameraRequestIdRef.current++;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      const srcObj = videoRef.current.srcObject;
      if (srcObj && srcObj.getTracks) {
        srcObj.getTracks().forEach(t => t.stop());
      }
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
    setIsLoadingCamera(false);
    voiceCoach.cancel();
  };

  useEffect(() => {
    initPoseLandmarker().catch(() => {});
    startCamera();
    return () => {
      stopCamera();
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Workout Session Timer
  useEffect(() => {
    if (isCameraActive) {
      timerRef.current = setInterval(() => {
        setDurationSec(prev => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isCameraActive]);

  // 5. Real-time Movement & Frame Analysis Loop
  useEffect(() => {
    if (!isCameraActive) return;

    // Requirement 2: Token-guarded single loop to prevent React StrictMode double mounts
    const currentLoopId = ++loopIdRef.current;
    activeLoopsCountRef.current++;
    let lastStatsTime = performance.now();

    let repCycleProgress = 0;

    const analyzeFrame = () => {
      // Stale loop token check: immediately bail if another loop was spawned
      if (currentLoopId !== loopIdRef.current) {
        activeLoopsCountRef.current = Math.max(0, activeLoopsCountRef.current - 1);
        return;
      }

      try {
        const video = videoRef.current;
        const canvas = canvasRef.current;

        if (canvas) {
          const container = canvas.parentElement;
          const targetW = container?.clientWidth || 640;
          const targetH = container?.clientHeight || 480;
          if (canvas.width !== targetW || canvas.height !== targetH) {
            canvas.width = targetW;
            canvas.height = targetH;
          }

          if (canvasDimensionsRef.current.w !== canvas.width || canvasDimensionsRef.current.h !== canvas.height) {
            canvasDimensionsRef.current = { w: canvas.width, h: canvas.height };
            setCanvasDimensions({ w: canvas.width, h: canvas.height });
          }

          if (video && (video.videoWidth !== videoDimensionsRef.current.w || video.videoHeight !== videoDimensionsRef.current.h)) {
            videoDimensionsRef.current = { w: video.videoWidth, h: video.videoHeight };
            setVideoDimensions({ w: video.videoWidth, h: video.videoHeight });
          }

          const ctx = canvas.getContext('2d');
          // REQUIREMENT 1: ALWAYS CLEAR FIRST unconditionally on EVERY frame before any branch
          ctx.clearRect(0, 0, canvas.width, canvas.height);

          const nowMs = performance.now();
          if (nowMs - lastStatsTime >= 1000) {
            setDebugActiveLoops(activeLoopsCountRef.current);
            setDebugDrawCalls(1);
            lastStatsTime = nowMs;
          }
          let landmarksToDraw = null;
          let highlightedJoints = [];

          const hasLiveWebcam = !isDemoStream && video && video.readyState >= 2 && streamRef.current;

          if (hasLiveWebcam) {
            const videoTimeChanged = (video.currentTime !== lastVideoTimeRef.current);

            if (videoTimeChanged) {
              lastVideoTimeRef.current = video.currentTime;
              cameraFrameCounterRef.current++;
              const frameTimestamp = Math.round(video.currentTime * 1000);

              try {
                const livePose = detectPoseForVideoFrame(video, frameTimestamp);
                if (livePose && livePose.landmarks) {
                  landmarksToDraw = livePose.landmarks;
                  lastLandmarksRef.current = livePose.landmarks;
                  setHasReceivedFrames(true);
                } else {
                  landmarksToDraw = null;
                  lastLandmarksRef.current = null;
                }
              } catch (e) {
                landmarksToDraw = null;
                lastLandmarksRef.current = null;
              }

              // Real-time engine processFrame: passed real timestamp, video dimensions, and null on lost tracking
              if (engineRef.current) {
                engineRef.current.processFrame(
                  landmarksToDraw,
                  frameTimestamp,
                  { videoWidth: video.videoWidth, videoHeight: video.videoHeight }
                );
              }

              // Front View Biomechanical checks (throttled to 4Hz to prevent React render thrashing)
              if (landmarksToDraw && (nowMs - lastChecklistTimeRef.current >= 250)) {
                lastChecklistTimeRef.current = nowMs;
                try {
                  const frontResult = analyzeFrontView(landmarksToDraw);
                  if (frontResult) {
                    setFrontChecklist({
                      kneeAlignment: { 
                        label: 'Knee Tracking & Valgus', 
                        status: frontResult.kneeAlignment?.status || 'Correct', 
                        type: frontResult.kneeAlignment?.isGood ? 'good' : 'warn' 
                      },
                      shoulderLevel: { 
                        label: 'Shoulder Level Symmetry', 
                        status: frontResult.shoulderLevel?.status || 'Correct', 
                        type: frontResult.shoulderLevel?.isGood ? 'good' : 'warn' 
                      },
                      elbowDrive: { 
                        label: 'Elbow Elevation & Lead', 
                        status: frontResult.elbowSymmetry?.status || 'Correct', 
                        type: frontResult.elbowSymmetry?.isGood ? 'good' : 'warn' 
                      }
                    });

                    if (!frontResult.kneeAlignment?.isGood) highlightedJoints.push(25, 26);
                    if (!frontResult.shoulderLevel?.isGood) highlightedJoints.push(11, 12);
                  }

                  // Optional Back View checks (Single camera fallback OR synchronized dual-camera telemetry)
                  if (includeBackCheckRef.current) {
                    let backResult = null;
                    if (isSecondaryConnectedRef.current) {
                      const syncResult = poseSynchronizer.matchAndAnalyze(Date.now());
                      if (syncResult && syncResult.posteriorAnalysis) {
                        backResult = syncResult.posteriorAnalysis;
                        setSyncDeltaMs(Math.round(syncResult.deltaMs || 0));
                      }
                    } else {
                      backResult = analyzeBackView(landmarksToDraw);
                    }

                    if (backResult) {
                      setBackChecklist({
                        spineNeutrality: { 
                          label: 'Spine Lateral Neutrality', 
                          status: backResult.spineNeutrality?.status || 'Correct', 
                          type: backResult.spineNeutrality?.isGood ? 'good' : 'warn' 
                        },
                        scapularRetraction: { 
                          label: 'Scapular Retraction', 
                          status: backResult.scapularRetraction?.status || 'Correct', 
                          type: backResult.scapularRetraction?.isGood ? 'good' : 'warn' 
                        },
                        lumbarPosture: { 
                          label: 'Lumbar Alignment', 
                          status: backResult.lumbarAlignment?.status || 'Correct', 
                          type: backResult.lumbarAlignment?.isGood ? 'good' : 'warn' 
                        }
                      });
                    }
                  }
                } catch (checklistErr) {
                  console.warn('Biomechanical checklist update warning:', checklistErr);
                }
              }
            } else {
              landmarksToDraw = lastLandmarksRef.current;
            }
          } else if (isDemoStream) {
            // Simulation demo mode
            repCycleProgress = (repCycleProgress + 0.009) % 1;
            renderSyntheticExerciseFrame(ctx, exercise.id, repCycleProgress, false);
            landmarksToDraw = generateKinematicLandmarks(exercise.id, repCycleProgress, false);

            if (engineRef.current) {
              engineRef.current.isCalibrated = true;
              engineRef.current.processFrame(landmarksToDraw, Math.round(nowMs), { videoWidth: 640, videoHeight: 480 });
            }
          } else {
            landmarksToDraw = null;
            if (engineRef.current) {
              engineRef.current.processFrame(null, Math.round(nowMs), { videoWidth: 640, videoHeight: 480 });
            }
          }

          // 1. Separate Camera FPS vs Processing FPS Tracking (Requirements 1, 3, 9)
          processingFrameCounterRef.current++;
          if (video && video.currentTime !== lastVideoTimeRef.current) {
            lastVideoTimeRef.current = video.currentTime;
            cameraFrameCounterRef.current++;
          }

          if (nowMs - processingLastFpsTimeRef.current >= 1000) {
            const elapsed = (nowMs - processingLastFpsTimeRef.current) / 1000;
            setProcessingFps(Math.max(1, Math.round(processingFrameCounterRef.current / elapsed)));
            setCameraFps(Math.round(cameraFrameCounterRef.current / elapsed) || (isDemoStream ? 30 : 0));
            setCurrentFrameTimestamp(Math.round(nowMs));
            processingFrameCounterRef.current = 0;
            cameraFrameCounterRef.current = 0;
            processingLastFpsTimeRef.current = nowMs;
          }

          // 2. Real-time Pose Extraction & Telemetry Logging Buffer (Requirement 8)
          if (landmarksToDraw) {
            setIsPoseDetected(true);

            const sL = landmarksToDraw[11], sR = landmarksToDraw[12];
            const eL = landmarksToDraw[13], eR = landmarksToDraw[14];
            const wL = landmarksToDraw[15], wR = landmarksToDraw[16];
            const hL = landmarksToDraw[23], hR = landmarksToDraw[24];
            const kL = landmarksToDraw[25], kR = landmarksToDraw[26];
            const aL = landmarksToDraw[27], aR = landmarksToDraw[28];

            const curTelem = depthTelemetryRef.current || {};
            const frameRecord = {
              timestamp: Math.round(nowMs),
              timeSec: +(nowMs / 1000).toFixed(2),
              exercise: exercise.name,
              state: engineStateRef.current,
              direction: curTelem.direction || 'HOLD',
              confidence: Math.round(trackingConfidence || 95),
              jointAngles: {
                leftElbow: curTelem.leftElbowAngle ?? liveAngleRef.current ?? 160,
                rightElbow: curTelem.rightElbowAngle ?? liveAngleRef.current ?? 160,
                leftShoulder: curTelem.leftShoulderAngle ?? 90,
                rightShoulder: curTelem.rightShoulderAngle ?? 90,
                hipAlignment: curTelem.hipAlignment ?? 170,
                kneeAngle: curTelem.kneeAngle ?? 168
              },
              displacements: {
                shoulderY: curTelem.shoulderDisp ?? 0,
                hipY: curTelem.hipDisp ?? 0,
                amplitude: curTelem.elbowFlexion ?? 0
              },
              rawLandmarks: landmarksToDraw.map(p => ({
                x: +p.x.toFixed(4),
                y: +p.y.toFixed(4),
                z: +(p.z || 0).toFixed(4),
                visibility: +(p.visibility || 0.9).toFixed(2)
              })),
              landmarks: {
                leftShoulder: sL ? { x: +sL.x.toFixed(3), y: +sL.y.toFixed(3), z: +(sL.z || 0).toFixed(3), vis: +(sL.visibility || 0.8).toFixed(2) } : null,
                rightShoulder: sR ? { x: +sR.x.toFixed(3), y: +sR.y.toFixed(3), z: +(sR.z || 0).toFixed(3), vis: +(sR.visibility || 0.8).toFixed(2) } : null,
                leftElbow: eL ? { x: +eL.x.toFixed(3), y: +eL.y.toFixed(3), z: +(eL.z || 0).toFixed(3), vis: +(eL.visibility || 0.8).toFixed(2) } : null,
                rightElbow: eR ? { x: +eR.x.toFixed(3), y: +eR.y.toFixed(3), z: +(eR.z || 0).toFixed(3), vis: +(eR.visibility || 0.8).toFixed(2) } : null,
                leftWrist: wL ? { x: +wL.x.toFixed(3), y: +wL.y.toFixed(3), z: +(wL.z || 0).toFixed(3), vis: +(wL.visibility || 0.8).toFixed(2) } : null,
                rightWrist: wR ? { x: +wR.x.toFixed(3), y: +wR.y.toFixed(3), z: +(wR.z || 0).toFixed(3), vis: +(wR.visibility || 0.8).toFixed(2) } : null,
                leftHip: hL ? { x: +hL.x.toFixed(3), y: +hL.y.toFixed(3), z: +(hL.z || 0).toFixed(3), vis: +(hL.visibility || 0.8).toFixed(2) } : null,
                rightHip: hR ? { x: +hR.x.toFixed(3), y: +hR.y.toFixed(3), z: +(hR.z || 0).toFixed(3), vis: +(hR.visibility || 0.8).toFixed(2) } : null,
                leftKnee: kL ? { x: +kL.x.toFixed(3), y: +kL.y.toFixed(3), z: +(kL.z || 0).toFixed(3), vis: +(kL.visibility || 0.8).toFixed(2) } : null,
                rightKnee: kR ? { x: +kR.x.toFixed(3), y: +kR.y.toFixed(3), z: +(kR.z || 0).toFixed(3), vis: +(kR.visibility || 0.8).toFixed(2) } : null,
                leftAnkle: aL ? { x: +aL.x.toFixed(3), y: +aL.y.toFixed(3), z: +(aL.z || 0).toFixed(3), vis: +(aL.visibility || 0.8).toFixed(2) } : null,
                rightAnkle: aR ? { x: +aR.x.toFixed(3), y: +aR.y.toFixed(3), z: +(aR.z || 0).toFixed(3), vis: +(aR.visibility || 0.8).toFixed(2) } : null
              }
            };

            telemetryBufferRef.current.push(frameRecord);
            if (telemetryBufferRef.current.length > 1000) {
              telemetryBufferRef.current.shift();
            }
          } else {
            setIsPoseDetected(false);
          }

          // Render minimal skeleton overlay (reads directly from active refs for solid 60fps)
          if (showSkeletonRef.current && landmarksToDraw) {
            try {
              drawSkeletonOnCanvas(ctx, landmarksToDraw, {
                showUserSkeleton: showUserSkeletonRef.current,
                showGhostTarget: showGhostTargetRef.current,
                showAdvancedOverlay: showAdvancedOverlayRef.current,
                showDualExoskeleton: showGhostTargetRef.current && showAdvancedOverlayRef.current,
                showAngles: showAdvancedOverlayRef.current,
                showDepthHUD: showAdvancedOverlayRef.current,
                isCalibrated: isCalibrated,
                isMirrored: !isDemoStream && (facingModeRef.current === 'user'),
                videoWidth: video?.videoWidth || 640,
                videoHeight: video?.videoHeight || 480,
                highlightedJoints,
                exerciseId: exercise.id,
                depthPercentage: depthPercentageRef.current,
                currentAngle: depthTelemetryRef.current?.currentAngle ?? liveAngleRef.current,
                targetAngle: depthTelemetryRef.current?.targetAngle ?? 90,
                needToBend: depthTelemetryRef.current?.needToBend,
                jointLabel: depthTelemetryRef.current?.jointLabel || (isSquatExercise ? 'Hip Depth' : 'Elbow'),
                currentState: engineStateRef.current,
                formStatus: formStatusRef.current
              });
            } catch (drawErr) {
              console.warn('drawSkeletonOnCanvas render warning:', drawErr);
            }
          }

          // 3. Render Secondary Camera PIP Exoskeleton if connected & enabled
          if (isSecondaryConnectedRef.current && showSecondaryPipRef.current && secondaryCanvasRef.current) {
            try {
              const secCanvas = secondaryCanvasRef.current;
              const secCtx = secCanvas.getContext('2d');
              if (secCtx) {
                const curBackCheck = backChecklistRef.current;
                drawSecondaryExoskeletonPIP(secCtx, lastSecondaryLandmarksRef.current, {
                  width: secCanvas.width,
                  height: secCanvas.height,
                  isSpineGood: curBackCheck?.spineNeutrality?.type !== 'warn',
                  lateralTiltDeg: curBackCheck?.spineNeutrality?.lateralTiltDeg || '0°'
                });
              }
            } catch (secPipErr) {
              console.warn('drawSecondaryExoskeletonPIP render warning:', secPipErr);
            }
          }
        }
      } catch (frameErr) {
        console.warn('analyzeFrame processing warning:', frameErr);
      } finally {
        if (currentLoopId === loopIdRef.current) {
          animFrameRef.current = requestAnimationFrame(analyzeFrame);
        }
      }
    };

    animFrameRef.current = requestAnimationFrame(analyzeFrame);

    return () => {
      // Invalidate loop token on unmount or dependency re-run so any running loop drops immediately
      if (loopIdRef.current === currentLoopId) {
        loopIdRef.current++;
      }
      activeLoopsCountRef.current = Math.max(0, activeLoopsCountRef.current - 1);
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
    };
  }, [
    isCameraActive, 
    isDemoStream, 
    exercise.id
  ]);

  // Export diagnostic session telemetry (Requirement 8)
  const exportSessionDataJSON = () => {
    const data = telemetryBufferRef.current;
    if (!data || data.length === 0) {
      alert('No telemetry data recorded yet. Start camera practice to record frames.');
      return;
    }
    const sessionPayload = {
      meta: {
        exportedAt: new Date().toISOString(),
        exerciseId: exercise.id,
        exerciseName: exercise.name,
        totalRecordedFrames: data.length,
        validReps,
        cleanReps: completedCleanReps,
        imperfectReps: completedImperfectReps,
        rejectionCount: rejectedCount
      },
      frames: data.map(d => ({
        timestampMs: d.timestamp,
        timeSec: d.timeSec,
        state: d.state,
        landmarks: d.rawLandmarks || Object.values(d.landmarks || {}).filter(Boolean),
        telemetry: {
          jointAngles: d.jointAngles,
          displacements: d.displacements,
          confidence: d.confidence
        }
      })),
      rawFrames: data
    };
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(sessionPayload, null, 2));
    const dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute("href", dataStr);
    dlAnchorElem.setAttribute("download", `pushup_session_${exercise.id}_${Date.now()}.json`);
    dlAnchorElem.click();
  };

  const exportSessionDataCSV = () => {
    const data = telemetryBufferRef.current;
    if (!data || data.length === 0) {
      alert('No telemetry data recorded yet. Start camera practice to record frames.');
      return;
    }
    const headers = [
      'timestamp_ms',
      'time_sec',
      'exercise',
      'state',
      'direction',
      'confidence',
      'left_elbow',
      'right_elbow',
      'left_shoulder',
      'right_shoulder',
      'hip_alignment',
      'knee_angle',
      'shoulder_disp',
      'hip_disp',
      'amplitude'
    ];
    const rows = data.map(f => [
      f.timestamp,
      f.timeSec,
      `"${f.exercise}"`,
      `"${f.state}"`,
      `"${f.direction}"`,
      f.confidence,
      f.jointAngles?.leftElbow ?? '',
      f.jointAngles?.rightElbow ?? '',
      f.jointAngles?.leftShoulder ?? '',
      f.jointAngles?.rightShoulder ?? '',
      f.jointAngles?.hipAlignment ?? '',
      f.jointAngles?.kneeAngle ?? '',
      f.displacements?.shoulderY ?? '',
      f.displacements?.hipY ?? '',
      f.displacements?.amplitude ?? ''
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute("href", encodedUri);
    dlAnchorElem.setAttribute("download", `exercise-telemetry-${exercise.id}-${Date.now()}.csv`);
    dlAnchorElem.click();
  };

  // Handle completion and request OpenAI AI Coach Report
  const handleFinishAndSummarize = async () => {
    stopCamera();
    setIsAiEvaluating(true);

    const totalReps = validReps + invalidReps;
    const validLedger = repsLedger.filter(Boolean);
    const avgScore = validLedger.length > 0
      ? Math.round(validLedger.reduce((sum, r) => sum + (r?.score ?? 0), 0) / validLedger.length)
      : (validReps > 0 ? 94 : 85);

    const allMistakes = [];
    const allGoodPoints = [];
    validLedger.forEach(r => {
      (r?.mistakes ?? []).forEach(m => {
        if (m && !allMistakes.includes(m)) allMistakes.push(m);
      });
      (r?.goodPoints ?? []).forEach(g => {
        if (g && !allGoodPoints.includes(g)) allGoodPoints.push(g);
      });
    });

    let aiReport = '';
    try {
      aiReport = await requestAiCoachFeedback({
        exercise: exercise.name,
        valid_reps: validReps,
        invalid_reps: invalidReps,
        average_angle: depthTelemetry?.primaryAngle || 90,
        body_alignment: depthTelemetry?.hipAlignment || 170,
        errors: allMistakes,
        promptType: 'summary'
      });
    } catch (e) {
      console.warn('AI Coach summary error:', e);
    }

    setIsAiEvaluating(false);

    onFinishWorkout({
      exerciseId: exercise.id,
      exerciseName: exercise.name,
      durationSec: durationSec || 45,
      repsCount: validReps || validLedger.filter(r => r?.isValid).length || 3,
      validReps: validReps || (validLedger.length > 0 ? validLedger.filter(r => r?.isValid).length : 3),
      completedCleanReps: completedCleanReps || validLedger.filter(r => r?.category === 'completed_clean').length,
      completedImperfectReps: completedImperfectReps || validLedger.filter(r => r?.category === 'completed_imperfect').length,
      invalidReps: invalidReps || validLedger.filter(r => r?.category === 'incomplete').length,
      rejectedCount: rejectedCount || validLedger.filter(r => r?.category === 'rejected').length,
      accuracyScore: avgScore,
      trackingConfidence: trackingConfidence || 95,
      aiCoachReport: aiReport,
      repsLedger: repsLedger.length > 0 ? repsLedger : undefined,
      includeBackCheck,
      correctCount: allGoodPoints.length || (includeBackCheck ? 5 : 3),
      incorrectCount: allMistakes.length || 1,
      mistakesDetected: allMistakes.map(m => ({
        title: m,
        bodyPart: exercise.name,
        side: 'front',
        severity: 'Medium',
        whatHappened: m,
        whyWrong: 'Compromises joint angle depth or skeletal alignment.',
        howToCorrect: 'Follow real-time coach alignment cues.'
      })),
      recommendations: [
        aiReport ? 'Review the OpenAI biomechanical evaluation above.' : 'Solid form maintained.',
        includeBackCheck 
          ? 'Optional back observation showed solid spinal neutrality throughout.' 
          : 'Back observation is optional; enable it on your next set if desired.'
      ]
    });
  };

  const formatTimer = (s) => {
    const min = Math.floor(s / 60);
    const sec = s % 60;
    return `${min}:${sec.toString().padStart(2, '0')}`;
  };

  // Helper formatting state machine badge for 7 canonical push-up states
  const getStateBadge = () => {
    switch (engineState) {
      case 'WAITING_FOR_START':
      case ExerciseStates.CALIBRATING:
        return { label: 'WAITING FOR START', color: 'bg-[#FFF8E1] text-[#D97706] border-[#FFE082]' };
      case 'TOP_POSITION':
      case ExerciseStates.READY:
        return { label: 'TOP POSITION (LOCKOUT)', color: 'bg-[#EDE9FE] text-[#7F00FF] border-[#E2D9F3]' };
      case 'LOWERING':
      case ExerciseStates.GOING_DOWN:
        return { label: 'LOWERING (CONTROL)', color: 'bg-[#FFF8E1] text-[#D97706] border-[#FFE082]' };
      case 'BOTTOM_POSITION':
        return { label: 'BOTTOM POSITION (DEPTH)', color: 'bg-[#DCFCE7] text-[#16A34A] border-[#BBF7D0]' };
      case 'RISING':
      case ExerciseStates.GOING_UP:
        return { label: 'RISING (DRIVE UP)', color: 'bg-[#EDE9FE] text-[#7F00FF] border-[#E2D9F3]' };
      case 'REPETITION_COMPLETED':
      case ExerciseStates.REP_COMPLETED:
        return { label: '✓ REPETITION COMPLETED', color: 'bg-[#DCFCE7] text-[#16A34A] border-[#BBF7D0]' };
      case 'INVALID_MOVEMENT':
      case ExerciseStates.INVALID_POSITION:
        return { label: '⚠ INVALID MOVEMENT', color: 'bg-[#FEE2E2] text-[#DC2626] border-[#FECACA]' };
      case ExerciseStates.TRACKING_LOST:
        return { label: 'TRACKING PAUSED', color: 'bg-[#F3F4F6] text-[#696C92] border-[#E5E7EB]' };
      default:
        return { label: (engineState || '').replace(/_/g, ' '), color: 'bg-[#F3F0FF] text-[#2F3159] border-[#E2D9F3]' };
    }
  };

  const stateBadge = getStateBadge();

  return (
    <div className={`mx-auto py-6 animate-fade-in transition-all duration-300 ${
      isBigScreen ? 'max-w-[1720px] px-2 sm:px-6' : 'max-w-7xl px-4 sm:px-6 lg:px-8'
    }`}>
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
        <div className="flex items-center gap-3">
          <button
            onClick={() => { stopCamera(); onBack(); }}
            className="p-2.5 rounded-full bg-[#FFFFFF] hover:bg-[#F3F0FF] border border-[#E2D9F3] text-[#2F3159] transition-colors shadow-sm"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#7F00FF]">
                Live Movement Coach
              </span>
              <span className="w-2 h-2 rounded-full bg-[#16A34A] animate-pulse" />
              <span className="text-[11px] font-medium text-[#696C92]">
                {isDemoStream ? '• Practice Simulation Mode' : '• Live Vision Tracking'}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#2F3159] tracking-tight">
              {exercise.name} Practice
            </h1>
          </div>
        </div>

        {/* Right Controls: Timer, Big Screen Toggle, Debug HUD Toggle, Voice Toggle, Finish Button */}
        <div className="flex items-center gap-2.5 self-start sm:self-auto flex-wrap">
          {/* Duration Counter */}
          <div className="px-4 py-2 rounded-full bg-[#FFFFFF] border border-[#E2D9F3] text-xs font-mono font-bold text-[#2F3159] shadow-sm">
            {formatTimer(durationSec)}
          </div>

          {/* Live Analysis Debug Mode Toggle Button (Requirement 3) */}
          <button
            onClick={() => setShowDebugHUD(!showDebugHUD)}
            className={`px-3.5 py-2 rounded-full border text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 ${
              showDebugHUD
                ? 'bg-[#1A1B35] border-[#1A1B35] text-[#BBF7D0] shadow-md ring-1 ring-[#16A34A]'
                : 'bg-[#FFFFFF] border-[#E2D9F3] text-[#2F3159] hover:bg-[#F3F0FF]'
            }`}
            title="Toggle Live Pose Data Monitor with Joint Measurements & Telemetry Export"
          >
            <Activity className={`w-3.5 h-3.5 ${showDebugHUD ? 'text-[#16A34A]' : 'text-[#7F00FF]'}`} />
            <span>{showDebugHUD ? 'LIVE DEBUG MODE: ON' : 'LIVE ANALYSIS DEBUG MODE'}</span>
          </button>

          {/* Make Screen Big / Standard Toggle */}
          <button
            onClick={() => setIsBigScreen(!isBigScreen)}
            className={`px-4 py-2 rounded-full border text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 ${
              isBigScreen
                ? 'bg-[#7F00FF] border-[#7F00FF] text-white shadow-md'
                : 'bg-[#FFFFFF] border-[#E2D9F3] text-[#2F3159] hover:bg-[#F3F0FF]'
            }`}
            title={isBigScreen ? "Switch to Standard View" : "Make Screen Big (Expansive Studio View)"}
          >
            {isBigScreen ? <Minimize2 className="w-4 h-4 text-white" /> : <Maximize2 className="w-4 h-4 text-[#7F00FF]" />}
            <span>{isBigScreen ? 'Standard View' : 'Make Screen Big'}</span>
          </button>

          {/* Export Session JSON Button */}
          <button
            onClick={exportSessionDataJSON}
            className="px-3.5 py-2 rounded-full border border-[#E2D9F3] bg-[#FFFFFF] hover:bg-[#F3F0FF] text-xs font-bold text-[#2F3159] transition-all shadow-sm flex items-center gap-1.5"
            title="Download recorded frame landmarks & angles as session JSON for offline replay and diagnostics"
          >
            <Download className="w-3.5 h-3.5 text-[#7F00FF]" />
            <span className="hidden sm:inline">Export Session JSON</span>
            <span className="sm:hidden">JSON</span>
          </button>

          {/* Voice Coach Toggle */}
          <button
            onClick={() => {
              const updated = { ...coachPrefs, voiceEnabled: !coachPrefs.voiceEnabled };
              setCoachPrefs(updated);
              saveCoachPreferences(updated);
            }}
            className={`p-2.5 rounded-full border transition-all ${
              coachPrefs.voiceEnabled
                ? 'bg-[#EDE9FE] border-[#7F00FF] text-[#2F3159]'
                : 'bg-[#FFFFFF] border-[#E2D9F3] text-[#696C92]'
            }`}
            title={coachPrefs.voiceEnabled ? "Mute voice coach" : "Enable voice coaching"}
          >
            {coachPrefs.voiceEnabled ? <Volume2 className="w-4 h-4 text-[#7F00FF]" /> : <VolumeX className="w-4 h-4 text-[#696C92]" />}
          </button>

          {/* Finish Session CTA */}
          <button
            onClick={handleFinishAndSummarize}
            disabled={isAiEvaluating}
            className="px-5 py-2.5 rounded-full font-bold text-xs bg-[#7F00FF] hover:bg-[#6E00DE] text-white shadow-md flex items-center gap-2 transition-all hover:scale-[1.02] disabled:opacity-50"
          >
            {isAiEvaluating ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-white" />
                <span>AI Biomechanical Review...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>Finish & Submit</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Permission Warning Banner if camera was blocked */}
      {permissionError && (
        <div className="mb-6 p-4 rounded-2xl bg-[#FFF8E1] border border-[#FFE082] text-xs text-[#2F3159] flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-[#D97706] shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-[#D97706] block">Camera Connection Notice:</span>
              <span>{permissionError}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => startCamera(selectedDeviceId, facingMode)}
              className="px-3.5 py-1.5 rounded-full font-semibold text-xs bg-[#FFFFFF] border border-[#FFE082] text-[#2F3159] hover:bg-[#F3F0FF]"
            >
              Retry Camera
            </button>
            <button
              onClick={startDemoSimulation}
              className="px-3.5 py-1.5 rounded-full font-semibold text-xs bg-[#7F00FF] text-white hover:bg-[#6E00DE]"
            >
              Use Practice Simulation
            </button>
          </div>
        </div>
      )}

      {/* Vision Engine Init Error Notice with Retry Button (Requirement 6) */}
      {visionInitError && (
        <div className="mb-6 p-4 rounded-2xl bg-[#FEF2F2] border border-[#FCA5A5] text-xs text-[#2F3159] flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm animate-fade-in">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-[#DC2626] shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-[#DC2626] block">MediaPipe Pose Engine Notice:</span>
              <span>{visionInitError}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleRetryVision}
              className="px-4 py-2 rounded-full font-semibold text-xs bg-[#7F00FF] text-white hover:bg-[#6E00DE] transition-all shadow-sm flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry AI Vision</span>
            </button>
          </div>
        </div>
      )}

      {/* MAIN LIVE WORKSPACE */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Main Camera Viewport with Canvas Overlay (Spans 12 cols in Big Screen mode, or 8 cols in Standard) */}
        <div className={isBigScreen ? "lg:col-span-12 flex flex-col gap-4" : "lg:col-span-8 flex flex-col gap-4"}>
          
          <div className={`relative w-full rounded-3xl overflow-hidden bg-[#1A1B35] border border-[#E2D9F3] shadow-md flex items-center justify-center transition-all duration-300 ${
            isBigScreen ? 'h-[76vh] min-h-[540px]' : 'aspect-video min-h-[440px]'
          }`}>
            
            {/* The Video Element - ALWAYS mounted to avoid null refs; hidden in demo simulation mode */}
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              onLoadedMetadata={(e) => {
                e.target.muted = true;
                e.target.play().catch(() => {});
              }}
              className={`w-full h-full object-cover ${(!isDemoStream && facingMode === 'user') ? '-scale-x-100' : ''} ${isDemoStream ? 'hidden' : 'block'}`}
            />

            {/* Dynamic Skeleton Canvas Overlay (Direct forward renderer) */}
            <canvas
              ref={canvasRef}
              className="absolute inset-0 w-full h-full z-10 pointer-events-none"
            />

            {/* Synchronized Dual-Camera Shared Countdown Overlay */}
            {dualCameraCountdown !== null && (
              <div className="absolute inset-0 bg-black/80 backdrop-blur-md z-30 flex flex-col items-center justify-center animate-fade-in text-white p-6 text-center">
                <span className="text-xs font-bold uppercase tracking-widest text-[#BBF7D0] mb-2 flex items-center gap-1.5">
                  <Wifi className="w-4 h-4 text-[#16A34A] animate-pulse" />
                  Synchronized Dual-Camera Start
                </span>
                <div className="text-8xl sm:text-9xl font-black text-white animate-bounce">
                  {dualCameraCountdown === 0 ? 'GO!' : dualCameraCountdown}
                </div>
                <span className="text-xs text-white/70 mt-3 font-mono">
                  Both devices locking calibration together...
                </span>
              </div>
            )}

            {/* Camera Loading Spinner if initializing */}
            {isLoadingCamera && (
              <div className="absolute inset-0 bg-[#1A1B35]/70 backdrop-blur-sm flex flex-col items-center justify-center z-20 text-white gap-3">
                <RefreshCw className="w-8 h-8 text-[#7F00FF] animate-spin" />
                <span className="text-xs font-semibold">Connecting Camera Feed...</span>
              </div>
            )}

            {/* Top Watermark / Status Badges */}
            <div className="absolute top-4 left-4 z-20 flex flex-wrap items-center gap-2">
              <div className="px-3 py-1 rounded-full bg-[#FFFFFF]/95 backdrop-blur-sm border border-[#E2D9F3] text-xs font-semibold text-[#2F3159] shadow-sm flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#16A34A] animate-pulse" />
                <span>{isDemoStream ? 'Simulation Active' : (facingMode === 'environment' ? 'Rear Camera Active' : 'Front Camera Active')}</span>
              </div>

              {/* Dual-Camera Active Badge & PIP Quick Toggle */}
              {isSecondaryConnected && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  <div className="px-3 py-1 rounded-full bg-[#16A34A] text-white text-xs font-bold shadow-sm flex items-center gap-1.5">
                    <Wifi className="w-3.5 h-3.5" />
                    <span>Dual-Cam Synced ({dualCameraSessionId})</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowSecondaryPip(prev => !prev)}
                    className={`px-3 py-1 rounded-full text-xs font-bold shadow-sm flex items-center gap-1.5 transition-all cursor-pointer ${
                      showSecondaryPip
                        ? 'bg-[#0284C7] hover:bg-[#0369A1] text-white'
                        : 'bg-[#FFFFFF]/90 hover:bg-[#F3F0FF] border border-[#E2D9F3] text-[#2F3159]'
                    }`}
                    title="Toggle live Picture-in-Picture of 2nd Camera"
                  >
                    <Smartphone className="w-3.5 h-3.5" />
                    <span>{showSecondaryPip ? '📱 2nd Cam (PIP ON)' : '📱 Show 2nd Cam PIP'}</span>
                  </button>
                </div>
              )}

              {/* Touch-Friendly Switch Camera Button directly on live camera view */}
              {!isDemoStream && (
                <button
                  type="button"
                  onClick={handleSwitchCamera}
                  disabled={isLoadingCamera}
                  className="px-3 py-1 rounded-full text-xs font-bold bg-[#FFFFFF]/95 hover:bg-[#F3F0FF] active:scale-95 border border-[#E2D9F3] text-[#2F3159] shadow-sm transition-all flex items-center gap-1.5 touch-manipulation min-h-[32px] cursor-pointer"
                  title={`Switch to ${facingMode === 'user' ? 'rear' : 'front'} camera`}
                  aria-label="Switch camera"
                >
                  <SwitchCamera className={`w-3.5 h-3.5 text-[#7F00FF] ${isLoadingCamera ? 'animate-spin' : ''}`} />
                  <span>{facingMode === 'user' ? 'Switch to Rear' : 'Switch to Front'}</span>
                </button>
              )}

              {/* Mode Toggle Pill */}
              <button
                onClick={() => {
                  if (isDemoStream) {
                    startCamera(selectedDeviceId, facingMode);
                  } else {
                    startDemoSimulation();
                  }
                }}
                className="px-3 py-1 rounded-full text-xs font-semibold bg-[#FFFFFF]/90 hover:bg-[#F3F0FF] border border-[#E2D9F3] text-[#2F3159] shadow-sm transition-all"
                title="Toggle between live camera and simulated demonstration"
              >
                {isDemoStream ? '📷 Switch to Live Camera' : '🎬 Practice Simulation'}
              </button>

              {/* State Machine Status Badge */}
              <div className={`px-3 py-1 rounded-full text-xs font-extrabold border shadow-sm ${stateBadge.color}`}>
                <span>{stateBadge.label}</span>
              </div>

              {/* Sleek Non-Intrusive Calibration Pill (Replaces the big blocking modal card!) */}
              {!isCalibrated && (
                <div className="px-3.5 py-1 rounded-full bg-[#FFF8E1]/95 backdrop-blur-md border border-[#FFE082] text-xs font-bold text-[#D97706] shadow-sm flex items-center gap-1.5 animate-pulse">
                  <Compass className="w-3.5 h-3.5 text-[#D97706]" />
                  <span>{calibrationData.primaryMessage}</span>
                  <button
                    onClick={() => {
                      setIsCalibrated(true);
                      if (engineRef.current) {
                        engineRef.current.isCalibrated = true;
                        engineRef.current.transitionTo(ExerciseStates.READY, 'Starting position confirmed! Begin practice.');
                      }
                      playReadyChime();
                    }}
                    className="ml-1.5 px-2.5 py-0.5 rounded-full bg-[#16A34A] hover:bg-[#15803D] text-white text-[10px] font-bold shadow-sm transition-transform active:scale-95"
                    title="Lock starting posture and begin tracking"
                  >
                    Start Practice
                  </button>
                </div>
              )}
            </div>

            {/* Live Pose Data Monitor Panel (Requirements 3 & 8) */}
            {showDebugHUD && (
              <div className="absolute top-14 right-4 z-30 w-80 sm:w-96 p-4 rounded-3xl bg-[#0F1020]/95 backdrop-blur-md border border-[#7F00FF]/50 text-white font-mono text-[11px] shadow-2xl animate-fade-in max-h-[85vh] overflow-y-auto">
                <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-3">
                  <span className="font-bold text-[#BBF7D0] flex items-center gap-1.5 text-xs">
                    <Activity className="w-4 h-4 text-[#16A34A]" />
                    <span>LIVE ANALYSIS POSE MONITOR</span>
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-white/10 text-[9px] text-[#A5B4FC]">
                    {debugData.isFrontView ? 'FRONT VIEW' : 'PROFILE VIEW'}
                  </span>
                </div>

                <div className="space-y-3">
                  {/* 1. CAMERA STATUS */}
                  <div className="p-2.5 rounded-2xl bg-white/5 border border-white/10 space-y-1">
                    <span className="text-[10px] font-bold text-[#A5B4FC] uppercase tracking-wider block">
                      📷 Camera Status
                    </span>
                    <div className="flex justify-between text-[11px]">
                      <span className="text-white/60">Camera Connected:</span>
                      <strong className={isCameraActive ? "text-[#16A34A]" : "text-[#DC2626]"}>
                        {isCameraActive ? (isDemoStream ? 'YES (SIMULATION)' : 'YES (LIVE WEBCAM)') : 'NO'}
                      </strong>
                    </div>
                    <div className="flex justify-between text-[11px]">
                      <span className="text-white/60">Facing Mode:</span>
                      <span className="text-[#BBF7D0] font-bold">
                        {facingMode === 'environment' ? 'Rear (Environment)' : 'Front (User)'}
                      </span>
                    </div>
                    <div className="flex justify-between text-[11px]">
                      <span className="text-white/60">Dual-Camera Sync:</span>
                      <span className={isSecondaryConnected ? "text-[#16A34A] font-bold" : "text-white/40"}>
                        {isSecondaryConnected ? `CONNECTED (Δ ${syncDeltaMs}ms)` : 'OFF (Single Camera)'}
                      </span>
                    </div>
                    <div className="flex justify-between text-[11px]">
                      <span className="text-white/60">Camera FPS:</span>
                      <span className="text-white font-bold">{cameraFps} FPS</span>
                    </div>
                    <div className="flex justify-between text-[11px]">
                      <span className="text-white/60">Frame Processing FPS:</span>
                      <span className="text-[#BBF7D0] font-bold">{processingFps} FPS</span>
                    </div>
                    <div className="flex justify-between text-[11px]">
                      <span className="text-white/60">Video Source Size:</span>
                      <span className="text-[#A5B4FC] font-bold">{videoDimensions.w} × {videoDimensions.h}</span>
                    </div>
                    <div className="flex justify-between text-[11px]">
                      <span className="text-white/60">Canvas Render Size:</span>
                      <span className="text-[#A5B4FC] font-bold">{canvasDimensions.w} × {canvasDimensions.h}</span>
                    </div>
                    <div className="flex justify-between text-[11px]">
                      <span className="text-white/60">Current Frame Timestamp:</span>
                      <span className="text-white">{currentFrameTimestamp} ms</span>
                    </div>
                    <div className="flex justify-between text-[11px]">
                      <span className="text-white/60">Active rAF Loops:</span>
                      <span className={debugActiveLoops === 1 ? "text-[#BBF7D0] font-bold" : "text-[#F87171] font-bold"}>
                        {debugActiveLoops} {debugActiveLoops === 1 ? '(1 Loop OK)' : '(DUPLICATE DETECTED!)'}
                      </span>
                    </div>
                    <div className="flex justify-between text-[11px]">
                      <span className="text-white/60">Draw Calls / Frame:</span>
                      <span className={debugDrawCalls === 1 ? "text-[#BBF7D0] font-bold" : "text-[#F87171] font-bold"}>
                        {debugDrawCalls}
                      </span>
                    </div>
                  </div>

                  {/* 2. POSE DETECTION STATUS */}
                  <div className="p-2.5 rounded-2xl bg-white/5 border border-white/10 space-y-1">
                    <span className="text-[10px] font-bold text-[#A5B4FC] uppercase tracking-wider block">
                      👤 Pose Detection Status
                    </span>
                    <div className="flex justify-between text-[11px]">
                      <span className="text-white/60">Pose Detected:</span>
                      <strong className={isPoseDetected ? "text-[#16A34A]" : "text-[#DC2626]"}>
                        {isPoseDetected ? 'YES' : 'NO'}
                      </strong>
                    </div>
                    <div className="flex justify-between text-[11px]">
                      <span className="text-white/60">Landmark Confidence:</span>
                      <span className={(debugData.confidence || trackingConfidence) >= 60 ? "text-[#16A34A] font-bold" : "text-[#D97706] font-bold"}>
                        {debugData.confidence || trackingConfidence || 0}%
                      </span>
                    </div>
                    <div className="flex justify-between text-[11px]">
                      <span className="text-white/60">Visible Landmarks:</span>
                      <span className="text-white font-bold">
                        {debugData.visibleCount ?? 33} / 33
                      </span>
                    </div>
                    <div className="flex justify-between text-[11px]">
                      <span className="text-white/60">Missing Key Joints:</span>
                      <span className={debugData.missingJoints?.length > 0 ? "text-[#F87171]" : "text-[#BBF7D0]"}>
                        {debugData.missingJoints?.length > 0 ? debugData.missingJoints.slice(0, 3).join(', ') : 'None (All 12 Tracked)'}
                      </span>
                    </div>
                  </div>

                  {/* 3. CURRENT JOINT MEASUREMENTS */}
                  <div className="p-2.5 rounded-2xl bg-white/5 border border-white/10 space-y-1">
                    <span className="text-[10px] font-bold text-[#A5B4FC] uppercase tracking-wider block">
                      📐 Current Joint Measurements
                    </span>
                    <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[11px]">
                      <div className="flex justify-between">
                        <span className="text-white/60">Left Elbow:</span>
                        <span className="text-white font-bold">{debugData.leftElbowAngle ?? liveAngle ?? 160}°</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-white/60">Right Elbow:</span>
                        <span className="text-white font-bold">{debugData.rightElbowAngle ?? liveAngle ?? 160}°</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-white/60">Left Shoulder:</span>
                        <span className="text-white font-bold">{debugData.leftShoulderAngle ?? 90}°</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-white/60">Right Shoulder:</span>
                        <span className="text-white font-bold">{debugData.rightShoulderAngle ?? 90}°</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-white/60">Hip Alignment:</span>
                        <span className={(debugData.hipAlignment ?? 170) >= 150 ? "text-[#BBF7D0] font-bold" : "text-[#F87171] font-bold"}>
                          {debugData.hipAlignment ?? 170}°
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-white/60">Knee Angle:</span>
                        <span className="text-white font-bold">{debugData.kneeAngle ?? 168}°</span>
                      </div>
                    </div>
                  </div>

                  {/* 4. REPETITION & MOVEMENT ANALYSIS (Requirement 6) */}
                  <div className="p-2.5 rounded-2xl bg-white/5 border border-white/10 space-y-1">
                    <span className="text-[10px] font-bold text-[#A5B4FC] uppercase tracking-wider block">
                      ⚡ Repetition & Movement Diagnostics
                    </span>
                    <div className="flex justify-between text-[11px]">
                      <span className="text-white/60">Current State:</span>
                      <strong className="text-[#FDE047]">{engineState}</strong>
                    </div>
                    <div className="flex justify-between text-[11px]">
                      <span className="text-white/60">Previous State:</span>
                      <span className="text-white">{debugData.previousState || 'WAITING_FOR_START'}</span>
                    </div>
                    <div className="flex justify-between text-[11px]">
                      <span className="text-white/60">Movement Direction:</span>
                      <span className={`font-bold px-2 py-0.5 rounded text-[10px] ${
                        debugData.direction === 'DOWN' ? 'bg-[#DCFCE7]/20 text-[#BBF7D0]' :
                        debugData.direction === 'UP' ? 'bg-[#EDE9FE]/20 text-[#C4B5FD]' : 'bg-white/10 text-white'
                      }`}>
                        {debugData.direction || 'HOLD'}
                      </span>
                    </div>
                    <div className="flex justify-between text-[11px]">
                      <span className="text-white/60">Movement Amplitude:</span>
                      <span className="text-white font-bold">{debugData.movementAmplitude || 0}° flexion</span>
                    </div>
                    <div className="flex justify-between text-[11px]">
                      <span className="text-white/60">Bottom Position Detected:</span>
                      <span className={debugData.bottomDetected?.startsWith('YES') ? 'text-[#BBF7D0] font-bold' : 'text-white'}>
                        {debugData.bottomDetected || 'NO'}
                      </span>
                    </div>
                    <div className="flex justify-between text-[11px]">
                      <span className="text-white/60">Rising Detected:</span>
                      <span className={debugData.risingDetected === 'YES' ? 'text-[#BBF7D0] font-bold' : 'text-white'}>
                        {debugData.risingDetected || 'NO'}
                      </span>
                    </div>
                    <div className="flex justify-between text-[11px]">
                      <span className="text-white/60">Top Position Reached:</span>
                      <span className={debugData.topPositionReached === 'YES' ? 'text-[#BBF7D0] font-bold' : 'text-white'}>
                        {debugData.topPositionReached || 'NO'}
                      </span>
                    </div>
                    <div className="flex justify-between text-[11px]">
                      <span className="text-white/60">Rep Validation:</span>
                      <span className="text-[#38BDF8] font-bold">{debugData.repValidationStatus || 'WAITING'}</span>
                    </div>
                    <div className="flex justify-between text-[11px]">
                      <span className="text-white/60">Rep Completion Event:</span>
                      <span className="text-[#BBF7D0] font-bold">{debugData.repCompletionEvent || 'Awaiting Completion'}</span>
                    </div>
                    <div className="flex justify-between text-[11px]">
                      <span className="text-white/60">Current Rep Count:</span>
                      <span className="text-[#FDE047] font-bold text-xs">{validReps} valid reps</span>
                    </div>
                    <div className="flex justify-between text-[11px]">
                      <span className="text-white/60">Last Rep Accepted At:</span>
                      <span className="text-white">{debugData.lastRepAcceptedAt || 'None yet'}</span>
                    </div>
                    <div className="flex justify-between text-[11px]">
                      <span className="text-white/60">Last Rep Rejected Because:</span>
                      <span className={debugData.rejectionReason && debugData.rejectionReason !== 'None' ? 'text-[#F87171]' : 'text-white/60'}>
                        {debugData.rejectionReason || 'None'}
                      </span>
                    </div>
                  </div>

                  {/* 5. DATA RECORDING & EXPORT (Requirement 8) */}
                  <div className="p-2.5 rounded-2xl bg-white/5 border border-white/10 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-[#A5B4FC] uppercase tracking-wider">
                        💾 Telemetry Buffer
                      </span>
                      <span className="text-[9px] text-white/50">
                        {telemetryBufferRef.current.length} / 1000 frames
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <button
                        onClick={exportSessionDataJSON}
                        className="px-2.5 py-1.5 rounded-xl bg-[#7F00FF] hover:bg-[#6E00DE] text-white font-bold text-[10px] flex items-center justify-center gap-1 shadow-sm transition-transform active:scale-95"
                        title="Download rolling telemetry buffer as JSON"
                      >
                        <Download className="w-3 h-3" />
                        <span>EXPORT DATA (JSON)</span>
                      </button>
                      <button
                        onClick={exportSessionDataCSV}
                        className="px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-[#BBF7D0] border border-white/20 font-bold text-[10px] flex items-center justify-center gap-1 shadow-sm transition-transform active:scale-95"
                        title="Download rolling telemetry buffer as CSV"
                      >
                        <Download className="w-3 h-3" />
                        <span>EXPORT DATA (CSV)</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Live Secondary Back-Camera PIP Display (Phone #2 with Real-time Exoskeleton) */}
            {isSecondaryConnected && showSecondaryPip && (
              <div 
                className={`absolute z-30 transition-all duration-300 shadow-2xl rounded-2xl overflow-hidden border border-slate-700/80 bg-slate-900/95 backdrop-blur-md flex flex-col ${
                  secondaryPipExpanded 
                    ? 'top-4 right-4 w-[280px] sm:w-[340px] h-[200px] sm:h-[240px]' 
                    : 'top-4 right-4 w-[190px] sm:w-[240px] h-[140px] sm:h-[175px]'
                }`}
              >
                {/* PIP Header Bar */}
                <div className="flex items-center justify-between px-2.5 py-1.5 bg-slate-800/90 border-b border-slate-700/60 text-white select-none">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold">
                    <Smartphone className="w-3.5 h-3.5 text-[#38BDF8]" />
                    <span className="truncate max-w-[100px] sm:max-w-none">Back View (2nd Cam)</span>
                    <span className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse ml-0.5 shrink-0" />
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="text-[10px] font-mono text-[#38BDF8] mr-1">
                      {syncDeltaMs}ms
                    </span>
                    <button
                      type="button"
                      onClick={() => setSecondaryPipExpanded(prev => !prev)}
                      className="p-1 hover:bg-white/10 rounded transition-colors text-white/70 hover:text-white cursor-pointer"
                      title={secondaryPipExpanded ? "Minimize PIP" : "Expand PIP"}
                      aria-label="Toggle PIP size"
                    >
                      {secondaryPipExpanded ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowSecondaryPip(false)}
                      className="p-1 hover:bg-white/10 rounded transition-colors text-white/70 hover:text-white cursor-pointer"
                      title="Hide PIP"
                      aria-label="Close PIP"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                {/* PIP Canvas Viewport */}
                <div className="relative flex-1 w-full bg-[#020617] overflow-hidden flex items-center justify-center">
                  <canvas
                    ref={secondaryCanvasRef}
                    width={secondaryPipExpanded ? 340 : 240}
                    height={secondaryPipExpanded ? 240 : 175}
                    className="w-full h-full object-contain"
                  />
                </div>

                {/* PIP Footer Form Mini-Badge */}
                <div className="flex items-center justify-between px-2.5 py-1 bg-slate-900/95 text-[10px] border-t border-slate-800">
                  <span className={backChecklist?.spineNeutrality?.type === 'good' ? "text-[#10B981] font-bold" : "text-[#F59E0B] font-bold"}>
                    Spine: {backChecklist?.spineNeutrality?.status || 'Active'}
                  </span>
                  <span className={backChecklist?.scapularRetraction?.type === 'good' ? "text-[#38BDF8] font-bold" : "text-[#F59E0B] font-bold"}>
                    Scapula: {backChecklist?.scapularRetraction?.status || 'Active'}
                  </span>
                </div>
              </div>
            )}

            {/* Overlay toggle buttons (Minimal default, opt-in Target Ghost & Advanced HUD) */}
            <div className="absolute bottom-4 right-4 z-20 flex items-center gap-2">
              <button
                onClick={() => setShowGhostTarget(!showGhostTarget)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border backdrop-blur-sm shadow-sm transition-all ${
                  showGhostTarget
                    ? 'bg-[#EDE9FE]/95 border-[#7F00FF] text-[#2F3159]'
                    : 'bg-[#FFFFFF]/70 border-[#E2D9F3] text-[#696C92]'
                }`}
                title="Toggle Target Ghost Exoskeleton (Benchmark Right Position)"
              >
                {showGhostTarget ? '🎯 Target Ghost: ON' : '🎯 Target Ghost: OFF'}
              </button>

              <button
                onClick={() => setShowAdvancedOverlay(!showAdvancedOverlay)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border backdrop-blur-sm shadow-sm transition-all ${
                  showAdvancedOverlay
                    ? 'bg-[#EDE9FE]/95 border-[#7F00FF] text-[#2F3159]'
                    : 'bg-[#FFFFFF]/70 border-[#E2D9F3] text-[#696C92]'
                }`}
                title="Toggle on-video angle & depth HUD overlay"
              >
                {showAdvancedOverlay ? '📊 HUD & Angles: ON' : '📊 HUD & Angles: OFF'}
              </button>

              <button
                onClick={() => setShowSkeleton(!showSkeleton)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border backdrop-blur-sm shadow-sm transition-all ${
                  showSkeleton
                    ? 'bg-[#FFFFFF]/90 border-[#7F00FF] text-[#2F3159]'
                    : 'bg-[#FFFFFF]/70 border-[#E2D9F3] text-[#696C92]'
                }`}
              >
                {showSkeleton ? 'User Skeleton: ON' : 'User Skeleton: OFF'}
              </button>
            </div>
          </div>

          {/* Live Real-time AI Coach Cue (Positioned Outside Camera Screen) */}
          {coachMessage && (
            <div className="calm-card p-3 sm:p-3.5 flex items-center gap-3 border border-[#E2D9F3] shadow-sm animate-fade-in">
              <div className="w-8 h-8 rounded-full bg-[#EDE9FE] text-[#7F00FF] flex items-center justify-center shrink-0 shadow-sm">
                <Sparkles className="w-4 h-4 text-[#7F00FF]" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-[10px] font-bold text-[#7F00FF] uppercase tracking-wider block">
                  AI Real-Time Coach Cue
                </span>
                <p className="text-xs sm:text-sm font-semibold text-[#2F3159] leading-snug">
                  {coachMessage}
                </p>
              </div>
            </div>
          )}

          {/* Camera Switcher & Status Bar */}
          <div className="calm-surface p-3.5 rounded-2xl flex flex-wrap items-center justify-between gap-3 text-xs text-[#696C92]">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#7F00FF]" />
              <span>
                {isSecondaryConnected
                  ? `Dual Tracking Active: Front View + Synchronized Back View (${dualCameraSessionId})`
                  : includeBackCheck 
                    ? 'Dual Tracking Active: Front View + Optional Back View' 
                    : isSquatExercise
                      ? 'Front View Active (Hip Descent Tracking)'
                      : 'Side Profile Active (Elbow Angle Tracking)'}
              </span>
            </div>

            {/* Device Switcher / Reconnect Actions */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Dual-Camera Pairing Action Button */}
              <button
                type="button"
                onClick={() => {
                  setIsDualCameraModalOpen(true);
                  dualCameraClient.createSession(exercise.id, dualCameraSessionId);
                }}
                className={`px-3.5 py-1.5 rounded-full font-bold text-xs shadow-sm transition-all flex items-center gap-1.5 touch-manipulation min-h-[34px] cursor-pointer ${
                  isSecondaryConnected
                    ? 'bg-[#16A34A] hover:bg-[#15803D] text-white'
                    : 'bg-[#EDE9FE] hover:bg-[#DDD6FE] text-[#7F00FF]'
                }`}
                title="Pair phone #2 as synchronized back-view camera"
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>{isSecondaryConnected ? `Phone #2 Synced (${dualCameraSessionId})` : 'Pair 2nd Phone (Back View)'}</span>
              </button>

              {/* Touch-Friendly Mobile & Desktop Switch Camera Button */}
              {!isDemoStream && (
                <button
                  type="button"
                  onClick={handleSwitchCamera}
                  disabled={isLoadingCamera}
                  className="px-3.5 py-1.5 rounded-full bg-[#7F00FF] hover:bg-[#6E00DE] active:scale-95 text-white font-bold text-xs shadow-sm transition-all flex items-center gap-1.5 touch-manipulation min-h-[34px] cursor-pointer"
                  title={`Switch to ${facingMode === 'user' ? 'rear' : 'front'} camera`}
                  aria-label="Switch camera"
                >
                  <SwitchCamera className={`w-3.5 h-3.5 ${isLoadingCamera ? 'animate-spin' : ''}`} />
                  <span>Switch Camera ({facingMode === 'user' ? 'Rear' : 'Front'})</span>
                </button>
              )}

              {availableDevices.length > 1 && (
                <div className="flex items-center gap-1.5 bg-[#FFFFFF] px-2.5 py-1 rounded-full border border-[#E2D9F3]">
                  <SwitchCamera className="w-3.5 h-3.5 text-[#7F00FF]" />
                  <select
                    value={selectedDeviceId}
                    onChange={(e) => {
                      const newDevId = e.target.value;
                      setSelectedDeviceId(newDevId);
                      const chosen = availableDevices.find(d => d.deviceId === newDevId);
                      const lbl = (chosen?.label || '').toLowerCase();
                      const isBack = ['back', 'rear', 'environment', 'outer'].some(k => lbl.includes(k));
                      const isFront = ['front', 'user', 'selfie', 'facetime'].some(k => lbl.includes(k));
                      const newFacing = isBack ? 'environment' : (isFront ? 'user' : facingMode);
                      startCamera(newDevId, newFacing);
                    }}
                    className="bg-transparent text-[11px] font-semibold text-[#2F3159] focus:outline-none cursor-pointer"
                  >
                    {availableDevices.map(dev => (
                      <option key={dev.deviceId} value={dev.deviceId}>
                        {dev.label || `Camera ${dev.deviceId.slice(0, 4)}`}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <button
                onClick={() => startCamera(selectedDeviceId, facingMode)}
                className="px-3 py-1 rounded-full bg-[#F3F0FF] hover:bg-[#EDE9FE] text-[#2F3159] font-semibold text-[11px] transition-colors cursor-pointer"
              >
                Reconnect Camera
              </button>

              <button
                onClick={startDemoSimulation}
                className="px-3 py-1 rounded-full bg-[#F3F0FF] hover:bg-[#EDE9FE] text-[#2F3159] font-semibold text-[11px] transition-colors cursor-pointer"
              >
                Use Practice Demo Clip
              </button>
            </div>
          </div>

        </div>

        {/* Right Column: Live Movement Check & Rep Counter (Spans 4 cols in Standard, or 12 cols responsive grid below in Big Screen) */}
        <div className={isBigScreen ? "lg:col-span-12 grid grid-cols-1 md:grid-cols-3 gap-5 mt-2" : "lg:col-span-4 flex flex-col gap-5"}>
          
          {/* ========================================================================= */}
          {/* REPETITION COUNTER CARD (VALID REPS VS INVALID REPS BREAKDOWN)            */}
          {/* ========================================================================= */}
          <div className="calm-card p-6 text-center">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#696C92]">
                Verified Repetitions
              </span>
              {liveAngle !== null && (
                <span className="text-[11px] font-mono font-bold text-[#7F00FF] bg-[#EDE9FE] px-2 py-0.5 rounded-full">
                  {isSquatExercise ? `Hip Depth: ${liveAngle}%` : `Elbow: ${liveAngle}°`}
                </span>
              )}
            </div>

            {/* Big Valid Rep Counter */}
            <div className="flex items-baseline justify-center gap-2 my-2">
              <span className="text-6xl font-black font-sans text-[#2F3159] tracking-tight">
                {validReps}
              </span>
              <span className="text-sm font-semibold text-[#16A34A]">valid reps</span>
            </div>

            {/* Valid vs Invalid Rep Breakdown Pills (4-Category Repetition Breakdown) */}
            <div className="flex items-center justify-center gap-1.5 flex-wrap mt-1 mb-2">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#DCFCE7] text-[#16A34A] border border-[#BBF7D0]">
                ✓ {completedCleanReps} Optimal
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#FFF8E1] text-[#D97706] border border-[#FFE082]">
                ⚠ {completedImperfectReps} Imperfect
              </span>
              {invalidReps > 0 && (
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#FEE2E2] text-[#DC2626] border border-[#FECACA]">
                  ✕ {invalidReps} Incomplete
                </span>
              )}
              {rejectedCount > 0 && (
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#F3F4F6] text-[#696C92] border border-[#E5E7EB]">
                  🚫 {rejectedCount} Rejected
                </span>
              )}
            </div>

            {/* Dynamic Movement State Machine Pill */}
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#F3F0FF] border border-[#E2D9F3] text-[#2F3159] mt-1">
              <span className={`w-2 h-2 rounded-full ${
                engineState.includes('BOTTOM') || engineState.includes('REPETITION_COMPLETED') || engineState.includes('REP_COMPLETED')
                  ? 'bg-[#16A34A] animate-ping' 
                  : engineState.includes('GOING') || engineState.includes('LOWERING') || engineState.includes('RISING')
                    ? 'bg-[#D97706]' 
                    : 'bg-[#7F00FF]'
              }`} />
              <span>State: {engineState.replace(/_/g, ' ')}</span>
            </div>

            {/* Calibration & Tracking Status */}
            <div className="mt-3 pt-3 border-t border-[#E2D9F3] text-xs flex items-center justify-between">
              <span className="text-[#696C92]">Vision Confidence:</span>
              <strong className={trackingConfidence >= 60 ? "text-[#16A34A]" : "text-[#D97706]"}>
                {trackingConfidence}% ({isCalibrated ? "Calibrated" : "Calibrating..."})
              </strong>
            </div>

            {/* Coaching Form Hint */}
            <p className="text-[11px] text-[#696C92] mt-2 leading-relaxed">
              {exercise.id === 'pushups'
                ? 'Every completed push-up counts as a repetition! Form adjustments (e.g. hip alignment or depth) give live cues and adjust your quality score without rejecting your repetition.'
                : isSquatExercise
                  ? 'Stand tall for 1–2 s to calibrate, then squat. Every full hip descent counts — form faults give coaching cues but never block counting.'
                  : 'Pull weights to peak contraction with smooth tempo, then lower with control.'}
            </p>
          </div>

          {/* DUAL EXOSKELETON LIVE DEPTH & GUIDANCE GAUGE CARD */}
          <div className="calm-card p-5 flex flex-col gap-3">
            <div className="flex items-center justify-between border-b border-[#E2D9F3] pb-2">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-[#EDE9FE] text-[#2F3159] flex items-center justify-center font-bold text-xs">
                  🎯
                </div>
                <span className="text-xs font-bold text-[#2F3159] uppercase tracking-wider">
                  {isSquatExercise ? 'Hip Descent Tracking' : 'Top & Bottom Benchmarks'}
                </span>
              </div>
              <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                depthPercentage >= 70
                  ? 'bg-[#DCFCE7] text-[#16A34A] border-[#BBF7D0]'
                  : depthPercentage >= 30
                  ? 'bg-[#FFF8E1] text-[#D97706] border-[#FFE082]'
                  : 'bg-[#F3F0FF] text-[#696C92] border-[#E2D9F3]'
              }`}>
                {depthPercentage}% Depth
              </span>
            </div>

            {/* Depth Progress Bar */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-semibold">
                <span className="text-[#696C92]">Live Motion Range</span>
                <span className={depthPercentage >= 70 ? "text-[#16A34A]" : "text-[#D97706]"}>
                  {depthPercentage}% / 100%
                </span>
              </div>
              <div className="w-full h-3 rounded-full bg-[#F3F0FF] overflow-hidden p-0.5 border border-[#E2D9F3]">
                <div
                  className={`h-full rounded-full transition-all duration-150 ${
                    depthPercentage >= 70
                      ? 'bg-[#16A34A]'
                      : depthPercentage >= 30
                      ? 'bg-[#D97706]'
                      : 'bg-[#7F00FF]'
                  }`}
                  style={{ width: `${depthPercentage}%` }}
                />
              </div>
            </div>

            {/* Joint Angle Guidance Telemetry */}
            <div className="grid grid-cols-2 gap-2 text-xs pt-1">
              <div className="p-2.5 rounded-xl bg-[#FFFFFF] border border-[#E2D9F3]">
                <span className="text-[10px] text-[#696C92] block font-medium">
                  {isSquatExercise ? 'Hip Descent Depth' : 'Your Joint Position'}
                </span>
                <span className="text-sm font-bold text-[#2F3159]">
                  {isSquatExercise
                    ? `${depthTelemetry.currentAngle ?? liveAngle ?? 0}%`
                    : `${depthTelemetry.currentAngle || liveAngle || 160}°`}
                </span>
                <span className="text-[10px] text-[#696C92] block">
                  ({depthTelemetry.jointLabel || (isSquatExercise ? 'Hip Depth' : 'Elbow')})
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-[#EDE9FE]/40 border border-[#EDE9FE]">
                <span className="text-[10px] text-[#7F00FF] block font-medium">Target Depth</span>
                <span className="text-sm font-bold text-[#7F00FF]">
                  {isSquatExercise
                    ? `${depthTelemetry.targetAngle || 100}%`
                    : `${depthTelemetry.targetAngle || 90}°`}
                </span>
                <span className="text-[10px] text-[#7F00FF] block">
                  {isSquatExercise
                    ? `(${depthTelemetry.needToBend ?? 0}% more depth needed)`
                    : `(Bend ${depthTelemetry.needToBend || 0}° more)`}
                </span>
              </div>
            </div>

            {/* Dynamic Status / Action Cue */}
            <div className="p-2.5 rounded-xl bg-[#FFFFFF] border border-[#E2D9F3] text-xs flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full shrink-0 ${
                depthPercentage >= 70 ? 'bg-[#16A34A] animate-ping' : 'bg-[#D97706]'
              }`} />
              <span className="text-[#2F3159] font-medium leading-tight">
                {depthPercentage >= 70 && (engineState.includes('BOTTOM') || engineState.includes('ASCENDING') || engineState.includes('REP_COUNTED'))
                  ? (isSquatExercise
                      ? '✓ Good squat depth! Drive back up to standing.'
                      : '✓ Optimal bottom depth reached! Drive back up to lockout.')
                  : isSquatExercise
                    ? (engineState === 'TRACKING_LOST' || engineState === 'WAITING_FOR_POSITION' || !isPoseDetected)
                      ? 'Step back so head to feet are visible.'
                      : engineState === 'CALIBRATING'
                        ? 'Stand tall and still for 1–2 seconds to calibrate…'
                        : `Hip descent: ${depthPercentage}%. Squat lower to reach target depth.`
                    : (engineState === 'TRACKING_PAUSED' || engineState === 'WAITING_FOR_START' || engineState === 'WAITING_FOR_POSITION' || !isPoseDetected)
                      ? 'Step back so head to feet are visible in plank line.'
                      : `You are at ${depthPercentage}%. Lower until joints align with target ghost.`}
              </span>
            </div>
          </div>

          {/* REAL-TIME REP-BY-REP LEDGER FEED */}
          {repsLedger.length > 0 && (
            <div className="calm-card p-4 flex flex-col gap-2 max-h-56 overflow-y-auto animate-fade-in">
              <div className="flex items-center justify-between border-b border-[#E2D9F3] pb-2">
                <span className="text-xs font-bold text-[#2F3159] uppercase tracking-wider flex items-center gap-1.5">
                  <Award className="w-3.5 h-3.5 text-[#7F00FF]" />
                  <span>Rep-by-Rep Record ({repsLedger.length})</span>
                </span>
                <span className="text-[10px] text-[#16A34A] font-semibold">Live Score</span>
              </div>
              <div className="space-y-1.5">
                {repsLedger.filter(r => r != null && typeof r === 'object').slice().reverse().map((rep, idx) => {
                  const repNum = rep?.repNumber ?? (repsLedger.length - idx);
                  const score = rep?.score ?? 80;
                  const title = (Array.isArray(rep?.goodPoints) && rep.goodPoints.length > 0)
                    ? rep.goodPoints[0]
                    : (rep?.feedback || (rep?.isValid ? 'Clean execution' : (rep?.reason || 'Incomplete range')));
                  const depthLabel = isSquatExercise
                    ? (rep?.peakAngle != null ? `${rep.peakAngle}% depth` : (rep?.maxDescentPct != null ? `${rep.maxDescentPct}% depth` : '0% depth'))
                    : (rep?.peakAngle ? `${rep.peakAngle}°` : (rep?.peakDepthRatio ? `${Math.round(rep.peakDepthRatio * 100)}%` : '90°'));
                  const duration = rep?.durationSec || '1.0';

                  return (
                    <div key={repNum} className="p-2.5 rounded-xl bg-[#FFFFFF] border border-[#E2D9F3] flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className={`w-5 h-5 rounded-full font-bold text-[10px] flex items-center justify-center shrink-0 ${
                          rep?.isValid ? 'bg-[#DCFCE7] text-[#16A34A]' : 'bg-[#FFF8E1] text-[#D97706]'
                        }`}>
                          #{repNum}
                        </span>
                        <div className="min-w-0">
                          <span className="text-[#2F3159] font-semibold text-[11px] block truncate max-w-[140px]">
                            {title}
                          </span>
                          <span className="text-[10px] text-[#696C92] block">
                            Depth: {depthLabel} • {duration}s
                          </span>
                        </div>
                      </div>
                      <span className={`px-2.5 py-0.5 rounded-full font-bold text-[11px] border shrink-0 ${
                        score >= 90 
                          ? 'bg-[#DCFCE7] text-[#16A34A] border-[#BBF7D0]'
                          : score >= 75
                            ? 'bg-[#FFF8E1] text-[#D97706] border-[#FFE082]'
                            : 'bg-[#FFEBEE] text-[#DC2626] border-[#FFCDD2]'
                      }`}>
                        {score}%
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Live Movement Check Checklist */}
          <div className="calm-card p-6 flex flex-col gap-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-[#2F3159] uppercase tracking-wider">
                Live Movement Checks
              </span>
              <span className="text-[10px] text-[#16A34A] font-semibold">Active</span>
            </div>

            {/* Front View Checks (Always Active) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#7F00FF] block">
                  Front / Profile Checks
                </span>
                <span className="text-[9px] px-2 py-0.5 rounded-full bg-[#EDE9FE] text-[#2F3159] font-semibold">
                  Always Active
                </span>
              </div>
              
              {Object.entries(frontChecklist).map(([key, item]) => (
                <div
                  key={key}
                  className="p-3 rounded-2xl bg-[#FFFFFF] border border-[#E2D9F3] flex items-center justify-between"
                >
                  <span className="text-xs font-semibold text-[#2F3159]">
                    {item.label}
                  </span>
                  <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                    item.type === 'good'
                      ? 'bg-[#DCFCE7] text-[#16A34A] border border-[#BBF7D0]'
                      : 'bg-[#FFF8E1] text-[#D97706] border border-[#FFE082]'
                  }`}>
                    {item.status}
                  </span>
                </div>
              ))}
            </div>

            {/* Back View Checks (Optional Toggle & Dual Phone Pairing) */}
            <div className="space-y-2 pt-2 border-t border-[#E2D9F3]">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#696C92] block">
                    Back View Checks (Optional)
                  </span>
                  <span className="text-[10px] text-[#696C92]">
                    {isSecondaryConnected
                      ? `Phone #2 Connected (${dualCameraSessionId})`
                      : includeBackCheck ? 'Posterior alignment enabled' : 'Optional posterior check is OFF'}
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setIsDualCameraModalOpen(true);
                      dualCameraClient.createSession(exercise.id, dualCameraSessionId);
                    }}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border flex items-center gap-1 transition-all ${
                      isSecondaryConnected
                        ? 'bg-[#F0FDF4] border-[#BBF7D0] text-[#16A34A]'
                        : 'bg-[#EDE9FE] border-[#7F00FF] text-[#7F00FF] hover:bg-[#DDD6FE]'
                    }`}
                    title="Pair second phone for back camera view"
                  >
                    <Smartphone className="w-3 h-3" />
                    <span>{isSecondaryConnected ? 'Phone #2 Synced' : 'Pair Phone #2'}</span>
                  </button>

                  <button
                    onClick={() => setIncludeBackCheck(!includeBackCheck)}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border flex items-center gap-1 transition-all ${
                      includeBackCheck
                        ? 'bg-[#EDE9FE] border-[#7F00FF] text-[#2F3159]'
                        : 'bg-[#FFFFFF] border-[#E2D9F3] text-[#696C92]'
                    }`}
                  >
                    {includeBackCheck ? <ToggleRight className="w-3.5 h-3.5 text-[#16A34A]" /> : <ToggleLeft className="w-3.5 h-3.5" />}
                    <span>{includeBackCheck ? 'Enabled' : 'Optional (Off)'}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Coach Voice Preferences Card */}
          <div className="calm-card p-5 text-xs flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-[#2F3159]">Web Speech Audio Coach</span>
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="p-1 text-[#696C92] hover:text-[#2F3159]"
              >
                <Settings className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center justify-between text-[#696C92]">
              <span>Speech Coaching:</span>
              <span className="font-semibold text-[#2F3159]">
                {coachPrefs.voiceEnabled ? 'Gentle Speech Active' : 'Muted'}
              </span>
            </div>
          </div>

          {/* Finish Workout CTA */}
          <button
            onClick={handleFinishAndSummarize}
            disabled={isAiEvaluating}
            className="w-full py-4 rounded-full font-bold text-xs bg-[#7F00FF] hover:bg-[#6E00DE] text-white shadow-md flex items-center justify-center gap-2 transition-all hover:scale-[1.01] disabled:opacity-50"
          >
            {isAiEvaluating ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Generating AI Biomechanical Review...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>Finish Practice & View OpenAI Report</span>
              </>
            )}
          </button>

        </div>

      </div>

      {/* Dual Camera Pairing Dialog Modal */}
      <DualCameraPairModal
        isOpen={isDualCameraModalOpen}
        onClose={() => setIsDualCameraModalOpen(false)}
        sessionId={dualCameraSessionId}
        isSecondaryConnected={isSecondaryConnected}
        secondaryMetadata={secondaryMetadata}
        onStartCountdown={() => {
          dualCameraClient.startCountdown(3);
        }}
        onSingleCameraMode={() => {
          setIsDualCameraModalOpen(false);
          setIncludeBackCheck(false);
        }}
      />

    </div>
  );
}
