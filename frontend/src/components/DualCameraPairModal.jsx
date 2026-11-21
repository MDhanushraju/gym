import React, { useState, useEffect } from 'react';
import { 
  X, Smartphone, QrCode, Copy, Check, ShieldCheck, 
  RefreshCw, CheckCircle2, ArrowRight, Video, Wifi, AlertCircle 
} from 'lucide-react';
import QRCode from 'qrcode';

export default function DualCameraPairModal({
  isOpen,
  onClose,
  sessionId,
  isSecondaryConnected,
  secondaryMetadata,
  onStartCountdown,
  onSingleCameraMode
}) {
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const isLocalhost = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

  // Generate join URL for phone #2
  const joinUrl = typeof window !== 'undefined'
    ? `${window.location.origin}${window.location.pathname}?join=${sessionId}`
    : `https://formfit.app/?join=${sessionId}`;

  useEffect(() => {
    if (sessionId) {
      QRCode.toDataURL(joinUrl, {
        width: 220,
        margin: 2,
        color: {
          dark: '#2F3159',
          light: '#FFFFFF'
        }
      })
        .then(url => setQrDataUrl(url))
        .catch(err => console.warn('QR code generation error:', err));
    }
  }, [sessionId, joinUrl]);

  if (!isOpen) return null;

  const handleCopyCode = () => {
    if (!sessionId) return;
    navigator.clipboard?.writeText(sessionId).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0F1020]/70 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-lg bg-[#FFFFFF] rounded-3xl p-6 sm:p-8 shadow-2xl border border-[#E2D9F3] text-[#2F3159]">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-full hover:bg-[#F3F0FF] text-[#696C92] transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-2xl bg-[#EDE9FE] text-[#7F00FF] flex items-center justify-center shrink-0">
            <Smartphone className="w-5 h-5 text-[#7F00FF]" />
          </div>
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#7F00FF] block">
              Dual-Perspective Coaching
            </span>
            <h2 className="text-xl sm:text-2xl font-extrabold text-[#2F3159] tracking-tight">
              Pair Second Camera (Back View)
            </h2>
          </div>
        </div>

        {/* Instructions */}
        <p className="text-xs text-[#696C92] mb-4 leading-relaxed">
          Position your second phone behind you to monitor spine lateral tilt, scapular retraction, and lumbar alignment.
          MediaPipe runs locally on both devices — <strong>no video is ever transmitted</strong>.
        </p>

        {isLocalhost && (
          <div className="mb-4 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-[11px] leading-relaxed flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <strong>Localhost Notice:</strong> Your phone cannot reach <code>localhost</code>. To test between two devices on the same Wi-Fi, open this app on your computer using your network IP (e.g. <code>http://192.168.0.105:5173</code>) or use your hosted GitHub Pages URL.
            </div>
          </div>
        )}

        {/* QR Code & Join Code Section */}
        <div className="bg-[#FAF9FF] p-5 rounded-2xl border border-[#EDE9FE] mb-6 flex flex-col sm:flex-row items-center gap-6 justify-center">
          
          {/* QR Code Canvas */}
          <div className="bg-white p-2.5 rounded-2xl shadow-sm border border-[#E2D9F3] flex flex-col items-center">
            {qrDataUrl ? (
              <img src={qrDataUrl} alt="Pairing QR Code" className="w-36 h-36 rounded-xl" />
            ) : (
              <div className="w-36 h-36 flex items-center justify-center bg-gray-50 rounded-xl">
                <RefreshCw className="w-6 h-6 text-[#7F00FF] animate-spin" />
              </div>
            )}
            <span className="text-[10px] font-semibold text-[#696C92] mt-1.5 flex items-center gap-1">
              <QrCode className="w-3 h-3 text-[#7F00FF]" /> Scan with Phone #2
            </span>
          </div>

          {/* Join Code Display */}
          <div className="flex flex-col items-center sm:items-start space-y-2 text-center sm:text-left">
            <span className="text-[11px] font-bold text-[#696C92] uppercase tracking-wider">
              Or Enter Join Code:
            </span>
            <div className="px-5 py-2.5 rounded-2xl bg-[#FFFFFF] border-2 border-[#7F00FF] font-mono text-2xl font-black text-[#7F00FF] shadow-sm tracking-widest">
              {sessionId || 'GENERATING...'}
            </div>
            <button
              onClick={handleCopyCode}
              disabled={!sessionId}
              className="px-3.5 py-1.5 rounded-full bg-[#EDE9FE] hover:bg-[#DDD6FE] text-[#7F00FF] text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-[#16A34A]" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Code Copied!' : 'Copy Join Code'}</span>
            </button>
          </div>
        </div>

        {/* Connection Status Box */}
        <div className={`p-4 rounded-2xl border transition-all mb-6 ${
          isSecondaryConnected
            ? 'bg-[#F0FDF4] border-[#BBF7D0] text-[#166534]'
            : 'bg-[#FFFBEB] border-[#FDE68A] text-[#92400E]'
        }`}>
          <div className="flex items-center gap-3">
            {isSecondaryConnected ? (
              <CheckCircle2 className="w-5 h-5 text-[#16A34A] shrink-0" />
            ) : (
              <RefreshCw className="w-5 h-5 text-[#D97706] animate-spin shrink-0" />
            )}
            <div className="text-xs">
              <strong className="block text-sm">
                {isSecondaryConnected ? 'Back Camera Connected & Ready!' : 'Waiting for Phone #2 to Connect...'}
              </strong>
              <span>
                {isSecondaryConnected
                  ? `Device streaming pose telemetry (${secondaryMetadata?.videoDimensions?.w || 1280}×${secondaryMetadata?.videoDimensions?.h || 720}).`
                  : 'Open FormFit on your second device and scan the QR code above.'}
              </span>
            </div>
          </div>
        </div>

        {/* Security & HTTPS Note */}
        <div className="mb-6 flex items-start gap-2 text-[11px] text-[#696C92] bg-[#F8FAFC] p-3 rounded-xl border border-slate-200">
          <ShieldCheck className="w-4 h-4 text-[#16A34A] shrink-0 mt-0.5" />
          <span>
            <strong>HTTPS Requirement:</strong> Web browsers require secure HTTPS (or localhost) to grant camera access on mobile devices across Wi-Fi.
          </span>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <button
            onClick={onSingleCameraMode}
            className="w-full sm:w-auto px-4 py-2.5 rounded-full text-xs font-semibold bg-[#F3F0FF] hover:bg-[#EDE9FE] text-[#2F3159] transition-all"
          >
            Continue with Single Front Camera
          </button>

          <button
            onClick={onStartCountdown}
            disabled={!isSecondaryConnected}
            className={`w-full sm:w-auto px-6 py-2.5 rounded-full text-xs font-bold text-white shadow-md transition-all flex items-center justify-center gap-2 ${
              isSecondaryConnected
                ? 'bg-[#16A34A] hover:bg-[#15803D] active:scale-95 cursor-pointer'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            <span>Start Dual-Camera Session</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

      </div>
    </div>
  );
}
