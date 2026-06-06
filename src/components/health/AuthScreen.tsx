import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, AlertCircle, User, Mail, Lock, Eye, EyeOff, ArrowRight, ArrowLeft, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import Logo from './Logo';
import GlowingButton from './GlowingButton';
import { useAuth } from '@/hooks/useAuth';

interface AuthScreenProps {
  onGuestLogin: () => Promise<void>;
}

type Mode = 'login' | 'signup';
type Stage = 'credentials' | 'otp';
const OTP_LENGTH = 6;
const RESEND_SECONDS = 60;

const isValidEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

const AuthScreen: React.FC<AuthScreenProps> = ({ onGuestLogin }) => {
  const { signInWithPassword, signUpWithPassword, verifySignupOtp } = useAuth();

  const [mode, setMode] = useState<Mode>('login');
  const [stage, setStage] = useState<Stage>('credentials');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [resendCountdown, setResendCountdown] = useState(0);

  const [loading, setLoading] = useState(false);
  const [guestLoading, setGuestLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const anyLoading = loading || guestLoading;

  useEffect(() => {
    if (resendCountdown <= 0) return;
    const t = setInterval(() => setResendCountdown((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [resendCountdown]);

  useEffect(() => {
    if (stage === 'otp') setTimeout(() => inputRefs.current[0]?.focus(), 50);
  }, [stage]);

  const switchMode = (next: Mode) => {
    if (anyLoading) return;
    setMode(next);
    setStage('credentials');
    setError(null);
    setOtp(Array(OTP_LENGTH).fill(''));
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const mail = email.trim().toLowerCase();
    if (!isValidEmail(mail)) { setError('Enter a valid email address.'); return; }
    if (!password) { setError('Enter your password.'); return; }
    setLoading(true);
    try {
      await signInWithPassword(mail, password);
      toast.success('Welcome back, Elite.');
    } catch (err: any) {
      const msg = err?.message || 'Login failed.';
      setError(msg);
      toast.error(msg);
    } finally { setLoading(false); }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const mail = email.trim().toLowerCase();
    if (!isValidEmail(mail)) { setError('Enter a valid email address.'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    setLoading(true);
    try {
      await signUpWithPassword(mail, password);
      setEmail(mail);
      setOtp(Array(OTP_LENGTH).fill(''));
      setStage('otp');
      setResendCountdown(RESEND_SECONDS);
      toast.success('Confirmation code sent to your email.');
    } catch (err: any) {
      const msg = err?.message || 'Signup failed.';
      setError(msg);
      toast.error(msg);
    } finally { setLoading(false); }
  };

  const handleResend = async () => {
    if (resendCountdown > 0 || anyLoading) return;
    setError(null);
    setLoading(true);
    try {
      await signUpWithPassword(email, password);
      setOtp(Array(OTP_LENGTH).fill(''));
      setResendCountdown(RESEND_SECONDS);
      inputRefs.current[0]?.focus();
      toast.success('New code sent.');
    } catch (err: any) {
      const msg = err?.message || 'Failed to resend code.';
      setError(msg);
      toast.error(msg);
    } finally { setLoading(false); }
  };

  const handleVerify = async (codeOverride?: string) => {
    setError(null);
    const code = (codeOverride ?? otp.join('')).trim();
    if (code.length !== OTP_LENGTH) { setError(`Enter the ${OTP_LENGTH}-digit code.`); return; }
    setLoading(true);
    try {
      await verifySignupOtp(email, code);
      toast.success('Email verified. Welcome to Healthy Hub.');
      // Routing gate handles redirect to /onboarding.
    } catch (err: any) {
      const msg = err?.message || 'Invalid or expired code.';
      setError(msg);
      toast.error(msg);
      setOtp(Array(OTP_LENGTH).fill(''));
      setTimeout(() => inputRefs.current[0]?.focus(), 50);
    } finally { setLoading(false); }
  };

  const handleOtpChange = (idx: number, raw: string) => {
    const digits = raw.replace(/\D/g, '');
    if (!digits) { const next = [...otp]; next[idx] = ''; setOtp(next); return; }
    if (digits.length > 1) {
      const next = [...otp];
      for (let i = 0; i < digits.length && idx + i < OTP_LENGTH; i++) next[idx + i] = digits[i];
      setOtp(next);
      const lastFilled = Math.min(idx + digits.length, OTP_LENGTH - 1);
      inputRefs.current[lastFilled]?.focus();
      if (next.every(Boolean)) handleVerify(next.join(''));
      return;
    }
    const next = [...otp]; next[idx] = digits; setOtp(next);
    if (idx < OTP_LENGTH - 1) inputRefs.current[idx + 1]?.focus();
    if (next.every(Boolean) && idx === OTP_LENGTH - 1) handleVerify(next.join(''));
  };

  const handleOtpKeyDown = (idx: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otp[idx] && idx > 0) {
      inputRefs.current[idx - 1]?.focus();
      const next = [...otp]; next[idx - 1] = ''; setOtp(next);
      e.preventDefault();
    } else if (e.key === 'ArrowLeft' && idx > 0) inputRefs.current[idx - 1]?.focus();
    else if (e.key === 'ArrowRight' && idx < OTP_LENGTH - 1) inputRefs.current[idx + 1]?.focus();
  };

  const handleGuest = async () => {
    setError(null);
    setGuestLoading(true);
    try { await onGuestLogin(); }
    catch (err: any) {
      const msg = err?.message || 'Guest protocol failed.';
      setError(msg); toast.error(msg);
    } finally { setGuestLoading(false); }
  };

  return (
    <div className="min-h-[100dvh] w-full flex flex-col bg-[#0A0A0A] relative overflow-y-auto no-scrollbar">
      <div className="fixed inset-0 z-0 bg-[radial-gradient(circle_at_center,_hsl(0_0%_10%)_0%,_hsl(0_0%_0%)_100%)] pointer-events-none" />
      <div className="fixed inset-0 z-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_at_center,black_40%,transparent_100%)] pointer-events-none" />

      <div className="relative z-10 min-h-[100dvh] w-full flex flex-col items-center p-6 pt-12 pb-10 lg:pt-20">
        <div className="flex-1 flex flex-col items-center justify-center w-full max-w-md">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full bg-white/[0.03] backdrop-blur-xl rounded-[24px] p-8 md:p-10 border border-white/10 shadow-2xl relative overflow-hidden"
          >
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-32 bg-[#CCFF00]/5 blur-[60px] pointer-events-none" />

            <div className="flex flex-col items-center mb-6 text-center relative z-10">
              <Logo className="h-14 w-auto mb-4" />
              <p className="text-[10px] text-zinc-500 font-black uppercase tracking-[0.45em]">
                {stage === 'otp' ? 'Verify Your Email' : 'Elite Access'}
              </p>
            </div>

            {/* Tabs */}
            {stage === 'credentials' && (
              <div className="relative z-10 mb-6 grid grid-cols-2 p-1 bg-white/5 border border-white/10 rounded-2xl">
                {(['login', 'signup'] as Mode[]).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => switchMode(m)}
                    className={`relative py-2.5 rounded-xl text-[10px] font-black uppercase tracking-[0.28em] transition-colors ${
                      mode === m ? 'text-black' : 'text-zinc-400 hover:text-foreground'
                    }`}
                  >
                    {mode === m && (
                      <motion.div
                        layoutId="auth-tab-pill"
                        className="absolute inset-0 bg-[#CCFF00] rounded-xl shadow-[0_0_20px_rgba(204,255,0,0.35)]"
                        transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                      />
                    )}
                    <span className="relative z-10">{m === 'login' ? 'Log In' : 'Sign Up'}</span>
                  </button>
                ))}
              </div>
            )}

            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="bg-destructive/10 border border-destructive/30 rounded-2xl p-3 mb-5 flex items-center gap-2 text-destructive overflow-hidden relative z-10 backdrop-blur-md"
                >
                  <AlertCircle size={14} className="shrink-0" />
                  <span className="text-xs font-bold uppercase tracking-widest">{error}</span>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence mode="wait">
              {stage === 'credentials' ? (
                <motion.form
                  key={`creds-${mode}`}
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  onSubmit={mode === 'login' ? handleLogin : handleSignUp}
                  className="space-y-4 relative z-10"
                >
                  <div className="relative group">
                    <Mail className="absolute left-5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500 group-focus-within:text-[#CCFF00] transition-colors" />
                    <input
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@domain.com"
                      disabled={anyLoading}
                      required
                      className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-4 py-4 text-sm text-foreground outline-none focus:border-[#CCFF00]/60 focus:shadow-[0_0_0_3px_rgba(204,255,0,0.08)] transition-all placeholder:text-zinc-600 disabled:opacity-50"
                    />
                  </div>

                  <div className="relative group">
                    <Lock className="absolute left-5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500 group-focus-within:text-[#CCFF00] transition-colors" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={mode === 'login' ? 'Your password' : 'Min 6 characters'}
                      minLength={6}
                      disabled={anyLoading}
                      required
                      className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-12 py-4 text-sm text-foreground outline-none focus:border-[#CCFF00]/60 focus:shadow-[0_0_0_3px_rgba(204,255,0,0.08)] transition-all placeholder:text-zinc-600 disabled:opacity-50"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((s) => !s)}
                      tabIndex={-1}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      className="absolute right-4 top-1/2 -translate-y-1/2 p-1 text-zinc-500 hover:text-[#CCFF00] transition-colors"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>

                  <motion.button
                    type="submit"
                    disabled={anyLoading}
                    whileTap={{ scale: 0.98 }}
                    className="w-full bg-[#CCFF00] text-black py-4 rounded-2xl font-black uppercase tracking-[0.28em] text-xs flex items-center justify-center gap-2 shadow-[0_0_30px_rgba(204,255,0,0.25)] disabled:opacity-60"
                  >
                    {loading
                      ? <><Loader2 className="animate-spin" size={16} /> {mode === 'login' ? 'Authenticating…' : 'Creating…'}</>
                      : mode === 'login'
                        ? <>Access Dashboard <ArrowRight size={16} /></>
                        : <>Create Elite Account <ArrowRight size={16} /></>}
                  </motion.button>
                </motion.form>
              ) : (
                <motion.form
                  key="otp-step"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  onSubmit={(e) => { e.preventDefault(); handleVerify(); }}
                  className="space-y-6 relative z-10"
                >
                  <p className="text-center text-[11px] text-zinc-400 leading-relaxed">
                    We sent a 6-digit code to{' '}
                    <span className="text-[#CCFF00] font-bold tracking-wide">{email}</span>
                  </p>

                  <div className="flex justify-between gap-2" role="group" aria-label="One-time passcode">
                    {otp.map((digit, idx) => (
                      <input
                        key={idx}
                        ref={(el) => (inputRefs.current[idx] = el)}
                        type="text"
                        inputMode="numeric"
                        autoComplete={idx === 0 ? 'one-time-code' : 'off'}
                        maxLength={idx === 0 ? OTP_LENGTH : 1}
                        value={digit}
                        onChange={(e) => handleOtpChange(idx, e.target.value)}
                        onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                        disabled={anyLoading}
                        aria-label={`Digit ${idx + 1}`}
                        className="w-11 h-14 sm:w-12 sm:h-16 text-center text-xl font-black text-foreground bg-white/5 border border-white/10 rounded-xl outline-none focus:border-[#CCFF00] focus:shadow-[0_0_0_3px_rgba(204,255,0,0.18),0_0_18px_rgba(204,255,0,0.35)] transition-all disabled:opacity-50 caret-[#CCFF00]"
                      />
                    ))}
                  </div>

                  <motion.button
                    type="submit"
                    disabled={anyLoading || otp.some((d) => !d)}
                    whileTap={{ scale: 0.98 }}
                    className="w-full bg-[#CCFF00] text-black py-4 rounded-2xl font-black uppercase tracking-[0.28em] text-xs flex items-center justify-center gap-2 shadow-[0_0_30px_rgba(204,255,0,0.25)] disabled:opacity-60"
                  >
                    {loading
                      ? <><Loader2 className="animate-spin" size={16} /> Verifying…</>
                      : <><ShieldCheck size={16} /> Verify &amp; Enter</>}
                  </motion.button>

                  <div className="flex flex-col items-center gap-2">
                    <button
                      type="button"
                      onClick={handleResend}
                      disabled={anyLoading || resendCountdown > 0}
                      className="text-[10px] font-bold uppercase tracking-[0.25em] text-zinc-400 hover:text-[#CCFF00] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {resendCountdown > 0 ? `Resend code in ${resendCountdown}s` : 'Resend code'}
                    </button>
                    <button
                      type="button"
                      onClick={() => { if (!anyLoading) { setStage('credentials'); setError(null); setOtp(Array(OTP_LENGTH).fill('')); } }}
                      disabled={anyLoading}
                      className="text-[10px] font-bold uppercase tracking-[0.25em] text-zinc-500 hover:text-foreground transition-colors flex items-center gap-1 disabled:opacity-50"
                    >
                      <ArrowLeft size={11} /> Back
                    </button>
                  </div>
                </motion.form>
              )}
            </AnimatePresence>

            <div className="mt-8 space-y-4 relative z-10">
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-white/10" />
                <span className="text-[9px] text-zinc-500 font-black uppercase tracking-widest">Or</span>
                <div className="flex-1 h-px bg-white/10" />
              </div>
              <GlowingButton onClick={handleGuest} disabled={anyLoading} className="w-full py-4 flex items-center justify-center gap-2">
                {guestLoading
                  ? <><Loader2 className="animate-spin" size={14} /> Processing…</>
                  : <><User size={14} /> Guest Protocol</>}
              </GlowingButton>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default AuthScreen;
