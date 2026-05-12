import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, Check, CheckCircle, ChevronRight, ClipboardList, Clock, ListTodo, MessageSquare, Plus, RefreshCw, Users, Stethoscope, Bell, UserPlus } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { notificationService } from '@/lib/firestore';
import type { Request, UserProfile, AppNotification } from '@/lib/firestore';
import { DateTimeDisplay } from '@/lib/datetime';

export const SpecialistDashboard = () => {
  const { sessionUser } = useAuth();
  const [requests, setRequests] = useState<Request[]>([]);
  const [clients, setClients] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [newClientAssignments, setNewClientAssignments] = useState<AppNotification[]>([]);

  useEffect(() => {
    const fetchDashboardData = async () => {
      setLoading(true);
      try {
        if (!sessionUser?.uid) {
          setRequests([]);
          setClients([]);
          setLoading(false);
          return;
        }
        const [reqSnap, clientsSnap] = await Promise.all([
          getDocs(query(collection(db, 'requests'), where('specialistId', '==', sessionUser.uid))),
          getDocs(query(collection(db, 'users'), where('assignedSpecialistId', '==', sessionUser.uid))),
        ]);

        setRequests(
          reqSnap.docs.map(d => ({ id: d.id, ...d.data(), submittedAt: d.data().submittedAt?.toDate() } as Request))
            .sort((a, b) => b.submittedAt.getTime() - a.submittedAt.getTime())
        );
        
        setClients(
          clientsSnap.docs.map(d => ({ uid: d.id, ...d.data() } as UserProfile))
        );
      } catch (e) {
        console.error('Error fetching specialist data', e);
      } finally {
        setLoading(false);
      }
    };
    fetchDashboardData();
  }, [sessionUser?.uid]);

  useEffect(() => {
    if (!sessionUser?.uid) return;
    const unsub = notificationService.subscribeToNotifications(sessionUser.uid, (items) => {
      setNotifications(items);
      const assignmentNotifs = items.filter(n => n.type === 'assignment');
      setNewClientAssignments(assignmentNotifs);
    });
    return () => unsub();
  }, [sessionUser?.uid]);

  const handleNotificationClick = async (notificationId: string, read: boolean) => {
    if (!read) {
      await notificationService.markNotificationRead(notificationId);
    }
  };

  const stats = [
    { label: 'Active Clients', value: clients.length || 0, icon: Users, color: 'bg-blue-50 text-blue-600' },
    { label: 'Pending Requests', value: requests.filter(r => r.status === 'pending').length, icon: Clock, color: 'bg-amber-50 text-amber-600' },
    { label: 'Completed Tasks', value: requests.filter(r => r.status === 'completed').length, icon: CheckCircle, color: 'bg-emerald-50 text-emerald-600' },
  ];

  return (
    <div className="space-y-6">
      {newClientAssignments.length > 0 && (
        <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100">
              <UserPlus size={20} className="text-indigo-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-indigo-900">New Client Assignments</h2>
              <p className="text-sm text-indigo-700">You have {newClientAssignments.length} new client assignment(s)</p>
            </div>
          </div>
          <div className="space-y-2">
            {newClientAssignments.slice(0, 3).map((notif) => (
              <div 
                key={notif.id} 
                onClick={() => handleNotificationClick(notif.id, notif.read)}
                className={`cursor-pointer flex items-center gap-2 rounded-lg bg-white/80 p-3 border border-indigo-100 ${!notif.read ? 'bg-indigo-100' : ''}`}
              >
                <Bell size={14} className="text-indigo-500" />
                <p className="text-sm text-indigo-800">{notif.message}</p>
                {!notif.read && <span className="ml-auto h-2 w-2 rounded-full bg-indigo-500" />}
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">Specialist Dashboard</h1>
          <p className="mt-1 text-slate-600">Welcome back, {sessionUser?.displayName?.split(' ')[0] || 'Specialist'}</p>
        </div>
        <div className="flex items-center gap-4">
          <DateTimeDisplay />
          <div className="flex gap-3">
            <button className="inline-flex items-center gap-2 rounded-lg bg-white border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
              <RefreshCw size={18} />
              Refresh
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-center gap-4">
          <div className="h-16 w-16 overflow-hidden rounded-full bg-slate-100">
            {sessionUser?.photoURL ? (
              <img src={sessionUser.photoURL} alt={sessionUser.displayName || 'Specialist'} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-slate-400">
                <Stethoscope size={22} />
              </div>
            )}
          </div>
          <div>
            <p className="text-sm text-slate-500">Your Specialist Profile</p>
            <h2 className="text-lg font-semibold text-navy-900">{sessionUser?.displayName || 'Specialist'}</h2>
            <p className="text-xs text-slate-500">
              {sessionUser?.yearsExperience ? `${sessionUser.yearsExperience}+ years experience` : 'Update your experience in Settings'}
            </p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {(sessionUser?.specialties?.length ? sessionUser.specialties : ['Add specialties in Settings']).map((item) => (
            <span key={item} className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-600">
              {item}
            </span>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-4">
                <div className={`flex h-12 w-12 items-center justify-center rounded-lg ${stat.color}`}>
                  <Icon size={24} />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-500">{stat.label}</p>
                  <p className="text-2xl font-bold text-navy-900">{loading ? '-' : stat.value}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-xl border border-slate-200 bg-white">
            <div className="flex items-center justify-between border-b border-slate-200 p-4">
              <h2 className="text-lg font-semibold text-navy-900">Incoming Requests</h2>
              <button className="text-sm font-medium text-teal-600 hover:text-teal-700">View All</button>
            </div>
            <div className="p-4">
              {loading ? (
                <div className="py-8 text-center text-slate-400 animate-pulse">Loading requests...</div>
              ) : requests.length > 0 ? (
                <div className="divide-y divide-slate-100">
                  {requests.slice(0, 5).map((req) => (
                    <div key={req.id} className="py-3 flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-teal-600">
                          <ListTodo size={18} />
                        </div>
                        <div>
                          <p className="font-medium text-slate-900">{req.type}</p>
                          <p className="text-sm text-slate-500 truncate max-w-sm">{req.description}</p>
                        </div>
                      </div>
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        req.status === 'pending' ? 'bg-slate-100 text-slate-600' :
                        req.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                        'bg-emerald-100 text-emerald-700'
                      }`}>
                        {req.status}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center text-slate-500">No requests assigned to you yet.</div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-navy-900 to-navy-800 p-6 text-white text-center shadow-lg">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-white/10">
              <MessageSquare size={32} className="text-teal-400" />
            </div>
            <h3 className="text-lg font-semibold">Message Clients</h3>
            <p className="mt-2 text-sm text-navy-200">
              Keep your clients updated. Quick communication prevents delays.
            </p>
            <Link to="/specialist/messages" className="mt-4 block w-full rounded-lg bg-teal-500 py-2.5 text-sm font-semibold hover:bg-teal-400 transition text-center">
              Open Messages
            </Link>
          </div>

          {clients.length > 0 && (
          <div className="rounded-xl border border-slate-200 bg-white">
            <div className="border-b border-slate-100 p-4">
              <h2 className="text-lg font-semibold text-navy-900 flex items-center gap-2">
                <Users size={18} className="text-indigo-500" />
                Assigned Doctors
              </h2>
            </div>
            <div className="divide-y divide-slate-100">
              {clients.map((client) => (
                <div key={client.uid} className="flex items-center gap-3 p-4">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-teal-400 to-teal-600 text-xs font-bold text-white">
                    {client.displayName?.charAt(0) || 'C'}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-900">{client.displayName || client.email || 'Client'}</p>
                    <p className="text-xs text-emerald-600 flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      Active
                    </p>
                  </div>
                  <Link to="/specialist/messages" className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition">
                    Message
                  </Link>
                </div>
              ))}
            </div>
          </div>
          )}

          <div className="rounded-xl border border-slate-200 bg-white">
            <div className="border-b border-slate-100 p-4">
              <h2 className="text-lg font-semibold text-navy-900 flex items-center gap-2">
                <ClipboardList size={18} className="text-teal-500" />
                Daily Activity
              </h2>
            </div>
            <div className="p-4 space-y-3">
              <div className="flex items-center justify-between rounded-lg bg-emerald-50 border border-emerald-200 p-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                    <Check size={14} />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-900">Morning Prep</p>
                    <p className="text-xs text-slate-500">Charts prepared</p>
                  </div>
                </div>
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700">Completed</span>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-slate-200 p-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-100 text-amber-600">
                    <Clock size={14} />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-900">Post-Clinic Documentation</p>
                    <p className="text-xs text-slate-500">Finalize notes in EHR</p>
                  </div>
                </div>
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">Pending</span>
              </div>
            </div>
          </div>

          <Link to="/specialist/calls" className="block rounded-xl border border-slate-200 bg-gradient-to-r from-purple-50 to-blue-50 p-4 hover:shadow-sm transition">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-100 text-purple-600">
                  <Calendar size={18} />
                </div>
                <div>
                  <p className="font-semibold text-navy-900">Upcoming Calls</p>
                  <p className="text-xs text-slate-500">View and manage scheduled meetings</p>
                </div>
              </div>
              <ChevronRight size={18} className="text-slate-400" />
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default SpecialistDashboard;
