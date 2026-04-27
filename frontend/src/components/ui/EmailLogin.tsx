import { type FormEvent, useState } from 'react';
import { motion } from 'motion/react';
import { Mail, Lock, Eye, EyeOff, ShieldCheck, KeyRound, Smartphone } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { auth } from '@/lib/firebase';
import { sendPasswordResetEmail } from 'firebase/auth';

type PortalType = 'client' | 'specialist';
type NoticeType = 'info' | 'error' | 'success';

interface EmailLoginProps {
  portal: PortalType;
  title: string;
  subtitle: string;
}

const EmailLogin = ({ portal, title, subtitle }: EmailLoginProps) => {
  const navigate = useNavigate();
  const { loginWithEmail, loginWithMfaTotp, mfaResolver, user } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [notice, setNotice] = useState<{ type: NoticeType; text: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [totpCode, setTotpCode] = useState('');

  const friendlyError = (error: any) => {
    const code = error.code || '';
    if (code === 'auth/invalid-credential') return 'Invalid email or password.';
    if (code === 'auth/user-disabled') return 'This account has been deactivated.';
    if (code === 'auth/too-many-requests') return 'Too many attempts. Please try again later.';
    return error.message || 'Authentication failed';
  };

  const handleLogin = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setNotice({ type: 'error', text: 'Please fill in all fields.' });
      return;
    }

    setSubmitting(true);
    setNotice(null);

    try {
      const profile = await loginWithEmail(email.trim().toLowerCase(), password);
      const path = profile.role === 'admin'
        ? '/admin/dashboard'
        : profile.role === 'specialist'
        ? '/specialist/dashboard'
        : '/portal/dashboard';
      navigate(path);
    } catch (error: any) {
      if (error.code === 'auth/multi-factor-auth-required') {
        // mfaResolver is now set in AuthContext — show TOTP screen
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
      const path = profile.role === 'admin'
        ? '/admin/dashboard'
        : profile.role === 'specialist'
        ? '/specialist/dashboard'
        : '/portal/dashboard';
      navigate(path);
    } catch {
      setNotice({ type: 'error', text: 'Invalid code. Please try again.' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      setNotice({ type: 'error', text: 'Please enter your email address first.' });
      return;
    }
    
    try {
      await sendPasswordResetEmail(auth, email.trim().toLowerCase());
      setNotice({ 
        type: 'success', 
        text: 'Password reset link sent! Check your inbox (and spam folder).' 
      });
    } catch (error: any) {
      setNotice({ type: 'error', text: friendlyError(error) });
    }
  };

  const noticeClass =
    notice?.type === 'error'
      ? 'text-red-400 bg-red-900/20 border-red-500/30'
      : notice?.type === 'success'
      ? 'text-emerald-400 bg-emerald-900/20 border-emerald-500/30'
      : 'text-blue-300 bg-blue-900/20 border-blue-500/30';

  const config = {
    client: {
      bgGradient: 'from-slate-900 via-teal-950 to-slate-900',
      icon: <KeyRound size={24} className="text-teal-400" />,
    },
    specialist: {
      bgGradient: 'from-slate-900 via-indigo-950 to-slate-900',
      icon: <ShieldCheck size={24} className="text-indigo-400" />,
    }
  }[portal];

  return (
    <div className={`relative min-h-screen bg-gradient-to-br ${config.bgGradient} flex items-center justify-center p-4`}>
      <div className="absolute inset-0 opacity-10 [background-image:linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] [background-size:40px_40px]" />
      
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="relative z-10 w-full max-w-md"
      >
        <div className="mb-6 text-center">
          <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 backdrop-blur-sm">
            {config.icon}
          </div>
          <h1 className="text-2xl font-bold text-white">{title}</h1>
          <p className="mt-1 text-sm text-slate-400">{subtitle}</p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-6 shadow-2xl">
          {mfaResolver ? (
            <motion.div
              key="mfa"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className="mb-5 flex flex-col items-center text-center">
                <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10">
                  <Smartphone size={26} className="text-teal-400" />
                </div>
                <h2 className="text-lg font-bold text-white">Two-Factor Verification</h2>
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
                  className="w-full rounded-xl border border-white/20 bg-white/10 px-4 py-4 text-center text-3xl font-mono font-bold tracking-widest text-white placeholder:text-slate-600 outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500/50"
                />
                <button
                  type="submit"
                  disabled={submitting || totpCode.length < 6}
                  className="w-full rounded-xl bg-teal-600 py-3 text-sm font-semibold text-white hover:bg-teal-500 disabled:opacity-50 shadow-lg shadow-teal-900/50 flex items-center justify-center h-[46px] transition"
                >
                  {submitting ? (
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-teal-300 border-t-transparent" />
                  ) : 'Verify & Sign In'}
                </button>
              </form>
            </motion.div>
          ) : (
            <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-300">Email Address</label>
              <div className="flex items-center rounded-xl border border-white/20 bg-white/10 px-3 py-2.5 focus-within:border-teal-500 focus-within:ring-1 focus-within:ring-teal-500/50 transition-all">
                <Mail size={16} className="mr-2 text-slate-400 shrink-0" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="off"
                  required
                  placeholder="Enter your email"
                  className="w-full bg-transparent text-sm text-white placeholder:text-slate-500 outline-none"
                />
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-slate-300">Password</label>
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  className="text-xs text-teal-400 hover:text-teal-300 transition"
                >
                  Forgot Password?
                </button>
              </div>
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
                'Sign In'
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

          {user && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 rounded-xl border border-blue-500/30 bg-blue-900/20 px-4 py-3 text-sm text-blue-300"
            >
              <p className="mb-2">You are already signed in.</p>
              <a 
                href="/portal/dashboard" 
                className="text-teal-400 hover:text-teal-300 underline"
              >
                Go to your dashboard
              </a>
            </motion.div>
          )}
        </div>

        <p className="mt-4 text-center text-xs text-slate-500">
          Trouble logging in? Contact MySyntroMed support.
        </p>
      </motion.div>
    </div>
  );
};

export default EmailLogin;
