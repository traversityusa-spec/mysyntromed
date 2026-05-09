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
import { doc, collection, onSnapshot, addDoc, updateDoc, serverTimestamp, query, where, getDocs } from 'firebase/firestore';
import { useAuth } from '@/lib/AuthContext';

interface RTCConfig {
  iceServers: RTCIceServer[];
}

const rtcConfig: RTCConfig = {
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

export type ICECandidateMessage = {
  id?: string;
  senderId: string;
  receiverId: string;
  candidate: RTCIceCandidateInit;
  createdAt: any;
};

type CallState = 'idle' | 'calling' | 'ringing' | 'connected' | 'ended';

interface WebRTCVideoCallProps {
  sessionId?: string;
  callerId?: string;
  callerName?: string;
  receiverId?: string;
  receiverName?: string;
  callType?: 'audio' | 'video';
  isInitiator?: boolean;
  onCallEnd?: () => void;
  meetingLink?: string;
}

export function WebRTCVideoCall({
  sessionId,
  callerId,
  callerName,
  receiverId,
  receiverName,
  callType = 'video',
  isInitiator = false,
  onCallEnd,
  meetingLink,
}: WebRTCVideoCallProps) {
  const { user, sessionUser } = useAuth();
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const unsubscribeRef = useRef<(() => void)[]>([]);

  const [callState, setCallState] = useState<CallState>(isInitiator ? 'calling' : 'idle');
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [incomingCall, setIncomingCall] = useState<CallOffer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [callerInfo, setCallerInfo] = useState<{ name: string; role: string } | null>(
    isInitiator ? { name: receiverName || '', role: '' } : null
  );

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
      if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed') {
        handleEndCall();
      }
    };

    return pc;
  }, [user?.uid, receiverId]);

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
      return null;
    }
  }, [callType]);

  const createOffer = useCallback(async () => {
    if (!peerConnectionRef.current || !user?.uid || !receiverId) return;

    try {
      const offer = await peerConnectionRef.current.createOffer();
      await peerConnectionRef.current.setLocalDescription(offer);

      await addDoc(collection(db, 'call_offers'), {
        callerId: user.uid,
        callerName: sessionUser?.displayName || 'User',
        callerRole: sessionUser?.role || 'client',
        receiverId: receiverId,
        receiverName: receiverName || 'User',
        receiverRole: 'client',
        callType,
        offer: offer,
        createdAt: serverTimestamp(),
        status: 'pending',
      });

      setCallState('calling');
    } catch (err) {
      console.error('Error creating offer:', err);
      setError('Failed to start call');
    }
  }, [user?.uid, receiverId, receiverName, sessionUser, callType]);

  const handleAnswerCall = useCallback(async (offer: CallOffer) => {
    try {
      const pc = createPeerConnection();

      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => pc.addTrack(track, localStreamRef.current!));
      }

      await pc.setRemoteDescription(new RTCSessionDescription(offer.offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      peerConnectionRef.current = pc;
      setCallState('connected');

      await updateDoc(doc(db, 'call_offers', offer.id), {
        answer: answer,
        status: 'answered',
      });

      if (offer.callerId && user?.uid) {
        await addDoc(collection(db, 'ice_candidates'), {
          senderId: user.uid,
          receiverId: offer.callerId,
          candidate: 'answer_accepted',
          createdAt: serverTimestamp(),
        });
      }
    } catch (err) {
      console.error('Error answering call:', err);
      setError('Failed to answer call');
    }
  }, [createPeerConnection, localStreamRef, user?.uid]);

  const handleRejectCall = useCallback(async (offer: CallOffer) => {
    try {
      await updateDoc(doc(db, 'call_offers', offer.id), {
        status: 'rejected',
      });
    } catch (err) {
      console.error('Error rejecting call:', err);
    }
  }, []);

  const handleEndCall = useCallback(async () => {
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
    setCallState('ended');

    if (user?.uid && receiverId) {
      const q = query(
        collection(db, 'call_offers'),
        where('receiverId', '==', user.uid),
        where('status', '==', 'pending')
      );
      const snaps = await getDocs(q);
      for (const snap of snaps.docs) {
        await updateDoc(doc(db, 'call_offers', snap.id), { status: 'ended' });
      }
    }

    setTimeout(() => {
      onCallEnd?.();
    }, 500);
  }, [user?.uid, receiverId, onCallEnd]);

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
      const stream = await setupLocalStream();
      if (!stream) return;

      if (isInitiator && receiverId) {
        const pc = createPeerConnection();

        stream.getTracks().forEach(track => pc.addTrack(track, stream));

        peerConnectionRef.current = pc;
        await createOffer();
      } else if (!isInitiator && sessionId) {
        const unsub = onSnapshot(doc(db, 'call_offers', sessionId), async (snap) => {
          if (!snap.exists()) return;
          const data = snap.data() as CallOffer;

          if (data.status === 'answered' && data.answer && user?.uid) {
            const pc = peerConnectionRef.current;
            if (pc) {
              await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
              setCallState('connected');
            }
          } else if (data.status === 'rejected' || data.status === 'ended') {
            handleEndCall();
          }
        });

        unsubscribeRef.current.push(unsub);
      }
    };

    initCall();

    return () => {
      unsubscribeRef.current.forEach(unsub => unsub());
      unsubscribeRef.current = [];

      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
        peerConnectionRef.current = null;
      }

      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
        localStreamRef.current = null;
      }
    };
  }, [setupLocalStream, isInitiator, receiverId, sessionId, createPeerConnection, createOffer, user?.uid]);

  useEffect(() => {
    if (!user?.uid) return;

    const unsubOffers = onSnapshot(
      query(collection(db, 'call_offers'), where('receiverId', '==', user.uid), where('status', '==', 'pending')),
      (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added') {
            const data = change.doc.data() as CallOffer;
            if (data.callerId !== user.uid) {
              setIncomingCall({ ...data, id: change.doc.id });
              setCallerInfo({ name: data.callerName, role: data.callerRole });
              setCallState('ringing');
            }
          }
        });
      }
    );

    unsubscribeRef.current.push(unsubOffers);

    const unsubCandidates = onSnapshot(
      query(collection(db, 'ice_candidates'), where('receiverId', '==', user.uid)),
      async (snapshot) => {
        snapshot.docChanges().forEach(async (change) => {
          if (change.type === 'added') {
            const data = change.doc.data() as any;
            if (data.candidate === 'answer_accepted') {
              return;
            }

            const pc = peerConnectionRef.current;
            if (pc && pc.remoteDescription) {
              try {
                await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
              } catch (err) {
                console.error('Error adding ICE candidate:', err);
              }
            }
          }
        });
      }
    );

    unsubscribeRef.current.push(unsubCandidates);

    return () => {
      unsubOffers();
      unsubCandidates();
    };
  }, [user?.uid]);

  if (incomingCall && callState === 'ringing') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
        <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-2xl">
          <div className="mb-6 flex flex-col items-center">
            <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-teal-100">
              <PhoneIncoming size={40} className="text-teal-600" />
            </div>
            <h2 className="text-xl font-bold text-slate-900">Incoming {callType === 'video' ? 'Video' : 'Audio'} Call</h2>
            <p className="mt-2 text-slate-600">{incomingCall.callerName}</p>
            <p className="text-sm text-slate-400 capitalize">{incomingCall.callerRole}</p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => {
                handleRejectCall(incomingCall);
                setIncomingCall(null);
                setCallState('idle');
              }}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-3 font-semibold text-white hover:bg-red-700"
            >
              <X size={20} />
              Reject
            </button>
            <button
              onClick={async () => {
                setIncomingCall(null);
                await handleAnswerCall(incomingCall);
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
          <h2 className="text-xl font-semibold text-white">Calling {receiverName || '...'}</h2>
          <p className="mt-2 text-slate-400">Waiting for response...</p>
          <button
            onClick={handleEndCall}
            className="mt-8 flex items-center gap-2 rounded-full bg-red-600 px-6 py-3 font-semibold text-white hover:bg-red-700"
          >
            <PhoneOff size={20} />
            Cancel
          </button>
        </div>
      </div>
    );
  }

  if (callState === 'ended') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900">
        <div className="flex flex-col items-center">
          <p className="text-lg font-medium text-white">Call Ended</p>
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
              <p className="text-lg font-medium text-white">{callerInfo?.name || receiverName}</p>
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
                onClick={handleEndCall}
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

    const unsub = onSnapshot(
      query(collection(db, 'call_offers'), where('receiverId', '==', userId), where('status', '==', 'pending')),
      (snapshot) => {
        const calls = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as CallOffer));
        setIncomingCalls(calls);
      }
    );

    return () => unsub();
  }, [userId]);

  return incomingCalls;
}