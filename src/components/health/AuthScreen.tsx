import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, Eye, EyeOff, AlertCircle, User, Mail, Lock, ArrowRight } from 'lucide-react';
import Logo from './Logo';
import GlowingButton from './GlowingButton';

interface AuthScreenProps {
  onSignIn: (email: string, password: string) => Promise<void>;
  onSignUp: (email: string, password: string, name: string) => Promise<void>;
  onGuestLogin: () => Promise<void>;
}

const AuthScreen: React.FC<AuthScreenProps> = ({ onSignIn, onSignUp, onGuestLogin }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [isGuestLoading, setIsGuestLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const anyLoading = isLoggingIn || isRegistering || isGuestLoading;

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const sanitizedEmail = email.trim().toLowerCase();

    if (!isLogin) {
      // REGISTER
      if (password !== confirmPassword) { setError('Passwords do not match.'); return; }
      if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }
      setIsRegistering(true);
      try {
        await onSignUp(sanitizedEmail, password, name || 'Elite');
      } catch (err: any) {
        setError(err.message || 'Registration refused.');
      } finally {
        setIsRegistering(false);
      }
    } else {
      // LOGIN
      setIsLoggingIn(true);
      try {
        await onSignIn(sanitizedEmail, password);
      } catch (err: any) {
        setError(err.message || 'Invalid login credentials.');
      } finally {
        setIsLoggingIn(false);
      }
    }
  };

  const handleGuest = async () => {
    setError(null);
    setIsGuestLoading(true);
    try {
      await onGuestLogin();
    } catch (err: any) {
      setError(err.message || 'Guest protocol failed.');
    } finally {
      setIsGuestLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] w-full flex flex-col bg-background relative overflow-y-auto no-scrollbar">
      <div className="fixed inset-0 z-0 bg-[radial-gradient(circle_at_center,_hsl(0_0%_10%)_0%,_hsl(0_0%_0%)_100%)] pointer-events-none" />
      <div className="fixed inset-0 z-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_at_center,black_40%,transparent_100%)] pointer-events-none" />

      <div className="relative z-10 min-h-[100dvh] w-full flex flex-col items-center p-6 pt-12 pb-10 lg:pt-20">
        <div className="flex-1 flex flex-col items-center justify-center w-full max-w-md">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full bg-foreground/5 backdrop-blur-xl rounded-[24px] p-8 md:p-12 border border-border shadow-2xl relative overflow-hidden"
          >
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-32 bg-primary/5 blur-[60px] pointer-events-none" />

            <div className="flex flex-col items-center mb-10 text-center relative z-10">
              <Logo className="h-16 w-auto mb-6" />
              <p className="text-[10px] text-muted-foreground font-black uppercase tracking-[0.5em] leading-relaxed">
                Elite Fitness Ecosystem
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

            <form onSubmit={handleAuth} className="space-y-5 relative z-10">
              {!isLogin && (
                <div className="relative group">
                  <User className="absolute left-5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                  <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Display Name"
                    disabled={anyLoading}
                    className="w-full bg-muted border border-border rounded-2xl pl-12 pr-4 py-4 text-sm text-foreground outline-none focus:border-primary/50 transition-all placeholder:text-muted-foreground disabled:opacity-50" />
                </div>
              )}

              <div className="relative group">
                <Mail className="absolute left-5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email Address"
                  disabled={anyLoading}
                  className="w-full bg-muted border border-border rounded-2xl pl-12 pr-4 py-4 text-sm text-foreground outline-none focus:border-primary/50 transition-all placeholder:text-muted-foreground disabled:opacity-50" required />
              </div>

              <div className="relative group">
                <Lock className="absolute left-5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                <input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password"
                  disabled={anyLoading}
                  className="w-full bg-muted border border-border rounded-2xl pl-12 pr-12 py-4 text-sm text-foreground outline-none focus:border-primary/50 transition-all placeholder:text-muted-foreground disabled:opacity-50" required />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>

              {!isLogin && (
                <div className="relative group">
                  <Lock className="absolute left-5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                  <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Confirm Password"
                    disabled={anyLoading}
                    className="w-full bg-muted border border-border rounded-2xl pl-12 pr-4 py-4 text-sm text-foreground outline-none focus:border-primary/50 transition-all placeholder:text-muted-foreground disabled:opacity-50" required />
                </div>
              )}

              <motion.button type="submit" disabled={anyLoading} whileTap={{ scale: 0.98 }}
                className="w-full bg-primary text-primary-foreground py-4 rounded-2xl font-black uppercase tracking-[0.3em] text-xs flex items-center justify-center gap-2 shadow-[0_0_30px_rgba(204,255,0,0.2)] disabled:opacity-50">
                {isLogin
                  ? (isLoggingIn ? <><Loader2 className="animate-spin" size={16} /> PROCESSING...</> : <>ACCESS SYSTEM <ArrowRight size={16} /></>)
                  : (isRegistering ? <><Loader2 className="animate-spin" size={16} /> PROCESSING...</> : <>REGISTER ID <ArrowRight size={16} /></>)
                }
              </motion.button>
            </form>

            <div className="mt-8 space-y-4 relative z-10">
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-border" />
                <span className="text-[9px] text-muted-foreground font-black uppercase tracking-widest">Or</span>
                <div className="flex-1 h-px bg-border" />
              </div>
              <button onClick={() => { setError(null); setIsLogin(!isLogin); }} disabled={anyLoading}
                className="w-full text-center text-[10px] text-muted-foreground font-bold uppercase tracking-widest hover:text-primary transition-colors py-2 disabled:opacity-50">
                {isLogin ? 'New here? Create an account' : 'Already have an account? Login'}
              </button>
              <GlowingButton onClick={handleGuest} disabled={anyLoading} className="w-full py-4 flex items-center justify-center gap-2">
                {isGuestLoading
                  ? <><Loader2 className="animate-spin" size={14} /> PROCESSING...</>
                  : <><User size={14} /> Guest Protocol</>
                }
              </GlowingButton>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default AuthScreen;
