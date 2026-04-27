import { useState, useEffect } from 'react';
import {
  Activity, ArrowUpRight, BarChart, Check, Copy,
  KeyRound, Loader2, Plus, Shield, Stethoscope, Trash2, Users, Inbox,
} from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { collection, getDocs, query } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { UserProfile } from '@/lib/firestore';
import { inviteCodeService, type InviteCode } from '@/lib/security';
import { DateTimeDisplay } from '@/lib/datetime';

/* ─── Invite Code Manager ─────────────────────────────────────── */
const InviteManager = ({ adminUid }: { adminUid: string }) => {
  const [codes, setCodes] = useState<InviteCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [newRole, setNewRole] = useState<'admin' | 'specialist'>('specialist');
  const [newLabel, setNewLabel] = useState('');
  const [copied, setCopied] = useState<string | null>(null);
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [generateError, setGenerateError] = useState<string | null>(null);

  const fetchCodes = async () => {
    try {
      const list = await inviteCodeService.list();
      setCodes(list.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()));
    } catch (e) {
      console.error('Error loading invite codes:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchCodes(); }, []);

  const handleGenerate = async () => {
    setGenerating(true);
    setGenerateError(null);
    try {
      const code = await inviteCodeService.generate(adminUid, newRole, newLabel.trim() || undefined);
      setGeneratedCode(code);
      setNewLabel('');
      await fetchCodes();
    } catch (e) {
      console.error('Error generating code:', e);
      setGenerateError('Failed to generate invite code. Check Firestore rules and try again.');
    } finally {
      setGenerating(false);
    }
  };

  const copyToClipboard = async (code: string) => {
    await navigator.clipboard.writeText(code);
    setCopied(code);
    setTimeout(() => setCopied(null), 2000);
  };

  const active = codes.filter(c => !c.used && c.expiresAt > new Date());
  const used = codes.filter(c => c.used);
  const expired = codes.filter(c => !c.used && c.expiresAt <= new Date());

  const BadgeColor = {
    admin: 'bg-purple-50 text-purple-700 border border-purple-200',
    specialist: 'bg-teal-50 text-teal-700 border border-teal-200',
  };

  const formatExpiry = (date: Date) => {
    const diff = date.getTime() - Date.now();
    if (diff <= 0) return 'Expired';
    const days = Math.floor(diff / 86400000);
    return days > 0 ? `${days}d left` : 'Expires today';
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-200 p-4">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
          <KeyRound size={20} className="text-teal-600" />
          Invite Code Manager
        </h2>
        <span className="text-xs text-slate-500">{active.length} active · {used.length} used</span>
      </div>

      {/* Generator */}
      <div className="border-b border-slate-100 bg-slate-50 p-4">
        <p className="mb-3 text-sm font-medium text-slate-700">Generate New Invite Code</p>
        <div className="flex flex-wrap gap-3 items-end">
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-500">Role</label>
            <select value={newRole} onChange={e => setNewRole(e.target.value as 'admin' | 'specialist')}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500">
              <option value="specialist">Specialist</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div className="flex-1 min-w-[160px] space-y-1">
            <label className="text-xs font-medium text-slate-500">Label (optional)</label>
            <input type="text" value={newLabel} onChange={e => setNewLabel(e.target.value)}
              placeholder='e.g. "For Dr. Jane Smith"'
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 placeholder:text-slate-400" />
          </div>
          <button onClick={handleGenerate} disabled={generating}
            className="flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50 transition">
            {generating ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
            Generate Code
          </button>
        </div>
        {generatedCode && (
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            <span className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Generated</span>
            <code className="rounded-md bg-white px-2 py-0.5 font-mono text-xs text-slate-800">{generatedCode}</code>
            <button
              onClick={() => copyToClipboard(generatedCode)}
              className="ml-auto rounded-md border border-emerald-200 bg-white px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100 transition"
            >
              {copied === generatedCode ? 'Copied!' : 'Copy'}
            </button>
          </div>
        )}
        {generateError && (
          <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {generateError}
          </div>
        )}
      </div>

      {/* Code list */}
      <div className="divide-y divide-slate-100">
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 size={24} className="animate-spin text-slate-400" />
          </div>
        ) : codes.length === 0 ? (
          <div className="py-8 text-center text-sm text-slate-500">
            No invite codes yet. Generate one above to onboard a new admin or specialist.
          </div>
        ) : (
          [...active, ...expired, ...used].map(code => (
            <div key={code.id} className="flex flex-wrap items-center gap-3 p-4 hover:bg-slate-50">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <code className={`rounded-md px-2 py-0.5 text-xs font-mono ${code.used ? 'line-through text-slate-400 bg-slate-100' : 'text-slate-800 bg-slate-100'}`}>
                    {code.code}
                  </code>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${BadgeColor[code.role]}`}>
                    {code.role}
                  </span>
                  {code.used && (
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500">Used</span>
                  )}
                  {!code.used && code.expiresAt <= new Date() && (
                    <span className="rounded-full bg-red-50 border border-red-200 px-2 py-0.5 text-[11px] text-red-600">Expired</span>
                  )}
                  {!code.used && code.expiresAt > new Date() && (
                    <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[11px] text-emerald-600">
                      {formatExpiry(code.expiresAt)}
                    </span>
                  )}
                </div>
                {code.label && (
                  <p className="mt-0.5 text-xs text-slate-500">{code.label}</p>
                )}
                {code.used && code.usedAt && (
                  <p className="mt-0.5 text-xs text-slate-400">
                    Used {code.usedAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </p>
                )}
              </div>
              {!code.used && code.expiresAt > new Date() && (
                <button onClick={() => copyToClipboard(code.code)}
                  className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 transition">
                  {copied === code.code ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                  {copied === code.code ? 'Copied!' : 'Copy'}
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

/* ─── Admin Dashboard ─────────────────────────────────────────── */
export const AdminDashboard = () => {
  const { sessionUser } = useAuth();
  const [metrics, setMetrics] = useState({ clients: 0, specialists: 0, requests: 0, calls: 0 });
  const [metricsLoading, setMetricsLoading] = useState(true);

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
              <div className="p-4 flex items-center justify-between hover:bg-slate-50 transition cursor-default">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded bg-teal-100 flex items-center justify-center text-teal-600">
                    <Users size={16} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">New Client Onboarded</p>
                    <p className="text-xs text-slate-500">System verified a new clinic registration</p>
                  </div>
                </div>
                <span className="text-[10px] font-medium text-slate-400">2 minutes ago</span>
              </div>
              <div className="p-4 flex items-center justify-between hover:bg-slate-50 transition cursor-default">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded bg-indigo-100 flex items-center justify-center text-indigo-600">
                    <KeyRound size={16} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Invite Code Generated</p>
                    <p className="text-xs text-slate-500">Admin generated a specialist access key</p>
                  </div>
                </div>
                <span className="text-[10px] font-medium text-slate-400">14 minutes ago</span>
              </div>
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
