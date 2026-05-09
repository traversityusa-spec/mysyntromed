import { useEffect, useRef, useState, useCallback } from 'react';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  PhoneOff,
  Phone,
  User,
  PhoneIncoming,
  X,
} from 'lucide-react';
import { db } from '@/lib/firebase';
import { doc, collection, onSnapshot, addDoc, updateDoc, serverTimestamp, query, where } from 'firebase/firestore';
import { useAuth } from '@/lib/AuthContext';

const rtcConfig: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

export type CallOffer = {
  id?: string;
  callerId: string;
  callerName: string;
  callerRole: string;
  receiverId: string;
  receiverName: string;
  receiverRole: string;
  callType: 'audio' | 'video';
  offer: RTCSessionDescriptionInit;
  createdAt: any;
  status: 'pending' | 'answered' | 'rejected' | 'ended';
  answer?: RTCSessionDescriptionInit;
};

type CallState = 'idle' | 'calling' | 'ringing' | 'connected' | 'ended';

interface WebRTCVideoCallProps {
  callerId?: string;
  callerName?: string;
  callerRole?: string;
  receiverId?: string;
  receiverName?: string;
  receiverRole?: string;
  callType?: 'audio' | 'video';
  isInitiator?: boolean;
  onCallEnd?: () => void;
}

