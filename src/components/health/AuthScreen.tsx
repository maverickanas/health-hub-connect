import React, { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Loader2, AlertCircle, Mail, Lock, Eye, EyeOff, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import Logo from './Logo';

// Supabase surfaces "already registered" via a few slightly different strings
// depending on version / email-confirm settings. Match them all.
const isAlreadyRegistered = (err: any): boolean => {
  const msg = String(err?.message || err || '').toLowerCase();
  const code = String(err?.code || err?.name || '').toLowerCase();
  return (
    msg.includes('already registered') ||
    msg.includes('already exists') ||
    msg.includes('user already') ||
    code === 'user_already_exists'
  );
};

interface AuthScreenProps {
  onSignIn: (email: string, password: string) => Promise<void>;
  onSignUp: (email: string, password: string) => Promise<void>;
  onGoogle: () => Promise<void>;
}

type Mode = 'login' | 'signup';

const GoogleIcon = () => (
  <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.8 32.4 29.3 35.5 24 35.5c-6.4 0-11.5-5.1-11.5-11.5S17.6 12.5 24 12.5c2.9 0 5.6 1.1 7.6 2.9l5.7-5.7C33.6 6.3 29 4.5 24 4.5 13.2 4.5 4.5 13.2 4.5 24S13.2 43.5 24 43.5c10.8 0 19.5-8.7 19.5-19.5 0-1.2-.1-2.3-.4-3.5z"/>
    <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.7 19 12.5 24 12.5c2.9 0 5.6 1.1 7.6 2.9l5.7-5.7C33.6 6.3 29 4.5 24 4.5 16.3 4.5 9.7 8.9 6.3 14.7z"/>
    <path fill="#4CAF50" d="M24 43.5c5 0 9.5-1.7 12.9-4.6l-6-5c-1.9 1.3-4.3 2.1-6.9 2.1-5.3 0-9.7-3.1-11.3-7.5l-6.6 5.1C9.5 39 16.2 43.5 24 43.5z"/>
    <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.4 4.2-4.4 5.4l6 5c-.4.4 6.6-4.8 6.6-14.4 0-1.2-.1-2.3-.4-3.5z"/>
  </svg>
);

const AuthScreen: React.FC<AuthScreenProps> = ({ onSignIn, onSignUp, onGoogle }) => {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const passwordRef = useRef<HTMLInputElement>(null);

  const isValidEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
  const anyBusy = busy || googleBusy;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const em = email.trim().toLowerCase();
    if (!isValidEmail(em)) { setError('Enter a valid email address.'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    setBusy(true);
    try {
      if (mode === 'signup') await onSignUp(em, password);
      else await onSignIn(em, password);
    } catch (err: any) {
      // Smart auto-switch: signing up with an existing email flips to Log In,
      // preserves the email, and focuses the password field.
      if (mode === 'signup' && isAlreadyRegistered(err)) {
        toast.info('Account already exists. Please log in.');
        setMode('login');
        setPassword('');
        setError(null);
        setTimeout(() => passwordRef.current?.focus(), 60);
      } else {
        setError(err?.message || 'Authentication failed.');
      }
    } finally {
      setBusy(false);
    }
  };

  const handleGoogle = async () => {
    setError(null);
    setGoogleBusy(true);
    try {
      await onGoogle();
    } catch (err: any) {
      setError(err?.message || 'Google sign-in failed.');
    } finally {
      setGoogleBusy(false);
    }
  };

  return (
    <div className="min-h-[100dvh] w-full flex flex-col bg-[#0A0A0A] relative overflow-y-auto no-scrollbar">
      <div className="fixed inset-0 z-0 bg-[radial-gradient(circle_at_center,_hsl(0_0%_8%)_0%,_hsl(0_0%_0%)_100%)] pointer-events-none" />

      <div className="relative z-10 min-h-[100dvh] w-full flex flex-col items-center p-6 pt-12 pb-10">
        <div className="flex-1 flex flex-col items-center justify-center w-full max-w-md">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full bg-white/[0.02] rounded-2xl p-8 md:p-10 border border-white/10"
          >
            <div className="flex flex-col items-center mb-8">
              <Logo className="h-12 w-auto" />
            </div>

            {/* Toggle */}
            <div className="relative flex bg-white/5 border border-white/10 rounded-full p-1 mb-6">
              <motion.div
                layout
                transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                className="absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-full bg-[#CCFF00]"
                style={{ left: mode === 'login' ? 4 : 'calc(50% + 0px)' }}
              />
              {(['login', 'signup'] as Mode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => { setMode(m); setError(null); }}
                  disabled={anyBusy}
                  className={`relative z-10 flex-1 py-2.5 text-[10px] font-black uppercase tracking-[0.28em] transition-colors ${
                    mode === m ? 'text-black' : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  {m === 'login' ? 'Log In' : 'Sign Up'}
                </button>
              ))}
            </div>

            {error && (
              <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-3 mb-5 flex items-center gap-2 text-destructive">
                <AlertCircle size={14} className="shrink-0" />
                <span className="text-xs font-bold uppercase tracking-widest">{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="relative group">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500 group-focus-within:text-[#CCFF00] transition-colors" />
                <input
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@domain.com"
                  disabled={anyBusy}
                  required
                  className="w-full bg-white/5 border border-white/10 rounded-xl pl-11 pr-4 py-3.5 text-sm text-foreground outline-none focus:border-[#CCFF00] transition-colors placeholder:text-zinc-600 disabled:opacity-50"
                />
              </div>

              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500 group-focus-within:text-[#CCFF00] transition-colors" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  disabled={anyBusy}
                  required
                  minLength={6}
                  className="w-full bg-white/5 border border-white/10 rounded-xl pl-11 pr-11 py-3.5 text-sm text-foreground outline-none focus:border-[#CCFF00] transition-colors placeholder:text-zinc-600 disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  disabled={anyBusy}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-zinc-500 hover:text-[#CCFF00] transition-colors"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>

              <motion.button
                type="submit"
                disabled={anyBusy}
                whileTap={{ scale: 0.98 }}
                className="w-full bg-[#CCFF00] text-black py-3.5 rounded-xl font-black uppercase tracking-[0.28em] text-xs flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {busy
                  ? <><Loader2 className="animate-spin" size={16} /> {mode === 'signup' ? 'Creating…' : 'Signing In…'}</>
                  : <>{mode === 'signup' ? 'Create Account' : 'Log In'} <ArrowRight size={16} /></>}
              </motion.button>
            </form>

            <div className="flex items-center gap-3 my-6">
              <div className="flex-1 h-px bg-white/10" />
              <span className="text-[9px] text-zinc-500 font-black uppercase tracking-widest">Or</span>
              <div className="flex-1 h-px bg-white/10" />
            </div>

            <motion.button
              type="button"
              onClick={handleGoogle}
              disabled={anyBusy}
              whileTap={{ scale: 0.98 }}
              className="w-full bg-transparent border border-white/20 text-white hover:bg-white/5 py-3.5 rounded-xl font-bold uppercase tracking-[0.22em] text-xs flex items-center justify-center gap-3 transition-colors disabled:opacity-60"
            >
              {googleBusy
                ? <><Loader2 className="animate-spin" size={16} /> Connecting…</>
                : <><GoogleIcon /> Continue with Google</>}
            </motion.button>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default AuthScreen;
