import { useState, useEffect, type FormEvent, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { collection, limit, onSnapshot, query, orderBy, where, updateDoc, doc, getDocs } from 'firebase/firestore';
import { db, activityService, messageService, API_BASE_URL } from '@/lib/firestore';
import type { UserProfile, Request, Message, ActivityItem } from '@/lib/firestore';
import { Users, Stethoscope, MessageSquare, ChartBar, Search, CheckCircle, Clock, AlertCircle, Plus, X, ShieldAlert, UserMinus, UserCheck, RefreshCw, Mail, Copy, Check, Trash2, ClipboardList, Shield, Send, Megaphone, Star, Phone, Activity, UserPlus, User } from 'lucide-react';
import { motion } from 'motion/react';
import { useAuth } from '@/lib/AuthContext';

const generatePassword = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
  const length = 14;
  let password = '';
  const array = new Uint32Array(length);
  crypto.getRandomValues(array);
  for (let i = 0; i < length; i++) {
    password += chars[array[i] % chars.length];
  }
  return password;
};

const CreateUserModal = ({ 
  isOpen, 
  onClose, 
  role, 
  onSuccess 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  role: 'client' | 'specialist' | 'admin';
  onSuccess: (msg: string) => void;
}) => {
  const { user } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailCopied, setEmailCopied] = useState(false);
  const [passwordCopied, setPasswordCopied] = useState(false);

  const handleAutoGenerate = () => {
    const newPassword = generatePassword();
    setPassword(newPassword);
  };

  const handleCopyEmail = () => {
    navigator.clipboard.writeText(email);
    setEmailCopied(true);
    setTimeout(() => setEmailCopied(false), 2000);
  };

  const handleCopyPassword = () => {
    navigator.clipboard.writeText(password);
    setPasswordCopied(true);
    setTimeout(() => setPasswordCopied(false), 2000);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    
    if (!password) {
      setError('Please generate a password first using the Auto Generate button.');
      return;
    }
    
    setSubmitting(true);
    setError(null);

    try {
      const token = await user?.getIdToken();
      const response = await fetch(`${API_BASE_URL}/api/auth/admin/create-user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ email: email.trim().toLowerCase(), password, displayName: displayName.trim(), role })
      });

      const text = await response.text();
      if (!text) throw new Error('Server returned empty response');
      const data = JSON.parse(text);
      if (!response.ok) throw new Error(data.error || `Failed to create user (${response.status})`);

      onSuccess(`Successfully created ${role} account for ${displayName}. Login credentials have been sent to their email.`);
      onClose();
      setEmail('');
      setPassword('');
      setDisplayName('');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setEmail('');
    setPassword('');
    setDisplayName('');
    setError(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"
      >
        <button onClick={handleClose} className="absolute right-4 top-4 text-slate-400 hover:text-slate-600">
          <X size={20} />
        </button>

        <div className="mb-6">
          <h2 className="text-xl font-bold text-navy-900">Create New {role.charAt(0).toUpperCase() + role.slice(1)}</h2>
          <p className="text-sm text-slate-500 mt-1">An email with login credentials will be automatically sent to the user.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Full Name</label>
            <input
              type="text"
              required
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g. Dr. Jane Smith"
              className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Email Address</label>
            <div className="relative">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="jane@example.com"
                className="w-full rounded-lg border border-slate-200 px-3 py-2.5 pr-10 text-sm outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
              />
              {email && (
                <button
                  type="button"
                  onClick={handleCopyEmail}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-600 transition-colors"
                  title="Copy email"
                >
                  {emailCopied ? <Check size={16} className="text-emerald-500" /> : <Copy size={16} />}
                </button>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Temporary Password</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Click 'Auto Generate' to create password"
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 pr-10 text-sm font-mono outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
                />
                {password && (
                  <button
                    type="button"
                    onClick={handleCopyPassword}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-600 transition-colors"
                    title="Copy password"
                  >
                    {passwordCopied ? <Check size={16} className="text-emerald-500" /> : <Copy size={16} />}
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={handleAutoGenerate}
                className="flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 transition-colors whitespace-nowrap"
              >
                <RefreshCw size={16} />
                Auto Generate
              </button>
            </div>
            {!password && (
              <p className="text-xs text-amber-600 flex items-center gap-1">
                <ShieldAlert size={12} />
                Password is required. Click Auto Generate to create one.
              </p>
            )}
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 border border-red-100 p-3 text-sm text-red-600 flex gap-2">
              <ShieldAlert size={16} className="shrink-0 mt-0.5" />
              {error}
            </div>
          )}

          <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 flex gap-3">
            <Mail size={18} className="text-blue-500 shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-blue-900">Welcome Email</p>
              <p className="text-blue-700 text-xs mt-0.5">
                A welcome email with login credentials will be automatically sent to the user's email address upon account creation.
              </p>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 rounded-lg border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !password}
              className="flex-1 rounded-lg bg-teal-600 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Creating & Sending Email...
                </>
              ) : (
                <>
                  <Mail size={16} />
                  Create & Send Email
                </>
              )}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

export const AdminClients = () => {
  const { user: authUser } = useAuth();
  const [clients, setClients] = useState<UserProfile[]>([]);
  const [specialists, setSpecialists] = useState<UserProfile[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deletingUser, setDeletingUser] = useState<{uid: string; name: string} | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const idToken = await authUser?.getIdToken(true);
      if (!idToken) return;

      const response = await fetch(`${API_BASE_URL}/api/auth/admin/users`, {
        headers: {
          'Authorization': `Bearer ${idToken}`
        }
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: 'Unknown error' }));
        setFetchError(err.error || `Server error (${response.status})`);
        return;
      }
      setFetchError(null);
      const data = await response.json();
      if (data.users) {
        const mapUser = (u: any) => ({
          uid: u.uid,
          email: u.email,
          displayName: u.displayName,
          role: u.role,
          disabled: u.disabled,
          createdAt: u.createdAt ? new Date(u.createdAt) : new Date(),
          updatedAt: u.createdAt ? new Date(u.createdAt) : new Date(),
          assignedSpecialistId: u.assignedSpecialistId,
          assignedSpecialistName: u.assignedSpecialistName,
          photoURL: u.photoURL,
          isNewUser: u.isNewUser
        } as UserProfile);

        const allUsers = data.users.map(mapUser);
        setClients(allUsers.filter((u: any) => u.role === 'client').sort((a: any, b: any) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0)));
        setSpecialists(allUsers.filter((u: any) => u.role === 'specialist').sort((a: any, b: any) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0)));
      }
    } catch (e: any) {
      console.error('Error fetching admin data:', e);
      setFetchError(e.message || 'Failed to connect to server');
    } finally {
      setLoading(false);
    }
  }, [authUser]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleToggleStatus = async (uid: string, currentDisabled: boolean) => {
    setActionLoading(uid);
    try {
      const token = await authUser?.getIdToken();
      const response = await fetch(`${API_BASE_URL}/api/auth/admin/deactivate-user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ uid, disabled: !currentDisabled })
      });

      if (!response.ok) throw new Error('Failed to update status');
      
      setSuccessMessage(`Account ${!currentDisabled ? 'deactivated' : 'activated'} successfully`);
      setTimeout(() => setSuccessMessage(null), 3000);
      await fetchData();
    } catch (err) {
      alert('Failed to update user status');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteUser = async () => {
    if (!deletingUser) return;
    setActionLoading(deletingUser.uid);
    try {
      const token = await authUser?.getIdToken();
      const response = await fetch(`${API_BASE_URL}/api/auth/admin/delete-user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ uid: deletingUser.uid })
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to delete user');
      }
      
      setSuccessMessage(`Account "${deletingUser.name}" has been permanently deleted`);
      setTimeout(() => setSuccessMessage(null), 3000);
      setDeleteModalOpen(false);
      setDeletingUser(null);
      await fetchData();
    } catch (err: any) {
      alert(err.message || 'Failed to delete user');
    } finally {
      setActionLoading(null);
    }
  };

  const handleAssign = async (userId: string, specId: string) => {
    if (!specId) return;
    const specialist = specialists.find(s => s.uid === specId);
    const client = clients.find(c => c.uid === userId);
    if (!specialist || !client) {
      console.error('Specialist or client not found', { specialist, client, specId, userId });
      alert('Could not find specialist or client');
      return;
    }
    
    setAssigningId(userId);
    try {
      const token = await authUser?.getIdToken();
      if (!token) {
        throw new Error('Your admin session has expired. Please log in again.');
      }

      const response = await fetch(`${API_BASE_URL}/api/auth/admin/assign-specialist`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ userId, specialistId: specId }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || 'Failed to assign specialist');
      }
      
      setSuccessMessage(`Successfully assigned ${specialist.displayName || specialist.email} to ${client.displayName || client.email}`);
      setTimeout(() => setSuccessMessage(null), 3000);
      await fetchData();
    } catch (e: any) {
      console.error('Failed to assign specialist:', e);
      alert(e.message || 'Failed to assign specialist');
    } finally {
      setAssigningId(null);
    }
  };

  const filteredClients = clients.filter(c => 
    c.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <CreateUserModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        role="client" 
        onSuccess={(msg) => {
          setSuccessMessage(msg);
          setTimeout(() => setSuccessMessage(null), 3000);
          fetchData();
        }}
      />

      {successMessage && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 flex items-center gap-2">
          <CheckCircle size={16} className="text-emerald-600" />
          {successMessage}
        </div>
      )}
      {fetchError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 flex items-center gap-2">
          <AlertCircle size={16} className="text-red-600" />
          {fetchError} — Make sure the backend is running on port 3001
        </div>
      )}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">Clients</h1>
          <p className="mt-1 text-slate-600">Overview of all registered platform clients</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Search by name or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-10 pr-4 text-sm outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 sm:w-64"
            />
          </div>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="flex items-center justify-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 transition shadow-sm"
          >
            <Plus size={18} />
            Add Client
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-2">
            <Users size={18} className="text-teal-600" />
            <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wider">All Clients ({clients.length})</h2>
          </div>
        </div>
        <div>
          {loading ? (
            <div className="flex flex-col items-center justify-center p-12 text-slate-500">
              <div className="mb-4 h-10 w-10 animate-spin rounded-full border-2 border-teal-500 border-t-transparent" />
              <p>Fetching clients...</p>
            </div>
          ) : filteredClients.length > 0 ? (
            <><div className="overflow-x-auto hidden sm:block">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/50">
                    <th className="px-6 py-4 font-semibold text-slate-700">Client</th>
                    <th className="px-6 py-4 font-semibold text-slate-700">Created</th>
                    <th className="px-6 py-4 font-semibold text-slate-700">Specialist</th>
                    <th className="px-6 py-4 font-semibold text-slate-700">Subscription</th>
                    <th className="px-6 py-4 font-semibold text-slate-700 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-600">
                  {filteredClients.map(client => (
                    <tr key={client.uid} className={`hover:bg-slate-50/50 transition ${client.disabled ? 'bg-slate-50/80 opacity-75' : ''}`}>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 overflow-hidden rounded-full">
                            {client.photoURL ? (
                              <img src={client.photoURL} alt={client.displayName || 'Client'} className="h-full w-full object-cover" />
                            ) : (
                              <div className={`flex h-full w-full items-center justify-center font-bold uppercase text-xs ${client.disabled ? 'bg-slate-200 text-slate-400' : 'bg-teal-100 text-teal-700'}`}>
                                {client.displayName?.charAt(0) || 'C'}
                              </div>
                            )}
                          </div>
                          <div>
                            <p className={`font-semibold ${client.disabled ? 'text-slate-500' : 'text-navy-900'}`}>{client.displayName || 'Unnamed'}</p>
                            <p className="text-xs text-slate-500">{client.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {client.createdAt?.toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4">
                        {assigningId === client.uid ? (
                          <span className="text-xs text-teal-600 flex items-center gap-1">
                            <span className="inline-block h-3 w-3 animate-spin rounded-full border border-teal-500 border-t-transparent"></span>
                            Assigning...
                          </span>
                        ) : client.assignedSpecialistId ? (
                          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${client.disabled ? 'bg-slate-100 text-slate-500' : 'bg-emerald-50 text-emerald-700'}`}>
                            <CheckCircle size={12} />
                            {client.assignedSpecialistName || 'Assigned'}
                          </span>
                        ) : (
                          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${client.disabled ? 'bg-slate-100 text-slate-400' : 'bg-amber-50 text-amber-700'}`}>
                            <AlertCircle size={12} />
                            Unassigned
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {client.disabled ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-xs font-bold uppercase text-red-600 ring-1 ring-inset ring-red-600/20">
                            Expired / Disabled
                          </span>
                        ) : client.isNewUser ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold uppercase text-blue-600 ring-1 ring-inset ring-blue-600/20">
                            Awaiting Payment
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold uppercase text-emerald-600 ring-1 ring-inset ring-emerald-600/20">
                            Active Paid
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-3">
                          <select
                            value={client.assignedSpecialistId || ''}
                            disabled={client.disabled}
                            onChange={(e) => handleAssign(client.uid, e.target.value)}
                            className="rounded border border-slate-200 bg-white px-2 py-1.5 text-xs outline-none focus:border-teal-500 disabled:opacity-50"
                          >
                            <option value="">Assign Specialist</option>
                            {specialists.map(s => (
                              <option key={s.uid} value={s.uid}>{s.displayName || s.email}</option>
                            ))}
                          </select>
                          <Link
                            to={`/admin/messages?start=${client.uid}`}
                            className="p-2 min-h-10 min-w-10 rounded-lg text-teal-600 hover:bg-teal-50 transition-colors inline-flex items-center justify-center"
                            title="Message Client"
                          >
                            <MessageSquare size={18} />
                          </Link>
                          <button
                            onClick={() => handleToggleStatus(client.uid, !!client.disabled)}
                            disabled={actionLoading === client.uid}
                            className={`p-2 min-h-10 min-w-10 rounded-lg transition-colors inline-flex items-center justify-center ${
                              client.disabled 
                                ? 'text-emerald-600 hover:bg-emerald-50' 
                                : 'text-red-600 hover:bg-red-50'
                            }`}
                            title={client.disabled ? "Renew Subscription & Enable Account" : "Cancel Subscription & Disable Account"}
                          >
                            {actionLoading === client.uid ? (
                              <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                            ) : (
                              client.disabled ? <UserCheck size={18} /> : <UserMinus size={18} />
                            )}
                          </button>
                          <button
                            onClick={() => { setDeletingUser({ uid: client.uid, name: client.displayName || client.email || 'User' }); setDeleteModalOpen(true); }}
                            disabled={actionLoading === client.uid}
                            className="p-2 min-h-10 min-w-10 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors inline-flex items-center justify-center"
                            title="Delete account"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="space-y-3 sm:hidden">
              {filteredClients.map(client => (
                <div key={client.uid} className={`rounded-xl border border-slate-200 bg-white p-4 ${client.disabled ? 'opacity-75' : ''}`}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 overflow-hidden rounded-full">
                        {client.photoURL ? (
                          <img src={client.photoURL} alt={client.displayName || 'Client'} className="h-full w-full object-cover" />
                        ) : (
                          <div className={`flex h-full w-full items-center justify-center font-bold uppercase text-xs ${client.disabled ? 'bg-slate-200 text-slate-400' : 'bg-teal-100 text-teal-700'}`}>
                            {client.displayName?.charAt(0) || 'C'}
                          </div>
                        )}
                      </div>
                      <div>
                        <p className={`font-semibold ${client.disabled ? 'text-slate-500' : 'text-navy-900'}`}>{client.displayName || 'Unnamed'}</p>
                        <p className="text-xs text-slate-500">{client.email}</p>
                      </div>
                    </div>
                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold uppercase ${client.disabled ? 'bg-red-50 text-red-600' : client.isNewUser ? 'bg-blue-50 text-blue-600' : 'bg-emerald-50 text-emerald-600'}`}>
                      {client.disabled ? 'Disabled' : client.isNewUser ? 'Pending' : 'Active'}
                    </span>
                  </div>
                  <div className="space-y-2 text-xs text-slate-500">
                    <div className="flex justify-between">
                      <span>Created:</span>
                      <span>{client.createdAt?.toLocaleDateString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Specialist:</span>
                      <span className="font-medium text-slate-700">
                        {client.assignedSpecialistName || 'Unassigned'}
                      </span>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-slate-100 flex gap-2">
                    <select
                      value={client.assignedSpecialistId || ''}
                      disabled={client.disabled}
                      onChange={(e) => handleAssign(client.uid, e.target.value)}
                      className="flex-1 rounded border border-slate-200 bg-white px-2 py-1.5 text-xs outline-none focus:border-teal-500 disabled:opacity-50"
                    >
                      <option value="">Assign Specialist</option>
                      {specialists.map(s => (
                        <option key={s.uid} value={s.uid}>{s.displayName || s.email}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => handleToggleStatus(client.uid, !!client.disabled)}
                      disabled={actionLoading === client.uid}
                      className={`p-2 rounded-lg transition-colors ${client.disabled ? 'text-emerald-600 hover:bg-emerald-50' : 'text-red-600 hover:bg-red-50'}`}
                      title={client.disabled ? "Enable" : "Disable"}
                    >
                      {client.disabled ? <UserCheck size={16} /> : <UserMinus size={16} />}
                    </button>
                    <button
                      onClick={() => { setDeletingUser({ uid: client.uid, name: client.displayName || client.email || 'User' }); setDeleteModalOpen(true); }}
                      className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50"
                      title="Delete"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div></>
          ) : (
            <div className="p-12 text-center text-slate-500">
              <Search size={32} className="mx-auto mb-3 text-slate-300" />
              <p>No clients match your search criteria.</p>
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <div className="flex items-center gap-3 text-red-600 mb-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
                <Trash2 size={24} />
              </div>
              <div>
                <h3 className="text-lg font-semibold">Delete Account</h3>
                <p className="text-sm text-red-500">This action cannot be undone</p>
              </div>
            </div>
            <p className="text-sm text-slate-600 mb-6">
              Are you sure you want to permanently delete the account for <span className="font-semibold">{deletingUser?.name}</span>? All associated data including messages, requests, and notifications will be removed.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => { setDeleteModalOpen(false); setDeletingUser(null); }}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteUser}
                disabled={actionLoading !== null}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition disabled:opacity-50"
              >
                {actionLoading !== null ? 'Deleting...' : 'Delete Account'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export const AdminSpecialists = () => {
  const { user: authUser } = useAuth();
  const [specialists, setSpecialists] = useState<UserProfile[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deletingUser, setDeletingUser] = useState<{uid: string; name: string} | null>(null);
  const [viewingWorkFor, setViewingWorkFor] = useState<UserProfile | null>(null);
  const [specialistActivity, setSpecialistActivity] = useState<ActivityItem[]>([]);
  const [showGroupMessage, setShowGroupMessage] = useState(false);
  const [groupMessageText, setGroupMessageText] = useState('');
  const [sendingGroup, setSendingGroup] = useState(false);
  const [ratingsMap, setRatingsMap] = useState<Record<string, { avg: number; count: number }>>({});
  
  useEffect(() => {
    if (!viewingWorkFor) return;
    const unsub = activityService.subscribeToSpecialistActivity(viewingWorkFor.uid, (activity) => {
      setSpecialistActivity(activity);
    });
    return () => unsub();
  }, [viewingWorkFor]);

  const fetchSpecialists = useCallback(async () => {
    try {
      const idToken = await authUser?.getIdToken(true);
      if (!idToken) return;

      const response = await fetch(`${API_BASE_URL}/api/auth/admin/users`, {
        headers: {
          'Authorization': `Bearer ${idToken}`
        }
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: 'Unknown error' }));
        setFetchError(err.error || `Server error (${response.status})`);
        return;
      }
      setFetchError(null);
      const data = await response.json();
      if (data.users) {
        const list = data.users
          .filter((u: any) => u.role === 'specialist')
          .map((u: any) => ({
            uid: u.uid,
            email: u.email,
            displayName: u.displayName,
            role: u.role,
            disabled: u.disabled,
            photoURL: u.photoURL,
            createdAt: u.createdAt ? new Date(u.createdAt) : new Date(),
            updatedAt: u.createdAt ? new Date(u.createdAt) : new Date(),
          } as UserProfile));
        setSpecialists(list.sort((a: any, b: any) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0)));
      }
    } catch (e: any) {
      console.error('Error loading specialists:', e);
      setFetchError(e.message || 'Failed to connect to server');
    } finally {
      setLoading(false);
    }
  }, [authUser]);

  useEffect(() => {
    fetchSpecialists();
  }, [fetchSpecialists]);

  const [ratingsTotal, setRatingsTotal] = useState(0);

  useEffect(() => {
    const q = query(collection(db, 'ratings'), limit(5000));
    const unsub = onSnapshot(q, (snap) => {
      console.log(`[RATINGS] Loaded ${snap.docs.length} ratings`);
      setRatingsTotal(snap.docs.length);
      const map: Record<string, { sum: number; count: number }> = {};
      snap.docs.forEach(d => {
        const data = d.data();
        const sid = data.specialistId as string;
        const r = data.rating as number;
        if (sid && typeof r === 'number') {
          if (!map[sid]) map[sid] = { sum: 0, count: 0 };
          map[sid].sum += r;
          map[sid].count += 1;
        }
      });
      const result: Record<string, { avg: number; count: number }> = {};
      Object.entries(map).forEach(([k, v]) => {
        result[k] = { avg: Math.round((v.sum / v.count) * 10) / 10, count: v.count };
      });
      setRatingsMap(result);
    }, (error) => {
      console.error('[RATINGS] Subscription error:', error);
    });
    return () => unsub();
  }, []);

  const handleToggleStatus = async (uid: string, currentDisabled: boolean) => {
    setActionLoading(uid);
    try {
      const token = await authUser?.getIdToken();
      const response = await fetch(`${API_BASE_URL}/api/auth/admin/deactivate-user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ uid, disabled: !currentDisabled })
      });

      if (!response.ok) throw new Error('Failed to update status');
      
      setSuccessMessage(`Account ${!currentDisabled ? 'deactivated' : 'activated'} successfully`);
      setTimeout(() => setSuccessMessage(null), 3000);
      await fetchSpecialists();
    } catch (err) {
      alert('Failed to update user status');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteUser = async () => {
    if (!deletingUser) return;
    setActionLoading(deletingUser.uid);
    try {
      const token = await authUser?.getIdToken();
      const response = await fetch(`${API_BASE_URL}/api/auth/admin/delete-user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ uid: deletingUser.uid })
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to delete user');
      }
      
      setSuccessMessage(`Account "${deletingUser.name}" has been permanently deleted`);
      setTimeout(() => setSuccessMessage(null), 3000);
      setDeleteModalOpen(false);
      setDeletingUser(null);
      await fetchSpecialists();
    } catch (err: any) {
      alert(err.message || 'Failed to delete user');
    } finally {
      setActionLoading(null);
    }
  };

  const handleGroupMessage = async () => {
    if (!groupMessageText.trim() || specialists.length === 0 || !authUser) return;
    setSendingGroup(true);
    const senderName = authUser.displayName || authUser.email?.split('@')[0] || 'Admin';
    const activeSpecialists = specialists.filter(s => !s.disabled);
    let sent = 0;
    for (const spec of activeSpecialists) {
      try {
        await messageService.sendMessage({
          senderId: authUser.uid,
          senderName,
          senderRole: 'admin',
          receiverId: spec.uid,
          text: `[Broadcast] ${groupMessageText.trim()}`,
          read: false,
          status: 'sent',
        });
        sent++;
      } catch (err) {
        console.error(`[GROUP MSG] Failed to send to ${spec.displayName}:`, err);
      }
    }
    setSuccessMessage(`Message sent to ${sent} of ${activeSpecialists.length} specialists`);
    setTimeout(() => setSuccessMessage(null), 4000);
    setGroupMessageText('');
    setShowGroupMessage(false);
    setSendingGroup(false);
  };

  const filteredSpecialists = specialists.filter(s => 
    s.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    s.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <CreateUserModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        role="specialist" 
        onSuccess={(msg) => {
          setSuccessMessage(msg);
          setTimeout(() => setSuccessMessage(null), 3000);
          fetchSpecialists();
        }}
      />

      {successMessage && (
        <div className="rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-800 flex items-center gap-2">
          <CheckCircle size={16} className="text-indigo-600" />
          {successMessage}
        </div>
      )}
      {fetchError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 flex items-center gap-2">
          <AlertCircle size={16} className="text-red-600" />
          {fetchError} — Make sure the backend is running on port 3001
        </div>
      )}

      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-navy-900">Specialists</h1>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-500">
              {ratingsTotal} total ratings
            </span>
          </div>
          <p className="mt-1 text-slate-600">Medical scribe specialists on the platform</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Search by name or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-10 pr-4 text-sm outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 sm:w-64"
            />
          </div>
          <button 
            onClick={() => setShowGroupMessage(true)}
            className="flex items-center justify-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 transition shadow-sm"
          >
            <Megaphone size={18} />
            Message All
          </button>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 transition shadow-sm"
          >
            <Plus size={18} />
            Add Specialist
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-indigo-50/30">
          <div className="flex items-center gap-2">
            <Stethoscope size={18} className="text-indigo-600" />
            <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wider">All Specialists ({specialists.length})</h2>
          </div>
        </div>
        <div>
          {loading ? (
            <div className="flex flex-col items-center justify-center p-12 text-slate-500">
              <div className="mb-4 h-10 w-10 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
              <p>Fetching specialists...</p>
            </div>
          ) : filteredSpecialists.length > 0 ? (
            <><div className="overflow-x-auto hidden sm:block">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/50">
                    <th className="px-6 py-4 font-semibold text-slate-700">Specialist</th>
                    <th className="px-6 py-4 font-semibold text-slate-700">Rating</th>
                    <th className="px-6 py-4 font-semibold text-slate-700">Joined</th>
                    <th className="px-6 py-4 font-semibold text-slate-700">Status</th>
                    <th className="px-6 py-4 font-semibold text-slate-700 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-600">
                  {filteredSpecialists.map(specialist => (
                    <tr key={specialist.uid} className={`hover:bg-indigo-50/30 transition ${specialist.disabled ? 'bg-slate-50/80 opacity-75' : ''}`}>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 overflow-hidden rounded-full">
                            {specialist.photoURL ? (
                              <img src={specialist.photoURL} alt={specialist.displayName || 'Specialist'} className="h-full w-full object-cover" />
                            ) : (
                              <div className={`flex h-full w-full items-center justify-center font-bold uppercase text-xs ${specialist.disabled ? 'bg-slate-200 text-slate-400' : 'bg-indigo-100 text-indigo-700'}`}>
                                {specialist.displayName?.charAt(0) || 'S'}
                              </div>
                            )}
                          </div>
                          <div>
                            <p className={`font-semibold ${specialist.disabled ? 'text-slate-500' : 'text-navy-900'}`}>{specialist.displayName || 'Unnamed'}</p>
                            <p className="text-xs text-slate-500">{specialist.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {(() => {
                          const r = ratingsMap[specialist.uid];
                          return r ? (
                            <span className="flex items-center gap-1">
                              <span className="text-amber-500 font-bold">{r.avg}</span>
                              <Star size={14} className="fill-amber-400 text-amber-400" />
                              <span className="text-xs text-slate-400">({r.count})</span>
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400">No ratings</span>
                          );
                        })()}
                      </td>
                      <td className="px-6 py-4">
                        {specialist.createdAt?.toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4">
                        {specialist.disabled ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-xs font-bold uppercase text-red-600 ring-1 ring-inset ring-red-600/20">
                            Deactivated
                          </span>
                        ) : specialist.isNewUser ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold uppercase text-blue-600 ring-1 ring-inset ring-blue-600/20">
                            Awaiting Setup
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold uppercase text-emerald-600 ring-1 ring-inset ring-emerald-600/20">
                            Active
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleToggleStatus(specialist.uid, !!specialist.disabled)}
                            className={`p-2 min-h-10 min-w-10 rounded-lg transition-colors inline-flex items-center justify-center ${
                              specialist.disabled 
                                ? 'text-emerald-600 hover:bg-emerald-50' 
                                : 'text-red-600 hover:bg-red-50'
                            }`}
                          >
                            {specialist.disabled ? <UserCheck size={18} /> : <UserMinus size={18} />}
                          </button>
                          <Link
                            to={`/admin/messages?start=${specialist.uid}`}
                            className="p-2 min-h-10 min-w-10 rounded-lg text-teal-600 hover:bg-teal-50 transition-colors inline-flex items-center justify-center"
                            title="Message Specialist"
                          >
                            <MessageSquare size={18} />
                          </Link>
                          <button
                            onClick={() => setViewingWorkFor(specialist)}
                            className="p-2 min-h-10 min-w-10 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors inline-flex items-center justify-center"
                            title="View Work Logs"
                          >
                            <ClipboardList size={18} />
                          </button>
                          <button
                            onClick={() => { setDeletingUser({ uid: specialist.uid, name: specialist.displayName || specialist.email || 'User' }); setDeleteModalOpen(true); }}
                            className="p-2 min-h-10 min-w-10 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors inline-flex items-center justify-center"
                            title="Delete account"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="space-y-3 sm:hidden">
              {filteredSpecialists.map(specialist => (
                <div key={specialist.uid} className={`rounded-xl border border-slate-200 bg-white p-4 ${specialist.disabled ? 'opacity-75' : ''}`}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 overflow-hidden rounded-full">
                        {specialist.photoURL ? (
                          <img src={specialist.photoURL} alt={specialist.displayName || 'Specialist'} className="h-full w-full object-cover" />
                        ) : (
                          <div className={`flex h-full w-full items-center justify-center font-bold uppercase text-xs ${specialist.disabled ? 'bg-slate-200 text-slate-400' : 'bg-indigo-100 text-indigo-700'}`}>
                            {specialist.displayName?.charAt(0) || 'S'}
                          </div>
                        )}
                      </div>
                      <div>
                        <p className={`font-semibold ${specialist.disabled ? 'text-slate-500' : 'text-navy-900'}`}>{specialist.displayName || 'Unnamed'}</p>
                        <p className="text-xs text-slate-500">{specialist.email}</p>
                      </div>
                    </div>
                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold uppercase ${specialist.disabled ? 'bg-red-50 text-red-600' : specialist.isNewUser ? 'bg-blue-50 text-blue-600' : 'bg-emerald-50 text-emerald-600'}`}>
                      {specialist.disabled ? 'Deactivated' : specialist.isNewUser ? 'Pending' : 'Active'}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs text-slate-500 mb-3">
                    <span>Joined:</span>
                    <span>{specialist.createdAt?.toLocaleDateString()}</span>
                  </div>
                  <div className="flex gap-2 pt-3 border-t border-slate-100">
                    <Link
                      to={`/admin/messages?start=${specialist.uid}`}
                      className="flex-1 p-2 rounded-lg text-xs font-medium text-teal-700 bg-teal-50 hover:bg-teal-100 text-center"
                    >
                      Message
                    </Link>
                    <button
                      onClick={() => handleToggleStatus(specialist.uid, !!specialist.disabled)}
                      className={`flex-1 p-2 rounded-lg text-xs font-medium transition-colors ${
                        specialist.disabled ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                      }`}
                    >
                      {specialist.disabled ? 'Enable' : 'Disable'}
                    </button>
                    <button
                      onClick={() => setViewingWorkFor(specialist)}
                      className="p-2 rounded-lg text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100"
                    >
                      <ClipboardList size={16} />
                    </button>
                    <button
                      onClick={() => { setDeletingUser({ uid: specialist.uid, name: specialist.displayName || specialist.email || 'User' }); setDeleteModalOpen(true); }}
                      className="p-2 rounded-lg text-red-600 hover:bg-red-50"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div></>
          ) : (
            <div className="p-12 text-center text-slate-500">
              <Search size={32} className="mx-auto mb-3 text-slate-300" />
              <p>No specialists match your search criteria.</p>
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <div className="flex items-center gap-3 text-red-600 mb-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
                <Trash2 size={24} />
              </div>
              <div>
                <h3 className="text-lg font-semibold">Delete Account</h3>
                <p className="text-sm text-red-500">This action cannot be undone</p>
              </div>
            </div>
            <p className="text-sm text-slate-600 mb-6">
              Are you sure you want to permanently delete the account for <span className="font-semibold">{deletingUser?.name}</span>? All associated data including messages, requests, and notifications will be removed.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => { setDeleteModalOpen(false); setDeletingUser(null); }}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteUser}
                disabled={actionLoading !== null}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition disabled:opacity-50"
              >
                {actionLoading !== null ? 'Deleting...' : 'Delete Account'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Group Message Modal */}
      {showGroupMessage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 p-4">
              <div>
                <h3 className="text-lg font-bold text-navy-900">Message All Specialists</h3>
                <p className="text-sm text-slate-500">This will send a broadcast to {specialists.filter(s => !s.disabled).length} active specialists</p>
              </div>
              <button onClick={() => { setShowGroupMessage(false); setGroupMessageText(''); }} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>
            <div className="p-4">
              <textarea
                value={groupMessageText}
                onChange={(e) => setGroupMessageText(e.target.value)}
                placeholder="Type your broadcast message..."
                rows={4}
                className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm outline-none focus:border-teal-500 focus:bg-white transition"
              />
              <div className="mt-1 text-xs text-slate-400">Messages will be prefixed with [Broadcast]</div>
            </div>
            <div className="flex items-center justify-end gap-3 border-t border-slate-100 p-4">
              <button
                onClick={() => { setShowGroupMessage(false); setGroupMessageText(''); }}
                className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleGroupMessage}
                disabled={!groupMessageText.trim() || sendingGroup}
                className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50 transition"
              >
                {sendingGroup ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  <Send size={16} />
                )}
                Send to All
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Specialist Work Log Modal */}
      {viewingWorkFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl max-h-[80vh] flex flex-col rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 p-4">
              <div>
                <h3 className="text-lg font-bold text-navy-900">Work Log: {viewingWorkFor.displayName || viewingWorkFor.email}</h3>
                <p className="text-sm text-slate-500">Recent activity and tasks handled</p>
              </div>
              <button onClick={() => setViewingWorkFor(null)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {specialistActivity.length === 0 ? (
                <div className="flex flex-col items-center py-12 text-slate-500">
                  <ClipboardList size={32} className="text-slate-300 mb-3" />
                  <p>No activity logs found for this specialist yet.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {specialistActivity.map(act => (
                    <div key={act.id} className="flex gap-4 rounded-lg border border-slate-100 bg-slate-50 p-4">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-indigo-600">
                        {act.type.includes('Call') ? <Clock size={20} /> : act.type.includes('Message') ? <MessageSquare size={20} /> : <CheckCircle size={20} />}
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900">{act.title}</p>
                        <p className="text-xs text-slate-500 mt-0.5">Type: {act.type}</p>
                        <p className="text-xs text-slate-400 mt-2">{act.createdAt.toLocaleString()}</p>
                      </div>
                      <div className="ml-auto flex items-start">
                        <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold ${
                          act.status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                          act.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                          'bg-amber-100 text-amber-700'
                        }`}>
                          {act.status.replace('_', ' ')}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export const AdminConversations = () => {
  const { user: authUser } = useAuth();
  const [conversations, setConversations] = useState<{clientId: string; clientName: string; clientPhotoURL?: string; specialistId: string; specialistName: string; lastMessage: string; lastTime: Date; unreadCount: number}[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<{clientId: string; specialistId: string} | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [allMessages, setAllMessages] = useState<Message[]>([]);
  const [specialists, setSpecialists] = useState<UserProfile[]>([]);
  const [clients, setClients] = useState<UserProfile[]>([]);
  const [mobileView, setMobileView] = useState<'list' | 'chat'>('list');

  useEffect(() => {
    const loadUsers = async () => {
      try {
        const idToken = await authUser?.getIdToken();
        if (!idToken) return;
        const response = await fetch(`${API_BASE_URL}/api/auth/admin/users`, {
          headers: { 'Authorization': `Bearer ${idToken}` }
        });
        const data = await response.json();
        if (data.users) {
          setSpecialists(data.users.filter((u: any) => u.role === 'specialist').map((u: any) => ({ uid: u.uid, displayName: u.displayName, email: u.email, photoURL: u.photoURL } as UserProfile)));
          setClients(data.users.filter((u: any) => u.role === 'client').map((u: any) => ({ uid: u.uid, displayName: u.displayName, email: u.email, photoURL: u.photoURL } as UserProfile)));
        }
      } catch (e) {
        console.error(e);
      }
    };
    loadUsers();
  }, [authUser]);

  useEffect(() => {
    const q = query(collection(db, 'messages'), orderBy('createdAt', 'desc'), limit(500));
    const unsub = onSnapshot(q, (snap) => {
      const msgs = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          senderId: data.senderId,
          senderName: data.senderName,
          senderRole: data.senderRole,
          receiverId: data.receiverId,
          text: data.text,
          read: data.read || false,
          status: data.status,
          createdAt: data.createdAt?.toDate?.() || new Date(),
        } as Message;
      });
      setAllMessages(msgs);
      setLoading(false);
    }, (err) => {
      console.error('Firestore subscription error:', err);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const lookupName = (uid: string, role: 'client' | 'specialist', fallbackName?: string | null): string => {
      const user = role === 'client'
        ? clients.find(c => c.uid === uid)
        : specialists.find(s => s.uid === uid);
      const name = user?.displayName || user?.email;
      if (name) return name;
      if (fallbackName) return fallbackName;
      const fromMsg = allMessages.find(m => m.senderId === uid && m.senderName);
      return fromMsg?.senderName || (role === 'client' ? 'Client' : 'Specialist');
    };

    const convMap = new Map<string, {clientId: string; clientName: string; clientPhotoURL?: string; specialistId: string; specialistName: string; lastMessage: string; lastTime: Date; unreadCount: number}>();
    
    allMessages.forEach((msg) => {
      const senderRole = msg.senderRole;
      
      let clientId = '', specialistId = '', clientName = '', specialistName = '';
      
      if (senderRole === 'client' && msg.receiverId) {
        clientId = msg.senderId;
        clientName = lookupName(clientId, 'client', msg.senderName);
        specialistId = msg.receiverId;
        specialistName = lookupName(specialistId, 'specialist');
      } else if (senderRole === 'specialist' && msg.receiverId) {
        specialistId = msg.senderId;
        specialistName = lookupName(specialistId, 'specialist', msg.senderName);
        clientId = msg.receiverId;
        clientName = lookupName(clientId, 'client');
      }
      
      if (!clientId || !specialistId) return;
      
      const key = `${clientId}_${specialistId}`;
      const existing = convMap.get(key);
      const isUnread = msg.receiverId !== clientId && !msg.read;
      
      if (!existing) {
        const c = clients.find(x => x.uid === clientId);
        convMap.set(key, { clientId, clientName, clientPhotoURL: c?.photoURL, specialistId, specialistName, lastMessage: msg.text, lastTime: msg.createdAt, unreadCount: isUnread ? 1 : 0 });
      } else if (msg.createdAt.getTime() > existing.lastTime.getTime()) {
        existing.lastMessage = msg.text;
        existing.lastTime = msg.createdAt;
        if (isUnread) existing.unreadCount += 1;
      }
    });
    
    setConversations(Array.from(convMap.values()).sort((a, b) => b.lastTime.getTime() - a.lastTime.getTime()));
  }, [allMessages, specialists, clients]);

  useEffect(() => {
    if (!selectedConversation) {
      setMessages([]);
      return;
    }
    const filtered = allMessages
      .filter((msg) =>
        (msg.senderId === selectedConversation.clientId && msg.receiverId === selectedConversation.specialistId) ||
        (msg.senderId === selectedConversation.specialistId && msg.receiverId === selectedConversation.clientId)
      )
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    setMessages(filtered);
    
    const markAsRead = async () => {
      const unreadMsgs = filtered.filter(m => !m.read);
      for (const msg of unreadMsgs) {
        try {
          await updateDoc(doc(db, 'messages', msg.id), { read: true, status: 'read' });
        } catch (e) {
          console.error('Error marking message as read:', e);
        }
      }
      if (unreadMsgs.length > 0) {
        setConversations(prev => prev.map(c => {
          if (c.clientId === selectedConversation.clientId && c.specialistId === selectedConversation.specialistId) {
            return { ...c, unreadCount: 0 };
          }
          return c;
        }));
      }
    };
    markAsRead();
  }, [selectedConversation, allMessages]);

  const formatTime = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours > 24) return date.toLocaleDateString();
    if (hours > 0) return `${hours}h ago`;
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  };

  return (
    <div className="flex h-full min-h-0 gap-4">
      <div className={`flex flex-col rounded-2xl border border-slate-200 bg-white ${
        mobileView === 'chat' ? 'hidden lg:flex lg:w-96' : 'w-full lg:w-96'
      }`}>
        <div className="border-b border-slate-100 p-4">
          <h2 className="text-xl font-bold text-navy-900">Conversations</h2>
          <p className="text-sm text-slate-500 mt-1">Monitor all messaging activity</p>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-teal-500 border-t-transparent" />
            </div>
          ) : conversations.length === 0 ? (
            <div className="flex flex-col items-center py-16 text-slate-500">
              <p className="font-medium">No conversations yet</p>
            </div>
          ) : (
            conversations.map((conv) => (
              <button
                key={`${conv.clientId}_${conv.specialistId}`}
                onClick={() => { setSelectedConversation({ clientId: conv.clientId, specialistId: conv.specialistId }); setMobileView('chat'); }}
                className={`w-full border-b border-slate-50 p-4 text-left transition hover:bg-slate-50 ${
                  selectedConversation?.clientId === conv.clientId && selectedConversation?.specialistId === conv.specialistId ? 'bg-teal-50' : ''
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-slate-900">{conv.clientName}</p>
                    <p className="text-xs text-slate-500">→ {conv.specialistName}</p>
                  </div>
                  <span className="text-xs text-slate-400">{formatTime(conv.lastTime)}</span>
                </div>
                <p className="mt-2 truncate text-sm text-slate-500">{conv.lastMessage}</p>
              </button>
            ))
          )}
        </div>
      </div>

      <div className={`flex-1 flex flex-col rounded-2xl border border-slate-200 bg-white ${
        mobileView === 'list' && selectedConversation ? 'hidden lg:flex' : ''
      }`}>
        {selectedConversation ? (
          <>
            <div className="border-b border-slate-100 p-4">
              <div className="flex items-center gap-3">
                <button onClick={() => setMobileView('list')} className="rounded-lg p-2 min-h-10 min-w-10 text-slate-400 hover:bg-slate-100 lg:hidden" title="Back to conversations">
                  <X size={20} />
                </button>
                <div className="h-10 w-10 overflow-hidden rounded-full bg-gradient-to-br from-teal-400 to-teal-600">
                  {(() => {
                    const conv = conversations.find(c => c.clientId === selectedConversation.clientId);
                    return conv?.clientPhotoURL ? (
                      <img src={conv.clientPhotoURL} alt={conv.clientName || ''} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-white font-bold">
                        {conv?.clientName.charAt(0).toUpperCase() || '?'}
                      </div>
                    );
                  })()}
                </div>
                <div>
                  <p className="font-semibold text-slate-900">
                    {conversations.find(c => c.clientId === selectedConversation.clientId)?.clientName}
                  </p>
                  <p className="text-xs text-slate-500">
                    Specialist: {conversations.find(c => c.clientId === selectedConversation.clientId)?.specialistName}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto bg-[#f0f2f5] p-4 space-y-4">
              {(!messages || messages.length === 0) ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-400">
                  <p>No messages found</p>
                </div>
              ) : messages.filter(Boolean).map((msg) => {
                if (!msg || !msg.senderId) return null;
                const isOwn = selectedConversation?.clientId ? msg.senderId === selectedConversation.clientId : false;
                return (
                  <div key={msg.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[70%] rounded-2xl px-4 py-2.5 ${
                      isOwn ? 'bg-teal-600 text-white rounded-br-md' : 'bg-white text-slate-900 rounded-bl-md shadow-sm'
                    }`}>
                      <p className="text-xs font-semibold mb-1">{msg.senderName || 'Unknown'}</p>
                      <p className="text-sm">{msg.text || ''}</p>
                      <p className={`text-xs mt-1 ${isOwn ? 'text-teal-200' : 'text-slate-400'}`}>
                        {formatTime(msg.createdAt || new Date())}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <div className="flex h-full flex-col items-center justify-center text-slate-500">
            <p>Select a conversation to view messages</p>
          </div>
        )}
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

type HealthLevel = 'good' | 'warning' | 'critical';
type Trend = 'up' | 'down' | 'stable';

const healthConfig: Record<HealthLevel, { bg: string; border: string; text: string; icon: string; label: string }> = {
  good: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', icon: '🟢', label: 'Good' },
  warning: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', icon: '🟡', label: 'Needs Attention' },
  critical: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', icon: '🔴', label: 'Critical' },
};

const trendIcon: Record<Trend, { icon: string; color: string }> = {
  up: { icon: '↑', color: 'text-emerald-600' },
  down: { icon: '↓', color: 'text-red-500' },
  stable: { icon: '→', color: 'text-slate-400' },
};

const getTrend = (current: number, previous: number, higherIsBetter: boolean): Trend => {
  if (previous === 0) return current > 0 ? 'up' : 'stable';
  const pct = ((current - previous) / previous) * 100;
  if (Math.abs(pct) < 5) return 'stable';
  if (higherIsBetter) return pct > 0 ? 'up' : 'down';
  return pct > 0 ? 'down' : 'up';
};

export const AdminAnalytics = () => {
  const [clients, setClients] = useState<UserProfile[]>([]);
  const [specialists, setSpecialists] = useState<UserProfile[]>([]);
  const [requests, setRequests] = useState<Request[]>([]);
  const [avgResponseTimeMs, setAvgResponseTimeMs] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [showGuide, setShowGuide] = useState(false);

  useEffect(() => {
    const unsubUsers = onSnapshot(
      query(collection(db, 'users')),
      (snap) => {
        const all = snap.docs.map(d => {
          const data = d.data();
          return {
            uid: d.id,
            ...data,
            createdAt: data.createdAt?.toDate?.() || new Date(),
            updatedAt: data.updatedAt?.toDate?.() || new Date(),
          } as UserProfile;
        });
        setClients(all.filter(u => u.role === 'client'));
        setSpecialists(all.filter(u => u.role === 'specialist'));
        setLoading(false);
      },
      (err) => {
        console.error('[ANALYTICS] Users subscription error:', err);
        setLoading(false);
      }
    );

    const unsubReqs = onSnapshot(
      query(collection(db, 'requests')),
      (snap) => {
        const reqs = snap.docs.map(d => {
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
        });
        setRequests(reqs);
      },
      (err) => console.error('[ANALYTICS] Requests subscription error:', err)
    );

    return () => { unsubUsers(); unsubReqs(); };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const calcResponseTime = async () => {
      try {
        const snap = await getDocs(
          query(collection(db, 'messages'), orderBy('createdAt', 'desc'), limit(2000))
        );
        if (cancelled) return;

        const raw = snap.docs.map(d => {
          const data = d.data();
          return {
            senderRole: data.senderRole as string,
            senderId: data.senderId as string,
            receiverId: data.receiverId as string,
            createdAt: data.createdAt?.toDate?.() || new Date(),
          };
        });

        const convs = new Map<string, { role: string; time: number }[]>();
        for (const m of raw) {
          if (m.senderRole === 'admin' || String(m.senderId).startsWith('system_')) continue;
          if (m.senderRole !== 'client' && m.senderRole !== 'specialist') continue;
          const key = [m.senderId, m.receiverId].sort().join('_');
          if (!convs.has(key)) convs.set(key, []);
          convs.get(key)!.push({ role: m.senderRole, time: m.createdAt.getTime() });
        }

        const diffs: number[] = [];
        for (const msgs of convs.values()) {
          msgs.sort((a, b) => a.time - b.time);
          for (let i = 0; i < msgs.length - 1; i++) {
            if (msgs[i].role === 'client' && msgs[i + 1].role === 'specialist') {
              const diff = msgs[i + 1].time - msgs[i].time;
              if (diff > 5000 && diff < 48 * 60 * 60 * 1000) diffs.push(diff);
            }
          }
        }

        if (!cancelled) {
          setAvgResponseTimeMs(diffs.length > 0 ? diffs.reduce((a, b) => a + b, 0) / diffs.length : null);
        }
      } catch (e) {
        console.error('[ANALYTICS] Response time calc error:', e);
      }
    };
    calcResponseTime();
    return () => { cancelled = true; };
  }, []);

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

  const activeUsersToday = clients.filter(c => {
    if (!c.lastLoginAt) return false;
    const last = c.lastLoginAt instanceof Date ? c.lastLoginAt : new Date(c.lastLoginAt);
    return last >= today;
  }).length;

  const activeUsersYesterday = clients.filter(c => {
    if (!c.lastLoginAt) return false;
    const last = c.lastLoginAt instanceof Date ? c.lastLoginAt : new Date(c.lastLoginAt);
    return last >= yesterday && last < today;
  }).length;

  const newUsersThisWeek = clients.filter(c => c.createdAt && c.createdAt > weekAgo).length;
  const newUsersLastWeek = clients.filter(c => c.createdAt && c.createdAt > twoWeeksAgo && c.createdAt <= weekAgo).length;

  const recentRequests = requests.filter(r => r.submittedAt > weekAgo);
  const oldRequests = requests.filter(r => r.submittedAt > twoWeeksAgo && r.submittedAt <= weekAgo);
  const recentCompleted = recentRequests.filter(r => r.status === 'completed').length;
  const oldCompleted = oldRequests.filter(r => r.status === 'completed').length;
  const recentTotal = recentRequests.length;
  const oldTotal = oldRequests.length;
  const recentRate = recentTotal > 0 ? Math.round((recentCompleted / recentTotal) * 100) : 0;
  const oldRate = oldTotal > 0 ? Math.round((oldCompleted / oldTotal) * 100) : 0;

  const pendingRequests = requests.filter(r => r.status === 'pending' || r.status === 'in_progress').length;
  const completedRequests = requests.filter(r => r.status === 'completed').length;
  const totalRequests = requests.length;
  const completionRate = totalRequests > 0 ? Math.round((completedRequests / totalRequests) * 100) : 0;
  const clientSpecialistRatio = specialists.length > 0 ? clients.length / specialists.length : 0;
  const engagementRate = clients.length > 0 ? Math.round((activeUsersToday / clients.length) * 100) : 0;

  const engagementTrend = getTrend(activeUsersToday, activeUsersYesterday || 1, true);
  const completionTrend = getTrend(recentRate, oldRate || 1, true);
  const capacityTrend = getTrend(clientSpecialistRatio, specialists.length > 0 ? (clients.length - newUsersThisWeek) / Math.max(specialists.length, 1) : 0, false);

  const engagementHealth: HealthLevel = engagementRate >= 30 ? 'good' : engagementRate >= 10 ? 'warning' : 'critical';
  const completionHealth: HealthLevel = completionRate >= 70 ? 'good' : completionRate >= 40 ? 'warning' : 'critical';
  const capacityHealth: HealthLevel = clientSpecialistRatio <= 5 ? 'good' : clientSpecialistRatio <= 8 ? 'warning' : 'critical';

  const avgResponseTimeFormatted = avgResponseTimeMs ? formatDuration(avgResponseTimeMs) : 'N/A';

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-teal-500 border-t-transparent" />
      </div>
    );
  }

  const healthCards = [
    {
      key: 'Engagement',
      title: 'Engagement',
      health: engagementHealth,
      value: `${engagementRate}%`,
      detail: `${activeUsersToday} of ${clients.length} clients active today`,
      tip: 'Aim for 30%+ daily active rate',
      trend: engagementTrend,
      trendLabel: engagementTrend === 'up' ? 'up from yesterday' : engagementTrend === 'down' ? 'down from yesterday' : 'same as yesterday',
    },
    {
      key: 'Completion',
      title: 'Request Completion',
      health: completionHealth,
      value: `${completionRate}%`,
      detail: `${completedRequests} of ${totalRequests} requests completed`,
      tip: 'Aim for 70%+ completion rate',
      trend: completionTrend,
      trendLabel: completionTrend === 'up' ? 'up from last week' : completionTrend === 'down' ? 'down from last week' : 'same as last week',
    },
    {
      key: 'Capacity',
      title: 'Specialist Capacity',
      health: capacityHealth,
      value: `${clientSpecialistRatio > 0 ? clientSpecialistRatio.toFixed(1) : 0}:1`,
      detail: `${clients.length} clients to ${specialists.length} specialists`,
      tip: 'Aim for 5:1 ratio or lower',
      trend: capacityTrend,
      trendLabel: capacityTrend === 'up' ? 'ratio increasing' : capacityTrend === 'down' ? 'ratio decreasing' : 'stable',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">Platform Health</h1>
          <p className="mt-1 text-slate-600">Real-time health of your platform at a glance</p>
        </div>
        <div className="relative">
          <button
            onClick={() => setShowGuide(!showGuide)}
            className="rounded-lg border border-slate-200 bg-white p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition"
            title="How to read these metrics"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>
          </button>
          {showGuide && (
            <div className="absolute right-0 top-12 z-50 w-80 rounded-xl border border-slate-200 bg-white p-4 shadow-lg">
              <h3 className="text-sm font-semibold text-navy-900 mb-2">Health Indicators</h3>
              <ul className="space-y-2 text-xs text-slate-600">
                <li><span className="font-medium text-emerald-600">🟢 Good</span> — Everything is healthy</li>
                <li><span className="font-medium text-amber-600">🟡 Needs Attention</span> — Monitor closely</li>
                <li><span className="font-medium text-red-600">🔴 Critical</span> — Take action soon</li>
              </ul>
              <hr className="my-2 border-slate-100" />
              <ul className="space-y-1.5 text-xs text-slate-500">
                <li><strong className="text-slate-700">Engagement:</strong> % of clients active today. Higher = healthier.</li>
                <li><strong className="text-slate-700">Completion:</strong> % of requests completed. Shows productivity.</li>
                <li><strong className="text-slate-700">Capacity:</strong> Client-to-specialist ratio. 5:1 or lower is ideal.</li>
              </ul>
              <button onClick={() => setShowGuide(false)} className="mt-3 w-full rounded-lg bg-slate-100 py-2.5 text-xs font-medium text-slate-600 hover:bg-slate-200">Got it</button>
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {healthCards.map(card => {
          const cfg = healthConfig[card.health];
          const tIcon = trendIcon[card.trend];
          return (
            <div key={card.key} className={`rounded-xl border-2 ${cfg.border} ${cfg.bg} p-5 transition hover:shadow-md`}>
              <div className="flex items-start justify-between mb-2">
                <span className={`text-xs font-semibold uppercase tracking-wide ${cfg.text}`}>
                  {cfg.icon} {cfg.label}
                </span>
                <span className="text-2xl font-bold text-navy-900">{card.value}</span>
              </div>
              <p className="text-sm font-semibold text-navy-900">{card.title}</p>
              <p className="text-xs text-slate-500 mt-1">{card.detail}</p>
              <div className="flex items-center gap-1 mt-2">
                <span className={`text-sm font-bold ${tIcon.color}`}>{tIcon.icon}</span>
                <span className="text-xs text-slate-400">{card.trendLabel}</span>
              </div>
              <p className="text-xs text-slate-400 mt-1">{card.tip}</p>
            </div>
          );
        })}
      </div>

      <div className="grid gap-4 grid-cols-2 md:grid-cols-5">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium text-slate-500">Total Clients</p>
          <p className="mt-1 text-2xl font-bold text-navy-900">{clients.length}</p>
          <p className="text-xs text-slate-400 mt-1">{newUsersThisWeek} new this week</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium text-slate-500">Specialists</p>
          <p className="mt-1 text-2xl font-bold text-navy-900">{specialists.length}</p>
          <p className="text-xs text-slate-400 mt-1">On the platform</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium text-slate-500">Pending</p>
          <p className={`mt-1 text-2xl font-bold ${pendingRequests > 10 ? 'text-amber-600' : 'text-navy-900'}`}>{pendingRequests}</p>
          <p className="text-xs text-slate-400 mt-1">Awaiting completion</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium text-slate-500">Completed</p>
          <p className="mt-1 text-2xl font-bold text-emerald-600">{completedRequests}</p>
          <p className="text-xs text-slate-400 mt-1">{completionRate}% rate</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium text-slate-500">Avg Response</p>
          <p className="mt-1 text-2xl font-bold text-purple-600">{avgResponseTimeFormatted}</p>
          <p className="text-xs text-slate-400 mt-1">From message timestamps</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-navy-900">User Activity</h2>
          <p className="text-sm text-slate-500 mb-4">Track engagement and growth</p>
          <div className="space-y-6">
            <div>
              <div className="flex items-center justify-between mb-2">
                <div>
                  <span className="text-sm text-slate-600">Active Users Today</span>
                  <p className="text-xs text-slate-400">Users who logged in today</p>
                </div>
                <span className="font-semibold text-emerald-600">{activeUsersToday}</span>
              </div>
              <div className="h-3 w-full rounded-full bg-slate-100">
                <div
                  className="h-3 rounded-full bg-gradient-to-r from-emerald-400 to-emerald-600 transition-all"
                  style={{ width: `${clients.length > 0 ? Math.min((activeUsersToday / clients.length) * 100, 100) : 0}%` }}
                />
              </div>
              <p className="text-xs text-slate-400 mt-1">{engagementRate}% of total clients</p>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <div>
                  <span className="text-sm text-slate-600">New Users This Week</span>
                  <p className="text-xs text-slate-400">Users registered in last 7 days</p>
                </div>
                <span className="font-semibold text-blue-600">{newUsersThisWeek}</span>
              </div>
              <div className="h-3 w-full rounded-full bg-slate-100">
                <div
                  className="h-3 rounded-full bg-gradient-to-r from-blue-400 to-blue-600 transition-all"
                  style={{ width: `${clients.length > 0 ? Math.min((newUsersThisWeek / clients.length) * 100, 100) : 0}%` }}
                />
              </div>
              <p className="text-xs text-slate-400 mt-1">{clients.length > 0 ? Math.round((newUsersThisWeek / clients.length) * 100) : 0}% of total clients</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-navy-900">Specialist Workload</h2>
          <p className="text-sm text-slate-500 mb-4">Monitor service capacity and distribution</p>
          <div className="space-y-6">
            <div>
              <div className="flex items-center justify-between mb-2">
                <div>
                  <span className="text-sm text-slate-600">Client to Specialist Ratio</span>
                  <p className="text-xs text-slate-400">Lower is better (5:1 recommended)</p>
                </div>
                <span className="font-semibold text-navy-900">
                  {specialists.length > 0 ? (clients.length / specialists.length).toFixed(1) : 0}:1
                </span>
              </div>
              <div className="h-3 w-full rounded-full bg-slate-100">
                <div
                  className={`h-3 rounded-full transition-all ${specialists.length > 0 && clientSpecialistRatio <= 5 ? 'bg-emerald-500' : clientSpecialistRatio <= 8 ? 'bg-amber-500' : 'bg-red-500'}`}
                  style={{ width: `${Math.min((clientSpecialistRatio / 5) * 100, 100)}%` }}
                />
              </div>
            </div>
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
              <div>
                <p className="text-sm font-medium text-slate-700">Average Workload</p>
                <p className="text-xs text-slate-500">Clients per specialist</p>
              </div>
              <span className="text-2xl font-bold text-purple-600">
                {specialists.length > 0 ? (clients.length / specialists.length).toFixed(1) : 0}
              </span>
            </div>
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
              <div>
                <p className="text-sm font-medium text-slate-700">Total Platform Capacity</p>
                <p className="text-xs text-slate-500">Max clients at 5:1 ratio</p>
              </div>
              <span className="text-2xl font-bold text-teal-600">
                {specialists.length * 5}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-navy-900">Platform Health Summary</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {healthCards.map(card => {
            const cfg = healthConfig[card.health];
            return (
              <div key={card.key} className={`rounded-lg p-4 ${cfg.bg} border ${cfg.border}`}>
                <p className={`font-medium ${cfg.text}`}>{card.title}</p>
                <p className={`text-sm mt-1 ${cfg.text}`}>{card.detail}</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export const AdminActivity = () => {
  const { user: authUser } = useAuth();
  const [allActivity, setAllActivity] = useState<ActivityItem[]>([]);
  const [filterType, setFilterType] = useState('');
  const [filterSearch, setFilterSearch] = useState('');

  useEffect(() => {
    const unsub = activityService.subscribeToAllActivity(setAllActivity);
    return () => unsub();
  }, []);

  const filtered = allActivity.filter(a => {
    if (filterType && a.type !== filterType) return false;
    if (filterSearch) {
      const q = filterSearch.toLowerCase();
      if (!a.title.toLowerCase().includes(q) && !a.specialistName?.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const typeOptions = [...new Set(allActivity.map(a => a.type))].sort();

  const iconFor = (type: string) => {
    const t = type.toLowerCase();
    if (t.includes('rating')) return <Star size={18} className="text-amber-500" />;
    if (t.includes('call')) return <Phone size={18} className="text-emerald-500" />;
    if (t.includes('message')) return <MessageSquare size={18} className="text-blue-500" />;
    if (t.includes('request')) return <ClipboardList size={18} className="text-indigo-500" />;
    if (t.includes('workflow') || t.includes('clinic')) return <CheckCircle size={18} className="text-teal-500" />;
    if (t.includes('group')) return <Users size={18} className="text-amber-500" />;
    if (t.includes('user') || t.includes('signup') || t.includes('created')) return <UserPlus size={18} className="text-purple-500" />;
    return <Activity size={18} className="text-slate-500" />;
  };

  const colorFor = (type: string) => {
    const t = type.toLowerCase();
    if (t.includes('rating') || t.includes('group')) return 'bg-amber-50 border-amber-200';
    if (t.includes('call')) return 'bg-emerald-50 border-emerald-200';
    if (t.includes('message')) return 'bg-blue-50 border-blue-200';
    if (t.includes('request')) return 'bg-indigo-50 border-indigo-200';
    if (t.includes('workflow') || t.includes('clinic')) return 'bg-teal-50 border-teal-200';
    if (t.includes('user') || t.includes('signup') || t.includes('created')) return 'bg-purple-50 border-purple-200';
    return 'bg-slate-50 border-slate-200';
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">Activity Log</h1>
          <p className="text-slate-600 mt-1">Step-by-step log of everything happening on the portal</p>
        </div>
        <span className="rounded-full bg-slate-100 px-4 py-1.5 text-xs font-medium text-slate-500">
          {allActivity.length} total events
        </span>
      </div>

      <div className="flex flex-wrap gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search activity or specialist..."
            value={filterSearch}
            onChange={e => setFilterSearch(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm outline-none focus:border-teal-500 transition"
          />
        </div>
        <select
          value={filterType}
          onChange={e => setFilterType(e.target.value)}
          className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-teal-500 transition"
        >
          <option value="">All types</option>
          {typeOptions.map(t => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <button
          onClick={() => { setFilterType(''); setFilterSearch(''); }}
          className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-500 hover:bg-slate-50 transition"
        >
          Clear filters
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center py-20 text-slate-500">
          <Activity size={48} className="text-slate-200 mb-4" />
          <p className="font-medium text-lg">No activity yet</p>
          <p className="text-sm mt-1">Activity logs will appear here as users interact with the portal</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((act) => (
            <div key={act.id} className={`flex items-start gap-4 rounded-xl border p-4 ${colorFor(act.type)}`}>
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white shadow-sm">
                {iconFor(act.type)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-slate-900">{act.title}</p>
                  <span className="rounded-full bg-white/80 px-2.5 py-1 text-xs font-medium text-slate-500 border border-slate-200">
                    {act.type}
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                  {act.specialistName && (
                    <span className="flex items-center gap-1">
                      <User size={12} />
                      {act.specialistName}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Clock size={12} />
                    {act.createdAt.toLocaleString()}
                  </span>
                  <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
                    act.status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                    act.status === 'in_progress' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'
                  }`}>
                    {act.status.replace('_', ' ')}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export const AdminAdmins = () => {
  const { user: authUser } = useAuth();
  const [admins, setAdmins] = useState<UserProfile[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deletingUser, setDeletingUser] = useState<{uid: string; name: string} | null>(null);

  const fetchAdmins = useCallback(async () => {
    try {
      const idToken = await authUser?.getIdToken(true);
      if (!idToken) return;
      const response = await fetch(`${API_BASE_URL}/api/auth/admin/users`, {
        headers: { 'Authorization': `Bearer ${idToken}` }
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: 'Unknown error' }));
        setFetchError(err.error || `Server error (${response.status})`);
        return;
      }
      setFetchError(null);
      const data = await response.json();
      if (data.users) {
        const list = data.users
          .filter((u: any) => u.role === 'admin')
          .map((u: any) => ({
            uid: u.uid,
            email: u.email,
            displayName: u.displayName,
            role: u.role,
            disabled: u.disabled,
            photoURL: u.photoURL,
            createdAt: u.createdAt ? new Date(u.createdAt) : new Date(),
            updatedAt: u.createdAt ? new Date(u.createdAt) : new Date(),
          } as UserProfile));
        setAdmins(list.sort((a: any, b: any) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0)));
      }
    } catch (e: any) {
      setFetchError(e.message || 'Failed to connect to server');
    } finally {
      setLoading(false);
    }
  }, [authUser]);

  useEffect(() => { fetchAdmins(); }, [fetchAdmins]);

  const handleToggleStatus = async (uid: string, currentDisabled: boolean) => {
    setActionLoading(uid);
    try {
      const token = await authUser?.getIdToken();
      const response = await fetch(`${API_BASE_URL}/api/auth/admin/deactivate-user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ uid, disabled: !currentDisabled })
      });
      if (!response.ok) throw new Error('Failed to update status');
      setSuccessMessage(`Account ${!currentDisabled ? 'deactivated' : 'activated'} successfully`);
      setTimeout(() => setSuccessMessage(null), 3000);
      await fetchAdmins();
    } catch {
      alert('Failed to update user status');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteUser = async () => {
    if (!deletingUser) return;
    setActionLoading(deletingUser.uid);
    try {
      const token = await authUser?.getIdToken();
      const response = await fetch(`${API_BASE_URL}/api/auth/admin/delete-user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ uid: deletingUser.uid })
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to delete user');
      }
      setSuccessMessage('Admin account deleted successfully');
      setTimeout(() => setSuccessMessage(null), 3000);
      setDeleteModalOpen(false);
      setDeletingUser(null);
      await fetchAdmins();
    } catch (err: any) {
      alert(err.message || 'Failed to delete admin');
    } finally {
      setActionLoading(null);
    }
  };

  const filtered = admins.filter(a =>
    a.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">Admin Management</h1>
          <p className="mt-1 text-slate-600">Manage platform administrators</p>
        </div>
        <button onClick={() => setIsModalOpen(true)} className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 transition-colors">
          <Plus size={18} />
          Add Admin
        </button>
      </div>

      <CreateUserModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        role="admin"
        onSuccess={(msg) => {
          setSuccessMessage(msg);
          setTimeout(() => setSuccessMessage(null), 5000);
          fetchAdmins();
        }}
      />

      {successMessage && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-emerald-700">
          <CheckCircle size={18} />
          <span className="text-sm font-medium">{successMessage}</span>
        </div>
      )}
      {fetchError && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
          <AlertCircle size={18} />
          <span className="text-sm font-medium">{fetchError}</span>
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 p-4">
          <div className="relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search admins..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm outline-none focus:border-teal-500 focus:bg-white transition"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-teal-500 border-t-transparent" />
          </div>
        ) : filtered.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {filtered.map((admin) => (
              <div key={admin.uid} className="flex items-center justify-between p-4 hover:bg-slate-50 transition">
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-100 text-sm font-bold text-purple-700">
                    {admin.displayName?.charAt(0)?.toUpperCase() || 'A'}
                  </div>
                  <div>
                    <p className="font-medium text-slate-900">{admin.displayName || 'Unnamed'}</p>
                    <p className="text-sm text-slate-500">{admin.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${admin.disabled ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
                    {admin.disabled ? 'Inactive' : 'Active'}
                  </span>
                  <button
                    onClick={() => handleToggleStatus(admin.uid, !!admin.disabled)}
                    disabled={actionLoading === admin.uid}
                    className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-50 transition"
                    title={admin.disabled ? 'Activate' : 'Deactivate'}
                  >
                    {admin.disabled ? <UserCheck size={16} /> : <UserMinus size={16} />}
                  </button>
                  <button
                    onClick={() => { setDeletingUser({ uid: admin.uid, name: admin.displayName || admin.email || '' }); setDeleteModalOpen(true); }}
                    className="rounded-lg border border-red-200 p-2 text-red-500 hover:bg-red-50 transition"
                    title="Delete"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center py-16 text-slate-500">
            <Shield size={40} className="text-slate-300 mb-4" />
            <p className="font-medium">No admins found</p>
            <p className="mt-1 text-sm">{searchTerm ? 'Try a different search' : 'Click "Add Admin" to create the first administrator'}</p>
          </div>
        )}
      </div>

      {deleteModalOpen && deletingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-navy-900">Delete Admin Account</h3>
            <p className="mt-2 text-sm text-slate-600">
              Are you sure you want to delete <strong>{deletingUser.name}</strong>? This will permanently remove their account and all associated data.
            </p>
            <div className="mt-6 flex gap-3">
              <button onClick={() => { setDeleteModalOpen(false); setDeletingUser(null); }} className="flex-1 rounded-lg border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors">
                Cancel
              </button>
              <button onClick={handleDeleteUser} disabled={actionLoading === deletingUser.uid} className="flex-1 rounded-lg bg-red-600 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
                {actionLoading === deletingUser.uid ? (
                  <><div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> Deleting...</>
                ) : 'Delete Account'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