export function WebRTCVideoCall({
  callerId,
  callerName,
  callerRole,
  receiverId,
  receiverName,
  receiverRole = 'client',
  callType = 'video',
  isInitiator = false,
  onCallEnd,
}: WebRTCVideoCallProps) {
  const { user, sessionUser } = useAuth();
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const currentOfferIdRef = useRef<string | null>(null);
  const isSubscribedRef = useRef(false);

  const [callState, setCallState] = useState<CallState>(isInitiator ? 'calling' : 'idle');
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [incomingCallData, setIncomingCallData] = useState<CallOffer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [otherPartyName, setOtherPartyName] = useState<string>(isInitiator ? (receiverName || '') : (callerName || 'User'));

  const cleanup = useCallback(() => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
    setLocalStream(null);
    setRemoteStream(null);
  }, []);

  const endCall = useCallback(async () => {
    cleanup();
    setCallState('ended');

    if (user?.uid && currentOfferIdRef.current) {
      try {
        await updateDoc(doc(db, 'call_offers', currentOfferIdRef.current), { status: 'ended' });
      } catch (e) {
        console.error('Error updating call status:', e);
      }
    }

    setTimeout(() => {
      onCallEnd?.();
    }, 100);
  }, [cleanup, user?.uid, onCallEnd]);

  const setupLocalStream = useCallback(async () => {
    try {
      const constraints: MediaStreamConstraints = {
        audio: true,
        video: callType === 'video' ? { width: 1280, height: 720, facingMode: 'user' } : false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      localStreamRef.current = stream;
      setLocalStream(stream);

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      return stream;
    } catch (err) {
      console.error('Error accessing media devices:', err);
      setError('Unable to access camera/microphone. Please check permissions.');
      cleanup();
      setTimeout(() => onCallEnd?.(), 100);
      return null;
    }
  }, [callType, cleanup, onCallEnd]);

  const createPeerConnection = useCallback(() => {
    const pc = new RTCPeerConnection(rtcConfig);

    pc.onicecandidate = (event) => {
      if (event.candidate && user?.uid && receiverId) {
        addDoc(collection(db, 'ice_candidates'), {
          senderId: user.uid,
          receiverId: receiverId,
          candidate: event.candidate.toJSON(),
          createdAt: serverTimestamp(),
        });
      }
    };

    pc.ontrack = (event) => {
      if (event.streams[0]) {
        setRemoteStream(event.streams[0]);
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = event.streams[0];
        }
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log('ICE connection state:', pc.iceConnectionState);
      if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'closed') {
        endCall();
      }
    };

    return pc;
  }, [user?.uid, receiverId, endCall]);

  const createOffer = useCallback(async () => {
    if (!user?.uid || !receiverId) {
      console.log('[WebRTC] Cannot create offer - missing user or receiverId');
      return;
    }

    console.log('[WebRTC] Creating peer connection and offer');
    try {
      const pc = createPeerConnection();
      peerConnectionRef.current = pc;

      const stream = localStreamRef.current;
      if (stream) {
        stream.getTracks().forEach(track => pc.addTrack(track, stream));
      }

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const docRef = await addDoc(collection(db, 'call_offers'), {
        callerId: user.uid,
        callerName: sessionUser?.displayName || 'User',
        callerRole: sessionUser?.role || 'client',
        receiverId: receiverId,
        receiverName: receiverName || 'User',
        receiverRole: receiverRole,
        callType,
        offer: offer,
        createdAt: serverTimestamp(),
        status: 'pending',
      });

      currentOfferIdRef.current = docRef.id;
      setCallState('calling');
      console.log('Offer created with ID:', docRef.id);
    } catch (err) {
      console.error('Error creating offer:', err);
      setError('Failed to start call');
      cleanup();
      setTimeout(() => onCallEnd?.(), 100);
    }
  }, [user?.uid, receiverId, receiverName, receiverRole, sessionUser, callType, createPeerConnection, cleanup, onCallEnd]);

  const answerCall = useCallback(async (offer: CallOffer) => {
    try {
      const pc = createPeerConnection();
      peerConnectionRef.current = pc;

      const stream = localStreamRef.current;
      if (stream) {
        stream.getTracks().forEach(track => pc.addTrack(track, stream));
      }

      await pc.setRemoteDescription(new RTCSessionDescription(offer.offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      currentOfferIdRef.current = offer.id || null;

      await updateDoc(doc(db, 'call_offers', offer.id), {
        answer: answer,
        status: 'answered',
      });

      setCallState('connected');

      await addDoc(collection(db, 'ice_candidates'), {
        senderId: user?.uid,
        receiverId: offer.callerId,
        candidate: 'answer_accepted',
        createdAt: serverTimestamp(),
      });
    } catch (err) {
      console.error('Error answering call:', err);
      setError('Failed to answer call');
      cleanup();
      setTimeout(() => onCallEnd?.(), 100);
    }
  }, [createPeerConnection, user?.uid, cleanup, onCallEnd]);

  const rejectCall = useCallback(async (offer: CallOffer) => {
    try {
      await updateDoc(doc(db, 'call_offers', offer.id), {
        status: 'rejected',
      });
    } catch (err) {
      console.error('Error rejecting call:', err);
    }
  }, []);

  const toggleMute = useCallback(() => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  }, []);

  const toggleVideo = useCallback(() => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoOff(!videoTrack.enabled);
      }
    }
  }, []);

  useEffect(() => {
    const initCall = async () => {
      console.log('[WebRTC] initCall starting', { isInitiator, receiverId });
      const stream = await setupLocalStream();
      if (!stream) {
        console.log('[WebRTC] No stream available');
        return;
      }

      if (isInitiator && receiverId) {
        console.log('[WebRTC] Creating offer for receiver:', receiverId);
        await createOffer();
      }
    };

    initCall();

    return () => {
      cleanup();
    };
  }, [isInitiator, receiverId, setupLocalStream, createOffer, cleanup]);

