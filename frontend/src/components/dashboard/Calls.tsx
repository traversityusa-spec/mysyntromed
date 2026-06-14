import { useState, useEffect } from 'react';
import { Phone, Video, Calendar, Clock, Plus, History, ExternalLink, X, Search, Users, Check } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { API_BASE_URL, db, notificationService } from '@/lib/firestore';
import { collection, query, where, getDocs, addDoc, serverTimestamp, type DocumentData } from 'firebase/firestore';
import { getSocket } from '@/lib/socket';

type ScheduledCall = {
  id: string;
  specialist: string;
  date: string;
  time: string;
  meetLink: string;
  status: 'upcoming' | 'completed' | 'cancelled';
};

const notifyAdminOfCall = async (type: 'scheduled' | 'instant', specialistName?: string, date?: string, time?: string) => {
  try {
    const token = await import('firebase/auth').then(m => m.getAuth().currentUser?.getIdToken());
    if (!token) return;
    fetch(`${API_BASE_URL}/api/notify/call`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ type, specialistName, date, time, loginUrl: window.location.origin }),
    }).catch((err) => console.warn('[CALLS] Failed to notify admin:', err));
  } catch (err) {
    console.warn('[CALLS] Error notifying admin:', err);
  }
};

const Calls = () => {
  const { sessionUser, user } = useAuth();
  const [showSchedule, setShowSchedule] = useState(false);
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  const [upcomingCalls, setUpcomingCalls] = useState<ScheduledCall[]>([]);
  const [pastCalls, setPastCalls] = useState<ScheduledCall[]>([]);
  const [loading, setLoading] = useState(true);

  const [showParticipants, setShowParticipants] = useState(false);
  const [availableUsers, setAvailableUsers] = useState<{ uid: string; displayName: string; email: string | null; role: string; photoURL?: string }[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [callType, setCallType] = useState<'voice' | 'video'>('video');

  useEffect(() => {
    const fetchCalls = async () => {
      if (!sessionUser?.uid) return;
      setLoading(true);
      try {
        const q = query(
          collection(db, 'calls'),
          where('userId', '==', sessionUser.uid)
        );
        const snapshot = await getDocs(q);
        const allCalls: ScheduledCall[] = snapshot.docs.map((doc) => {
          const data = doc.data() as DocumentData;
          return {
            id: doc.id,
            specialist: data.specialist || '',
            date: data.date || '',
            time: data.time || '',
            meetLink: data.meetLink || '',
            status: data.status || 'upcoming',
          };
        });
        allCalls.sort((a, b) => String(b.date).localeCompare(String(a.date)));
        setUpcomingCalls(allCalls.filter(c => c.status === 'upcoming'));
        setPastCalls(allCalls.filter(c => c.status === 'completed' || c.status === 'cancelled'));
      } catch (err) {
        console.error('[CALLS] Failed to fetch calls:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchCalls();
  }, [sessionUser?.uid]);

  useEffect(() => {
    if (!showParticipants && !showSchedule) return;
    const fetchUsers = async () => {
      try {
        const token = await import('firebase/auth').then(m => m.getAuth().currentUser?.getIdToken());
        if (!token) return;
        const res = await fetch(`${API_BASE_URL}/api/auth/call-participants`, {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        if (!res.ok) throw new Error('Failed to fetch participants');
        const data = await res.json();
        const formatted = (data.users || [])
          .filter((u: any) => u.uid !== user?.uid)
          .map((u: any) => ({
            uid: u.uid,
            displayName: u.displayName || u.email?.split('@')[0] || 'Unknown',
            email: u.email || '',
            role: u.role === 'admin' ? 'admin' : u.role === 'specialist' ? 'specialist' : 'client',
            photoURL: u.photoURL || '',
          }));
        setAvailableUsers(formatted);
      } catch (err) {
        console.error('[CALLS] Failed to fetch users:', err);
      }
    };
    fetchUsers();
  }, [showParticipants, showSchedule, sessionUser?.uid, sessionUser?.role, user?.uid]);

  const handleSchedule = async () => {
    if (selectedUsers.length === 0 || !scheduleDate || !scheduleTime) return;
    const formattedDate = new Date(scheduleDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    const formattedTime = new Date(`2000-01-01T${scheduleTime}`).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    const participantNames = selectedUsers.map(uid => availableUsers.find(u => u.uid === uid)?.displayName || uid).join(', ');
    const newCall: ScheduledCall = {
      id: Date.now().toString(),
      specialist: participantNames,
      date: formattedDate,
      time: formattedTime,
      meetLink: '',
      status: 'upcoming',
    };
    setUpcomingCalls(prev => [...prev, newCall]);
    notifyAdminOfCall('scheduled', newCall.specialist, formattedDate, formattedTime);

    const callerName = sessionUser?.displayName || 'Someone';

    try {
      await addDoc(collection(db, 'calls'), {
        userId: sessionUser?.uid,
        specialist: newCall.specialist,
        participantIds: selectedUsers,
        date: formattedDate,
        time: formattedTime,
        meetLink: '',
        status: 'upcoming',
        createdAt: serverTimestamp(),
      });
    } catch (err) {
      console.error('[CALLS] Failed to save scheduled call:', err);
    }

    selectedUsers.forEach(uid => {
      notificationService.addNotification({
        userId: uid,
        title: 'Scheduled Call',
        message: `${callerName} scheduled a call with you on ${formattedDate} at ${formattedTime}`,
        type: 'system',
      }).catch(err => console.error('[CALLS] Failed to notify participant:', err));
    });

    setShowSchedule(false);
    setScheduleDate('');
    setScheduleTime('');
    setSelectedUsers([]);
  };

  const toggleUser = (uid: string) => {
    setSelectedUsers(prev =>
      prev.includes(uid) ? prev.filter(id => id !== uid) : [...prev, uid]
    );
  };

  const handleStartInstantCall = () => {
    setSelectedUsers([]);
    setSearchQuery('');
    setCallType('video');
    setShowParticipants(true);
  };

  const startCallWithParticipants = () => {
    if (selectedUsers.length === 0) return;
    const roomCode = `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 10)}`;
    const meetUrl = `https://meet.jit.si/${roomCode}`;
    window.dispatchEvent(new CustomEvent('call:start', { detail: { roomName: roomCode, meetingLink: meetUrl, callType } }));
    notifyAdminOfCall('instant', sessionUser?.displayName || sessionUser?.assignedSpecialistName || 'User');
    const callerName = sessionUser?.displayName || 'User';
    const socket = getSocket();
    selectedUsers.forEach(targetId => {
      if (socket?.connected && user?.uid) {
        socket.emit('callInvite', {
          to: targetId,
          callType,
          callerId: user.uid,
          callerName,
          meetingLink: meetUrl,
          sessionId: roomCode,
        });
      }
      notificationService.addNotification({
        userId: targetId,
        title: `Incoming ${callType === 'voice' ? 'Voice' : 'Video'} Call`,
        message: `${callerName} is calling you`,
        type: 'call',
        data: { meetingLink: meetUrl, roomName: roomCode, callType, callerId: user?.uid, callerName },
      }).catch(err => console.error('[CALLS] Failed to save call notification:', err));
    });
    setShowParticipants(false);
    setSelectedUsers([]);
  };

  const filteredUsers = availableUsers.filter(u =>
    u.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (u.email && u.email.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">Calls</h1>
          <p className="mt-1 text-sm text-slate-500">Schedule and manage meetings</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleStartInstantCall}
            className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-teal-700 transition"
          >
            <Video size={18} />
            Start Instant Call
          </button>
          <button
            onClick={() => { setShowSchedule(true); setSelectedUsers([]); setSearchQuery(''); }}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
          >
            <Plus size={18} />
            Schedule New Call
          </button>
        </div>
      </div>

      {showSchedule && (
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-navy-900">Schedule a Call</h2>
            <button onClick={() => { setShowSchedule(false); setSearchQuery(''); setScheduleDate(''); setScheduleTime(''); }} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
              <X size={20} />
            </button>
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-700 mb-2">Who are you calling?</label>
            <div className="relative mb-2">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search participants..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-10 pr-4 text-sm outline-none focus:border-teal-500 focus:bg-white transition"
              />
            </div>
            <div className="max-h-40 overflow-y-auto rounded-lg border border-slate-100">
              {filteredUsers.length > 0 ? filteredUsers.map((u) => {
                const isSelected = selectedUsers.includes(u.uid);
                return (
                  <button
                    key={u.uid}
                    onClick={() => toggleUser(u.uid)}
                    className={`flex w-full items-center gap-3 px-3 py-2 text-left transition border-b border-slate-50 last:border-0 ${
                      isSelected ? 'bg-teal-50' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border-2 transition ${
                      isSelected ? 'border-teal-600 bg-teal-600' : 'border-slate-300'
                    }`}>
                      {isSelected && <Check size={12} className="text-white" />}
                    </div>
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-teal-400 to-teal-600 text-xs font-bold text-white shrink-0">
                      {u.displayName.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-sm font-medium text-slate-900">{u.displayName}</p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                      u.role === 'specialist' ? 'bg-purple-100 text-purple-700' :
                      u.role === 'admin' ? 'bg-teal-100 text-teal-700' :
                      'bg-blue-100 text-blue-700'
                    }`}>
                      {u.role === 'specialist' ? 'Specialist' : u.role === 'admin' ? 'Admin' : 'Client'}
                    </span>
                  </button>
                );
              }) : (
                <p className="px-3 py-4 text-center text-sm text-slate-400">No participants found</p>
              )}
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Date</label>
              <input
                type="date"
                value={scheduleDate}
                onChange={(e) => setScheduleDate(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-teal-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Time</label>
              <input
                type="time"
                value={scheduleTime}
                onChange={(e) => setScheduleTime(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-teal-500"
              />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2 rounded-lg bg-blue-50 p-3 text-sm text-blue-700">
            <ExternalLink size={16} />
            <span>Video link will be available at call time</span>
          </div>
          <button
            onClick={handleSchedule}
            disabled={selectedUsers.length === 0 || !scheduleDate || !scheduleTime}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50 transition"
          >
            <Calendar size={18} />
            {selectedUsers.length > 0 ? `Schedule with ${selectedUsers.length} participant${selectedUsers.length > 1 ? 's' : ''}` : 'Confirm Schedule'}
          </button>
        </div>
      )}

      {/* Participants Selection Modal */}
      {showParticipants && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-16">
          <div className="mx-4 w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 p-4">
              <h3 className="text-lg font-bold text-navy-900">Start a Call</h3>
              <button
                onClick={() => { setShowParticipants(false); setSelectedUsers([]); setSearchQuery(''); }}
                className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-4">
              <p className="mb-3 text-sm text-slate-600">Select who you want to call:</p>
              <div className="relative mb-3">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search participants..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm outline-none focus:border-teal-500 focus:bg-white transition"
                  autoFocus
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setCallType('video')}
                  className={`flex-1 flex items-center justify-center gap-2 rounded-lg border py-2 text-sm font-medium transition ${
                    callType === 'video'
                      ? 'border-teal-600 bg-teal-50 text-teal-700'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Video size={16} />
                  Video
                </button>
                <button
                  onClick={() => setCallType('voice')}
                  className={`flex-1 flex items-center justify-center gap-2 rounded-lg border py-2 text-sm font-medium transition ${
                    callType === 'voice'
                      ? 'border-teal-600 bg-teal-50 text-teal-700'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Phone size={16} />
                  Voice
                </button>
              </div>
            </div>
            <div className="max-h-64 overflow-y-auto border-t border-slate-100">
              {filteredUsers.length > 0 ? (
                filteredUsers.map((u) => {
                  const isSelected = selectedUsers.includes(u.uid);
                  return (
                    <button
                      key={u.uid}
                      onClick={() => toggleUser(u.uid)}
                      className={`flex w-full items-center gap-3 px-4 py-3 text-left transition border-b border-slate-50 last:border-0 ${
                        isSelected ? 'bg-teal-50' : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className={`flex h-5 w-5 items-center justify-center rounded border-2 transition ${
                        isSelected ? 'border-teal-600 bg-teal-600' : 'border-slate-300'
                      }`}>
                        {isSelected && <Check size={12} className="text-white" />}
                      </div>
                      <div className="relative">
                        {u.photoURL ? (
                          <img src={u.photoURL} alt={u.displayName} className="h-10 w-10 rounded-full object-cover" />
                        ) : (
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-teal-400 to-teal-600 text-sm font-bold text-white">
                            {u.displayName.charAt(0).toUpperCase()}
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="truncate font-semibold text-slate-900">{u.displayName}</p>
                          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                            u.role === 'specialist' ? 'bg-purple-100 text-purple-700' :
                            u.role === 'admin' ? 'bg-teal-100 text-teal-700' :
                            'bg-blue-100 text-blue-700'
                          }`}>
                            {u.role === 'specialist' ? 'Specialist' : u.role === 'admin' ? 'Admin' : 'Client'}
                          </span>
                        </div>
                        {u.email && (
                          <p className="truncate text-xs text-slate-400">{u.email}</p>
                        )}
                      </div>
                    </button>
                  );
                })
              ) : (
                <div className="flex flex-col items-center py-8 text-slate-400">
                  <Users size={24} className="mb-2" />
                  <p className="text-sm font-medium">No users found</p>
                  <p className="text-xs">Try a different search term</p>
                </div>
              )}
            </div>
            <div className="border-t border-slate-100 p-4 flex items-center justify-between">
              <p className="text-xs text-slate-500">
                {selectedUsers.length > 0
                  ? `${selectedUsers.length} participant${selectedUsers.length > 1 ? 's' : ''} selected`
                  : 'Select at least one participant'}
              </p>
              <button
                onClick={startCallWithParticipants}
                disabled={selectedUsers.length === 0}
                className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {callType === 'video' ? <Video size={16} /> : <Phone size={16} />}
                Start {callType === 'video' ? 'Video' : 'Voice'} Call
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 p-5">
          <h2 className="text-lg font-semibold text-navy-900 flex items-center gap-2">
            <Clock size={18} className="text-teal-600" />
            Upcoming Calls
          </h2>
        </div>
        {loading ? (
          <div className="p-8 text-center text-slate-500">Loading calls...</div>
        ) : upcomingCalls.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            <Calendar size={32} className="mx-auto mb-2 text-slate-300" />
            <p>No upcoming calls</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {upcomingCalls.map((call) => (
              <div key={call.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5">
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-teal-100 text-teal-600">
                    <Video size={18} />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">{call.specialist}</p>
                    <p className="text-sm text-slate-500 flex items-center gap-2">
                      <Calendar size={14} />
                      {call.date}
                      <Clock size={14} />
                      {call.time}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <a
                    href={call.meetLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-3 py-2 text-xs font-medium text-white hover:bg-teal-700 transition"
                  >
                    <Video size={14} />
                    Join
                  </a>
                  <button className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 transition">
                    Reschedule
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 p-5">
          <h2 className="text-lg font-semibold text-navy-900 flex items-center gap-2">
            <History size={18} className="text-slate-500" />
            Meeting History
          </h2>
        </div>
        {loading ? (
          <div className="p-8 text-center text-slate-500">Loading...</div>
        ) : pastCalls.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            <History size={32} className="mx-auto mb-2 text-slate-300" />
            <p>No past calls</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {pastCalls.map((call) => (
              <div key={call.id} className="flex items-center justify-between p-5">
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                    <Phone size={18} />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">{call.specialist}</p>
                    <p className="text-sm text-slate-500">{call.date} at {call.time}</p>
                  </div>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                  Completed
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Calls;
