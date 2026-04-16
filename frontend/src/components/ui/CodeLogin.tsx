import { type FormEvent, type ChangeEvent, useState } from 'react';
import { motion } from 'motion/react';
import { KeyRound, User, ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';

type PortalType = 'client' | 'specialist' | 'admin';
type NoticeType = 'info' | 'error' | 'success';

interface CodeLoginProps {
  portal: PortalType;
  title: string;
  subtitle: string;
}

const CodeLogin = ({ portal, title, subtitle }: CodeLoginProps) => {
  const navigate = useNavigate();
  const { loginWithCode } = useAuth();
  const [code, setCode] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [notice, setNotice] = useState<{ type: NoticeType; text: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const formatCode = (value: string): string => {
    const cleaned = value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    const parts = [];
    for (let i = 0; i < cleaned.length && i < 24; i += 6) {
      parts.push(cleaned.slice(i, i + 6));
    }
    return parts.join('-');
  };

  const handleCodeChange = (e: ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCode(e.target.value);
    setCode(formatted);
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!code.trim()) {
      setNotice({ type: 'error', text: 'Please enter your access code.' });
      return;
    }

    if (!displayName.trim()) {
      setNotice({ type: 'error', text: 'Please enter your name.' });
      return;
    }

    setSubmitting(true);
    setNotice(null);

    try {
      const profile = await loginWithCode(code.trim(), displayName.trim());

      if (profile.role !== portal) {
        setNotice({ 
          type: 'error', 
          text: `This code is for ${profile.role}s only. Please use the correct portal.` 
        });
        return;
      }

      navigate(
        profile.role === 'admin' 
          ? '/admin/dashboard' 
          : profile.role === 'specialist' 
          ? '/specialist/dashboard' 
          : '/portal/dashboard'
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Login failed';
      setNotice({ type: 'error', text: message });
    } finally {
      setSubmitting(false);
    }
  };

  const noticeClass =
    notice?.type === 'error'
      ? 'text-red-600 bg-red-50 border-red-200'
      : notice?.type === 'success'
      ? 'text-emerald-600 bg-emerald-50 border-emerald-200'
      : 'text-blue-600 bg-blue-50 border-blue-200';

  const portalConfig = {
    client: {
      bgGradient: 'from-slate-900 via-teal-950 to-slate-900',
      accent: 'teal',
      icon: <KeyRound size={24} className="text-teal-400" />,
    },
    specialist: {
      bgGradient: 'from-slate-900 via-teal-950 to-slate-900',
      accent: 'teal',
      icon: <KeyRound size={24} className="text-teal-400" />,
    },
    admin: {
      bgGradient: 'from-slate-950 via-slate-900 to-slate-950',
      accent: 'slate',
      icon: <ShieldCheck size={24} className="text-teal-400" />,
    },
  };

  const config = portalConfig[portal];

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
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-300">Your Name</label>
              <div className="flex items-center rounded-xl border border-white/20 bg-white/10 px-3 py-2.5 focus-within:border-teal-500 focus-within:ring-1 focus-within:ring-teal-500/50 transition-all">
                <User size={16} className="mr-2 text-slate-400 shrink-0" />
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  autoComplete="off"
                  autoCapitalize="words"
                  autoCorrect="off"
                  spellCheck={false}
                  required
                  placeholder="Enter your full name"
                  className="w-full bg-transparent text-sm text-white placeholder:text-slate-500 outline-none"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-300">Access Code</label>
              <div className="flex items-center rounded-xl border border-white/20 bg-white/10 px-3 py-2.5 focus-within:border-teal-500 focus-within:ring-1 focus-within:ring-teal-500/50 transition-all">
                <KeyRound size={16} className="mr-2 text-slate-400 shrink-0" />
                <input
                  type="text"
                  value={code}
                  onChange={handleCodeChange}
                  autoComplete="off"
                  autoCapitalize="characters"
                  autoCorrect="off"
                  spellCheck={false}
                  required
                  placeholder="XXXXXX-XXXXXX-XXXXXX-XXXXXX"
                  className="w-full bg-transparent text-sm text-white placeholder:text-slate-500 outline-none font-mono tracking-wider"
                  maxLength={29}
                />
              </div>
              <p className="text-xs text-slate-500">Enter the code provided by your administrator</p>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-xl bg-teal-600 py-3 text-sm font-semibold text-white hover:bg-teal-500 disabled:opacity-50 shadow-lg shadow-teal-900/50 flex items-center justify-center h-[46px] transition"
            >
              {submitting ? (
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-teal-300 border-t-transparent" />
              ) : (
                'Access Portal'
              )}
            </button>
          </form>

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
          Need help? Contact your administrator for your access code.
        </p>
      </motion.div>
    </div>
  );
};

export default CodeLogin;
