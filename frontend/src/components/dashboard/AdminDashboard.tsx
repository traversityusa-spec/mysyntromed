import { useState, useEffect } from 'react';
import {
  Activity, ArrowUpRight, CheckCircle, Clock, Inbox, Shield, Stethoscope, Users, X, Mail, Phone, Building,
} from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { UserProfile } from '@/lib/firestore';
import { userService } from '@/lib/firestore';
import { DateTimeDisplay } from '@/lib/datetime';

/* ─── Client Detail Modal ─────────────────────────────────────── */
const ClientDetailModal = ({ client, onClose }: { client: UserProfile; onClose: () => void }) => {
  const { refreshSessionUser } = useAuth();
  const [activating, setActivating] = useState(false);
  const [justActivated, setJustActivated] = useState(false);

  const isExpired = client.subscriptionEndDate ? new Date(client.subscriptionEndDate) < new Date() : false;
  const isExpiringSoon = client.subscriptionEndDate ? (() => {
    const diff = new Date(client.subscriptionEndDate).getTime() - Date.now();
    return diff > 0 && diff <= 3 * 24 * 60 * 60 * 1000; // 3 days
  })() : false;

  const handleReactivate = async () => {
    setActivating(true);
    try {
      await userService.activateSubscription(client.uid);
      setJustActivated(true);
      setTimeout(() => {
        onClose();
      }, 1500);
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

  const getDaysRemaining = () => {
    if (!client.subscriptionEndDate) return null;
    const now = new Date();
    const end = new Date(client.subscriptionEndDate);
    const diff = end.getTime() - now.getTime();
    if (diff <= 0) return 0;
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  const daysRemaining = getDaysRemaining();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 p-4">
          <h2 className="text-lg font-semibold text-slate-900">Client Details</h2>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-slate-100 transition">
            <X size={20} className="text-slate-500" />
          </button>
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
            <StatusIcon size={14} />
            {status.label}
            {daysRemaining !== null && daysRemaining > 0 && (
              <span>({daysRemaining} days left)</span>
            )}
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-3 text-sm">
              <Mail size={16} className="text-slate-400" />
              <span className="text-slate-700">{client.email || 'No email'}</span>
            </div>
            {client.phone && (
              <div className="flex items-center gap-3 text-sm">
                <Phone size={16} className="text-slate-400" />
                <span className="text-slate-700">{client.phone}</span>
              </div>
            )}
            {client.clinicName && (
              <div className="flex items-center gap-3 text-sm">
                <Building size={16} className="text-slate-400" />
                <span className="text-slate-700">{client.clinicName}</span>
              </div>
            )}
            <div className="flex items-center gap-3 text-sm">
              <Users size={16} className="text-slate-400" />
              <span className="text-slate-700">Joined {new Date(client.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
            </div>
            {client.subscriptionStartDate && (
              <div className="flex items-center gap-3 text-sm">
                <Clock size={16} className="text-slate-400" />
                <span className="text-slate-700">Subscription started {client.subscriptionStartDate ? new Date(client.subscriptionStartDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'Unknown'}</span>
              </div>
            )}
            {client.subscriptionEndDate && (
              <div className="flex items-center gap-3 text-sm">
                <Clock size={16} className="text-slate-400" />
                <span className="text-slate-700">Expires {client.subscriptionEndDate ? new Date(client.subscriptionEndDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'Unknown'}</span>
              </div>
            )}
          </div>

          {(isExpired || justActivated) && (
            <div className={`rounded-lg border p-4 ${justActivated ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'}`}>
              <div className="flex items-center gap-3">
                <CheckCircle className={justActivated ? 'text-emerald-600' : 'text-red-600'} size={20} />
                <p className={`text-sm font-medium ${justActivated ? 'text-emerald-800' : 'text-red-800'}`}>
                  {justActivated ? 'Subscription has been reactivated for 30 days!' : 'Account suspended. Contact administrator.'}
                </p>
              </div>
            </div>
          )}

          {isExpired && !justActivated && (
            <button
              onClick={handleReactivate}
              disabled={activating}
              className="w-full rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50 transition flex items-center justify-center gap-2"
            >
              {activating ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Reactivating...
                </>
              ) : (
                <>
                  <CheckCircle size={16} />
                  Reactivate Subscription (30 days)
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

/* ─── Admin Dashboard ─────────────────────────────────────────── */
export const AdminDashboard = () => {
  const { sessionUser } = useAuth();
  const [metrics, setMetrics] = useState({ clients: 0, specialists: 0, requests: 0, calls: 0 });
  const [metricsLoading, setMetricsLoading] = useState(true);
  const [clients, setClients] = useState<UserProfile[]>([]);
  const [recentClient, setRecentClient] = useState<UserProfile | null>(null);
  const [selectedClient, setSelectedClient] = useState<UserProfile | null>(null);

  useEffect(() => {
    const fetchAdminData = async () => {
      setMetricsLoading(true);
      try {
        const [usersSnap, reqSnap, callsSnap] = await Promise.all([
          getDocs(query(collection(db, 'users'))),
          getDocs(query(collection(db, 'requests'))),
          getDocs(query(collection(db, 'calls'))),
        ]);

        const users = usersSnap.docs.map(d => d.data() as UserProfile);
        setMetrics({
          clients: users.filter(u => u.role === 'client').length,
          specialists: users.filter(u => u.role === 'specialist').length,
          requests: reqSnap.size,
          calls: callsSnap.size,
        });

        const clientUsers = users.filter(u => u.role === 'client');
        const sortedClients = clientUsers.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        setClients(sortedClients);
        if (sortedClients.length > 0) {
          setRecentClient(sortedClients[0]);
        }
      } catch (e) {
        console.error('Admin data fetch error (check Firestore rules):', e);
      } finally {
        setMetricsLoading(false);
      }
    };
    fetchAdminData();
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
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Admin Portal</h1>
          <p className="mt-1 text-slate-500">Overview of MySyntroMed system operations</p>
        </div>
        <div className="flex items-center gap-4">
          <DateTimeDisplay />
          <div className="flex items-center gap-2 rounded-lg bg-teal-50 px-3 py-1.5 text-sm font-medium text-teal-700 border border-teal-100">
            <Shield size={16} />
            Super Admin Access
          </div>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map(stat => {
          const Icon = stat.icon;
          return (
            <div key={stat.title} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-slate-500">{stat.title}</p>
                <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${stat.color}`}>
                  <Icon size={20} />
                </div>
              </div>
              <div className="mt-4">
                <p className="text-3xl font-bold text-slate-900">
                  {metricsLoading ? <span className="inline-block h-8 w-10 animate-pulse rounded bg-slate-200" /> : stat.value}
                </p>
                <div className="mt-1 flex items-center text-xs font-medium text-emerald-600">
                  <ArrowUpRight size={14} className="mr-1" />
                  {stat.trend}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Recent System Activity */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 p-4 bg-slate-50/50">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            <Activity size={20} className="text-teal-600" />
            Recent System Activity
          </h2>
          <button className="text-xs font-semibold text-teal-600 hover:text-teal-700">View All activity</button>
        </div>
        <div className="p-0">
          {metricsLoading ? (
            <div className="p-12 text-center text-slate-400 animate-pulse">Scanning system logs...</div>
          ) : (
            <div className="divide-y divide-slate-100">
              <button onClick={() => recentClient && setSelectedClient(recentClient)} disabled={!recentClient}
                className="w-full p-4 flex items-center justify-between hover:bg-slate-50 transition cursor-pointer text-left">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded bg-teal-100 flex items-center justify-center text-teal-600">
                    <Users size={16} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">New Client Onboarded</p>
                    <p className="text-xs text-slate-500">
                      {recentClient ? `Verified: ${recentClient.displayName || recentClient.email}` : 'System verified a new clinic registration'}
                    </p>
                  </div>
                </div>
                <span className="text-[10px] font-medium text-slate-400">2 minutes ago</span>
              </button>
              <div className="p-4 flex items-center justify-between hover:bg-slate-50 transition cursor-default">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded bg-emerald-100 flex items-center justify-center text-emerald-600">
                    <Inbox size={16} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Consultation Completed</p>
                    <p className="text-xs text-slate-500">Scribe finalized patient notes for visit #1204</p>
                  </div>
                </div>
                <span className="text-[10px] font-medium text-slate-400">1 hour ago</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
