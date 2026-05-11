import { useMemo, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  CalendarCheck,
  Check,
  Circle,
  ClipboardList,
  Clock,
  FileText,
  MessageSquare,
  Phone,
  Plus,
  RefreshCw,
  Shield,
  User,
} from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { useDashboardData, useUserProfile } from '@/lib/dashboard';
import { activityService } from '@/lib/firestore';
import SpecialistDashboard from './SpecialistDashboard';
import AdminDashboard from './AdminDashboard';
import { DateTimeDisplay } from '@/lib/datetime';

const quickActions = [
  { label: 'Message Specialist', icon: MessageSquare, to: '/portal/messages', color: 'bg-blue-50 text-blue-700' },
  { label: 'Submit Request', icon: Plus, to: '/portal/requests', color: 'bg-teal-50 text-teal-700' },
  { label: 'Urgent Support', icon: AlertTriangle, to: '/portal/requests', color: 'bg-red-50 text-red-700', urgent: true },
];

/* ------------------------------------------------------------------ */
/* Client-only dashboard content                                         */
/* ------------------------------------------------------------------ */
const ClientDashboardContent = () => {
  const { user, sessionUser } = useAuth();
  const { stats, activity, activityFilter, setActivityFilter, loading } = useDashboardData();
  const { profile, markAsOldUser } = useUserProfile();
  const [clinicStatus, setClinicStatus] = useState<'not_started' | 'in_progress' | 'completed'>('not_started');
  const [showWelcome, setShowWelcome] = useState(false);

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  }, []);

  const isNewUser = useMemo(() => profile?.isNewUser === true, [profile?.isNewUser]);

  const userName = useMemo(
    () => profile?.displayName || sessionUser?.email?.split('@')[0] || 'there',
    [profile?.displayName, sessionUser?.email]
  );

  useEffect(() => {
    if (isNewUser) setShowWelcome(true);
  }, [isNewUser]);

  const handleDismissWelcome = async () => {
    setShowWelcome(false);
    await markAsOldUser();
  };

  const handleClinicFinish = async () => {
    setClinicStatus('in_progress');
    if (user?.uid) {
      try {
        await activityService.addActivity({
          title: 'Clinic Day Finished',
          type: 'Workflow',
          userId: user.uid,
          specialistId: sessionUser?.assignedSpecialistId || '',
          specialistName: sessionUser?.assignedSpecialistName || 'Unassigned',
          status: 'completed',
        });
      } catch (error) {
        console.error('Error logging clinic finish:', error);
      }
    }
    setTimeout(() => setClinicStatus('completed'), 2000);
  };

  const formatTime = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    return 'Just now';
  };

  const filteredActivity = useMemo(() => {
    if (activityFilter === 'today') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return activity.filter((a) => a.createdAt >= today);
    }
    return activity;
  }, [activity, activityFilter]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-teal-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {showWelcome && isNewUser && (
        <div className="rounded-xl border border-teal-200 bg-gradient-to-r from-teal-50 to-emerald-50 p-6">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-teal-100">
              <RefreshCw className="h-6 w-6 text-teal-600" />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-teal-900">Welcome {userName} to MySyntroMed Portal! 👋</h2>
              <p className="mt-1 text-sm text-teal-700">
                Your dedicated specialist is ready to help streamline your practice operations.
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <Link
                  to="/portal/requests"
                  onClick={handleDismissWelcome}
                  className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700"
                >
                  <Plus size={16} />
                  Submit Your First Request
                </Link>
                <Link
                  to="/portal/specialist"
                  onClick={handleDismissWelcome}
                  className="inline-flex items-center gap-2 rounded-lg border border-teal-300 bg-white px-4 py-2 text-sm font-medium text-teal-700 hover:bg-teal-50"
                >
                  <User size={16} />
                  Meet Your Specialist
                </Link>
                <button
                  onClick={handleDismissWelcome}
                  className="text-sm text-teal-600 underline hover:text-teal-800"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 overflow-hidden rounded-full bg-slate-100">
              {sessionUser?.photoURL ? (
                <img src={sessionUser.photoURL} alt={userName} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-slate-400">
                  <User size={22} />
                </div>
              )}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-navy-900">
                {greeting}, {userName}!
              </h1>
              <p className="mt-1 text-slate-600">Here's what's happening with your practice today.</p>
              {!sessionUser?.assignedSpecialistId && (
                <span className="mt-2 inline-flex items-center rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700">
                  Pending Assignment
                </span>
              )}
            </div>
            <DateTimeDisplay />
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[
          { label: 'Open Requests', value: stats.openRequests, sub: `${stats.inProgressRequests} in progress`, icon: ClipboardList, color: 'bg-teal-50 text-teal-600' },
          { label: 'Completed Today', value: stats.completedToday, sub: 'Tasks completed', icon: Check, color: 'bg-emerald-50 text-emerald-600' },
          { label: 'Messages', value: stats.unreadMessages, sub: 'Unread messages', icon: MessageSquare, color: 'bg-blue-50 text-blue-600' },
        ].map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-slate-500">{card.label}</p>
                <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${card.color}`}>
                  <Icon size={16} />
                </div>
              </div>
              <p className="mt-2 text-3xl font-bold text-navy-900">{card.value}</p>
              <p className="mt-1 text-xs text-slate-500">{card.sub}</p>
            </div>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {/* Today With Your Specialist */}
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="mb-4 text-lg font-semibold text-navy-900">Today With Your Specialist</h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-lg border border-slate-200 p-4">
                <div className="flex items-center gap-3">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${clinicStatus === 'completed' ? 'bg-emerald-100' : 'bg-slate-100'}`}>
                    {clinicStatus === 'completed' ? (
                      <Check className="h-5 w-5 text-emerald-600" />
                    ) : clinicStatus === 'in_progress' ? (
                      <RefreshCw className="h-5 w-5 animate-spin text-amber-600" />
                    ) : (
                      <Circle className="h-5 w-5 text-slate-400" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-slate-900">Morning Prep</p>
                    <p className="text-sm text-slate-500">Specialist prepares charts and patient details</p>
                  </div>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-medium ${clinicStatus === 'completed' ? 'bg-emerald-100 text-emerald-700' : clinicStatus === 'in_progress' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>
                  {clinicStatus === 'completed' ? 'Completed' : clinicStatus === 'in_progress' ? 'In Progress' : 'Not Started'}
                </span>
              </div>

              <div className="flex items-center justify-between rounded-lg border border-slate-200 p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100">
                    <FileText className="h-5 w-5 text-slate-400" />
                  </div>
                  <div>
                    <p className="font-medium text-slate-900">Post-Clinic Documentation</p>
                    <p className="text-sm text-slate-500">Scribe finalizes notes in Athena</p>
                  </div>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">Pending</span>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-3">
              <button
                onClick={handleClinicFinish}
                disabled={clinicStatus !== 'not_started'}
                className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Check size={16} />
                Clinic Day Finished
              </button>
              <Link
                to="/portal/messages"
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                <MessageSquare size={16} />
                Message Specialist
              </Link>
            </div>
          </div>

          {/* Activity Feed */}
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-navy-900">Activity Feed</h2>
              <div className="flex gap-2">
                {(['today', 'week', 'month'] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setActivityFilter(f)}
                    className={`rounded-lg px-3 py-1 text-xs font-medium transition ${activityFilter === f ? 'bg-teal-100 text-teal-700' : 'text-slate-500 hover:bg-slate-100'}`}
                  >
                    {f.charAt(0).toUpperCase() + f.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            {filteredActivity.length > 0 ? (
              <div className="space-y-3">
                {filteredActivity.slice(0, 5).map((item) => (
                  <div key={item.id} className="flex items-start gap-3 rounded-lg border border-slate-100 p-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-50">
                      <ClipboardList size={14} className="text-teal-600" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-slate-900">{item.title}</p>
                      <p className="text-sm text-slate-500">{item.type} • {item.specialistName}</p>
                    </div>
                    <span className="text-xs text-slate-400">{formatTime(item.createdAt)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center py-8 text-slate-500">
                <Clock size={32} className="mb-2 text-slate-300" />
                <p className="text-sm">No activity yet</p>
                <Link to="/portal/requests" className="mt-2 text-sm text-teal-600 hover:underline">
                  Submit your first request
                </Link>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          {/* Specialist Info */}
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="mb-4 text-lg font-semibold text-navy-900">Your Specialist</h2>
            <div className="flex flex-col items-center text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-teal-100 text-teal-700">
                <User size={28} />
              </div>
              <h3 className="mt-3 font-semibold text-slate-900">
                {sessionUser?.assignedSpecialistName || 'Pending Assignment'}
              </h3>
              <p className="text-sm text-slate-500">
                {sessionUser?.assignedSpecialistId ? 'Medical Scribe Specialist' : 'Awaiting admin assignment'}
              </p>
              <div className="mt-2 flex items-center gap-1">
                <span className={`h-2 w-2 rounded-full ${sessionUser?.assignedSpecialistId ? 'bg-emerald-500' : 'bg-amber-400'}`} />
                <span className={`text-xs ${sessionUser?.assignedSpecialistId ? 'text-emerald-600' : 'text-amber-600'}`}>
                  {sessionUser?.assignedSpecialistId ? 'Available' : 'Pending'}
                </span>
              </div>
              <div className="mt-4 flex gap-2">
                <Link
                  to="/portal/messages"
                  className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium ${
                    sessionUser?.assignedSpecialistId
                      ? 'bg-teal-600 text-white hover:bg-teal-700'
                      : 'bg-slate-200 text-slate-500 cursor-not-allowed'
                  }`}
                >
                  <MessageSquare size={14} />
                  Message
                </Link>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="mb-4 text-lg font-semibold text-navy-900">Quick Actions</h2>
            <div className="space-y-2">
              {quickActions.map((action) => {
                const Icon = action.icon;
                return (
                  <Link
                    key={action.label}
                    to={action.to}
                    className={`flex items-center gap-3 rounded-lg p-3 transition ${action.color} ${action.urgent ? 'ring-2 ring-red-200' : ''} hover:opacity-80`}
                  >
                    <Icon size={18} />
                    <span className="text-sm font-medium">{action.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>

          {/* HIPAA Notice */}
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-navy-900">
              <Shield className="h-5 w-5 text-teal-600" />
              HIPAA Compliant
            </h2>
            <p className="text-sm text-slate-600">
              All communications and data handling follow HIPAA guidelines to keep your practice secure.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Root gate — picks correct dashboard by role                          */
/* ------------------------------------------------------------------ */
const DashboardHome = () => {
  const { sessionUser, loading, user } = useAuth();

  if (loading || !user) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-teal-500 border-t-transparent" />
      </div>
    );
  }

  if (sessionUser?.role === 'specialist') return <SpecialistDashboard />;
  if (sessionUser?.role === 'admin') return <AdminDashboard />;
  return <ClientDashboardContent />;
};

export default DashboardHome;
