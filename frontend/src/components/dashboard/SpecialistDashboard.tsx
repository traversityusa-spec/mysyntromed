import { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Check, CheckCircle, ChevronRight, ClipboardList, Clock, FileText, ListTodo, MessageSquare, RefreshCw, Users, Stethoscope, X, Phone, Building } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { collection, query, where, onSnapshot, getDocs } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { workflowService, API_BASE_URL, userService, requestService } from '@/lib/firestore';
import type { Request, UserProfile, WorkflowStatus, Message } from '@/lib/firestore';
import { messageService } from '@/lib/firestore';
import { getSocket } from '@/lib/socket';
import { DateTimeDisplay } from '@/lib/datetime';

export const SpecialistDashboard = () => {
  const { sessionUser, showWelcomeBack, welcomeBackData, clearWelcomeBack } = useAuth();
  const [specialistRequests, setSpecialistRequests] = useState<Request[]>([]);
  const [assignedClientRequests, setAssignedClientRequests] = useState<Request[]>([]);
  const [clients, setClients] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  // Per-client workflow state: keyed by clientId
  const [clientWorkflows, setClientWorkflows] = useState<Record<string, WorkflowStatus | null>>({});

  const [managingClient, setManagingClient] = useState<UserProfile | null>(null);
  const [clientMsgs, setClientMsgs] = useState<Message[]>([]);
  const [loadingClient, setLoadingClient] = useState(false);

  const requests = useMemo(() => {
    const byId = new Map<string, Request>();
    [...assignedClientRequests, ...specialistRequests].forEach((request) => byId.set(request.id, request));
    return Array.from(byId.values()).sort((a, b) => b.submittedAt.getTime() - a.submittedAt.getTime());
  }, [assignedClientRequests, specialistRequests]);

  const mapRequestDoc = (id: string, data: any): Request => ({
    id,
    ...data,
    submittedAt: data.submittedAt?.toDate?.() || new Date(),
    completedAt: data.completedAt?.toDate?.(),
    assignedAt: data.assignedAt?.toDate?.(),
  } as Request);

  const refreshAssignedClients = useCallback(async () => {
    if (!sessionUser?.uid) return;
    try {
      const assignedClients = await userService.getAssignedClients(sessionUser.uid);
      setClients(assignedClients);
    } catch (error) {
      console.error('[ASSIGNED CLIENTS] Refresh failed:', error);
    }
  }, [sessionUser?.uid]);

  useEffect(() => {
    if (!sessionUser?.uid) { setSpecialistRequests([]); setAssignedClientRequests([]); setClients([]); setLoading(false); return; }
    setLoading(true);

    const unsubReqs = onSnapshot(
      query(collection(db, 'requests'), where('specialistId', '==', sessionUser.uid)),
      (snap) => {
        setSpecialistRequests(snap.docs.map(d => mapRequestDoc(d.id, d.data())));
        setLoading(false);
      },
      (err) => { console.error('[REQUESTS] Subscription error:', err); setLoading(false); }
    );

    getDocs(query(collection(db, 'requests'), where('specialistId', '==', sessionUser.uid)))
      .then(snap => {
        setSpecialistRequests(snap.docs.map(d => mapRequestDoc(d.id, d.data())));
        setLoading(false);
      })
      .catch(err => { console.error('[REQUESTS] getDocs error:', err); setLoading(false); });

    const unsubClients = userService.subscribeToAssignedClients(sessionUser.uid, setClients);
    refreshAssignedClients();

    return () => { unsubReqs(); unsubClients(); };
  }, [sessionUser?.uid, refreshAssignedClients]);

  useEffect(() => {
    if (!clients.length) {
      setAssignedClientRequests([]);
      return;
    }

    let cancelled = false;
    const loadClientRequests = async () => {
      try {
        const chunks: UserProfile[][] = [];
        for (let index = 0; index < clients.length; index += 10) {
          chunks.push(clients.slice(index, index + 10));
        }
        const snaps = await Promise.all(
          chunks.map((chunk) => getDocs(query(collection(db, 'requests'), where('userId', 'in', chunk.map(client => client.uid)), where('specialistId', '==', sessionUser?.uid))))
        );
        if (!cancelled) {
          setAssignedClientRequests(snaps.flatMap(snap => snap.docs.map(d => mapRequestDoc(d.id, d.data()))));
        }
      } catch (err) {
        console.error('[CLIENT REQUESTS] Failed to load assigned client requests:', err);
      }
    };

    loadClientRequests();
    return () => { cancelled = true; };
  }, [clients]);

  // Subscribe to the currently selected client's workflow
  useEffect(() => {
    if (!sessionUser?.uid || !managingClient) return;
    const unsub = workflowService.subscribe(sessionUser.uid, (wf) => {
      setClientWorkflows(prev => ({ ...prev, [managingClient.uid]: wf }));
    }, managingClient.uid);
    return () => unsub();
  }, [sessionUser?.uid, managingClient?.uid]);

  const handleWorkflowChange = async (
    clientId: string,
    field: 'morningPrepStatus' | 'postClinicStatus',
    value: 'not_started' | 'in_progress' | 'completed'
  ) => {
    if (!sessionUser?.uid) return;
    try {
      if (field === 'morningPrepStatus') {
        await workflowService.updateMorningPrep(sessionUser.uid, value, clientId);
      } else {
        await workflowService.updatePostClinic(sessionUser.uid, value, clientId);
      }
    } catch (e) {
      console.error('[WORKFLOW] Failed to update:', e);
      return;
    }

    const socket = getSocket();
    if (socket?.connected) {
      socket.emit('workflowUpdate', {
        specialistId: sessionUser.uid,
        clientId,
        field,
        value,
        specialistName: sessionUser.displayName || 'Specialist',
      });
    }

    try {
      const adminSnap = await getDocs(query(collection(db, 'users'), where('role', '==', 'admin')));
      const adminEmails = adminSnap.docs.map(d => d.data().email).filter(Boolean);
      const client = clients.find(client => client.uid === clientId);
      const clientEmails = client?.email ? [client.email] : [];

      const token = await auth.currentUser?.getIdToken();
      if (!token) { console.warn('[WORKFLOW] No auth token'); return; }
      const res = await fetch(`${API_BASE_URL}/api/workflow/notify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          specialistId: sessionUser.uid,
          specialistName: sessionUser.displayName || 'Your Specialist',
          clientId,
          clientName: client?.displayName || 'Client',
          clientEmail: client?.email || '',
          step: field === 'morningPrepStatus' ? 'Morning Prep' : 'Post-Clinic Documentation',
          status: value,
          loginUrl: window.location.origin,
          recipientEmails: [...new Set([...adminEmails, ...clientEmails])],
        }),
      });
      if (!res.ok) console.error('[WORKFLOW] Backend error:', await res.text());
    } catch (e) {
      console.error('[WORKFLOW] Failed to send notification:', e);
    }
  };

  const handleManageClient = async (client: UserProfile) => {
    setManagingClient(client);
    setLoadingClient(true);
    try {
      const msgs = await messageService.getConversation(sessionUser!.uid, client.uid);
      setClientMsgs(msgs);
    } catch (e) {
      console.error('Error loading messages:', e);
      setClientMsgs([]);
    }
    setLoadingClient(false);
  };

  const handleClientRequestStatusChange = async (requestId: string, newStatus: 'pending' | 'in_progress' | 'completed') => {
    try {
      await requestService.updateRequestStatus(requestId, newStatus, sessionUser?.uid, sessionUser?.displayName || sessionUser?.email || 'Specialist');
      setSpecialistRequests(prev => prev.map(req => req.id === requestId ? { ...req, status: newStatus, completedAt: newStatus === 'completed' ? new Date() : req.completedAt } : req));
      setAssignedClientRequests(prev => prev.map(req => req.id === requestId ? { ...req, status: newStatus, completedAt: newStatus === 'completed' ? new Date() : req.completedAt } : req));
    } catch (e) {
      console.error('Error updating client request status:', e);
    }
  };

  const selectedClientDashboard = useMemo(() => {
    if (!managingClient) return null;
    const allRequests = requests.filter(r => r.userId === managingClient.uid);
    const openRequests = allRequests.filter(r => r.status !== 'completed');
    const urgentRequests = allRequests.filter(r => r.priority === 'urgent' && r.status !== 'completed');

    return {
      allRequests,
      openRequests,
      urgentRequests,
      completedRequests: allRequests.filter(r => r.status === 'completed'),
    };
  }, [managingClient, requests]);

  const stats = [
    { label: 'Total Requests', value: requests.length || 0, icon: ClipboardList, color: 'bg-purple-50 text-purple-600' },
    { label: 'Active Clients', value: clients.length || 0, icon: Users, color: 'bg-blue-50 text-blue-600' },
    { label: 'Pending', value: requests.filter(r => r.status === 'pending').length, icon: Clock, color: 'bg-amber-50 text-amber-600' },
    { label: 'Completed', value: requests.filter(r => r.status === 'completed').length, icon: CheckCircle, color: 'bg-emerald-50 text-emerald-600' },
  ];

  // Helper to get workflow for currently managing client
  const currentWorkflow = managingClient ? clientWorkflows[managingClient.uid] : null;

  return (
    <div className="space-y-6">
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
                    ? 'Great to see you again. Here\'s your specialist overview.'
                    : 'Your specialist dashboard is ready.'}
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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">Specialist Dashboard</h1>
          <p className="mt-1 text-slate-600">Welcome back, {sessionUser?.displayName?.split(' ')[0] || 'Specialist'}</p>
        </div>
        <div className="flex items-center gap-4">
          <DateTimeDisplay />
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
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
          <div className="rounded-xl border border-teal-100 bg-teal-50 px-5 py-4 lg:min-w-56">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">Assigned Clients</p>
                <p className="mt-1 text-3xl font-bold text-navy-900">{loading ? '-' : clients.length}</p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-white text-teal-600">
                <Users size={24} />
              </div>
            </div>
            <p className="mt-1 text-xs text-teal-700">Use each client dashboard below to manage their work.</p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {(sessionUser?.specialties?.length ? sessionUser.specialties : ['Add specialties in Settings']).map((item) => (
            item === 'Add specialties in Settings' ? (
              <Link key={item} to="/specialist/settings" className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-600 hover:bg-teal-50 hover:text-teal-700 transition">
                {item}
              </Link>
            ) : (
              <span key={item} className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-600">
                {item}
              </span>
            )
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

          {/* Client Dashboards */}
          <div className="rounded-xl border border-slate-200 bg-white">
            <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-navy-900">Client Dashboards</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {clients.length} assigned client{clients.length === 1 ? '' : 's'} available to manage
                </p>
              </div>
              <Link to="/specialist/requests" className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                <ClipboardList size={16} />
                All Requests
              </Link>
            </div>
            <div className="p-4">
              {clients.length === 0 ? (
                <div className="py-8 text-center text-slate-500">
                  <Users size={32} className="mx-auto mb-2 text-slate-300" />
                  <p className="font-medium">No clients assigned yet</p>
                  <p className="text-xs mt-1">Assigned clients will appear here with their own dashboard.</p>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {clients.map((client) => {
                    const clientRequests = requests.filter(r => r.userId === client.uid);
                    const openRequests = clientRequests.filter(r => r.status !== 'completed');
                    const urgentRequests = openRequests.filter(r => r.priority === 'urgent');

                    return (
                      <button
                        key={client.uid}
                        onClick={() => handleManageClient(client)}
                        className={`rounded-xl border p-4 text-left transition hover:border-teal-200 hover:bg-teal-50/40 ${
                          managingClient?.uid === client.uid ? 'border-teal-300 bg-teal-50' : 'border-slate-200 bg-white'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-teal-400 to-teal-600 text-sm font-bold text-white">
                            {client.photoURL ? (
                              <img src={client.photoURL} alt={client.displayName || 'Client'} className="h-full w-full object-cover" />
                            ) : (
                              client.displayName?.charAt(0) || 'C'
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-slate-900">{client.displayName || client.email || 'Client'}</p>
                                <p className="truncate text-xs text-slate-500">{client.clinicName || client.email}</p>
                              </div>
                              <ChevronRight size={16} className="mt-0.5 shrink-0 text-slate-300" />
                            </div>
                            <div className="mt-3 grid grid-cols-3 gap-2">
                              <div className="rounded-lg bg-slate-50 px-2 py-2 text-center">
                                <p className="text-base font-bold text-navy-900">{openRequests.length}</p>
                                <p className="text-xs font-medium text-slate-500">Open</p>
                              </div>
                              <div className="rounded-lg bg-slate-50 px-2 py-2 text-center">
                                <p className="text-base font-bold text-navy-900">{clientRequests.length}</p>
                                <p className="text-xs font-medium text-slate-500">Total</p>
                              </div>
                              <div className={`rounded-lg px-2 py-2 text-center ${urgentRequests.length ? 'bg-red-50' : 'bg-slate-50'}`}>
                                <p className={`text-base font-bold ${urgentRequests.length ? 'text-red-700' : 'text-navy-900'}`}>{urgentRequests.length}</p>
                                <p className={`text-xs font-medium ${urgentRequests.length ? 'text-red-600' : 'text-slate-500'}`}>Urgent</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Per-Client Detail Panel */}
          {managingClient && selectedClientDashboard && (
            <div className="rounded-xl border border-teal-200 bg-white shadow-sm">
              {/* Header */}
              <div className="flex flex-col gap-4 border-b border-slate-200 p-5 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-teal-400 to-teal-600 text-sm font-bold text-white">
                    {managingClient.photoURL ? (
                      <img src={managingClient.photoURL} alt={managingClient.displayName || 'Client'} className="h-full w-full object-cover" />
                    ) : (
                      managingClient.displayName?.charAt(0) || 'C'
                    )}
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">Managing Client</p>
                    <h3 className="text-lg font-semibold text-navy-900">{managingClient.displayName || 'Client'}</h3>
                    <p className="text-sm text-slate-500">{managingClient.clinicName || managingClient.email}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link to="/specialist/messages" className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-3 py-2 text-sm font-medium text-white hover:bg-teal-700">
                    <MessageSquare size={16} />
                    Message
                  </Link>
                  <button onClick={() => setManagingClient(null)} className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50" aria-label="Close client dashboard">
                    <X size={16} />
                  </button>
                </div>
              </div>

              {/* Stats */}
              <div className="grid gap-3 border-b border-slate-100 p-5 sm:grid-cols-4">
                {[
                  { label: 'Open Requests', value: selectedClientDashboard.openRequests.length },
                  { label: 'Completed', value: selectedClientDashboard.completedRequests.length },
                  { label: 'Urgent', value: selectedClientDashboard.urgentRequests.length },
                  { label: 'Messages', value: clientMsgs.length },
                ].map((item) => (
                  <div key={item.label} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                    <p className="text-2xl font-bold text-navy-900">{loadingClient ? '-' : item.value}</p>
                    <p className="text-xs font-medium text-slate-500">{item.label}</p>
                  </div>
                ))}
              </div>

              {/* Today With This Client — Per-client workflow */}
              <div className="border-b border-slate-100 p-5">
                <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">Today with {managingClient.displayName || 'this client'}</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between rounded-lg border border-slate-200 p-4">
                    <div className="flex items-center gap-3">
                      <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${currentWorkflow?.morningPrepStatus === 'completed' ? 'bg-emerald-100' : currentWorkflow?.morningPrepStatus === 'in_progress' ? 'bg-amber-100' : 'bg-slate-100'}`}>
                        {currentWorkflow?.morningPrepStatus === 'completed' ? (
                          <Check className="h-5 w-5 text-emerald-600" />
                        ) : currentWorkflow?.morningPrepStatus === 'in_progress' ? (
                          <RefreshCw className="h-5 w-5 animate-spin text-amber-600" />
                        ) : (
                          <Clock className="h-5 w-5 text-slate-400" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-slate-900">Morning Prep</p>
                        <p className="text-sm text-slate-500">Prepare charts and patient details</p>
                      </div>
                    </div>
                    <select
                      value={currentWorkflow?.morningPrepStatus || 'not_started'}
                      onChange={(e) => handleWorkflowChange(managingClient.uid, 'morningPrepStatus', e.target.value as 'not_started' | 'in_progress' | 'completed')}
                      className={`rounded-lg border px-3 py-1.5 text-xs font-medium outline-none ${
                        currentWorkflow?.morningPrepStatus === 'completed' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' :
                        currentWorkflow?.morningPrepStatus === 'in_progress' ? 'border-amber-200 bg-amber-50 text-amber-700' :
                        'border-slate-200 bg-slate-50 text-slate-600'
                      }`}
                    >
                      <option value="not_started">Not Started</option>
                      <option value="in_progress">Ongoing</option>
                      <option value="completed">Completed</option>
                    </select>
                  </div>

                  <div className="flex items-center justify-between rounded-lg border border-slate-200 p-4">
                    <div className="flex items-center gap-3">
                      <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${currentWorkflow?.postClinicStatus === 'completed' ? 'bg-emerald-100' : currentWorkflow?.postClinicStatus === 'in_progress' ? 'bg-amber-100' : 'bg-slate-100'}`}>
                        {currentWorkflow?.postClinicStatus === 'completed' ? (
                          <Check className="h-5 w-5 text-emerald-600" />
                        ) : currentWorkflow?.postClinicStatus === 'in_progress' ? (
                          <RefreshCw className="h-5 w-5 animate-spin text-amber-600" />
                        ) : (
                          <FileText className="h-5 w-5 text-slate-400" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-slate-900">Post-Clinic Documentation</p>
                        <p className="text-sm text-slate-500">Finalize notes in EHR</p>
                      </div>
                    </div>
                    <select
                      value={currentWorkflow?.postClinicStatus || 'not_started'}
                      onChange={(e) => handleWorkflowChange(managingClient.uid, 'postClinicStatus', e.target.value as 'not_started' | 'in_progress' | 'completed')}
                      disabled={!currentWorkflow?.clinicDayFinished}
                      className={`rounded-lg border px-3 py-1.5 text-xs font-medium outline-none ${
                        !currentWorkflow?.clinicDayFinished ? 'cursor-not-allowed opacity-50' :
                        currentWorkflow?.postClinicStatus === 'completed' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' :
                        currentWorkflow?.postClinicStatus === 'in_progress' ? 'border-amber-200 bg-amber-50 text-amber-700' :
                        'border-slate-200 bg-slate-50 text-slate-600'
                      }`}
                    >
                      <option value="not_started">Not Started</option>
                      <option value="in_progress">Ongoing</option>
                      <option value="completed">Completed</option>
                    </select>
                  </div>
                </div>

                {currentWorkflow?.clinicDayFinished && (
                  <div className="mt-4 flex flex-wrap gap-3">
                    <Link
                      to="/specialist/messages"
                      className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                      <MessageSquare size={16} />
                      Message {managingClient.displayName || 'Client'}
                    </Link>
                  </div>
                )}
              </div>

              {/* Requests + Messages */}
              <div className="grid gap-5 p-5 lg:grid-cols-2">
                <div>
                  <div className="mb-3 flex items-center justify-between">
                    <h4 className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                      <ClipboardList size={14} />
                      Client Requests
                    </h4>
                    <Link to="/specialist/requests" className="text-xs font-medium text-teal-600 hover:text-teal-700">View all</Link>
                  </div>
                  {loadingClient ? (
                    <div className="flex justify-center py-8">
                      <div className="h-8 w-8 animate-spin rounded-full border-2 border-teal-500 border-t-transparent" />
                    </div>
                  ) : selectedClientDashboard.allRequests.length === 0 ? (
                    <p className="rounded-lg bg-slate-50 py-4 text-center text-sm text-slate-400">No requests yet</p>
                  ) : (
                    <div className="space-y-2">
                      {selectedClientDashboard.allRequests.slice(0, 5).map(req => (
                        <div key={req.id} className="rounded-lg border border-slate-200 p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-slate-900">{req.type}</p>
                              <p className="mt-1 line-clamp-2 text-xs text-slate-500">{req.description}</p>
                            </div>
                            <select
                              value={req.status}
                              onChange={(e) => handleClientRequestStatusChange(req.id, e.target.value as 'pending' | 'in_progress' | 'completed')}
                              className={`shrink-0 rounded-lg border px-3 py-1.5 text-xs font-medium outline-none ${
                                req.status === 'completed' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' :
                                req.status === 'in_progress' ? 'border-blue-200 bg-blue-50 text-blue-700' :
                                'border-slate-200 bg-slate-50 text-slate-600'
                              }`}
                            >
                              <option value="pending">Pending</option>
                              <option value="in_progress">In Progress</option>
                              <option value="completed">Completed</option>
                            </select>
                          </div>
                          <div className="mt-2 flex items-center justify-between gap-3">
                            <span className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full ${
                              req.priority === 'urgent' ? 'bg-red-100 text-red-700' :
                              req.priority === 'high' ? 'bg-amber-100 text-amber-700' :
                              'bg-teal-100 text-teal-700'
                            }`}>{req.priority}</span>
                            <span className="text-xs text-slate-400">{req.submittedAt.toLocaleDateString()}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
                    <MessageSquare size={14} />
                    Recent Messages
                  </h4>
                  {loadingClient ? (
                    <div className="flex justify-center py-8">
                      <div className="h-8 w-8 animate-spin rounded-full border-2 border-teal-500 border-t-transparent" />
                    </div>
                  ) : clientMsgs.length === 0 ? (
                    <p className="rounded-lg bg-slate-50 py-4 text-center text-sm text-slate-400">No messages yet</p>
                  ) : (
                    <div className="max-h-80 space-y-2 overflow-y-auto rounded-lg border border-slate-200 p-3">
                      {clientMsgs.slice(-8).map(msg => (
                        <div key={msg.id} className={`flex ${msg.senderId === sessionUser?.uid ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[80%] rounded-xl px-3 py-2 text-sm ${
                            msg.senderId === sessionUser?.uid
                              ? 'bg-teal-500 text-white rounded-br-sm'
                              : 'bg-slate-100 text-slate-800 rounded-bl-sm'
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
                  <div className="mt-3 rounded-lg border border-slate-100 bg-slate-50 p-3 text-xs text-slate-500">
                    {managingClient.phone && (
                      <p className="mb-1 flex items-center gap-2">
                        <Phone size={13} className="text-slate-400" />
                        {managingClient.phone}
                      </p>
                    )}
                    <p className="flex items-center gap-2">
                      <Building size={13} className="text-slate-400" />
                      {managingClient.clinicName || 'Clinic details not added'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Incoming Requests */}
          <div className="rounded-xl border border-slate-200 bg-white">
            <div className="flex items-center justify-between border-b border-slate-200 p-4">
              <div>
                <h2 className="text-lg font-semibold text-navy-900">Incoming Requests</h2>
                <p className="text-xs text-slate-500 mt-0.5">Track your support requests</p>
              </div>
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


        </div>
      </div>
    </div>
  );
};

export default SpecialistDashboard;
