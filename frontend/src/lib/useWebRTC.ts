import { useEffect, useRef, useState, useCallback } from 'react';
import { getSocket } from './socket';

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
  ],
};

export type CallStatus = 'idle' | 'connecting' | 'connected' | 'ended';

type UseWebRTCOptions = {
  sessionId: string;
  isCaller: boolean;
  targetUserId: string;
  localUserId: string;
  localDisplayName: string;
  callType: 'voice' | 'video';
};

export function useWebRTC({
  sessionId,
  isCaller,
  targetUserId,
  localUserId,
  callType,
}: UseWebRTCOptions) {
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [status, setStatus] = useState<CallStatus>('idle');
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const candidatesQueue = useRef<RTCIceCandidateInit[]>([]);
  const endedRef = useRef(false);
  const connectingRef = useRef(false);

  useEffect(() => {
    const socket = getSocket();
    if (!socket?.connected) {
      setConnectionError('Not connected to signaling server');
      return;
    }

    let cancelled = false;
    let connectionTimeout: ReturnType<typeof setTimeout> | null = null;
    let pendingOffer: RTCSessionDescriptionInit | null = null;
    let pendingOfferFrom = '';
    let earlyCandidates: RTCIceCandidateInit[] = [];
    let readyReceived = false;

    const handleReady = (data: { sessionId: string; from: string }) => {
      if (data.sessionId !== sessionId) return;
      if (!isCaller) return;
      readyReceived = true;
      if (pcRef.current) {
        createAndSendOffer();
      }
    };

    const handleOffer = async (data: { offer: RTCSessionDescriptionInit; sessionId: string; from: string }) => {
      if (data.sessionId !== sessionId) return;
      if (data.from !== targetUserId) return;
      if (isCaller) return;

      const pc = pcRef.current;
      if (!pc) {
        pendingOffer = data.offer;
        pendingOfferFrom = data.from;
        return;
      }
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket!.emit('webrtc:answer', {
          to: data.from,
          answer: pc.localDescription!.toJSON(),
          sessionId,
          from: localUserId,
        });
        for (const c of candidatesQueue.current) {
          try { await pc.addIceCandidate(new RTCIceCandidate(c)); } catch {}
        }
        candidatesQueue.current = [];
      } catch (err) {
        console.error('[WEBRTC] handleOffer error:', err);
      }
    };

    const handleAnswer = async (data: { answer: RTCSessionDescriptionInit; sessionId: string; from: string }) => {
      if (data.sessionId !== sessionId) return;
      if (data.from !== targetUserId) return;
      if (!isCaller) return;

      const pc = pcRef.current;
      if (!pc) return;
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
        for (const c of candidatesQueue.current) {
          try { await pc.addIceCandidate(new RTCIceCandidate(c)); } catch {}
        }
        candidatesQueue.current = [];
      } catch (err) {
        console.error('[WEBRTC] handleAnswer error:', err);
      }
    };

    const handleCandidate = async (data: { candidate: RTCIceCandidateInit; sessionId: string }) => {
      if (data.sessionId !== sessionId) return;
      const pc = pcRef.current;
      if (!pc || !pc.remoteDescription?.type) {
        earlyCandidates.push(data.candidate);
        return;
      }
      try {
        await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
      } catch (err) {
        console.error('[WEBRTC] handleCandidate error:', err);
      }
    };

    const handleCallEnded = () => {
      if (!endedRef.current) {
        setConnectionError('The other party ended the call');
        connectingRef.current = false;
        setStatus('ended');
        pcRef.current?.close();
      }
    };

    socket.on('webrtc:offer', handleOffer);
    socket.on('webrtc:answer', handleAnswer);
    socket.on('webrtc:ice-candidate', handleCandidate);
    socket.on('webrtc:ready', handleReady);
    socket.on('callRejected', handleCallEnded);

    async function createAndSendOffer() {
      const pc = pcRef.current;
      if (!pc || cancelled) return;
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        if (!cancelled) {
          socket!.emit('webrtc:offer', {
            to: targetUserId,
            offer: pc.localDescription!.toJSON(),
            sessionId,
            from: localUserId,
          });
        }
      } catch (err) {
        console.error('[WEBRTC] createOffer error:', err);
        if (!cancelled) {
          setConnectionError('Failed to start call');
        }
      }
    }

    async function setupCall() {
      let stream: MediaStream;
      try {
        const constraints: MediaStreamConstraints = {
          audio: true,
          video: callType === 'video' ? {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: 'user',
          } : false,
        };
        stream = await navigator.mediaDevices.getUserMedia(constraints);
        if (cancelled) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }
        localStreamRef.current = stream;
        setLocalStream(stream);
      } catch {
        setConnectionError('Could not access camera/microphone. Please ensure permissions are granted.');
        return;
      }

      const pc = new RTCPeerConnection(ICE_SERVERS);
      pcRef.current = pc;

      stream.getTracks().forEach(track => {
        pc.addTrack(track, stream);
      });

      pc.ontrack = (event) => {
        const [remote] = event.streams;
        if (remote) {
          setRemoteStream(remote);
          connectingRef.current = false;
          setStatus('connected');
        }
      };

      pc.onicecandidate = (event) => {
        if (event.candidate && !endedRef.current) {
          socket!.emit('webrtc:ice-candidate', {
            to: targetUserId,
            candidate: event.candidate.toJSON(),
            sessionId,
            from: localUserId,
          });
        }
      };

      pc.onconnectionstatechange = () => {
        if (cancelled) return;
        if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
          connectingRef.current = false;
          setConnectionError('Connection lost');
          setStatus('ended');
        } else if (pc.connectionState === 'connected') {
          connectingRef.current = false;
          setStatus('connected');
        }
      };

      pc.oniceconnectionstatechange = () => {
        if (pc.iceConnectionState === 'failed' && !cancelled) {
          connectingRef.current = false;
          setConnectionError('Could not establish connection. Please try again.');
        }
      };

      connectingRef.current = true;
      setStatus('connecting');

      connectionTimeout = setTimeout(() => {
        if (connectingRef.current && !cancelled) {
          setConnectionError('Call timed out. The other party may be unavailable.');
          setStatus('ended');
        }
      }, 45000);

      if (pendingOffer) {
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(pendingOffer));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          socket!.emit('webrtc:answer', {
            to: pendingOfferFrom,
            answer: pc.localDescription!.toJSON(),
            sessionId,
            from: localUserId,
          });
          pendingOffer = null;
        } catch (err) {
          console.error('[WEBRTC] processing pending offer error:', err);
        }
      }

      for (const c of earlyCandidates) {
        if (pc.remoteDescription?.type) {
          try { await pc.addIceCandidate(new RTCIceCandidate(c)); } catch {}
        } else {
          candidatesQueue.current.push(c);
        }
      }
      earlyCandidates = [];

      if (!isCaller) {
        socket!.emit('webrtc:ready', {
          to: targetUserId,
          sessionId,
          from: localUserId,
        });
      }

      if (isCaller && readyReceived) {
        await createAndSendOffer();
      }
    }

    setupCall();

    return () => {
      cancelled = true;
      endedRef.current = true;
      if (connectionTimeout) clearTimeout(connectionTimeout);
      socket.off('webrtc:offer', handleOffer);
      socket.off('webrtc:answer', handleAnswer);
      socket.off('webrtc:ice-candidate', handleCandidate);
      socket.off('webrtc:ready', handleReady);
      socket.off('callRejected', handleCallEnded);
      pcRef.current?.close();
      pcRef.current = null;
      localStreamRef.current?.getTracks().forEach(t => t.stop());
      localStreamRef.current = null;
    };
  }, [sessionId, isCaller, targetUserId, localUserId, callType]);

  const toggleMute = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const enabled = stream.getAudioTracks().some(t => t.enabled);
    stream.getAudioTracks().forEach(t => { t.enabled = !enabled; });
    setIsMuted(enabled);
  }, []);

  const toggleVideo = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const videoTracks = stream.getVideoTracks();
    if (videoTracks.length === 0) return;
    const enabled = videoTracks.some(t => t.enabled);
    videoTracks.forEach(t => { t.enabled = !enabled; });
    setIsVideoOff(enabled);
  }, []);

  const endCall = useCallback(() => {
    endedRef.current = true;
    const socket = getSocket();
    if (socket?.connected && targetUserId) {
      socket.emit('callEnded', { to: targetUserId, sessionId });
    }
    pcRef.current?.close();
    pcRef.current = null;
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    localStreamRef.current = null;
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
