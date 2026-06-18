import { useState, useEffect, useMemo } from 'react';
import {
  Activity, ArrowUpRight, CheckCircle, Clock, Inbox, Shield, Stethoscope, Users, X, Mail, Phone, Building,
  RefreshCw, ClipboardList, AlertCircle, ChevronRight, MessageSquare,
} from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { collection, getDocs, query, orderBy, onSnapshot, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { UserProfile, Request, Message } from '@/lib/firestore';
import { userService, messageService } from '@/lib/firestore';
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
  const [viewingClient, setViewingClient] = useState<UserProfile | null>(null);
  const [showClientDetail, setShowClientDetail] = useState(false);
  const [clientRequests, setClientRequests] = useState<Request[]>([]);
  const [clientMessages, setClientMessages] = useState<Message[]>([]);
  const [loadingClientData, setLoadingClientData] = useState(false);

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
          requests: reqSnap.docs.filter(d => d.data().status === 'pending' && !d.data().specialistId).length,
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

    const unsubRequests = onSnapshot(
      query(collection(db, 'requests'), where('status', '==', 'pending')),
      (snap) => {
        const pending = snap.docs.filter(d => !d.data().specialistId).length;
        setMetrics(prev => ({ ...prev, requests: pending }));
      }
    );

    return () => unsubRequests();
  }, [sessionUser?.uid]);

  const statCards = [
    { title: 'Total Clients', value: metrics.clients, icon: Users, color: 'bg-blue-50 text-blue-600', trend: 'Active accounts' },
    { title: 'Specialists', value: metrics.specialists, icon: Stethoscope, color: 'bg-indigo-50 text-indigo-600', trend: 'On platform' },
    { title: 'Total Requests', value: metrics.requests, icon: Inbox, color: 'bg-amber-50 text-amber-600', trend: 'All time' },
    { title: 'Consultations', value: metrics.calls, icon: Activity, color: 'bg-emerald-50 text-emerald-600', trend: 'Scheduled' },
  ];

  const handleViewClient = async (client: UserProfile) => {
    setViewingClient(client);
    setShowClientDetail(true);
    setLoadingClientData(true);
    setClientRequests(requests.filter(r => r.userId === client.uid));
    if (client.assignedSpecialistId) {
      try {
        const msgs = await messageService.getConversation(client.uid, client.assignedSpecialistId);
        setClientMessages(msgs);
      } catch (e) {
        console.error('Error loading messages:', e);
        setClientMessages([]);
      }
    } else {
      setClientMessages([]);
    }
    setLoadingClientData(false);
  };

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

      {/* Per-Client Analysis */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 p-4 bg-slate-50/50">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            <Users size={20} className="text-teal-600" />
            Client Analysis
          </h2>
          <span className="text-xs text-slate-500">{clients.length} clients</span>
        </div>
        {metricsLoading ? (
          <div className="p-12 text-center text-slate-400 animate-pulse">Loading clients...</div>
        ) : clients.length === 0 ? (
          <div className="p-12 text-center text-slate-400">No clients yet</div>
        ) : (
          <div className="flex flex-col md:flex-row">
            <div className={`w-full md:w-72 md:shrink-0 border-r border-slate-200 divide-y divide-slate-100 overflow-y-auto max-h-[600px] ${showClientDetail ? 'hidden md:block' : ''}`}>
              <div className="md:hidden flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50">
                <span className="text-sm font-semibold text-slate-700">Select a client</span>
                <span className="text-xs text-slate-500">{clients.length} total</span>
              </div>
              {clients.map(client => (
                <button
                  key={client.uid}
                  onClick={() => handleViewClient(client)}
                  className={`w-full text-left p-4 hover:bg-slate-50 transition ${
                    viewingClient?.uid === client.uid ? 'bg-teal-50 border-l-2 border-teal-500' : ''
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-teal-100 flex items-center justify-center text-teal-600 text-sm font-bold shrink-0">
                      {client.displayName?.[0]?.toUpperCase() || 'C'}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">{client.displayName || 'Unnamed'}</p>
                      <p className="text-xs text-slate-500 truncate">
                        {client.assignedSpecialistName ? `→ ${client.assignedSpecialistName}` : 'Unassigned'}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
            <div className={`flex-1 p-6 ${!showClientDetail ? 'hidden md:block' : ''}`}>
              {viewingClient ? (
                <>
                  <button
                    onClick={() => setShowClientDetail(false)}
                    className="md:hidden mb-4 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                    Back to list
                  </button>
                  {loadingClientData ? (
                    <div className="flex items-center justify-center h-64">
                      <div className="h-8 w-8 animate-spin rounded-full border-2 border-teal-500 border-t-transparent" />
                    </div>
                  ) : (
                    <div className="space-y-6">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-4 min-w-0">
                          <div className="h-14 w-14 shrink-0 rounded-full bg-teal-100 flex items-center justify-center text-teal-600 text-xl font-bold">
                            {viewingClient.displayName?.[0]?.toUpperCase() || 'C'}
                          </div>
                          <div className="min-w-0">
                            <h3 className="text-lg font-semibold text-slate-900 truncate">{viewingClient.displayName || 'Client'}</h3>
                            <p className="text-sm text-slate-500 truncate">{viewingClient.email}</p>
                            <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                              <Stethoscope size={12} />
                              {viewingClient.assignedSpecialistName || 'No specialist assigned'}
                            </p>
                          </div>
                        </div>
                        <span className={`shrink-0 inline-flex px-3 py-1.5 text-xs font-semibold rounded-full ${
                          viewingClient.disabled ? 'bg-red-100 text-red-700' :
                          viewingClient.isNewUser ? 'bg-blue-100 text-blue-700' :
                          'bg-emerald-100 text-emerald-700'
                        }`}>
                          {viewingClient.disabled ? 'Inactive' : viewingClient.isNewUser ? 'Pending' : 'Active'}
                        </span>
                      </div>

                      <div>
                        <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                          <ClipboardList size={16} />
                          Requests ({clientRequests.length})
                        </h4>
                        {clientRequests.length === 0 ? (
                          <p className="text-sm text-slate-400 py-4 text-center bg-slate-50 rounded-lg">No requests from this client</p>
                        ) : (
                          <div className="overflow-x-auto rounded-lg border border-slate-200">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b border-slate-100 bg-slate-50">
                                  <th className="text-left p-3 font-semibold text-slate-600 text-xs">Type</th>
                                  <th className="text-left p-3 font-semibold text-slate-600 text-xs">Priority</th>
                                  <th className="text-left p-3 font-semibold text-slate-600 text-xs">Status</th>
                                  <th className="text-left p-3 font-semibold text-slate-600 text-xs">Open</th>
                                  <th className="text-left p-3 font-semibold text-slate-600 text-xs">Response</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {clientRequests.map(req => (
                                  <tr key={req.id} className="hover:bg-slate-50">
                                    <td className="p-3 text-slate-800 whitespace-nowrap">{req.type}</td>
                                    <td className="p-3">
                                      <span className={`inline-flex px-2.5 py-1 text-xs font-semibold rounded-full ${
                                        req.priority === 'urgent' ? 'bg-red-100 text-red-700' :
                                        req.priority === 'high' ? 'bg-amber-100 text-amber-700' :
                                        'bg-teal-100 text-teal-700'
                                      }`}>{req.priority}</span>
                                    </td>
                                    <td className="p-3">
                                      <span className={`inline-flex px-2.5 py-1 text-xs font-semibold rounded-full ${statusColors[req.status]}`}>
                                        {statusLabels[req.status]}
                                      </span>
                                    </td>
                                    <td className="p-3 text-xs text-slate-500 whitespace-nowrap">{req.submittedAt.toLocaleDateString()}</td>
                                    <td className="p-3 text-xs">
                                      <span className={`font-medium ${getResponseTime(req) === 'Waiting' ? 'text-amber-600' : 'text-slate-600'}`}>
                                        {getResponseTime(req)}
                                      </span>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>

                      {viewingClient.assignedSpecialistId && (
                        <div>
                          <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                            <MessageSquare size={16} />
                            Recent Messages
                          </h4>
                          {clientMessages.length === 0 ? (
                            <p className="text-sm text-slate-400 py-4 text-center bg-slate-50 rounded-lg">No messages yet</p>
                          ) : (
                            <div className="space-y-2 max-h-60 overflow-y-auto rounded-lg border border-slate-200 p-3">
                              {clientMessages.slice(-10).map(msg => (
                                <div key={msg.id} className={`flex ${msg.senderId === viewingClient.uid ? 'justify-start' : 'justify-end'}`}>
                                  <div className={`max-w-[80%] rounded-xl px-3 py-2 text-sm ${
                                    msg.senderId === viewingClient.uid
                                      ? 'bg-slate-100 text-slate-800 rounded-bl-sm'
                                      : 'bg-teal-500 text-white rounded-br-sm'
                                  }`}>
                                    <p className="text-xs font-semibold mb-0.5 opacity-70">{msg.senderName}</p>
                                    <p>{msg.text}</p>
                                    <p className="text-xs mt-0.5 opacity-60">
                                      {msg.createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                  <Users size={48} className="mb-3 text-slate-300" />
                  <p className="font-medium">Select a client</p>
                  <p className="text-sm mt-1">Click a client on the left to view their full analysis</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;
