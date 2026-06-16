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
  const remoteStreamRef = useRef<MediaStream | null>(null);

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
    let readyReceived = false;

    const handleReady = (data: { sessionId: string; from: string }) => {
      console.log('[WEBRTC] handleReady called', data, 'expected sessionId:', sessionId, 'isCaller:', isCaller);
      if (data.sessionId !== sessionId) return;
      if (!isCaller) return;
      console.log('[WEBRTC] handleReady proceeding, pcRef.current:', !!pcRef.current);
      readyReceived = true;
      if (pcRef.current) {
        createAndSendOffer();
      }
    };

    const handleOffer = async (data: { offer: RTCSessionDescriptionInit; sessionId: string; from: string }) => {
      console.log('[WEBRTC] handleOffer called', 'from:', data.from, 'sessionId:', data.sessionId, 'targetUserId:', targetUserId, 'isCaller:', isCaller);
      if (data.sessionId !== sessionId) return;
      if (data.from !== targetUserId) return;
      if (isCaller) return;

      const pc = pcRef.current;
      if (!pc) {
        console.log('[WEBRTC] handleOffer: no PC yet, storing pending offer');
        pendingOffer = data.offer;
        pendingOfferFrom = data.from;
        return;
      }
      console.log('[WEBRTC] handleOffer: processing offer, setting remote description');
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
        console.log('[WEBRTC] handleOffer: remote description set, creating answer');
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        console.log('[WEBRTC] handleOffer: answer created and set locally, emitting webrtc:answer');
        socket!.emit('webrtc:answer', {
          to: data.from,
          answer: pc.localDescription!.toJSON(),
          sessionId,
          from: localUserId,
        });
        console.log('[WEBRTC] handleOffer: flushed candidatesQueue, count:', candidatesQueue.current.length);
        for (const c of candidatesQueue.current) {
          try { await pc.addIceCandidate(new RTCIceCandidate(c)); } catch {}
        }
        candidatesQueue.current = [];
      } catch (err) {
        console.error('[WEBRTC] handleOffer error:', err);
      }
    };

    const handleAnswer = async (data: { answer: RTCSessionDescriptionInit; sessionId: string; from: string }) => {
      console.log('[WEBRTC] handleAnswer called', 'from:', data.from, 'sessionId:', data.sessionId, 'targetUserId:', targetUserId, 'isCaller:', isCaller);
      if (data.sessionId !== sessionId) return;
      if (data.from !== targetUserId) return;
      if (!isCaller) return;

      const pc = pcRef.current;
      if (!pc) {
        console.log('[WEBRTC] handleAnswer: no PC found');
        return;
      }
      console.log('[WEBRTC] handleAnswer: setting remote description');
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
        console.log('[WEBRTC] handleAnswer: remote description set, flushing candidatesQueue, count:', candidatesQueue.current.length);
        for (const c of candidatesQueue.current) {
          try { await pc.addIceCandidate(new RTCIceCandidate(c)); } catch {}
        }
        candidatesQueue.current = [];
        console.log('[WEBRTC] handleAnswer: done');
      } catch (err) {
        console.error('[WEBRTC] handleAnswer error:', err);
      }
    };

    const handleCandidate = async (data: { candidate: RTCIceCandidateInit; sessionId: string }) => {
      if (data.sessionId !== sessionId) return;
      const pc = pcRef.current;
      if (!pc || !pc.remoteDescription?.type) {
        candidatesQueue.current.push(data.candidate);
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
      if (!pc || cancelled) {
        console.log('[WEBRTC] createAndSendOffer: skipping, pc:', !!pc, 'cancelled:', cancelled);
        return;
      }
      console.log('[WEBRTC] createAndSendOffer: creating offer');
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        console.log('[WEBRTC] createAndSendOffer: offer created and set locally, emitting');
        if (!cancelled) {
          socket!.emit('webrtc:offer', {
            to: targetUserId,
            offer: pc.localDescription!.toJSON(),
            sessionId,
            from: localUserId,
          });
          console.log('[WEBRTC] createAndSendOffer: offer emitted');
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
        console.log('[WEBRTC] setupCall: requesting media, constraints:', constraints);
        stream = await navigator.mediaDevices.getUserMedia(constraints);
        console.log('[WEBRTC] setupCall: media acquired, tracks:', stream.getTracks().length);
        if (cancelled) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }
        localStreamRef.current = stream;
        setLocalStream(stream);
      } catch (err) {
        console.error('[WEBRTC] setupCall: getUserMedia failed:', err);
        setConnectionError('Could not access camera/microphone. Please ensure permissions are granted.');
        return;
      }

      const pc = new RTCPeerConnection(ICE_SERVERS);
      pcRef.current = pc;
      console.log('[WEBRTC] setupCall: PC created');

      stream.getTracks().forEach(track => {
        pc.addTrack(track, stream);
        console.log('[WEBRTC] setupCall: added track kind:', track.kind);
      });

      pc.ontrack = (event) => {
        console.log('[WEBRTC] pc.ontrack fired, streams:', event.streams.length, 'track kind:', event.track?.kind);
        if (event.streams.length > 0) {
          const remote = event.streams[0];
          if (remote) {
            remoteStreamRef.current = remote;
            setRemoteStream(remote);
          }
        } else if (event.track) {
          console.log('[WEBRTC] pc.ontrack: no stream in event, building from track');
          if (!remoteStreamRef.current) {
            remoteStreamRef.current = new MediaStream([event.track]);
            setRemoteStream(remoteStreamRef.current);
          } else {
            remoteStreamRef.current.addTrack(event.track);
            setRemoteStream(remoteStreamRef.current);
          }
        }
        connectingRef.current = false;
        setStatus('connected');
      };

      let iceCandidateCount = 0;
      pc.onicecandidate = (event) => {
        if (event.candidate && !endedRef.current) {
          iceCandidateCount++;
          if (iceCandidateCount === 1) console.log('[WEBRTC] pc.onicecandidate: first candidate');
          socket!.emit('webrtc:ice-candidate', {
            to: targetUserId,
            candidate: event.candidate.toJSON(),
            sessionId,
            from: localUserId,
          });
        } else if (!event.candidate) {
          console.log('[WEBRTC] pc.onicecandidate: gathering complete, total:', iceCandidateCount);
        }
      };

      pc.onconnectionstatechange = () => {
        console.log('[WEBRTC] pc.onconnectionstatechange:', pc.connectionState);
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
        console.log('[WEBRTC] pc.oniceconnectionstatechange:', pc.iceConnectionState);
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
        console.log('[WEBRTC] setupCall: processing pending offer');
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

      if (pc.remoteDescription?.type) {
        const q = candidatesQueue.current;
        candidatesQueue.current = [];
        if (q.length) console.log('[WEBRTC] setupCall: flushing candidate queue, count:', q.length);
        for (const c of q) {
          try { await pc.addIceCandidate(new RTCIceCandidate(c)); } catch {}
        }
      }

      if (!isCaller) {
        console.log('[WEBRTC] setupCall: emitting webrtc:ready to', targetUserId);
        socket!.emit('webrtc:ready', {
          to: targetUserId,
          sessionId,
          from: localUserId,
        });
      } else {
        console.log('[WEBRTC] setupCall: I am caller, readyReceived:', readyReceived);
      }

      if (isCaller && readyReceived) {
        console.log('[WEBRTC] setupCall: caller and ready already received, creating offer now');
        await createAndSendOffer();
      } else {
        console.log('[WEBRTC] setupCall: waiting for webrtc:ready (caller) or offer (callee)');
      }
    }

    console.log('[WEBRTC] Effect: starting setupCall, isCaller:', isCaller, 'targetUserId:', targetUserId, 'sessionId:', sessionId);

    setupCall();

    return () => {
      console.log('[WEBRTC] Effect cleanup');
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
      remoteStreamRef.current = null;
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
