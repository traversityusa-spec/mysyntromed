import { useMemo, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  Calendar,
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
  Users,
  AlertCircle,
  X,
} from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { useAuth } from '@/lib/AuthContext';
import { useDashboardData, useUserProfile } from '@/lib/dashboard';
import { workflowService, API_BASE_URL } from '@/lib/firestore';
import type { WorkflowStatus } from '@/lib/firestore';
import SpecialistDashboard from './SpecialistDashboard';
import AdminDashboard from './AdminDashboard';
import { DateTimeDisplay } from '@/lib/datetime';

const quickActions = [
  { label: 'Message Specialist', icon: MessageSquare, to: '/portal/messages', color: 'bg-blue-50 text-blue-700' },
  { label: 'Submit Request', icon: Plus, to: '/portal/requests', color: 'bg-teal-50 text-teal-700' },
  { label: 'Schedule Meeting', icon: Calendar, to: '/portal/calls', color: 'bg-purple-50 text-purple-700' },
  { label: 'Urgent Support', icon: AlertTriangle, to: '/portal/requests', color: 'bg-red-50 text-red-700', urgent: true },
];

/* ─── Subscription Countdown ────────────────────────────────── */
const SubscriptionCountdown = () => {
  const { sessionUser } = useAuth();
  const [daysLeft, setDaysLeft] = useState<number>(0);
  const [hoursLeft, setHoursLeft] = useState<number>(0);
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    const calculateTime = () => {
      if (!sessionUser?.subscriptionEndDate) return;
      
      const now = new Date();
      const end = new Date(sessionUser.subscriptionEndDate);
      const diff = end.getTime() - now.getTime();

      if (diff <= 0) {
        setIsExpired(true);
        setDaysLeft(0);
        setHoursLeft(0);
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      setDaysLeft(days);
      setHoursLeft(hours);
      setIsExpired(false);
    };

    calculateTime();
    const interval = setInterval(calculateTime, 60000);
    return () => clearInterval(interval);
  }, [sessionUser?.subscriptionEndDate]);

  if (!sessionUser?.subscriptionEndDate || sessionUser.role !== 'client') return null;

  if (isExpired) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center">
            <AlertCircle className="text-red-600" size={20} />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-red-800">Subscription Expired</p>
            <p className="text-xs text-red-600">Please contact your administrator to renew your subscription.</p>
          </div>
        </div>
      </div>
    );
  }

  const isWarning = daysLeft <= 3;

  return (
    <div className={`rounded-xl border p-4 mb-6 ${isWarning ? 'border-amber-200 bg-amber-50' : 'border-teal-200 bg-teal-50'}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`h-10 w-10 rounded-full flex items-center justify-center ${isWarning ? 'bg-amber-100' : 'bg-teal-100'}`}>
            <Clock className={isWarning ? 'text-amber-600' : 'text-teal-600'} size={20} />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-800">Subscription Active</p>
            <p className="text-xs text-slate-600">
              {sessionUser.subscriptionStartDate ? `Started ${new Date(sessionUser.subscriptionStartDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}` : 'Subscription active'}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className={`text-2xl font-bold ${isWarning ? 'text-amber-600' : 'text-teal-600'}`}>
            {daysLeft}<span className="text-sm font-normal ml-1">days</span>
          </p>
          <p className="text-xs text-slate-500">{hoursLeft}h remaining today</p>
        </div>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Client-only dashboard content                                         */
/* ------------------------------------------------------------------ */
const ClientDashboardContent = () => {
  const { user, sessionUser, showWelcomeBack, welcomeBackData, clearWelcomeBack } = useAuth();
  const { stats, activity, activityFilter, setActivityFilter, loading } = useDashboardData();
  const { profile, markAsOldUser } = useUserProfile();
  const [showWelcome, setShowWelcome] = useState(false);
  const [specialistPhotoURL, setSpecialistPhotoURL] = useState<string | null>(null);
  const [workflow, setWorkflow] = useState<WorkflowStatus | null>(null);
  const [morningPrepStatus, setMorningPrepStatus] = useState<'not_started' | 'in_progress' | 'completed'>('not_started');
  const [postClinicStatus, setPostClinicStatus] = useState<'not_started' | 'in_progress' | 'completed'>('not_started');

  useEffect(() => {
    if (!sessionUser?.assignedSpecialistId) {
      setSpecialistPhotoURL(null);
      setWorkflow(null);
      return;
    }
    let cancelled = false;
    getDoc(doc(db, 'users', sessionUser.assignedSpecialistId)).then(snap => {
      if (!cancelled && snap.exists()) {
        setSpecialistPhotoURL(snap.data().photoURL || null);
      }
    });
    const unsub = workflowService.subscribe(sessionUser.assignedSpecialistId, (wf) => {
      setWorkflow(wf);
      if (wf) {
        setMorningPrepStatus(wf.morningPrepStatus);
        setPostClinicStatus(wf.postClinicStatus);
      }
    }, sessionUser.uid);

    const handleWorkflowUpdated = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.clientId === sessionUser.uid || detail?.clientId === sessionUser.assignedSpecialistId) {
        if (detail.field === 'morningPrepStatus') {
          setMorningPrepStatus(detail.value);
        } else if (detail.field === 'postClinicStatus') {
          setPostClinicStatus(detail.value);
        }
      }
    };
    window.addEventListener('socket:workflowUpdated', handleWorkflowUpdated);

    return () => { cancelled = true; unsub(); window.removeEventListener('socket:workflowUpdated', handleWorkflowUpdated); };
  }, [sessionUser?.assignedSpecialistId]);

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
    setPostClinicStatus('in_progress');
    if (!sessionUser?.assignedSpecialistId || !sessionUser?.uid) return;
    setWorkflow(prev => prev ? { ...prev, clinicDayFinished: true } : prev);
    try {
      await workflowService.clinicDayFinished(sessionUser.assignedSpecialistId, sessionUser.uid);
    } catch (error) {
      console.error('Error marking clinic day finished:', error);
    }
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
      <SubscriptionCountdown />
      {showWelcomeBack && (
        <div className="rounded-xl border border-teal-200 bg-gradient-to-r from-teal-50 to-emerald-50 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-teal-100">
                <RefreshCw className="h-5 w-5 text-teal-600" />
              </div>
              <div>
                <p className="font-semibold text-teal-900">
                  {welcomeBackData.isReturning
                    ? `Welcome back, ${welcomeBackData.displayName}!`
                    : `Welcome, ${welcomeBackData.displayName}!`}
                </p>
                <p className="text-sm text-teal-700">
                  {welcomeBackData.isReturning
                    ? 'Great to see you again. Here\'s your practice overview.'
                    : 'Your dashboard is ready. Let\'s get started!'}
                </p>
              </div>
            </div>
            <button
              onClick={clearWelcomeBack}
              className="rounded-lg p-1.5 text-teal-600 hover:bg-teal-200/50 transition"
            >
              <X size={18} />
            </button>
          </div>
        </div>
      )}
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
          </div>
          <DateTimeDisplay />
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

      {/* Specialist Info Card */}
      {sessionUser?.role === 'client' && sessionUser?.assignedSpecialistId && (
        <div className="rounded-xl border border-slate-200 bg-gradient-to-r from-teal-50 to-blue-50 p-5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-teal-400 to-teal-600 text-xl font-bold text-white shadow-sm">
                {specialistPhotoURL ? (
                  <img src={specialistPhotoURL} alt={sessionUser.assignedSpecialistName || 'Specialist'} className="h-full w-full object-cover" onError={() => setSpecialistPhotoURL(null)} />
                ) : (
                  sessionUser.assignedSpecialistName?.charAt(0) || 'S'
                )}
              </div>
              <div>
                <p className="text-lg font-bold text-navy-900">{sessionUser.assignedSpecialistName || 'Your Specialist'}</p>
                <p className="text-sm text-slate-500">Medical Scribe Specialist</p>
                <p className="mt-0.5 text-xs text-emerald-600 flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Available — Usually responds within 1 hour
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Link to="/portal/messages" className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-3.5 py-2 text-xs font-medium text-white hover:bg-teal-700 transition">
                <MessageSquare size={14} />
                Message
              </Link>
              <Link to="/portal/calls" className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition">
                <Phone size={14} />
                Call
              </Link>
              <Link to="/portal/calls" className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition">
                <Calendar size={14} />
                Schedule
              </Link>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {/* Today With Your Specialist — read-only for client */}
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="mb-4 text-lg font-semibold text-navy-900">Today With Your Specialist</h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-lg border border-slate-200 p-4">
                <div className="flex items-center gap-3">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${morningPrepStatus === 'completed' ? 'bg-emerald-100' : morningPrepStatus === 'in_progress' ? 'bg-amber-100' : 'bg-slate-100'}`}>
                    {morningPrepStatus === 'completed' ? (
                      <Check className="h-5 w-5 text-emerald-600" />
                    ) : morningPrepStatus === 'in_progress' ? (
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
                <span className={`rounded-lg border px-3 py-1.5 text-xs font-medium ${
                  morningPrepStatus === 'completed' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' :
                  morningPrepStatus === 'in_progress' ? 'border-amber-200 bg-amber-50 text-amber-700' :
                  'border-slate-200 bg-slate-50 text-slate-600'
                }`}>
                  {morningPrepStatus === 'completed' ? 'Completed' :
                   morningPrepStatus === 'in_progress' ? 'Ongoing' : 'Not Started'}
                </span>
              </div>

              <div className="flex items-center justify-between rounded-lg border border-slate-200 p-4">
                <div className="flex items-center gap-3">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${postClinicStatus === 'completed' ? 'bg-emerald-100' : postClinicStatus === 'in_progress' ? 'bg-amber-100' : 'bg-slate-100'}`}>
                    {postClinicStatus === 'completed' ? (
                      <Check className="h-5 w-5 text-emerald-600" />
                    ) : postClinicStatus === 'in_progress' ? (
                      <RefreshCw className="h-5 w-5 animate-spin text-amber-600" />
                    ) : (
                      <FileText className="h-5 w-5 text-slate-400" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-slate-900">Post-Clinic Documentation</p>
                    <p className="text-sm text-slate-500">Scribe finalizes notes in Athena</p>
                  </div>
                </div>
                <span className={`rounded-lg border px-3 py-1.5 text-xs font-medium ${
                  postClinicStatus === 'completed' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' :
                  postClinicStatus === 'in_progress' ? 'border-amber-200 bg-amber-50 text-amber-700' :
                  'border-slate-200 bg-slate-50 text-slate-600'
                }`}>
                  {postClinicStatus === 'completed' ? 'Completed' :
                   postClinicStatus === 'in_progress' ? 'Ongoing' : 'Not Started'}
                </span>
              </div>
            </div>

            {morningPrepStatus === 'completed' && !workflow?.clinicDayFinished && (
            <div className="mt-4">
              <button
                onClick={handleClinicFinish}
                className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 transition"
              >
                <Check size={16} />
                Clinic Day Finished
              </button>
            </div>
            )}

            <div className="mt-4 flex flex-wrap gap-3">
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
              <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-teal-100 text-teal-700">
                {specialistPhotoURL ? (
                  <img src={specialistPhotoURL} alt={sessionUser?.assignedSpecialistName || 'Specialist'} className="h-full w-full object-cover" onError={() => setSpecialistPhotoURL(null)} />
                ) : (
                  <User size={28} />
                )}
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