useEffect(() => {
    console.log('[WebRTC] Component mounting', { callerId, receiverId, isInitiator, userId: user?.uid });
    if (!user?.uid) {
      console.log('[WebRTC] No user logged in');
      return;
    }

    const unsub = onSnapshot(
      query(collection(db, 'call_offers'), where('receiverId', '==', user.uid)),
      async (snapshot) => {
        console.log('[WebRTC] Call offers snapshot received, docs:', snapshot.docs.length);
        for (const change of snapshot.docChanges()) {
          const data = change.doc.data() as CallOffer;
          const offerId = change.doc.id;
          console.log('[WebRTC] Doc change:', change.type, offerId, data);

          if (change.type === 'added' && data.status === 'pending') {
            if (data.callerId !== user.uid) {
              console.log('[WebRTC] INCOMING CALL for receiver:', data);
              setIncomingCallData({ ...data, id: offerId });
              setOtherPartyName(data.callerName);
              setCallState('ringing');
            }
          }

          if (change.type === 'modified' && data.status === 'answered' && data.answer) {
            if (currentOfferIdRef.current === offerId && isInitiator) {
              const pc = peerConnectionRef.current;
              if (pc) {
                try {
                  await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
                  setCallState('connected');
                  console.log('[WebRTC] Call connected - answer received');
                } catch (e) {
                  console.error('[WebRTC] Error setting remote description:', e);
                }
              }
            }
          }

          if (change.type === 'modified' && (data.status === 'rejected' || data.status === 'ended')) {
            console.log('[WebRTC] Call rejected/ended:', data.status);
            if (callState === 'calling' || callState === 'ringing') {
              endCall();
            }
          }
        }
      }
    );

    const unsubCaller = onSnapshot(
      query(collection(db, 'call_offers'), where('callerId', '==', user.uid)),
      async (snapshot) => {
        console.log('[WebRTC] Caller offers snapshot received, docs:', snapshot.docs.length);
        for (const change of snapshot.docChanges()) {
          const data = change.doc.data() as CallOffer;
          const offerId = change.doc.id;
          console.log('[WebRTC] Caller doc change:', change.type, offerId, data);

          if (change.type === 'added' && data.status === 'pending') {
            console.log('[WebRTC] My outgoing call created:', offerId);
          }

          if (change.type === 'modified' && data.status === 'answered' && data.answer) {
            console.log('[WebRTC] Answer received for my call:', offerId);
            if (currentOfferIdRef.current === offerId && isInitiator) {
              const pc = peerConnectionRef.current;
              if (pc && pc.signalingState === 'have-local-offer') {
                try {
                  await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
                  setCallState('connected');
                  console.log('[WebRTC] Call connected - answer processed');
                } catch (e) {
                  console.error('[WebRTC] Error setting remote description:', e);
                }
              }
            }
          }

          if (change.type === 'modified' && (data.status === 'rejected' || data.status === 'ended')) {
            console.log('[WebRTC] My call rejected/ended:', data.status);
            if (callState === 'calling' || callState === 'ringing') {
              endCall();
            }
          }
        }
      }
    );

    const unsubCandidates = onSnapshot(
      query(collection(db, 'ice_candidates'), where('receiverId', '==', user.uid)),
      async (snapshot) => {
        console.log('[WebRTC] ICE candidates snapshot:', snapshot.docs.length);
        for (const change of snapshot.docChanges()) {
          if (change.type === 'added') {
            const data = change.doc.data() as any;
            if (data.candidate === 'answer_accepted' || data.candidate === 'call_ended') {
              continue;
            }

            const pc = peerConnectionRef.current;
            if (pc && pc.remoteDescription) {
              try {
                await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
                console.log('[WebRTC] ICE candidate added');
              } catch (err) {
                console.error('[WebRTC] Error adding ICE candidate:', err);
              }
            }
          }
        }
      }
    );

    return () => {
      unsub();
      unsubCaller();
      unsubCandidates();
    };
  }, [user?.uid, callState, isInitiator, endCall]);

  if (callState === 'ringing' && incomingCallData) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
        <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-2xl">
          <div className="mb-6 flex flex-col items-center">
            <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-teal-100 animate-pulse">
              <PhoneIncoming size={40} className="text-teal-600" />
            </div>
            <h2 className="text-xl font-bold text-slate-900">Incoming {callType === 'video' ? 'Video' : 'Audio'} Call</h2>
            <p className="mt-2 text-slate-600">{incomingCallData.callerName}</p>
            <p className="text-sm text-slate-400 capitalize">{incomingCallData.callerRole}</p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => {
                rejectCall(incomingCallData);
                setIncomingCallData(null);
                cleanup();
                setTimeout(() => onCallEnd?.(), 100);
              }}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-3 font-semibold text-white hover:bg-red-700"
            >
              <X size={20} />
              Reject
            </button>
            <button
              onClick={async () => {
                const offer = incomingCallData;
                setIncomingCallData(null);
                await answerCall(offer);
              }}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 font-semibold text-white hover:bg-emerald-700"
            >
              <Phone size={20} />
              Accept
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (callState === 'calling') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900">
        <div className="flex flex-col items-center">
          <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-teal-600 animate-pulse">
            <User size={48} className="text-white" />
          </div>
          <h2 className="text-xl font-semibold text-white">Calling {otherPartyName || receiverName || '...'}</h2>
          <p className="mt-2 text-slate-400">Waiting for response...</p>
          <button
            onClick={endCall}
            className="mt-8 flex items-center gap-2 rounded-full bg-red-600 px-6 py-3 font-semibold text-white hover:bg-red-700"
          >
            <PhoneOff size={20} />
            Cancel
          </button>
        </div>
      </div>
    );
  }

  if (callState === 'connected') {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-slate-900">
        <div className="relative flex h-full">
          {remoteStream && callType === 'video' ? (
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center">
              <div className="mb-6 flex h-32 w-32 items-center justify-center rounded-full bg-teal-600">
                <User size={64} className="text-white" />
              </div>
              <p className="text-lg font-medium text-white">{otherPartyName || receiverName || callerName}</p>
              <p className="text-sm text-slate-400">{callType === 'audio' ? 'Audio Call' : 'Connected'}</p>
            </div>
          )}

          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-6">
            <div className="mx-auto flex max-w-md items-center justify-center gap-4">
              <button
                onClick={toggleMute}
                className={`flex h-14 w-14 items-center justify-center rounded-full ${
                  isMuted ? 'bg-red-600' : 'bg-slate-700'
                } text-white hover:opacity-80`}
              >
                {isMuted ? <MicOff size={24} /> : <Mic size={24} />}
              </button>

              {callType === 'video' && (
                <button
                  onClick={toggleVideo}
                  className={`flex h-14 w-14 items-center justify-center rounded-full ${
                    isVideoOff ? 'bg-red-600' : 'bg-slate-700'
                  } text-white hover:opacity-80`}
                >
                  {isVideoOff ? <VideoOff size={24} /> : <Video size={24} />}
                </button>
              )}

              <button
                onClick={endCall}
                className="flex h-14 w-14 items-center justify-center rounded-full bg-red-600 text-white hover:bg-red-700"
              >
                <PhoneOff size={24} />
              </button>
            </div>
          </div>

          <div className="absolute right-4 bottom-24 w-32 overflow-hidden rounded-xl shadow-lg">
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className={`w-full object-cover ${isVideoOff ? 'hidden' : 'h-24'}`}
            />
            {isVideoOff && (
              <div className="flex h-24 w-32 items-center justify-center bg-slate-800">
                <VideoOff size={24} className="text-slate-400" />
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return null;
}

export function useIncomingCalls(userId: string) {
  const [incomingCalls, setIncomingCalls] = useState<CallOffer[]>([]);

  useEffect(() => {
    if (!userId) return;

    console.log('[useIncomingCalls] Subscribing to calls for user:', userId);

    const unsub = onSnapshot(
      query(collection(db, 'call_offers'), where('receiverId', '==', userId), where('status', '==', 'pending')),
      (snapshot) => {
        console.log('[useIncomingCalls] Snapshot received, docs:', snapshot.docs.length);
        const calls = snapshot.docs
          .map(doc => ({ ...doc.data(), id: doc.id } as CallOffer))
          .filter(call => call.callerId !== userId);
        console.log('[useIncomingCalls] Filtered calls:', calls.length, calls);
        setIncomingCalls(calls);
      }
    );

    return () => {
      console.log('[useIncomingCalls] Unsubscribing');
      unsub();
    };
  }, [userId]);

  return incomingCalls;
}