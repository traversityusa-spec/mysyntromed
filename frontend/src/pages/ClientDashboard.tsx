import { useMemo, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Bell,
  CheckCircle,
  ClipboardCheck,
  Clock3,
  LogOut,
  MessageCircle,
  ShieldCheck,
  Stethoscope,
  UserPlus,
} from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { notificationService, requestService, messageService } from '@/lib/firestore';
import type { AppNotification, Request } from '@/lib/firestore';
import { query, collection, where, orderBy, getDocs, limit as firestoreLimit } from 'firebase/firestore';
import { db } from '@/lib/firestore';

const stats = [
  { label: 'Open Requests', value: '3', sub: '2 in progress' },
  { label: 'Unread Messages', value: '5', sub: 'From your specialist' },
  { label: 'Next Call', value: '2:00 PM', sub: 'Tomorrow' },
  { label: 'Compliance', value: '100%', sub: 'HIPAA-ready workflows' },
];

const recentUpdates = [
  { title: 'Prior auth follow-up completed', time: '1h ago', type: 'Request' },
  { title: 'Specialist sent billing clarification', time: '3h ago', type: 'Message' },
  { title: 'Patient coordination list updated', time: 'Today', type: 'Task' },
];

const upcoming = [
  { title: 'Specialist check-in call', when: 'Tomorrow • 2:00 PM' },
  { title: 'Weekly workflow review', when: 'Friday • 10:30 AM' },
];

const quickActions = [
  { label: 'Create Request', hint: 'Submit a new operational task', to: '/contact' },
  { label: 'Message Specialist', hint: 'Send an update or question', to: '/contact' },
  { label: 'Book Consultation', hint: 'Schedule support call', to: '/contact' },
];

