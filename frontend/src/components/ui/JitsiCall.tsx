import { useRef } from 'react';
import { X, Phone, Video } from 'lucide-react';

type JitsiCallProps = {
  roomName: string;
  callType: 'voice' | 'video';
  displayName: string;
  onLeave: () => void;
};

const JitsiCall = ({ roomName, callType, displayName, onLeave }: JitsiCallProps) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const params = new URLSearchParams({
    userInfo: JSON.stringify({ displayName: displayName || 'User' }),
    config: JSON.stringify({
      startWithAudioMuted: callType === 'voice',
      startWithVideoMuted: callType === 'voice',
      prejoinPageEnabled: false,
      enableWelcomePage: false,
      disableDeepLinking: true,
      requireDisplayName: false,
      enableUserRolesBasedOnToken: false,
      disableInviteFunctions: true,
      doNotStoreRoom: true,
    }),
    interfaceConfig: JSON.stringify({
      SHOW_JITSI_WATERMARK: false,
      SHOW_WATERMARK_FOR_GUESTS: false,
      TOOLBAR_ALWAYS_VISIBLE: true,
      DISABLE_JOIN_LEAVE_NOTIFICATIONS: true,
      MOBILE_APP_PROMO: false,
    }),
    jwt: undefined,
  }).toString();

  const src = `https://meet.jit.si/${encodeURIComponent(roomName)}#${params}`;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-black">
      <div className="flex items-center justify-between bg-slate-900 px-4 py-3">
        <div className="flex items-center gap-2 text-white">
          {callType === 'voice' ? <Phone size={18} className="text-teal-400" /> : <Video size={18} className="text-teal-400" />}
          <span className="text-sm font-medium">{callType === 'voice' ? 'Voice' : 'Video'} call in progress</span>
        </div>
        <button
          onClick={onLeave}
          className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 transition"
        >
          <X size={16} />
          Leave Call
        </button>
      </div>
      <iframe
        ref={iframeRef}
        src={src}
        allow="camera; microphone; display-capture; autoplay; clipboard-read; clipboard-write"
        className="flex-1 border-0"
        title="Jitsi Call"
      />
    </div>
  );
};

export default JitsiCall;
