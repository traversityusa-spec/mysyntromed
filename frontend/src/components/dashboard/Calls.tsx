import { type FormEvent, useEffect, useState } from 'react';
import {
  AlertTriangle,
  Calendar,
  CalendarPlus,
  Check,
  Clock,
  RefreshCw,
  Shield,
  Video,
  X,
  Phone,
} from 'lucide-react';
import { useCalls } from '@/lib/dashboard';
import { useAuth } from '@/lib/AuthContext';
import { collection, getDocs, query, where, doc, updateDoc } from 'firebase/firestore';
import { useSearchParams } from 'react-router-dom';
import { db, liveCallService, notificationService, type CallSession, type ScheduledCall, type UserProfile } from '@/lib/firestore';

const checkMediaPermissions = async (): Promise<{ camera: boolean; microphone: boolean }> => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    stream.getTracks().forEach(track => track.stop());
    return { camera: true, microphone: true };
  } catch {
    try {
      const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStream.getTracks().forEach(track => track.stop());
      return { camera: false, microphone: true };
    } catch {
      return { camera: false, microphone: false };
    }
  }
};

const Calls = () => {
  const { user, sessionUser } = useAuth();
  const { upcomingCalls, pastCalls, loading, scheduleCall, refreshCalls } = useCalls();
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [callTitle, setCallTitle] = useState('');
  const [callDate, setCallDate] = useState('');
  const [callTime, setCallTime] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeCallLink, setActiveCallLink] = useState<string | null>(null);
  const [incomingCalls, setIncomingCalls] = useState<CallSession[]>([]);
  const [activeSession, setActiveSession] = useState<CallSession | null>(null);
  const [outgoingSessionId, setOutgoingSessionId] = useState<string | null>(null);
  const [callStatus, setCallStatus] = useState<string | null>(null);
  const [assignedClients, setAssignedClients] = useState<UserProfile[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [rescheduleCall, setRescheduleCall] = useState<ScheduledCall | null>(null);
  const [showCallTypeSelection, setShowCallTypeSelection] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();

  const role = sessionUser?.role || 'client';

  useEffect(() => {
    if (role !== 'specialist' || !user?.uid) return;
    const loadClients = async () => {
      try {
        const snap = await getDocs(query(collection(db, 'users'), where('role', '==', 'client')));
        const clients = snap.docs.map(d => ({ uid: d.id, ...d.data() } as UserProfile));
        setAssignedClients(clients);
        if (!selectedClientId && clients.length > 0) setSelectedClientId(clients[0].uid);
      } catch (e) {
        console.error('Failed to load clients', e);
      }
    };
    loadClients();
  }, [role, user?.uid, selectedClientId]);

  useEffect(() => {
    const joinSessionId = searchParams.get('join');
    if (joinSessionId) {
      setOutgoingSessionId(joinSessionId);
      setSearchParams({});
    }
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    if (!outgoingSessionId) return;
    const unsub = liveCallService.subscribeToSession(outgoingSessionId, (session) => {
      if (!session) return;
      if (session.status === 'accepted') {
        setActiveSession(session);
        setActiveCallLink(session.meetingLink);
        setCallStatus('Connected');
      } else if (session.status === 'rejected') {
        setCallStatus('Rejected');
        setOutgoingSessionId(null);
      } else if (session.status === 'ended') {
        setCallStatus('Ended');
        setOutgoingSessionId(null);
        setActiveSession(null);
        setActiveCallLink(null);
      }
    });
    return () => unsub();
  }, [outgoingSessionId]);

  const handleSchedule = async (e: FormEvent) => {
    e.preventDefault();
    if (!callTitle || !callDate || !callTime) return;
    if (role === 'specialist' && !selectedClientId) {
      setError('Select a client to schedule a call.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const scheduledDate = new Date(`${callDate}T${callTime}`);
      await scheduleCall({
        title: callTitle,
        date: scheduledDate,
        userId: role === 'specialist' ? selectedClientId : undefined,
      });
      setSubmitted(true);
      setTimeout(() => {
        setShowScheduleForm(false);
        setSubmitted(false);
        setCallTitle('');
        setCallDate('');
        setCallTime('');
      }, 2000);
    } catch (err) {
      setError('Failed to schedule call. Please try again.');
      console.error('Error scheduling call:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleStartCall = async (meetingLink?: string, call?: ScheduledCall) => {
    const permissions = await checkMediaPermissions();
    if (!permissions.camera || !permissions.microphone) {
      setError('Camera or microphone access denied. Please allow access to start video calls.');
      return;
    }
    const link = meetingLink || `https://meet.jit.si/mysyntromed-instant-${Date.now()}`;
    if (link.includes('meet.google.com')) {
      window.open(link, '_blank');
    } else {
      setActiveCallLink(link);
    }
  };

  const handleReschedule = (call: ScheduledCall) => {
    setRescheduleCall(call);
    setCallTitle(call.title);
    const callDateTime = new Date(call.date);
    setCallDate(callDateTime.toISOString().split('T')[0]);
    setCallTime(callDateTime.toTimeString().slice(0, 5));
    setShowScheduleForm(true);
  };

  const handleConfirmReschedule = async (e: FormEvent) => {
    e.preventDefault();
    if (!rescheduleCall || !callDate || !callTime) return;

    setSubmitting(true);
    setError(null);

    try {
      const newDate = new Date(`${callDate}T${callTime}`);
      const docRef = doc(db, 'calls', rescheduleCall.id);
      await updateDoc(docRef, { date: newDate });

      const targetUserId = role === 'specialist' ? rescheduleCall.userId : rescheduleCall.specialistId;
      if (targetUserId) {
        const formattedDate = newDate.toLocaleString('en-US', {
          weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
        });
        await notificationService.addNotification({
          userId: targetUserId,
          title: 'Call Rescheduled',
          message: `${(sessionUser as any)?.displayName || 'The other party'} rescheduled the call to ${formattedDate}.`,
          type: 'call'
        });
      }

      setRescheduleCall(null);
      setShowScheduleForm(false);
      setSubmitted(true);
      setTimeout(() => {
        setSubmitted(false);
        setCallTitle('');
        setCallDate('');
        setCallTime('');
      }, 2000);
      refreshCalls();
    } catch (err) {
      setError('Failed to reschedule call. Please try again.');
      console.error('Error rescheduling call:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleStartInstantCall = async (type: 'audio' | 'video') => {
    if (!user?.uid || !sessionUser) return;

    const permissions = await checkMediaPermissions();
    if (!permissions.camera && !permissions.microphone) {
      setError('Camera and microphone access denied. Please allow access to start video calls.');
      return;
    }

    setCallStatus(null);
    setShowCallTypeSelection(false);
    const meetingLink = `https://meet.jit.si/mysyntromed-live-${Date.now()}-${Math.random().toString(36).slice(2, 8)}${type === 'audio' ? '#config.startAudioOnly=true' : ''}`;

    if (role === 'client') {
      try {
        const receiverId = sessionUser.assignedSpecialistId;
        const receiverName = sessionUser.assignedSpecialistName;
        if (!receiverId || !receiverName) {
          setError('No specialist assigned yet.');
          return;
        }
        const sessionId = await liveCallService.createSession({
          callerId: user.uid,
          callerName: sessionUser.displayName || 'Client',
          callerRole: 'client',
          receiverId,
          receiverName,
          receiverRole: 'specialist',
          meetingLink,
          callType: type,
        });
        setOutgoingSessionId(sessionId);
        setCallStatus('Calling specialist…');
      } catch (err) {
        setError('Failed to start a call. Please try again.');
      }
      return;
    }

    if (role === 'specialist') {
      const client = assignedClients.find(c => c.uid === selectedClientId);
      if (!client) {
        setError('Select a client to start a call.');
        return;
      }
      const sessionId = await liveCallService.createSession({
        callerId: user.uid,
        callerName: sessionUser.displayName || 'Specialist',
        callerRole: 'specialist',
        receiverId: client.uid,
        receiverName: client.displayName || client.email || 'Client',
        receiverRole: 'client',
        meetingLink,
        callType: type,
      });
      setOutgoingSessionId(sessionId);
      setCallStatus('Calling client…');
    }
  };

  const handleAcceptCall = async (session: CallSession) => {
    await liveCallService.updateStatus(session.id, 'accepted');
    setActiveSession(session);
    setActiveCallLink(session.meetingLink);
  };

  const handleRejectCall = async (session: CallSession) => {
    await liveCallService.updateStatus(session.id, 'rejected');
  };

  const handleEndLiveCall = async () => {
    if (activeSession?.id) {
      await liveCallService.updateStatus(activeSession.id, 'ended');
    }
    setActiveSession(null);
    setActiveCallLink(null);
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatTime = (date: Date) => {
    return new Date(date).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">Calls</h1>
          <p className="mt-1 text-slate-600">Manage your consultations and meetings</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowCallTypeSelection(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-700"
          >
            <Video size={18} />
            Start Instant Call
          </button>
          <button
            onClick={() => setShowScheduleForm(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-teal-700"
          >
            <CalendarPlus size={18} />
            Schedule New Call
          </button>
        </div>
      </div>

      {showCallTypeSelection && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
            <h3 className="mb-4 text-center text-lg font-semibold text-navy-900">Select Call Type</h3>
            <div className="flex gap-4">
              <button
                onClick={() => handleStartInstantCall('audio')}
                className="flex flex-1 flex-col items-center justify-center gap-2 rounded-lg border border-slate-200 p-4 transition hover:border-teal-500 hover:bg-slate-50"
              >
                <div className="rounded-full bg-teal-100 p-3 text-teal-600">
                  <Phone size={24} />
                </div>
                <span className="font-medium text-slate-700">Audio Call</span>
              </button>
              <button
                onClick={() => handleStartInstantCall('video')}
                className="flex flex-1 flex-col items-center justify-center gap-2 rounded-lg border border-slate-200 p-4 transition hover:border-teal-500 hover:bg-slate-50"
              >
                <div className="rounded-full bg-teal-100 p-3 text-teal-600">
                  <Video size={24} />
                </div>
                <span className="font-medium text-slate-700">Video Call</span>
              </button>
            </div>
            <button
              onClick={() => setShowCallTypeSelection(false)}
              className="mt-6 w-full rounded-lg border border-slate-200 py-2 font-medium text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {activeCallLink ? (
        <div className="flex h-[calc(100vh-12rem)] flex-col overflow-hidden rounded-xl border border-slate-200 bg-black">
          <div className="flex items-center justify-between bg-slate-900 px-4 py-3 text-white">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
              <span className="text-sm font-medium">Video Consultation Active</span>
            </div>
            <button
              onClick={handleEndLiveCall}
              className="flex items-center gap-1 rounded bg-red-600 px-3 py-1.5 text-xs font-semibold hover:bg-red-700"
            >
              <X size={14} />
              End Call
            </button>
          </div>
          <iframe
            src={activeCallLink}
            allow="camera; microphone; fullscreen; display-capture"
            className="h-full w-full border-0"
          />
        </div>
      ) : (
        <>
      {callStatus && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
          {callStatus}
        </div>
      )}

      {showScheduleForm && (
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-navy-900">Schedule a New Call</h2>
            <button
              onClick={() => setShowScheduleForm(false)}
              className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            >
              <X size={20} />
            </button>
          </div>

          {error && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {submitted ? (
            <div className="flex flex-col items-center justify-center py-8">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
                <Check size={32} className="text-emerald-600" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900">Call Scheduled!</h3>
              <p className="mt-1 text-sm text-slate-500">
                Your meeting link will be sent via email and in your messages.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSchedule} className="space-y-5">
              {role === 'specialist' && (
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">Client</label>
                  <select
                    value={selectedClientId}
                    onChange={(e) => setSelectedClientId(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-teal-500"
                  >
                    <option value="">Select a client</option>
                    {assignedClients.map(c => (
                      <option key={c.uid} value={c.uid}>
                        {c.displayName || c.email || c.uid}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Meeting Title</label>
                <input
                  type="text"
                  value={callTitle}
                  onChange={(e) => setCallTitle(e.target.value)}
                  required
                  placeholder="e.g., Weekly Workflow Review"
                  className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-teal-500"
                />
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">Date</label>
                  <div className="relative">
                    <Calendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="date"
                      value={callDate}
                      onChange={(e) => setCallDate(e.target.value)}
                      required
                      min={new Date().toISOString().split('T')[0]}
                      className="w-full rounded-lg border border-slate-200 py-2.5 pl-10 pr-4 text-sm outline-none focus:border-teal-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">Time</label>
                  <div className="relative">
                    <Clock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="time"
                      value={callTime}
                      onChange={(e) => setCallTime(e.target.value)}
                      required
                      className="w-full rounded-lg border border-slate-200 py-2.5 pl-10 pr-4 text-sm outline-none focus:border-teal-500"
                    />
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-start gap-3">
                  <Video size={18} className="mt-0.5 text-slate-500" />
                  <div>
                    <p className="text-sm font-medium text-slate-700">In-App Video Integration</p>
                    <p className="mt-1 text-xs text-slate-500">
                      A secure video meeting link will be automatically generated and shared with your specialist.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowScheduleForm(false)}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !callTitle || !callDate || !callTime}
                  className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {submitting ? (
                    <>
                      <RefreshCw size={16} className="animate-spin" />
                      Scheduling...
                    </>
                  ) : (
                    <>
                      <CalendarPlus size={16} />
                      Schedule Call
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-teal-500 border-t-transparent" />
        </div>
      ) : (
        <>
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-white">
              <div className="flex items-center justify-between border-b border-slate-200 p-4">
                <h2 className="text-lg font-semibold text-navy-900">Upcoming Calls</h2>
                <button
                  onClick={() => refreshCalls()}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                >
                  <RefreshCw size={16} />
                </button>
              </div>
              <div className="p-4">
                {upcomingCalls.length > 0 ? (
                  <div className="space-y-3">
                    {upcomingCalls.map((call) => (
                      <div
                        key={call.id}
                        className="flex items-start justify-between rounded-lg border border-slate-200 p-4"
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-50 text-teal-600">
                            <Calendar size={18} />
                          </div>
                          <div>
                            <p className="font-medium text-slate-900">{call.title}</p>
                            <p className="mt-1 text-sm text-slate-500">
                              {formatDate(call.date)} • {formatTime(call.date)}
                            </p>
                            <p className="mt-0.5 text-xs text-slate-400">{call.specialistName}</p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          {call.meetingLink && (
                            <button
                              onClick={() => handleStartCall(call.meetingLink, call)}
                              className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700"
                            >
                              Join
                            </button>
                          )}
                          <button
                            onClick={() => handleReschedule(call)}
                            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                          >
                            Reschedule
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center py-8 text-slate-500">
                    <Calendar size={32} className="mb-2 text-slate-300" />
                    <p className="text-sm">No upcoming calls</p>
                    <button
                      onClick={() => setShowScheduleForm(true)}
                      className="mt-2 text-sm text-teal-600 hover:underline"
                    >
                      Schedule a meeting
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white">
              <div className="border-b border-slate-200 p-4">
                <h2 className="text-lg font-semibold text-navy-900">Meeting History</h2>
              </div>
              <div className="p-4">
                {pastCalls.length > 0 ? (
                  <div className="space-y-3">
                    {pastCalls.map((call) => (
                      <div
                        key={call.id}
                        className="flex items-start gap-3 rounded-lg border border-slate-100 p-3"
                      >
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                          <Check size={18} />
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-slate-900">{call.title}</p>
                          <p className="mt-0.5 text-sm text-slate-500">
                            {formatDate(call.date)} • {call.status}
                          </p>
                          <p className="mt-0.5 text-xs text-slate-400">{call.specialistName}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center py-8 text-slate-500">
                    <Clock size={32} className="mb-2 text-slate-300" />
                    <p className="text-sm">No past meetings</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <h2 className="text-lg font-semibold text-navy-900">Integration</h2>
            <div className="mt-4 flex items-center gap-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-teal-100 text-teal-600">
                <Video size={24} />
              </div>
              <div>
                <p className="font-medium text-slate-900">In-App Video System</p>
                <p className="text-sm text-slate-500">
                  All scheduled and instant calls run securely inside your dashboard without leaving the portal.
                </p>
              </div>
              <div className="ml-auto">
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700">
                  <Check size={12} />
                  Active
                </span>
              </div>
            </div>
          </div>
        </>
      )}
        </>
      )}
    </div>
  );
};

export default Calls;
