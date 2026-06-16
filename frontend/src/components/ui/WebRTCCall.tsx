import { useRef, useEffect } from 'react';
import { X, Phone, Video, Mic, MicOff, VideoOff, User } from 'lucide-react';
import { useWebRTC, type CallStatus } from '@/lib/useWebRTC';

type WebRTCCallProps = {
  sessionId: string;
  callType: 'voice' | 'video';
  isCaller: boolean;
  targetUserId: string;
  localUserId: string;
  localDisplayName: string;
  remoteDisplayName?: string;
  onLeave: () => void;
};

const WebRTCCall = ({
  sessionId,
  callType,
  isCaller,
  targetUserId,
  localUserId,
  localDisplayName,
  remoteDisplayName,
  onLeave,
}: WebRTCCallProps) => {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const {
    status,
    localStream,
    remoteStream,
    isMuted,
    isVideoOff,
    connectionError,
    toggleMute,
    toggleVideo,
    endCall,
  } = useWebRTC({
    sessionId,
    isCaller,
    targetUserId,
    localUserId,
    localDisplayName,
    callType,
  });

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (!remoteStream) return;
    if (callType === 'video' && remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = remoteStream;
      remoteVideoRef.current.play().catch(() => {});
    } else if (callType === 'voice' && remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = remoteStream;
      remoteAudioRef.current.play().catch(() => {});
    }
  }, [remoteStream, callType]);

  useEffect(() => {
    if (status === 'ended') {
      onLeave();
    }
  }, [status, onLeave]);

  const handleEndCall = () => {
    endCall();
    onLeave();
  };

  const handleContainerClick = () => {
    if (remoteVideoRef.current && remoteVideoRef.current.paused) {
      remoteVideoRef.current.play().catch(() => {});
    }
    if (remoteAudioRef.current && remoteAudioRef.current.paused) {
      remoteAudioRef.current.play().catch(() => {});
    }
  };

  const isConnecting = status === 'idle' || status === 'connecting';

  return (
    <div ref={containerRef} onClick={handleContainerClick} className="fixed inset-0 z-[100] flex flex-col bg-black">
      {remoteStream && callType === 'voice' && (
        <audio ref={remoteAudioRef} autoPlay playsInline />
      )}
      <div className="flex items-center justify-between bg-slate-900/90 px-4 py-3">
        <div className="flex items-center gap-2 text-white">
          {callType === 'voice' ? (
            <Phone size={18} className="text-teal-400" />
          ) : (
            <Video size={18} className="text-teal-400" />
          )}
          <span className="text-sm font-medium">
            {isConnecting
              ? 'Connecting...'
              : status === 'connected'
              ? `${callType === 'voice' ? 'Voice' : 'Video'} call in progress`
              : 'Call ended'}
          </span>
          {isConnecting && (
            <span className="ml-2 inline-block h-3 w-3 rounded-full bg-teal-400 animate-pulse" />
          )}
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); handleEndCall(); }}
          className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 transition"
        >
          <X size={16} />
          Leave Call
        </button>
      </div>

      {connectionError && (
        <div className="mx-4 mt-2 rounded-lg bg-red-900/80 px-4 py-2 text-center text-sm text-red-200">
          {connectionError}
        </div>
      )}

      <div className="relative flex-1 flex items-center justify-center bg-slate-950 p-4">
        {remoteStream && callType === 'video' ? (
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="h-full w-full rounded-xl object-contain"
          />
        ) : (
          <div className="flex flex-col items-center gap-4 text-slate-500">
            {isConnecting ? (
              <>
                <div className="flex h-24 w-24 items-center justify-center rounded-full bg-slate-800 animate-pulse">
                  <User size={40} className="text-slate-600" />
                </div>
                <p className="text-lg font-medium text-slate-400">
                  {isCaller ? `Calling ${remoteDisplayName || '...'}` : `${remoteDisplayName || 'Someone'} is calling`}
                </p>
                <p className="text-sm text-slate-500">Waiting for the other party to join...</p>
              </>
            ) : status === 'connected' && callType === 'voice' ? (
              <>
                <div className="flex h-24 w-24 items-center justify-center rounded-full bg-teal-900/50 border-2 border-teal-500">
                  <User size={40} className="text-teal-400" />
                </div>
                <p className="text-lg font-medium text-slate-300">
                  {remoteDisplayName || 'Connected'}
                </p>
                <div className="flex items-center gap-2">
                  <span className="inline-block h-2 w-2 rounded-full bg-teal-500 animate-pulse" />
                  <span className="text-sm text-teal-400">Voice call active</span>
                </div>
              </>
            ) : null}
          </div>
        )}

        {localStream && callType === 'video' && (
          <div className="absolute bottom-4 right-4 h-36 w-48 overflow-hidden rounded-xl border-2 border-slate-700 shadow-lg">
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className={`h-full w-full object-cover ${isVideoOff ? 'opacity-0' : ''}`}
            />
            {isVideoOff && (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-800">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-700">
                  <User size={20} className="text-slate-400" />
                </div>
              </div>
            )}
            <div className="absolute bottom-1 left-1 rounded bg-black/60 px-2 py-0.5 text-[10px] text-white">
              {localDisplayName}
            </div>
          </div>
        )}

        {callType === 'voice' && localStream && (
          <div className="absolute bottom-4 right-4 flex items-center gap-2 rounded-lg bg-slate-800/80 px-3 py-2 text-sm text-slate-400">
            <Mic size={14} className={isMuted ? 'text-red-400' : 'text-teal-400'} />
            <span>{isMuted ? 'Muted' : 'You'}</span>
          </div>
        )}
      </div>

      <div className="flex items-center justify-center gap-4 bg-slate-900/90 px-4 py-5">
        <button
          onClick={(e) => { e.stopPropagation(); toggleMute(); }}
          className={`flex h-12 w-12 items-center justify-center rounded-full transition ${
            isMuted ? 'bg-red-600 text-white' : 'bg-slate-700 text-white hover:bg-slate-600'
          }`}
          title={isMuted ? 'Unmute' : 'Mute'}
        >
          {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
        </button>

        {callType === 'video' && (
          <button
            onClick={(e) => { e.stopPropagation(); toggleVideo(); }}
            className={`flex h-12 w-12 items-center justify-center rounded-full transition ${
              isVideoOff ? 'bg-red-600 text-white' : 'bg-slate-700 text-white hover:bg-slate-600'
            }`}
            title={isVideoOff ? 'Turn on camera' : 'Turn off camera'}
          >
            {isVideoOff ? <VideoOff size={20} /> : <Video size={20} />}
          </button>
        )}

        <button
          onClick={(e) => { e.stopPropagation(); handleEndCall(); }}
          className="flex h-14 w-14 items-center justify-center rounded-full bg-red-600 text-white hover:bg-red-700 transition shadow-lg"
          title="End call"
        >
          <Phone size={22} className="rotate-135" />
        </button>
      </div>
    </div>
  );
};

export default WebRTCCall;
