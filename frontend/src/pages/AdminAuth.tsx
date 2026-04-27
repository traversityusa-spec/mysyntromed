import { FormEvent, useState } from 'react';
import { motion } from 'motion/react';
import { Eye, EyeOff, Lock, Mail, ShieldAlert, ShieldCheck, Smartphone } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { signInWithEmailAndPassword, sendEmailVerification, signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';

type NoticeType = 'info' | 'error' | 'success';

const AdminAuth = () => {
  const navigate = useNavigate();
  const { loginWithEmail, loginWithMfaTotp, mfaResolver } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [notice, setNotice] = useState<{ type: NoticeType; text: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [showVerification, setShowVerification] = useState(false);
  const [pendingEmail, setPendingEmail] = useState('');
  const [totpCode, setTotpCode] = useState('');

  const friendlyError = (error: unknown) => {
    const code = String((error as { code?: string })?.code || '');
    const message = String((error as { message?: string })?.message || '');
    
    if (code === 'auth/invalid-credential') return 'Invalid email or password.';
    if (code === 'auth/user-not-found') return 'No admin account found with this email.';
    if (code === 'auth/user-disabled') return 'This account has been disabled.';
    if (code === 'auth/too-many-requests') return 'Too many attempts. Please wait and try again.';
    if (code === 'auth/network-request-failed') return 'Network error. Check your internet connection.';
    if (code) return `Authentication error (${code}).`;
    if (message) return message;
    return 'Something went wrong. Please try again.';
  };

  const handleLogin = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    const trimmedEmail = email.trim().toLowerCase();
    
    if (!trimmedEmail) {
      setNotice({ type: 'error', text: 'Please enter your email.' });
      return;
    }
    
    if (!password) {
      setNotice({ type: 'error', text: 'Please enter your password.' });
      return;
    }

    setSubmitting(true);
    setNotice(null);

    try {
      const profile = await loginWithEmail(trimmedEmail, password);

      if (profile.role !== 'admin') {
        await auth.signOut();
        setNotice({ type: 'error', text: 'Your account does not have admin access.' });
        return;
      }

      navigate('/admin/dashboard');
    } catch (error: any) {
      if (error.code === 'auth/multi-factor-auth-required') {
        setNotice({ type: 'info', text: 'Enter your 6-digit verification code sent to your email.' });
      } else {
        setNotice({ type: 'error', text: friendlyError(error) });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleMfaSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (totpCode.length < 6) return;
    setSubmitting(true);
    setNotice(null);
    try {
      const profile = await loginWithMfaTotp(totpCode);
      if (profile.role !== 'admin') {
        await auth.signOut();
        setNotice({ type: 'error', text: 'Your account does not have admin access.' });
        return;
      }
      navigate('/admin/dashboard');
    } catch {
      setNotice({ type: 'error', text: 'Invalid code. Please try again.' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleResendVerification = async () => {
    if (!pendingEmail || !password) return;
    
    try {
      const cred = await signInWithEmailAndPassword(auth, pendingEmail, password);
      await sendEmailVerification(cred.user);
      await signOut(auth);
      setNotice({ type: 'success', text: 'Verification email resent. Check your inbox.' });
    } catch (error) {
      setNotice({ type: 'error', text: friendlyError(error) });
    }
  };

  const noticeClass =
    notice?.type === 'error'
      ? 'text-red-400 bg-red-900/20 border-red-500/30'
      : notice?.type === 'success'
      ? 'text-emerald-400 bg-emerald-900/20 border-emerald-500/30'
      : 'text-blue-300 bg-blue-900/20 border-blue-500/30';

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
      <div className="absolute inset-0 opacity-10 [background-image:linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] [background-size:40px_40px]" />
      
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="relative z-10 w-full max-w-md"
      >
        <div className="mb-6 text-center">
          <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl border border-teal-500/30 bg-teal-950/60 backdrop-blur-sm">
            <ShieldAlert size={24} className="text-teal-400" />
          </div>
          <h1 className="text-2xl font-bold text-white">Admin Portal</h1>
          <p className="mt-1 text-sm text-slate-400">Authorized Personnel Only</p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-6 shadow-2xl">
          {mfaResolver ? (
            <motion.div
              key="mfa"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              <div className="flex flex-col items-center text-center">
                <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full border border-teal-500/30 bg-teal-950/60">
                  <Smartphone size={26} className="text-teal-400" />
                </div>
                <h2 className="text-lg font-semibold text-white">Two-Factor Verification</h2>
                <p className="mt-1 text-sm text-slate-400">Enter the 6-digit code sent to your email</p>
              </div>
              <form onSubmit={handleMfaSubmit} className="space-y-4">
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="000000"
                  autoFocus
                  className="w-full rounded-xl border border-white/20 bg-white/10 px-4 py-4 text-center text-3xl font-mono font-bold tracking-widest text-white placeholder:text-slate-600 outline-none focus:border-teal-500"
                />
                <button
                  type="submit"
                  disabled={submitting || totpCode.length < 6}
                  className="w-full rounded-xl bg-teal-600 py-3 text-sm font-semibold text-white hover:bg-teal-500 disabled:opacity-50 flex items-center justify-center h-[46px] transition"
                >
                  {submitting ? <div className="h-5 w-5 animate-spin rounded-full border-2 border-teal-300 border-t-transparent" /> : 'Verify & Sign In'}
                </button>
              </form>
            </motion.div>
          ) : showVerification ? (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              <div className="text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-teal-900/30 border border-teal-500/30">
                  <ShieldCheck size={28} className="text-teal-400" />
                </div>
                <h2 className="text-lg font-semibold text-white">Verify Your Email</h2>
                <p className="mt-2 text-sm text-slate-400">
                  A verification link has been sent to <strong className="text-white">{pendingEmail}</strong>
                </p>
              </div>
              
              <div className="rounded-xl bg-amber-900/20 border border-amber-500/30 p-4 text-sm text-amber-300">
                <p className="font-medium">Important:</p>
                <p className="mt-1">Click the link in your email to verify your account, then sign in again.</p>
              </div>
              
              <button
                type="button"
                onClick={handleResendVerification}
                className="w-full rounded-xl border border-white/20 py-2.5 text-sm font-medium text-slate-300 hover:bg-white/10 transition"
              >
                Resend Verification Email
              </button>
              
              <button
                type="button"
                onClick={() => {
                  setShowVerification(false);
                  setPendingEmail('');
                  setPassword('');
                }}
                className="w-full rounded-xl py-2.5 text-sm text-slate-500 hover:text-slate-300 transition"
              >
                ← Back to Sign In
              </button>
            </motion.div>
          ) : (
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-300">Admin Email</label>
                <div className="flex items-center rounded-xl border border-white/20 bg-white/10 px-3 py-2.5 focus-within:border-teal-500 focus-within:ring-1 focus-within:ring-teal-500/50 transition-all">
                  <Mail size={16} className="mr-2 text-slate-400 shrink-0" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="off"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    required
                    placeholder="admin@yourcompany.com"
                    className="w-full bg-transparent text-sm text-white placeholder:text-slate-500 outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-300">Password</label>
                <div className="flex items-center rounded-xl border border-white/20 bg-white/10 px-3 py-2.5 focus-within:border-teal-500 focus-within:ring-1 focus-within:ring-teal-500/50 transition-all">
                  <Lock size={16} className="mr-2 text-slate-400 shrink-0" />
                  <input
                    type={showPwd ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="off"
                    required
                    placeholder="Enter your password"
                    className="w-full bg-transparent text-sm text-white placeholder:text-slate-500 outline-none"
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

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-xl bg-teal-600 py-3 text-sm font-semibold text-white hover:bg-teal-500 disabled:opacity-50 shadow-lg shadow-teal-900/50 flex items-center justify-center h-[46px] transition"
              >
                {submitting ? (
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-teal-300 border-t-transparent" />
                ) : (
                  'Sign In Securely'
                )}
              </button>
            </form>
          )}

          {notice && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className={`mt-4 rounded-xl border px-4 py-3 text-sm ${noticeClass}`}
            >
              {notice.text}
            </motion.div>
          )}
        </div>

        <p className="mt-4 text-center text-xs text-slate-500">
          Not an admin?{' '}
          <a href="/portal" className="text-slate-400 hover:text-teal-400 transition">
            Go to Client Portal
          </a>
        </p>
      </motion.div>
    </div>
  );
};

export default AdminAuth;
