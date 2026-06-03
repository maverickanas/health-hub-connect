import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, AlertCircle, User, Mail, ArrowRight, ArrowLeft, ShieldCheck } from 'lucide-react';
import Logo from './Logo';
import GlowingButton from './GlowingButton';

interface AuthScreenProps {
  onSendOtp: (email: string) => Promise<void>;
  onVerifyOtp: (email: string, code: string) => Promise<void>;
  onGuestLogin: () => Promise<void>;
}

type Step = 'email' | 'otp';
const RESEND_SECONDS = 60;
const OTP_LENGTH = 6;

const AuthScreen: React.FC<AuthScreenProps> = ({ onSendOtp, onVerifyOtp, onGuestLogin }) => {
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [isSending, setIsSending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [isGuestLoading, setIsGuestLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendCountdown, setResendCountdown] = useState(0);

  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const anyLoading = isSending || isVerifying || isResending || isGuestLoading;

  // Countdown ticker for resend cooldown
  useEffect(() => {
    if (resendCountdown <= 0) return;
    const t = setInterval(() => setResendCountdown((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [resendCountdown]);

  // Focus first OTP box when entering verify step
  useEffect(() => {
    if (step === 'otp') {
      setTimeout(() => inputRefs.current[0]?.focus(), 50);
    }
  }, [step]);

  const isValidEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

  const handleSendOtp = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError(null);
    const sanitized = email.trim().toLowerCase();
    if (!isValidEmail(sanitized)) { setError('Enter a valid email address.'); return; }
    setIsSending(true);
    try {
      await onSendOtp(sanitized);
      setEmail(sanitized);
      setOtp(Array(OTP_LENGTH).fill(''));
      setStep('otp');
      setResendCountdown(RESEND_SECONDS);
    } catch (err: any) {
      setError(err?.message || 'Failed to send security code.');
    } finally {
      setIsSending(false);
    }
  };

  const handleResend = async () => {
    if (resendCountdown > 0) return;
    setError(null);
    setIsResending(true);
    try {
      await onSendOtp(email);
      setOtp(Array(OTP_LENGTH).fill(''));
      setResendCountdown(RESEND_SECONDS);
      inputRefs.current[0]?.focus();
    } catch (err: any) {
      setError(err?.message || 'Failed to resend code.');
    } finally {
      setIsResending(false);
    }
  };

  const handleVerify = async (e?: React.FormEvent, codeOverride?: string) => {
    e?.preventDefault();
    setError(null);
    const code = (codeOverride ?? otp.join('')).trim();
    if (code.length !== OTP_LENGTH) { setError(`Enter the ${OTP_LENGTH}-digit code.`); return; }
    setIsVerifying(true);
    try {
      await onVerifyOtp(email, code);
      // Index.tsx routing gate takes over (onboarding vs dashboard).
    } catch (err: any) {
      setError(err?.message || 'Invalid or expired code.');
      setOtp(Array(OTP_LENGTH).fill(''));
      setTimeout(() => inputRefs.current[0]?.focus(), 50);
    } finally {
      setIsVerifying(false);
    }
  };

  const handleOtpChange = (idx: number, raw: string) => {
    const digits = raw.replace(/\D/g, '');
    if (!digits) {
      const next = [...otp]; next[idx] = ''; setOtp(next); return;
    }
    if (digits.length > 1) {
      // Pasted multi-digit value — distribute across boxes
      const next = [...otp];
      for (let i = 0; i < digits.length && idx + i < OTP_LENGTH; i++) next[idx + i] = digits[i];
      setOtp(next);
      const lastFilled = Math.min(idx + digits.length, OTP_LENGTH - 1);
      inputRefs.current[lastFilled]?.focus();
      if (next.every(Boolean)) handleVerify(undefined, next.join(''));
      return;
    }
    const next = [...otp]; next[idx] = digits; setOtp(next);
    if (idx < OTP_LENGTH - 1) inputRefs.current[idx + 1]?.focus();
    if (next.every(Boolean) && idx === OTP_LENGTH - 1) handleVerify(undefined, next.join(''));
  };

  const handleOtpKeyDown = (idx: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otp[idx] && idx > 0) {
      inputRefs.current[idx - 1]?.focus();
      const next = [...otp]; next[idx - 1] = ''; setOtp(next);
      e.preventDefault();
    } else if (e.key === 'ArrowLeft' && idx > 0) {
      inputRefs.current[idx - 1]?.focus();
    } else if (e.key === 'ArrowRight' && idx < OTP_LENGTH - 1) {
      inputRefs.current[idx + 1]?.focus();
    }
  };

  const handleGuest = async () => {
    setError(null);
    setIsGuestLoading(true);
    try {
      await onGuestLogin();
    } catch (err: any) {
      setError(err?.message || 'Guest protocol failed.');
    } finally {
      setIsGuestLoading(false);
    }
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
            className="w-full bg-white/[0.03] backdrop-blur-xl rounded-[24px] p-8 md:p-12 border border-white/10 shadow-2xl relative overflow-hidden"
          >
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-32 bg-[#CCFF00]/5 blur-[60px] pointer-events-none" />

            <div className="flex flex-col items-center mb-8 text-center relative z-10">
              <Logo className="h-14 w-auto mb-5" />
              <p className="text-[10px] text-zinc-500 font-black uppercase tracking-[0.45em]">
                {step === 'email' ? 'Secure Passwordless Access' : 'Verify Your Identity'}
              </p>
            </div>

            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="bg-destructive/10 border border-destructive/30 rounded-2xl p-4 mb-6 flex items-center gap-2 text-destructive overflow-hidden relative z-10 backdrop-blur-md"
                >
                  <AlertCircle size={14} className="shrink-0" />
                  <span className="text-xs font-bold uppercase tracking-widest">{error}</span>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence mode="wait">
              {step === 'email' ? (
                <motion.form
                  key="email-step"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  onSubmit={handleSendOtp}
                  className="space-y-5 relative z-10"
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

                  <motion.button
                    type="submit"
                    disabled={anyLoading}
                    whileTap={{ scale: 0.98 }}
                    className="w-full bg-[#CCFF00] text-black py-4 rounded-2xl font-black uppercase tracking-[0.28em] text-xs flex items-center justify-center gap-2 shadow-[0_0_30px_rgba(204,255,0,0.25)] disabled:opacity-60"
                  >
                    {isSending
                      ? <><Loader2 className="animate-spin" size={16} /> Sending…</>
                      : <>Send Security Code <ArrowRight size={16} /></>}
                  </motion.button>
                </motion.form>
              ) : (
                <motion.form
                  key="otp-step"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  onSubmit={handleVerify}
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
                    {isVerifying
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
                      {isResending
                        ? 'Resending…'
                        : resendCountdown > 0
                          ? `Resend code in ${resendCountdown}s`
                          : 'Resend code'}
                    </button>
                    <button
                      type="button"
                      onClick={() => { if (!anyLoading) { setStep('email'); setError(null); setOtp(Array(OTP_LENGTH).fill('')); } }}
                      disabled={anyLoading}
                      className="text-[10px] font-bold uppercase tracking-[0.25em] text-zinc-500 hover:text-foreground transition-colors flex items-center gap-1 disabled:opacity-50"
                    >
                      <ArrowLeft size={11} /> Use a different email
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
                {isGuestLoading
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
