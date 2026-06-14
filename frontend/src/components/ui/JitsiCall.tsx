import { useEffect, useRef } from 'react';
import { X, Phone } from 'lucide-react';

type JitsiCallProps = {
  roomName: string;
  callType: 'voice' | 'video';
  displayName: string;
  onLeave: () => void;
};

const JitsiCall = ({ roomName, callType, displayName, onLeave }: JitsiCallProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<any>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const domain = 'meet.jit.si';

    const initJitsi = () => {
      const JitsiMeetExternalAPI = (window as any).JitsiMeetExternalAPI;
      if (!JitsiMeetExternalAPI || !container) return;

      apiRef.current = new JitsiMeetExternalAPI(domain, {
        roomName,
        parentNode: container,
        width: '100%',
        height: '100%',
        configOverrides: {
          startWithAudioMuted: callType === 'voice',
          startWithVideoMuted: callType === 'voice',
          prejoinPageEnabled: false,
          toolbarButtons: [
            'microphone', 'camera', 'chat', 'raisehand',
            'tileview', 'fullscreen', 'settings',
          ],
        },
        interfaceConfigOverrides: {
          SHOW_JITSI_WATERMARK: false,
          SHOW_WATERMARK_FOR_GUESTS: false,
          TOOLBAR_ALWAYS_VISIBLE: true,
          DISABLE_JOIN_LEAVE_NOTIFICATIONS: true,
        },
        userInfo: {
          displayName: displayName || 'User',
        },
      });

      apiRef.current.addListener('readyToClose', onLeave);
    };

    if ((window as any).JitsiMeetExternalAPI) {
      initJitsi();
    } else {
      const script = document.createElement('script');
      script.src = 'https://meet.jit.si/external_api.js';
      script.async = true;
      script.onload = initJitsi;
      document.body.appendChild(script);
    }

    return () => {
      if (apiRef.current) {
        try { apiRef.current.executeCommand('hangup'); } catch {}
        try { apiRef.current.dispose(); } catch {}
        apiRef.current = null;
      }
    };
  }, [roomName, callType, displayName, onLeave]);

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-black">
      <div className="flex items-center justify-between bg-slate-900 px-4 py-3">
        <div className="flex items-center gap-2 text-white">
          <Phone size={18} className="text-teal-400" />
          <span className="text-sm font-medium">Call in progress</span>
        </div>
        <button
          onClick={onLeave}
          className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 transition"
        >
          <X size={16} />
          Leave Call
        </button>
      </div>
      <div ref={containerRef} className="flex-1" />
    </div>
  );
};

export default JitsiCall;