const ClientDashboard = () => {
  const navigate = useNavigate();
  const { sessionUser, logout, refreshSessionUser } = useAuth();
  const [assignmentNotification, setAssignmentNotification] = useState<AppNotification | null>(null);
  const [openRequests, setOpenRequests] = useState(0);
  const [inProgressRequests, setInProgressRequests] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [recentActivity, setRecentActivity] = useState<{ title: string; time: string; type: string }[]>([]);
  const [loading, setLoading] = useState(true);

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  }, []);

  const hasAssignment = !!sessionUser?.assignedSpecialistId;

  useEffect(() => {
    if (!sessionUser?.uid) return;
    setLoading(true);

    const fetchDashboardData = async () => {
      try {
        const [requestsSnap, messagesSnap, activitySnap] = await Promise.all([
          getDocs(query(collection(db, 'requests'), where('userId', '==', sessionUser.uid))),
          getDocs(query(collection(db, 'messages'), where('participants', 'array-contains', sessionUser.uid), where('read', '==', false))),
          getDocs(query(collection(db, 'activity'), where('userId', '==', sessionUser.uid), orderBy('createdAt', 'desc'), firestoreLimit(5))),
        ]);

        const requests = requestsSnap.docs.map(d => ({ id: d.id, ...d.data() } as unknown as Request));
        setOpenRequests(requests.filter(r => r.status !== 'completed').length);
        setInProgressRequests(requests.filter(r => r.status === 'in_progress').length);
        setUnreadMessages(messagesSnap.size);

        setRecentActivity(
          activitySnap.docs.map(d => {
            const data = d.data();
            return {
              title: data.title || 'Activity',
              time: data.createdAt?.toDate?.() ? timeAgo(data.createdAt.toDate()) : '',
              type: data.type || 'Update',
            };
          })
        );
      } catch (err) {
        console.error('[DASHBOARD] Error fetching data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [sessionUser?.uid]);

  useEffect(() => {
    if (!sessionUser?.uid) return;
    const unsub = notificationService.subscribeToNotifications(sessionUser.uid, (items) => {
      const assignmentNotif = items.find(n => n.type === 'assignment' && !n.read);
      if (assignmentNotif) {
        setAssignmentNotification(assignmentNotif);
      }
    });
    return () => unsub();
  }, [sessionUser?.uid]);

  const timeAgo = (date: Date): string => {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 60) return 'Just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  const stats = [
    { label: 'Open Requests', value: String(openRequests), sub: `${inProgressRequests} in progress` },
    { label: 'Unread Messages', value: String(unreadMessages), sub: 'From your specialist' },
    { label: 'Compliance', value: '100%', sub: 'HIPAA-ready workflows' },
  ];

  const quickActions = [
    { label: 'Create Request', hint: 'Submit a new operational task', to: '/portal/requests' },
    { label: 'Message Specialist', hint: 'Send an update or question', to: '/portal/messages' },
    { label: 'Book Consultation', hint: 'Schedule support call', to: '/portal/calls' },
  ];

  const handleLogout = () => {
    void logout().finally(() => navigate('/portal'));
  };

  const dismissAssignmentNotification = async () => {
    setAssignmentNotification(null);
    await refreshSessionUser();
  };

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-4 md:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-600 text-white">
              <Stethoscope size={20} />
            </div>
            <div>
              <p className="text-xs font-semibold tracking-[0.18em] text-slate-500">MYSYNTROMED</p>
              <p className="text-base font-bold text-navy-900">Client Dashboard</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              className="rounded-lg border border-slate-200 p-2 text-slate-600 transition hover:bg-slate-50"
              aria-label="Notifications"
            >
              <Bell size={18} />
            </button>
            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              <LogOut size={16} />
              Log out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 py-6 md:px-8 md:py-8">
        {assignmentNotification && (
          <section className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100">
                  <UserPlus size={24} className="text-emerald-600" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-emerald-900">{assignmentNotification.title}</h2>
                  <p className="mt-1 text-sm text-emerald-800">{assignmentNotification.message}</p>
                </div>
              </div>
              <button
                onClick={dismissAssignmentNotification}
                className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 whitespace-nowrap"
              >
                <MessageCircle size={16} />
                Message Specialist
              </button>
            </div>
          </section>
        )}
        <section className="mb-6 rounded-2xl bg-gradient-to-r from-navy-900 via-navy-800 to-teal-700 p-6 text-white md:p-8">
          <p className="text-sm text-teal-200">{greeting}</p>
          <h1 className="mt-1 text-3xl font-bold text-white md:text-4xl">
            Welcome back{sessionUser?.displayName ? `, ${sessionUser.displayName}` : sessionUser?.email ? `, ${sessionUser.email.split('@')[0]}` : ', Client'}
          </h1>
          <div className="mt-3 flex items-center gap-2">
            {hasAssignment ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/20 px-3 py-1 text-sm text-emerald-200">
                <CheckCircle size={14} />
                Specialist Assigned: {sessionUser.assignedSpecialistName || 'Your Specialist'}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/20 px-3 py-1 text-sm text-amber-200">
                <Clock3 size={14} />
                Awaiting Specialist Assignment
              </span>
            )}
          </div>
          <p className="mt-2 max-w-2xl text-sm text-teal-100 md:text-base">
            Track your support requests, communicate with your specialist, and keep your operations moving in one place.
          </p>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {stats.map((card) => (
            <div key={card.label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{card.label}</p>
              <p className="mt-2 text-2xl font-bold text-navy-900">{card.value}</p>
              <p className="mt-1 text-sm text-slate-500">{card.sub}</p>
            </div>
          ))}
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-[1.5fr_1fr]">
          <article className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <h2 className="text-base font-semibold text-navy-900">Recent Activity</h2>
              <span className="text-xs font-medium text-slate-500">Live updates</span>
            </div>
            <div className="divide-y divide-slate-100">
              {loading ? (
                <div className="p-5 text-sm text-slate-500">Loading activity...</div>
              ) : recentActivity.length === 0 ? (
                <div className="p-5 text-sm text-slate-500">No recent activity</div>
              ) : recentActivity.map((item) => (
                <div key={item.title + item.time} className="flex items-start justify-between gap-3 px-5 py-4">
                  <div>
                    <p className="font-medium text-slate-900">{item.title}</p>
                    <p className="mt-1 text-sm text-slate-500">{item.type}</p>
                  </div>
                  <span className="text-xs text-slate-400">{item.time}</span>
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-5 py-4">
              <h2 className="text-base font-semibold text-navy-900">Upcoming</h2>
            </div>
            <div className="space-y-3 p-5">
              <p className="text-sm text-slate-500">Check your <Link to="/portal/calls" className="text-teal-600 hover:underline">scheduled calls</Link> for upcoming events.</p>
            </div>
          </article>
        </section>

        <section className="mt-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-3 inline-flex rounded-lg bg-teal-50 p-2 text-teal-700">
              <ClipboardCheck size={18} />
            </div>
            <h3 className="font-semibold text-navy-900">Request Tracking</h3>
            <p className="mt-1 text-sm text-slate-600">Submit requests and monitor status in real time.</p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-3 inline-flex rounded-lg bg-blue-50 p-2 text-blue-700">
              <MessageCircle size={18} />
            </div>
            <h3 className="font-semibold text-navy-900">Direct Messaging</h3>
            <p className="mt-1 text-sm text-slate-600">Keep communication fast with your assigned specialist.</p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-3 inline-flex rounded-lg bg-emerald-50 p-2 text-emerald-700">
              <ShieldCheck size={18} />
            </div>
            <h3 className="font-semibold text-navy-900">Secure & Compliant</h3>
            <p className="mt-1 text-sm text-slate-600">HIPAA-conscious support workflows for your practice.</p>
          </div>
        </section>

        <section className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <Clock3 size={16} className="text-teal-600" />
            <h2 className="font-semibold text-navy-900">Quick Actions</h2>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {quickActions.map((action) => (
              <Link
                key={action.label}
                to={action.to}
                className="rounded-lg border border-slate-200 p-4 transition hover:border-teal-200 hover:bg-teal-50/40"
              >
                <p className="font-medium text-slate-900">{action.label}</p>
                <p className="mt-1 text-sm text-slate-500">{action.hint}</p>
              </Link>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
};

export default ClientDashboard;
