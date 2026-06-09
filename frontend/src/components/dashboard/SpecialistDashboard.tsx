import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, Check, CheckCircle, ChevronRight, ClipboardList, Clock, FileText, ListTodo, MessageSquare, Plus, RefreshCw, Users, Stethoscope, X, Mail, Phone, Building } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { collection, query, where, onSnapshot, getDocs } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { workflowService, API_BASE_URL } from '@/lib/firestore';
import type { Request, UserProfile, WorkflowStatus, Message } from '@/lib/firestore';
import { messageService } from '@/lib/firestore';
import { DateTimeDisplay } from '@/lib/datetime';

export const SpecialistDashboard = () => {
  const { sessionUser, showWelcomeBack, welcomeBackData, clearWelcomeBack } = useAuth();
  const [requests, setRequests] = useState<Request[]>([]);
  const [clients, setClients] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [workflow, setWorkflow] = useState<WorkflowStatus | null>(null);
  const [managingClient, setManagingClient] = useState<UserProfile | null>(null);
  const [clientReqs, setClientReqs] = useState<Request[]>([]);
  const [clientMsgs, setClientMsgs] = useState<Message[]>([]);
  const [loadingClient, setLoadingClient] = useState(false);

  useEffect(() => {
    if (!sessionUser?.uid) { setRequests([]); setClients([]); setLoading(false); return; }
    setLoading(true);

    const unsubReqs = onSnapshot(
      query(collection(db, 'requests'), where('specialistId', '==', sessionUser.uid)),
      (snap) => {
        setRequests(snap.docs.map(d => ({ id: d.id, ...d.data(), submittedAt: d.data().submittedAt?.toDate() } as Request)));
        setLoading(false);
      },
      (err) => { console.error('[REQUESTS] Subscription error:', err); setLoading(false); }
    );

    getDocs(query(collection(db, 'users'), where('assignedSpecialistId', '==', sessionUser.uid)))
      .then(snap => setClients(snap.docs.map(d => ({ uid: d.id, ...d.data() } as UserProfile))))
      .catch(err => console.error('[CLIENTS] getDocs error:', err));

    const unsubClients = onSnapshot(
      query(collection(db, 'users'), where('assignedSpecialistId', '==', sessionUser.uid)),
      (snap) => {
        if (!snap.metadata.hasPendingWrites) setClients(snap.docs.map(d => ({ uid: d.id, ...d.data() } as UserProfile)));
      },
      (err) => { console.error('[CLIENTS] Subscription error:', err); }
    );

    return () => { unsubReqs(); unsubClients(); };
  }, [sessionUser?.uid]);

  useEffect(() => {
    if (!sessionUser?.uid) return;
    const unsubWf = workflowService.subscribe(sessionUser.uid, setWorkflow);
    return () => { unsubWf(); };
  }, [sessionUser?.uid]);

  const handleWorkflowChange = async (field: 'morningPrepStatus' | 'postClinicStatus', value: 'not_started' | 'in_progress' | 'completed') => {
    if (!sessionUser?.uid) return;
    try {
      if (field === 'morningPrepStatus') {
        await workflowService.updateMorningPrep(sessionUser.uid, value);
      } else {
        await workflowService.updatePostClinic(sessionUser.uid, value);
      }
    } catch (e) {
      console.error('[WORKFLOW] Failed to update:', e);
      return;
    }
    try {
      const [adminSnap, assignedClientsSnap] = await Promise.all([
        getDocs(query(collection(db, 'users'), where('role', '==', 'admin'))),
        getDocs(query(collection(db, 'users'), where('assignedSpecialistId', '==', sessionUser.uid))),
      ]);
      const adminEmails = adminSnap.docs.map(d => d.data().email).filter(Boolean);
      const clientEmails = assignedClientsSnap.docs.map(d => d.data().email).filter(Boolean);

      const token = await auth.currentUser?.getIdToken();
      if (!token) { console.warn('[WORKFLOW] No auth token'); return; }
      const res = await fetch(`${API_BASE_URL}/api/workflow/notify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          specialistId: sessionUser.uid,
          specialistName: sessionUser.displayName || 'Your Specialist',
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
    setClientReqs(requests.filter(r => r.userId === client.uid));
    try {
      const msgs = await messageService.getConversation(sessionUser!.uid, client.uid);
      setClientMsgs(msgs);
    } catch (e) {
      console.error('Error loading messages:', e);
      setClientMsgs([]);
    }
    setLoadingClient(false);
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

  const stats = [
    { label: 'Total Requests', value: requests.length || 0, icon: ClipboardList, color: 'bg-purple-50 text-purple-600' },
    { label: 'Active Clients', value: clients.length || 0, icon: Users, color: 'bg-blue-50 text-blue-600' },
    { label: 'Pending', value: requests.filter(r => r.status === 'pending').length, icon: Clock, color: 'bg-amber-50 text-amber-600' },
    { label: 'Completed', value: requests.filter(r => r.status === 'completed').length, icon: CheckCircle, color: 'bg-emerald-50 text-emerald-600' },
  ];

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
          {/* Today With Your Clients */}
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="mb-4 text-lg font-semibold text-navy-900">Today With Your Clients</h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-lg border border-slate-200 p-4">
                <div className="flex items-center gap-3">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${workflow?.morningPrepStatus === 'completed' ? 'bg-emerald-100' : workflow?.morningPrepStatus === 'in_progress' ? 'bg-amber-100' : 'bg-slate-100'}`}>
                    {workflow?.morningPrepStatus === 'completed' ? (
                      <Check className="h-5 w-5 text-emerald-600" />
                    ) : workflow?.morningPrepStatus === 'in_progress' ? (
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
                  value={workflow?.morningPrepStatus || 'not_started'}
                  onChange={(e) => handleWorkflowChange('morningPrepStatus', e.target.value as 'not_started' | 'in_progress' | 'completed')}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-medium outline-none ${
                    workflow?.morningPrepStatus === 'completed' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' :
                    workflow?.morningPrepStatus === 'in_progress' ? 'border-amber-200 bg-amber-50 text-amber-700' :
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
                  <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${workflow?.postClinicStatus === 'completed' ? 'bg-emerald-100' : workflow?.postClinicStatus === 'in_progress' ? 'bg-amber-100' : 'bg-slate-100'}`}>
                    {workflow?.postClinicStatus === 'completed' ? (
                      <Check className="h-5 w-5 text-emerald-600" />
                    ) : workflow?.postClinicStatus === 'in_progress' ? (
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
                  value={workflow?.postClinicStatus || 'not_started'}
                  onChange={(e) => handleWorkflowChange('postClinicStatus', e.target.value as 'not_started' | 'in_progress' | 'completed')}
                  disabled={!workflow?.clinicDayFinished}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-medium outline-none ${
                    !workflow?.clinicDayFinished ? 'cursor-not-allowed opacity-50' :
                    workflow?.postClinicStatus === 'completed' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' :
                    workflow?.postClinicStatus === 'in_progress' ? 'border-amber-200 bg-amber-50 text-amber-700' :
                    'border-slate-200 bg-slate-50 text-slate-600'
                  }`}
                >
                  <option value="not_started">Not Started</option>
                  <option value="in_progress">Ongoing</option>
                  <option value="completed">Completed</option>
                </select>
              </div>
            </div>

            {workflow?.clinicDayFinished && (
            <div className="mt-4 flex flex-wrap gap-3">
              <Link
                to="/specialist/messages"
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                <MessageSquare size={16} />
                Message Clients
              </Link>
            </div>
            )}
          </div>

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

          {clients.length > 0 && (
          <div className="rounded-xl border border-slate-200 bg-white">
            <div className="border-b border-slate-100 p-4">
              <h2 className="text-lg font-semibold text-navy-900 flex items-center gap-2">
                <Users size={18} className="text-indigo-500" />
                My Clients ({clients.length})
              </h2>
            </div>
            <div className="divide-y divide-slate-100">
              {clients.map((client) => (
                <button
                  key={client.uid}
                  onClick={() => handleManageClient(client)}
                  className={`w-full flex items-center gap-3 p-4 text-left hover:bg-slate-50 transition ${
                    managingClient?.uid === client.uid ? 'bg-indigo-50' : ''
                  }`}
                >
                  <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-teal-400 to-teal-600 text-xs font-bold text-white shrink-0">
                    {client.photoURL ? (
                      <img src={client.photoURL} alt={client.displayName || 'Client'} className="h-full w-full object-cover" />
                    ) : (
                      client.displayName?.charAt(0) || 'C'
                    )}
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-sm font-medium text-slate-900 truncate">{client.displayName || client.email || 'Client'}</p>
                    <p className="text-xs text-slate-500 truncate">{client.email}</p>
                    <p className="text-xs text-emerald-600 flex items-center gap-1 mt-0.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      {requests.filter(r => r.userId === client.uid && r.status !== 'completed').length} open request{(requests.filter(r => r.userId === client.uid && r.status !== 'completed').length) !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <ChevronRight size={16} className="text-slate-300 shrink-0" />
                </button>
              ))}
            </div>
          </div>
          )}

          {/* Client Detail Panel */}
          {managingClient && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setManagingClient(null)}>
              <div className="w-full max-w-2xl max-h-[85vh] flex flex-col rounded-xl bg-white shadow-xl" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between border-b border-slate-200 p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-teal-400 to-teal-600 text-sm font-bold text-white">
                      {managingClient.photoURL ? (
                        <img src={managingClient.photoURL} alt="" className="h-full w-full object-cover rounded-full" />
                      ) : (
                        managingClient.displayName?.charAt(0) || 'C'
                      )}
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900">{managingClient.displayName || 'Client'}</h3>
                      <p className="text-xs text-slate-500">{managingClient.email}</p>
                    </div>
                  </div>
                  <button onClick={() => setManagingClient(null)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 transition">
                    <X size={20} />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-5">
                  {managingClient.phone && (
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <Phone size={14} className="text-slate-400" />
                      {managingClient.phone}
                    </div>
                  )}
                  {managingClient.clinicName && (
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <Building size={14} className="text-slate-400" />
                      {managingClient.clinicName}
                    </div>
                  )}

                  {loadingClient ? (
                    <div className="flex justify-center py-8">
                      <div className="h-8 w-8 animate-spin rounded-full border-2 border-teal-500 border-t-transparent" />
                    </div>
                  ) : (
                    <>
                      <div>
                        <h4 className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                          <ClipboardList size={14} />
                          Requests ({clientReqs.length})
                        </h4>
                        {clientReqs.length === 0 ? (
                          <p className="text-sm text-slate-400 py-3 text-center bg-slate-50 rounded-lg">No requests yet</p>
                        ) : (
                          <div className="space-y-2">
                            {clientReqs.map(req => (
                              <div key={req.id} className="rounded-lg border border-slate-200 p-3">
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-sm font-medium text-slate-900">{req.type}</span>
                                  <span className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full ${statusColors[req.status]}`}>
                                    {statusLabels[req.status]}
                                  </span>
                                </div>
                                <p className="text-xs text-slate-500 mb-1">{req.description}</p>
                                <div className="flex items-center justify-between">
                                  <span className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full ${
                                    req.priority === 'urgent' ? 'bg-red-100 text-red-700' :
                                    req.priority === 'high' ? 'bg-amber-100 text-amber-700' :
                                    'bg-teal-100 text-teal-700'
                                  }`}>{req.priority}</span>
                                  <span className="text-[10px] text-slate-400">{req.submittedAt.toLocaleDateString()}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div>
                        <h4 className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                          <MessageSquare size={14} />
                          Recent Messages
                        </h4>
                        {clientMsgs.length === 0 ? (
                          <p className="text-sm text-slate-400 py-3 text-center bg-slate-50 rounded-lg">No messages yet</p>
                        ) : (
                          <div className="space-y-2 max-h-60 overflow-y-auto rounded-lg border border-slate-200 p-3">
                            {clientMsgs.slice(-10).map(msg => (
                              <div key={msg.id} className={`flex ${msg.senderId === sessionUser?.uid ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[80%] rounded-xl px-3 py-2 text-sm ${
                                  msg.senderId === sessionUser?.uid
                                    ? 'bg-teal-500 text-white rounded-br-sm'
                                    : 'bg-slate-100 text-slate-800 rounded-bl-sm'
                                }`}>
                                  <p className="text-xs font-semibold mb-0.5 opacity-70">{msg.senderName}</p>
                                  <p>{msg.text}</p>
                                  <p className="text-[10px] mt-0.5 opacity-60">
                                    {msg.createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        <Link
                          to="/specialist/messages"
                          className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-teal-600 hover:text-teal-700"
                        >
                          <MessageSquare size={14} />
                          Open full conversation
                        </Link>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

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
