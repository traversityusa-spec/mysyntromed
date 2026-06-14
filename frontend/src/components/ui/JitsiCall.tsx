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

  const hash = new URLSearchParams({
    'config.startWithAudioMuted': callType === 'voice' ? 'true' : 'false',
    'config.startWithVideoMuted': callType === 'voice' ? 'true' : 'false',
    'config.prejoinPageEnabled': 'false',
    'config.enableWelcomePage': 'false',
    'config.disableDeepLinking': 'true',
    'config.requireDisplayName': 'false',
    'config.enableUserRolesBasedOnToken': 'false',
    'config.disableInviteFunctions': 'true',
    'config.disableLobby': 'true',
    'config.startConferenceWithLobby': 'false',
    'config.doNotStoreRoom': 'true',
    'userInfo.displayName': displayName || 'User',
  }).toString();

  const src = `https://meet.jit.si/${encodeURIComponent(roomName)}#${hash}`;

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
