import React, { useRef, useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { 
  Play, Pause, RotateCcw, Volume2, VolumeX, Eye, EyeOff, Activity 
} from 'lucide-react';
import { drawSkeletonOnCanvas } from '../utils/skeletonRenderer';
import { generateKinematicLandmarks, detectPoseForVideoFrame } from '../utils/poseDetection';

const VideoPlayer = forwardRef(function VideoPlayer({
  src,
  title = "Video Player",
  exerciseId = "weighted-squats",
  isUserWithError = false,
  showSkeletonDefault = true,
  onTimeUpdateSync,
  highlightedJoints = [],
  watermarkBadge = null,
  accentColor = "#16A34A",
  autoPlay = false,
  timeline = null
}, ref) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const animFrameRef = useRef(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isMuted, setIsMuted] = useState(true);
  const [showSkeleton, setShowSkeleton] = useState(showSkeletonDefault);
  const [isLooping, setIsLooping] = useState(true);
  const [engineMode, setEngineMode] = useState('CALIBRATED');

  useImperativeHandle(ref, () => ({
    play: () => videoRef.current?.play(),
    pause: () => videoRef.current?.pause(),
    seek: (time) => {
      if (videoRef.current) {
        videoRef.current.currentTime = time;
      }
    },
    setSpeed: (rate) => {
      if (videoRef.current) {
        videoRef.current.playbackRate = rate;
        setPlaybackRate(rate);
      }
    },
    videoElement: videoRef.current
  }));

  // Render loop to draw pose skeleton & angles synchronized with video frame
  useEffect(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const ctx = canvas.getContext('2d');

    const renderOverlay = () => {
      if (canvas.width !== video.clientWidth || canvas.height !== video.clientHeight) {
        canvas.width = video.clientWidth || 640;
        canvas.height = video.clientHeight || 480;
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (showSkeleton && video.readyState >= 2) {
        const dur = video.duration || 4;
        const normProgress = (video.currentTime % dur) / dur;
        let landmarksToDraw = null;

        // 1. Prefer analyzed timeline landmarks matching current video playback time
        if (timeline && timeline.length > 0) {
          const t = video.currentTime;
          let closest = timeline[0];
          let minDiff = Math.abs(timeline[0].timestamp - t);
          for (let i = 1; i < timeline.length; i++) {
            const diff = Math.abs(timeline[i].timestamp - t);
            if (diff < minDiff) {
              minDiff = diff;
              closest = timeline[i];
            }
          }
          if (closest && closest.landmarks) {
            landmarksToDraw = closest.landmarks;
            setEngineMode('TRACKED');
          }
        }

        // 2. Fallback to live frame detection if timeline not provided
        if (!landmarksToDraw) {
          const liveDetection = detectPoseForVideoFrame(video, video.currentTime * 1000);
          if (liveDetection && liveDetection.landmarks) {
            landmarksToDraw = liveDetection.landmarks;
            setEngineMode('LIVE');
          } else {
            landmarksToDraw = generateKinematicLandmarks(exerciseId, normProgress, isUserWithError);
            setEngineMode('CALIBRATED');
          }
        }

        drawSkeletonOnCanvas(ctx, landmarksToDraw, {
          accentColor: accentColor || '#7F00FF',
          dangerColor: '#DC2626',
          warningColor: '#D97706',
          highlightedJoints: highlightedJoints,
          exerciseId: exerciseId,
          showAngles: false,
          showDualExoskeleton: false,
          showGhostTarget: false,
          showDepthHUD: false,
          isMirrored: false
        });
      }

      animFrameRef.current = requestAnimationFrame(renderOverlay);
    };

    animFrameRef.current = requestAnimationFrame(renderOverlay);

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [showSkeleton, exerciseId, isUserWithError, highlightedJoints, accentColor, timeline]);

  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    const curr = videoRef.current.currentTime;
    setCurrentTime(curr);
    if (onTimeUpdateSync) {
      onTimeUpdateSync(curr, videoRef.current.duration || 1);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration || 4);
      if (autoPlay) {
        videoRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
      }
    }
  };

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      videoRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
    }
  };

  const handleSeek = (e) => {
    const newTime = parseFloat(e.target.value);
    if (videoRef.current) {
      videoRef.current.currentTime = newTime;
      setCurrentTime(newTime);
      if (onTimeUpdateSync) {
        onTimeUpdateSync(newTime, duration);
      }
    }
  };

  const handleSpeedChange = (rate) => {
    if (videoRef.current) {
      videoRef.current.playbackRate = rate;
      setPlaybackRate(rate);
    }
  };

  const handleRestart = () => {
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.play();
      setIsPlaying(true);
    }
  };

  const formatTime = (secs) => {
    if (isNaN(secs)) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="relative rounded-2xl overflow-hidden bg-[#FFFFFF] border border-[#E2D9F3] shadow-sm group flex flex-col">
      {/* Top Header */}
      <div className="px-4 py-3 border-b border-[#E2D9F3] flex items-center justify-between bg-[#FFFFFF] z-20">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-[#7F00FF]" />
          <span className="text-xs font-semibold text-[#2F3159] tracking-wide">{title}</span>
        </div>

        {/* Status Badges */}
        <div className="flex items-center gap-2">
          {watermarkBadge && (
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-[#EDE9FE] text-[#2F3159]">
              {watermarkBadge}
            </span>
          )}
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-[#E5F0F5] text-[#2F3159] flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#7F00FF]" />
            {engineMode === 'LIVE' ? 'MediaPipe Live' : 'AI Pose Guide'}
          </span>
        </div>
      </div>

      {/* Main Video Viewport with Canvas Overlay */}
      <div className="relative aspect-video w-full bg-[#F3F0FF] flex items-center justify-center overflow-hidden">
        <video
          ref={videoRef}
          src={src}
          className="w-full h-full object-contain"
          playsInline
          muted={isMuted}
          loop={isLooping}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onEnded={() => setIsPlaying(false)}
        />

        {/* Dynamic Skeleton Canvas Overlay */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full pointer-events-none z-10"
        />

        {/* Soft Center Play Button when paused */}
        {!isPlaying && (
          <button
            onClick={togglePlay}
            className="absolute z-20 w-14 h-14 rounded-full bg-[#7F00FF] hover:bg-[#6E00DE] text-white flex items-center justify-center shadow-lg hover:scale-105 transition-all"
            aria-label="Play video"
          >
            <Play className="w-6 h-6 fill-white ml-0.5" />
          </button>
        )}
      </div>

      {/* Control Toolbar */}
      <div className="p-3 bg-[#FFFFFF] border-t border-[#E2D9F3] flex flex-col gap-2 z-20">
        
        {/* Scrubber */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono text-[#696C92] w-9 text-right">
            {formatTime(currentTime)}
          </span>
          <input
            type="range"
            min="0"
            max={duration || 1}
            step="0.05"
            value={currentTime}
            onChange={handleSeek}
            className="flex-1 h-1.5 bg-[#E2D9F3] rounded-lg appearance-none cursor-pointer accent-[#7F00FF]"
          />
          <span className="text-[11px] font-mono text-[#696C92] w-9">
            {formatTime(duration)}
          </span>
        </div>

        {/* Controls Row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <button
              onClick={togglePlay}
              className="p-1.5 rounded-lg bg-[#F3F0FF] hover:bg-[#EDE9FE] text-[#2F3159] transition-colors"
              title={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current" />}
            </button>

            <button
              onClick={handleRestart}
              className="p-1.5 rounded-lg bg-[#F3F0FF] hover:bg-[#EDE9FE] text-[#2F3159] transition-colors"
              title="Replay from start"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            {/* Slow Motion Controls */}
            <div className="flex items-center gap-1 ml-2 bg-[#F3F0FF] p-0.5 rounded-lg border border-[#E2D9F3]">
              {[0.5, 0.75, 1.0].map((rate) => (
                <button
                  key={rate}
                  onClick={() => handleSpeedChange(rate)}
                  className={`px-2 py-0.5 text-[10px] font-semibold rounded ${
                    playbackRate === rate
                      ? 'bg-[#7F00FF] text-white'
                      : 'text-[#696C92] hover:text-[#2F3159]'
                  }`}
                >
                  {rate}x
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSkeleton(!showSkeleton)}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border transition-all ${
                showSkeleton
                  ? 'bg-[#EDE9FE] border-[#7F00FF] text-[#2F3159]'
                  : 'bg-[#F3F0FF] border-[#E2D9F3] text-[#696C92]'
              }`}
              title="Toggle AI Pose Skeleton"
            >
              {showSkeleton ? <Eye className="w-3.5 h-3.5 text-[#16A34A]" /> : <EyeOff className="w-3.5 h-3.5" />}
              <span>Skeleton</span>
            </button>

            <button
              onClick={() => setIsMuted(!isMuted)}
              className="p-1.5 rounded-lg bg-[#F3F0FF] hover:bg-[#EDE9FE] text-[#2F3159] transition-colors"
              title={isMuted ? "Unmute" : "Mute"}
            >
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
});

export default VideoPlayer;
