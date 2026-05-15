import { useState } from 'react';
import { Phone, Video, Calendar, Clock, Plus, History, ExternalLink, X, ChevronRight } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { API_BASE_URL } from '@/lib/firestore';

type ScheduledCall = {
  id: string;
  specialist: string;
  date: string;
  time: string;
  meetLink: string;
  status: 'upcoming' | 'completed' | 'cancelled';
};

const mockUpcomingCalls: ScheduledCall[] = [
  { id: '1', specialist: 'Dr. Sarah Chen', date: 'May 15, 2026', time: '10:00 AM', meetLink: 'https://meet.google.com/abc-defg-hij', status: 'upcoming' },
  { id: '2', specialist: 'Dr. Sarah Chen', date: 'May 18, 2026', time: '2:00 PM', meetLink: 'https://meet.google.com/xyz-uvwx-stu', status: 'upcoming' },
];

const mockPastCalls: ScheduledCall[] = [
  { id: '3', specialist: 'Dr. Sarah Chen', date: 'May 8, 2026', time: '11:00 AM', meetLink: 'https://meet.google.com/lmn-opqr-stu', status: 'completed' },
  { id: '4', specialist: 'Dr. Sarah Chen', date: 'May 1, 2026', time: '3:00 PM', meetLink: 'https://meet.google.com/def-ghij-klm', status: 'completed' },
];

const notifyAdminOfCall = async (type: 'scheduled' | 'instant', specialistName?: string, date?: string, time?: string) => {
  try {
    const token = await import('firebase/auth').then(m => m.getAuth().currentUser?.getIdToken());
    if (!token) return;
    fetch(`${API_BASE_URL}/api/notify/call`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ type, specialistName, date, time, loginUrl: window.location.origin }),
    }).catch(() => {});
  } catch {}
};

const Calls = () => {
  const { sessionUser } = useAuth();
  const [showSchedule, setShowSchedule] = useState(false);
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  const [upcomingCalls, setUpcomingCalls] = useState(mockUpcomingCalls);
  const [pastCalls] = useState(mockPastCalls);

  const handleSchedule = () => {
    if (!scheduleDate || !scheduleTime) return;
    const formattedDate = new Date(scheduleDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    const formattedTime = new Date(`2000-01-01T${scheduleTime}`).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    const newCall: ScheduledCall = {
      id: Date.now().toString(),
      specialist: sessionUser?.assignedSpecialistName || 'Dr. Sarah Chen',
      date: formattedDate,
      time: formattedTime,
      meetLink: 'https://meet.google.com/new-meeting-link',
      status: 'upcoming',
    };
    setUpcomingCalls(prev => [...prev, newCall]);
    notifyAdminOfCall('scheduled', newCall.specialist, formattedDate, formattedTime);
    setShowSchedule(false);
    setScheduleDate('');
    setScheduleTime('');
  };

  const handleStartInstantCall = () => {
    notifyAdminOfCall('instant', sessionUser?.assignedSpecialistName || 'Specialist');
    window.open('https://meet.google.com/new', '_blank');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">Calls</h1>
          <p className="mt-1 text-sm text-slate-500">Schedule and manage meetings with your specialist</p>
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
            onClick={() => setShowSchedule(true)}
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
            <button onClick={() => setShowSchedule(false)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
              <X size={20} />
            </button>
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
            <span>Google Meet link will be generated automatically</span>
          </div>
          <button
            onClick={handleSchedule}
            disabled={!scheduleDate || !scheduleTime}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50 transition"
          >
            <Calendar size={18} />
            Confirm Schedule
          </button>
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 p-5">
          <h2 className="text-lg font-semibold text-navy-900 flex items-center gap-2">
            <Clock size={18} className="text-teal-600" />
            Upcoming Calls
          </h2>
        </div>
        {upcomingCalls.length === 0 ? (
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
        {pastCalls.length === 0 ? (
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
