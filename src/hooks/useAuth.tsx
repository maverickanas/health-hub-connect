import { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signUp: (email: string, password: string, displayName: string) => Promise<{
    user: User;
    session: Session | null;
    needsEmailConfirmation: boolean;
  }>;
  signIn: (email: string, password: string) => Promise<void>;
  signInAsGuest: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const bootstrappingRef = useRef<Set<string>>(new Set());

  const ensureProfileRow = async (u: User) => {
    if (bootstrappingRef.current.has(u.id)) return;
    bootstrappingRef.current.add(u.id);
    try {
      const displayName =
        (u.user_metadata?.display_name as string | undefined) ||
        (u.is_anonymous ? 'Guest' : u.email?.split('@')[0]) ||
        'Elite';
      const { error } = await supabase
        .from('profiles')
        .upsert(
          { user_id: u.id, display_name: displayName },
          { onConflict: 'user_id', ignoreDuplicates: true }
        );
      if (error) console.error('[AuthProvider] ensureProfileRow upsert failed:', error);
    } catch (err) {
      console.error('[AuthProvider] ensureProfileRow unexpected error:', err);
    } finally {
      bootstrappingRef.current.delete(u.id);
    }
  };

  useEffect(() => {
    // 1. Set listener FIRST (synchronous state updates only — defer async work)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      if (session?.user) {
        setTimeout(() => { ensureProfileRow(session.user); }, 0);
      }
    });

    // 2. THEN hydrate from persisted localStorage session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      if (session?.user) {
        setTimeout(() => { ensureProfileRow(session.user); }, 0);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string, displayName: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName },
        emailRedirectTo: window.location.origin,
      },
    });
    if (error) throw error;
    if (!data.user) throw new Error('Registration failed: no user returned by the server.');
    return { user: data.user, session: data.session, needsEmailConfirmation: !data.session };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signInAsGuest = async () => {
    const { error } = await supabase.auth.signInAnonymously();
    if (error) throw error;
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  return (
    <AuthContext.Provider value={{ session, user, loading, signUp, signIn, signInAsGuest, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an <AuthProvider>');
  return ctx;
}
