import { useEffect, useRef, useState, useCallback } from 'react';
import { Room, RoomEvent, RemoteTrack, Track } from 'livekit-client';
import { API_BASE_URL } from './firestore';
import { getSocket } from './socket';
import { auth } from './firebase';

const LIVEKIT_URL = import.meta.env.VITE_LIVEKIT_URL || 'wss://mysyntromed-dn34bete.livekit.cloud';

export type CallStatus = 'idle' | 'connecting' | 'connected' | 'ended';

type UseLiveKitOptions = {
  sessionId: string;
  isCaller: boolean;
  targetUserId: string;
  localUserId: string;
  localDisplayName: string;
  callType: 'voice' | 'video';
};

export function useLiveKit({
  sessionId,
  callType,
  targetUserId,
  localUserId,
  localDisplayName,
}: UseLiveKitOptions) {
  const roomRef = useRef<Room | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [status, setStatus] = useState<CallStatus>('idle');
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      try {
        const firebaseToken = await auth.currentUser?.getIdToken();
        if (!firebaseToken) throw new Error('Not authenticated');

        const res = await fetch(`${API_BASE_URL}/api/livekit/token`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${firebaseToken}`,
          },
          body: JSON.stringify({
            roomName: `call-${sessionId}`,
            participantName: localDisplayName || localUserId,
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || 'Failed to get LiveKit token');
        }
        const { token: livekitToken } = await res.json();
        if (cancelled) return;

        setStatus('connecting');

        const room = new Room({
          adaptiveStream: true,
          dynacast: true,
        });
        roomRef.current = room;

        room.on(RoomEvent.TrackSubscribed, (_track) => {
          const track = _track as RemoteTrack;
          console.log('[LIVEKIT] Track subscribed:', track.kind, 'from:', track.sid);
          if (!remoteStreamRef.current) {
            remoteStreamRef.current = new MediaStream();
          }
          remoteStreamRef.current.addTrack(track.mediaStreamTrack);
          setRemoteStream(new MediaStream(remoteStreamRef.current.getTracks()));
        });

        room.on(RoomEvent.TrackUnsubscribed, (_track) => {
          const track = _track as RemoteTrack;
          console.log('[LIVEKIT] Track unsubscribed:', track.kind);
          remoteStreamRef.current?.removeTrack(track.mediaStreamTrack);
          if (remoteStreamRef.current) {
            setRemoteStream(new MediaStream(remoteStreamRef.current.getTracks()));
          }
        });

        room.on(RoomEvent.LocalTrackPublished, (pub) => {
          if (pub.track) {
            setLocalStream(new MediaStream([pub.track.mediaStreamTrack]));
          }
        });

        room.on(RoomEvent.Disconnected, () => {
          console.log('[LIVEKIT] Disconnected');
          if (!cancelled) {
            setStatus('ended');
          }
        });

        room.on(RoomEvent.ConnectionStateChanged, (state) => {
          console.log('[LIVEKIT] Connection state:', state);
        });

        await room.connect(LIVEKIT_URL, livekitToken);
        if (cancelled) return;

        console.log('[LIVEKIT] Connected, enabling mic');
        await room.localParticipant.setMicrophoneEnabled(true);
        if (callType === 'video') {
          await room.localParticipant.setCameraEnabled(true);
        }

        setStatus('connected');
      } catch (err: any) {
        console.error('[LIVEKIT] Error:', err.message);
        if (!cancelled) {
          setConnectionError(err.message || 'Failed to start call');
          setStatus('ended');
        }
      }
    };

    init();

    return () => {
      cancelled = true;
      roomRef.current?.disconnect();
      roomRef.current = null;
      remoteStreamRef.current = null;
    };
  }, [sessionId, callType, localDisplayName, localUserId]);

  const toggleMute = useCallback(() => {
    const room = roomRef.current;
    if (!room) return;
    const enabled = room.localParticipant.isMicrophoneEnabled;
    room.localParticipant.setMicrophoneEnabled(!enabled);
    setIsMuted(enabled);
  }, []);

  const toggleVideo = useCallback(() => {
    const room = roomRef.current;
    if (!room) return;
    if (callType !== 'video') return;
    const enabled = room.localParticipant.isCameraEnabled;
    room.localParticipant.setCameraEnabled(!enabled);
    setIsVideoOff(enabled);
  }, [callType]);

  const endCall = useCallback(() => {
    const socket = getSocket();
    if (socket?.connected) {
      socket.emit('callEnded', { to: targetUserId, sessionId });
    }
    roomRef.current?.disconnect();
    roomRef.current = null;
    remoteStreamRef.current = null;
    setLocalStream(null);
    setRemoteStream(null);
    setStatus('ended');
  }, [targetUserId, sessionId]);

  return {
    status,
    localStream,
    remoteStream,
    isMuted,
    isVideoOff,
    connectionError,
    toggleMute,
    toggleVideo,
    endCall,
  };
}
