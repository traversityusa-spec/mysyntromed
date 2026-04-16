import { useState, type FormEvent } from 'react';
import { motion } from 'motion/react';
import { Lock, Eye, EyeOff, ShieldCheck, CheckCircle2, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { updatePassword } from 'firebase/auth';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';

const ResetPassword = () => {
  const navigate = useNavigate();
  const { user, sessionUser, refreshSessionUser, logout } = useAuth();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: FormEvent) => {

    e.preventDefault();
    if (!user) return;

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      // 1. Update Firebase Auth password
      await updatePassword(user, newPassword);

      // 2. Update Firestore profile to clear isNewUser flag
      const userDocRef = doc(db, 'users', user.uid);
      await updateDoc(userDocRef, {
        isNewUser: false,
        updatedAt: serverTimestamp(),
      });

      setSuccess(true);
      
      // 3. Refresh session and redirect after a short delay
      await refreshSessionUser();
      setTimeout(() => {
        const path = sessionUser?.role === 'admin' 
          ? '/admin/dashboard' 
          : sessionUser?.role === 'specialist' 
          ? '/specialist/dashboard' 
          : '/portal/dashboard';
        navigate(path);
      }, 2000);
    } catch (err: any) {
      console.error('Password reset error:', err);
      if (err.code === 'auth/requires-recent-login') {
        setError('For security, please log out and log back in before changing your password.');
      } else {
        setError(err.message || 'Failed to update password.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 text-white">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center p-8 rounded-2xl bg-white/5 border border-emerald-500/30 max-w-sm w-full"
        >
          <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
            <CheckCircle2 size={32} />
          </div>
          <h2 className="text-2xl font-bold mb-2">Password Updated</h2>
          <p className="text-slate-400 mb-6">Your security is our priority. You are now being redirected to your dashboard.</p>
          <div className="h-1 w-full bg-slate-800 rounded-full overflow-hidden">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: '100%' }}
              transition={{ duration: 2 }}
              className="h-full bg-emerald-500"
            />
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="absolute inset-0 opacity-5 [background-image:linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] [background-size:40px_40px]" />
      
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 w-full max-w-md"
      >
        <div className="mb-8 text-center">
          <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-500/10 backdrop-blur-sm text-teal-400">
            <ShieldCheck size={28} />
          </div>
          <h1 className="text-2xl font-bold text-white">Secure Your Account</h1>
          <p className="mt-2 text-slate-400 italic">"Security is not a product, but a process."</p>
          <div className="mt-4 p-3 rounded-lg bg-blue-900/20 border border-blue-500/30 text-xs text-blue-300">
            MySyntroMed requires all new accounts to set a personal password upon first login to ensure HIPAA compliance and data privacy.
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-6 shadow-2xl">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-300">New Password</label>
              <div className="flex items-center rounded-xl border border-white/20 bg-white/10 px-3 py-2.5 focus-within:border-teal-500 focus-within:ring-1 focus-within:ring-teal-500/50">
                <Lock size={16} className="mr-2 text-slate-400 shrink-0" />
                <input
                  type={showPwd ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  className="w-full bg-transparent text-sm text-white placeholder:text-slate-500 outline-none"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(!showPwd)}
                  className="ml-2 text-slate-400 hover:text-slate-200 transition"
                >
                  {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-300">Confirm Password</label>
              <div className="flex items-center rounded-xl border border-white/20 bg-white/10 px-3 py-2.5 focus-within:border-teal-500 focus-within:ring-1 focus-within:ring-teal-500/50">
                <Lock size={16} className="mr-2 text-slate-400 shrink-0" />
                <input
                  type={showPwd ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat new password"
                  className="w-full bg-transparent text-sm text-white placeholder:text-slate-500 outline-none"
                  required
                />
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-red-900/20 border border-red-500/30 text-xs text-red-400">
                <AlertCircle size={14} className="shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-xl bg-teal-600 py-3 text-sm font-semibold text-white hover:bg-teal-500 disabled:opacity-50 transition"
            >
              {submitting ? 'Updating Security...' : 'Set Secure Password'}
            </button>

            <button
              type="button"
              onClick={() => logout()}
              className="w-full py-2 text-xs text-slate-500 hover:text-slate-300 transition"
            >
              Cancel and Sign Out
            </button>
          </form>
        </div>
      </motion.div>
    </div>
  );
};

export default ResetPassword;
