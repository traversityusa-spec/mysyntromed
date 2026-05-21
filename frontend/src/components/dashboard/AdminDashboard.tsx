import { useState, useEffect, useMemo } from 'react';
import {
  Activity, ArrowUpRight, CheckCircle, Clock, Inbox, Shield, Stethoscope, Users, X, Mail, Phone, Building,
  RefreshCw, ClipboardList, AlertCircle, ChevronRight,
} from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { UserProfile, Request } from '@/lib/firestore';
import { userService } from '@/lib/firestore';
import { DateTimeDisplay } from '@/lib/datetime';

const ClientDetailModal = ({ client, onClose }: { client: UserProfile; onClose: () => void }) => {
  const { refreshSessionUser } = useAuth();
  const [activating, setActivating] = useState(false);
  const [justActivated, setJustActivated] = useState(false);

  const isExpired = client.subscriptionEndDate ? new Date(client.subscriptionEndDate) < new Date() : false;
  const isExpiringSoon = client.subscriptionEndDate ? (() => {
    const diff = new Date(client.subscriptionEndDate).getTime() - Date.now();
    return diff > 0 && diff <= 3 * 24 * 60 * 60 * 1000;
  })() : false;

  const handleReactivate = async () => {
    setActivating(true);
    try {
      await userService.activateSubscription(client.uid);
      setJustActivated(true);
      setTimeout(() => onClose(), 1500);
    } catch (error) {
      console.error('Error reactivating subscription:', error);
    } finally {
      setActivating(false);
    }
  };

  const getSubscriptionStatus = () => {
    if (!client.subscriptionEndDate) return { label: 'No Subscription', color: 'bg-slate-100 text-slate-600', icon: Clock };
    if (isExpired) return { label: 'Expired', color: 'bg-red-100 text-red-700', icon: Clock };
    if (isExpiringSoon) return { label: 'Expiring Soon', color: 'bg-amber-100 text-amber-700', icon: Clock };
    return { label: 'Active', color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle };
  };

  const status = getSubscriptionStatus();
  const StatusIcon = status.icon;
  const daysRemaining = client.subscriptionEndDate ? Math.ceil((new Date(client.subscriptionEndDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 p-4">
          <h2 className="text-lg font-semibold text-slate-900">Client Details</h2>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-slate-100 transition"><X size={20} className="text-slate-500" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-full bg-teal-100 flex items-center justify-center text-teal-600 text-xl font-bold">
              {client.displayName?.[0]?.toUpperCase() || 'C'}
            </div>
            <div>
              <p className="text-xl font-semibold text-slate-900">{client.displayName || 'Unnamed Client'}</p>
              <p className="text-sm text-slate-500 capitalize">{client.role}</p>
            </div>
          </div>
          <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-medium ${status.color}`}>
            <StatusIcon size={14} /> {status.label}
            {daysRemaining !== null && daysRemaining > 0 && <span>({daysRemaining} days left)</span>}
          </div>
          <div className="space-y-3">
            <div className="flex items-center gap-3 text-sm"><Mail size={16} className="text-slate-400" /><span className="text-slate-700">{client.email || 'No email'}</span></div>
            {client.phone && <div className="flex items-center gap-3 text-sm"><Phone size={16} className="text-slate-400" /><span className="text-slate-700">{client.phone}</span></div>}
            {client.clinicName && <div className="flex items-center gap-3 text-sm"><Building size={16} className="text-slate-400" /><span className="text-slate-700">{client.clinicName}</span></div>}
          </div>
          {isExpired && !justActivated && (
            <button onClick={handleReactivate} disabled={activating} className="w-full rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50 transition">
              {activating ? 'Reactivating...' : 'Reactivate Subscription (30 days)'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

const formatDuration = (ms: number): string => {
  if (ms < 0) return '-';
  const minutes = Math.floor(ms / 60000);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours < 24) return `${hours}h ${mins}m`;
  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h`;
};

const getResponseTime = (req: Request): string => {
  if (req.assignedAt) {
    return formatDuration(req.assignedAt.getTime() - req.submittedAt.getTime());
  }
  if (req.statusHistory && req.statusHistory.length > 1) {
    const firstChange = req.statusHistory[1];
    if (firstChange?.timestamp) {
      const changeTime = firstChange.timestamp instanceof Date ? firstChange.timestamp : new Date(firstChange.timestamp);
      return formatDuration(changeTime.getTime() - req.submittedAt.getTime());
    }
  }
  return req.status === 'pending' ? 'Waiting' : '-';
};

const statusColors: Record<string, string> = {
  pending: 'bg-slate-100 text-slate-600',
  in_progress: 'bg-blue-100 text-blue-700',
  completed: 'bg-emerald-100 text-emerald-700',
};
const statusLabels: Record<string, string> = {
  pending: 'Pending',
  in_progress: 'Active',
  completed: 'Done',
};

export const AdminDashboard = () => {
  const { sessionUser, showWelcomeBack, welcomeBackData, clearWelcomeBack } = useAuth();
  const [metrics, setMetrics] = useState({ clients: 0, specialists: 0, requests: 0, calls: 0 });
  const [metricsLoading, setMetricsLoading] = useState(true);
  const [clients, setClients] = useState<UserProfile[]>([]);
  const [requests, setRequests] = useState<Request[]>([]);
  const [selectedClient, setSelectedClient] = useState<UserProfile | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setMetricsLoading(true);
      try {
        const [usersSnap, reqSnap, callsSnap] = await Promise.all([
          getDocs(query(collection(db, 'users'))),
          getDocs(query(collection(db, 'requests'), orderBy('submittedAt', 'desc'))),
          getDocs(query(collection(db, 'calls'))),
        ]);

        const users = usersSnap.docs.map(d => {
          const data = d.data();
          return {
            ...data,
            createdAt: data.createdAt?.toDate?.() || new Date(),
            updatedAt: data.updatedAt?.toDate?.() || new Date(),
            subscriptionStartDate: data.subscriptionStartDate?.toDate?.(),
            subscriptionEndDate: data.subscriptionEndDate?.toDate?.(),
          } as UserProfile;
        });
        setMetrics({
          clients: users.filter(u => u.role === 'client').length,
          specialists: users.filter(u => u.role === 'specialist').length,
          requests: reqSnap.size,
          calls: callsSnap.size,
        });

        const clientUsers = users.filter(u => u.role === 'client');
        const sortedClients = [...clientUsers].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        setClients(sortedClients);
        setRequests(
          reqSnap.docs.map(d => {
            const data = d.data();
            return {
              id: d.id,
              ...data,
              submittedAt: data.submittedAt?.toDate?.() || new Date(),
              completedAt: data.completedAt?.toDate?.(),
              assignedAt: data.assignedAt?.toDate?.(),
              statusHistory: (data.statusHistory || []).map((e: any) => ({
                ...e,
                timestamp: e.timestamp?.toDate ? e.timestamp.toDate() : new Date(e.timestamp || Date.now()),
              })),
            } as Request;
          })
        );
      } catch (e) {
        console.error('Admin data fetch error:', e);
      } finally {
        setMetricsLoading(false);
      }
    };
    fetchData();
  }, [sessionUser?.uid]);

  const statCards = [
    { title: 'Total Clients', value: metrics.clients, icon: Users, color: 'bg-blue-50 text-blue-600', trend: 'Active accounts' },
    { title: 'Specialists', value: metrics.specialists, icon: Stethoscope, color: 'bg-indigo-50 text-indigo-600', trend: 'On platform' },
    { title: 'Total Requests', value: metrics.requests, icon: Inbox, color: 'bg-amber-50 text-amber-600', trend: 'All time' },
    { title: 'Consultations', value: metrics.calls, icon: Activity, color: 'bg-emerald-50 text-emerald-600', trend: 'Scheduled' },
  ];

  return (
    <div className="space-y-6">
      {selectedClient && <ClientDetailModal client={selectedClient} onClose={() => setSelectedClient(null)} />}
      {showWelcomeBack && (
        <div className="rounded-xl border border-teal-200 bg-gradient-to-r from-teal-50 to-emerald-50 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-teal-100">
                <RefreshCw className="h-5 w-5 text-teal-600" />
              </div>
              <div>
                <p className="font-semibold text-teal-900">
                  {welcomeBackData.isReturning ? `Welcome back, ${welcomeBackData.displayName}!` : `Welcome, ${welcomeBackData.displayName}!`}
                </p>
                <p className="text-sm text-teal-700">{welcomeBackData.isReturning ? "Here's your admin overview." : 'Your admin dashboard is ready.'}</p>
              </div>
            </div>
            <button onClick={clearWelcomeBack} className="rounded-lg p-1.5 text-teal-600 hover:bg-teal-200/50 transition"><X size={18} /></button>
          </div>
        </div>
      )}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Admin Portal</h1>
          <p className="mt-1 text-slate-500">Overview of MySyntroMed system operations</p>
        </div>
        <div className="flex items-center gap-4">
          <DateTimeDisplay />
          <div className="flex items-center gap-2 rounded-lg bg-teal-50 px-3 py-1.5 text-sm font-medium text-teal-700 border border-teal-100">
            <Shield size={16} /> Super Admin Access
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map(stat => {
          const Icon = stat.icon;
          return (
            <div key={stat.title} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-slate-500">{stat.title}</p>
                <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${stat.color}`}><Icon size={20} /></div>
              </div>
              <div className="mt-4">
                <p className="text-3xl font-bold text-slate-900">
                  {metricsLoading ? <span className="inline-block h-8 w-10 animate-pulse rounded bg-slate-200" /> : stat.value}
                </p>
                <div className="mt-1 flex items-center text-xs font-medium text-emerald-600">
                  <ArrowUpRight size={14} className="mr-1" /> {stat.trend}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Requests Table */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 p-4 bg-slate-50/50">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            <ClipboardList size={20} className="text-teal-600" />
            All Requests
          </h2>
          <span className="text-xs text-slate-500">{requests.length} total</span>
        </div>
        {metricsLoading ? (
          <div className="p-12 text-center text-slate-400 animate-pulse">Loading requests...</div>
        ) : requests.length === 0 ? (
          <div className="p-12 text-center text-slate-400">No requests yet</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  <th className="text-left p-3 font-semibold text-slate-600">Client</th>
                  <th className="text-left p-3 font-semibold text-slate-600">Type</th>
                  <th className="text-left p-3 font-semibold text-slate-600">Priority</th>
                  <th className="text-left p-3 font-semibold text-slate-600">Status</th>
                  <th className="text-left p-3 font-semibold text-slate-600">Submitted</th>
                  <th className="text-left p-3 font-semibold text-slate-600">Response Time</th>
                  <th className="text-left p-3 font-semibold text-slate-600">Completed</th>
                  <th className="text-left p-3 font-semibold text-slate-600">Specialist</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {requests.map((req) => (
                  <tr key={req.id} className="hover:bg-slate-50 transition">
                    <td className="p-3 font-medium text-slate-900">{req.clientName || req.clientEmail || 'Unknown'}</td>
                    <td className="p-3 text-slate-700">{req.type}</td>
                    <td className="p-3">
                      <span className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full ${
                        req.priority === 'urgent' ? 'bg-red-100 text-red-700' :
                        req.priority === 'high' ? 'bg-amber-100 text-amber-700' :
                        'bg-teal-100 text-teal-700'
                      }`}>{req.priority}</span>
                    </td>
                    <td className="p-3">
                      <span className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full ${statusColors[req.status]}`}>
                        {statusLabels[req.status]}
                      </span>
                    </td>
                    <td className="p-3 text-slate-600 text-xs">{req.submittedAt.toLocaleDateString()} {req.submittedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                    <td className="p-3">
                      <span className={`text-xs font-medium ${getResponseTime(req) === 'Waiting' ? 'text-amber-600' : 'text-slate-700'}`}>
                        {getResponseTime(req)}
                      </span>
                    </td>
                    <td className="p-3 text-xs text-slate-600">
                      {req.completedAt
                        ? `${req.completedAt.toLocaleDateString()} ${req.completedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                        : '-'}
                    </td>
                    <td className="p-3 text-xs text-slate-600">{req.specialistName || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;
