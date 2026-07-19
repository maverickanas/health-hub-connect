import { createContext, useCallback, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

export interface AuthProfile {
  display_name: string;
  avatar_url: string | null;
  height: number | null;
  weight: number | null;
  age: number | null;
}

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  loading: boolean;
  profile: AuthProfile | null;
  profileLoading: boolean;
  refetchProfile: () => Promise<AuthProfile | null>;
  signInWithPassword: (email: string, password: string) => Promise<void>;
  signUpWithPassword: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const sleep = (ms: number) => new Promise(res => setTimeout(res, ms));

async function fetchProfileWithRetry(userId: string, maxRetries = 5): Promise<AuthProfile | null> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const { data, error } = await supabase
      .from('profiles')
      .select('display_name, avatar_url, height, weight, age')
      .eq('user_id', userId)
      .maybeSingle();

    if (!error && data) {
      let avatar_url = data.avatar_url;
      if (avatar_url && !/^https?:\/\//i.test(avatar_url)) {
        try {
          const { data: signed } = await supabase.storage.from('avatars').createSignedUrl(avatar_url, 60 * 60);
          avatar_url = signed?.signedUrl ?? null;
        } catch {
          avatar_url = null;
        }
      }
      return { ...data, avatar_url };
    }
    if (error) console.warn(`[AuthProvider] profile fetch attempt ${attempt + 1} errored:`, error);
    if (attempt < maxRetries - 1) await sleep(100 * Math.pow(2, attempt));
  }
  return null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<AuthProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
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
          // Explicit NULLs override the DB column defaults so brand-new users
          // are correctly flagged as needing onboarding by the gatekeeper.
          { user_id: u.id, display_name: displayName, height: null, weight: null, age: null, gender: null },
          { onConflict: 'user_id', ignoreDuplicates: true }
        );
      if (error) console.error('[AuthProvider] ensureProfileRow upsert failed:', error);
    } catch (err) {
      console.error('[AuthProvider] ensureProfileRow unexpected error:', err);
    } finally {
      bootstrappingRef.current.delete(u.id);
    }
  };

  const loadProfile = useCallback(async (u: User): Promise<AuthProfile | null> => {
    setProfileLoading(true);
    try {
      // Make sure a row exists for brand-new users before fetching.
      await ensureProfileRow(u);
      const p = await fetchProfileWithRetry(u.id);
      setProfile(p);
      return p;
    } finally {
      setProfileLoading(false);
    }
  }, []);

  const refetchProfile = useCallback(async () => {
    if (!user) return null;
    return loadProfile(user);
  }, [user, loadProfile]);

  useEffect(() => {
    // 1. Listener FIRST (sync state updates only — defer async work).
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      if (session?.user) {
        setTimeout(() => { loadProfile(session.user); }, 0);
      } else {
        setProfile(null);
        setProfileLoading(false);
      }
    });

    // 2. THEN hydrate from persisted session and preload profile.
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      if (session?.user) {
        setTimeout(() => { loadProfile(session.user); }, 0);
      } else {
        setProfileLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [loadProfile]);

  const signInWithPassword = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signUpWithPassword = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/` },
    });
    if (error) throw error;
    // When email confirmations are enabled, Supabase returns a stubbed user
    // with an empty `identities` array for an already-registered email
    // (no error). Surface it as a normalised "already registered" error so
    // AuthScreen can auto-switch to Log In.
    if (data?.user && Array.isArray((data.user as any).identities) && (data.user as any).identities.length === 0) {
      const e: any = new Error('User already registered');
      e.code = 'user_already_exists';
      throw e;
    }
  };

  const signInWithGoogle = async () => {
    const { lovable } = await import('@/integrations/lovable');
    const result = await lovable.auth.signInWithOAuth('google', {
      redirect_uri: window.location.origin,
    });
    if (result.error) throw result.error instanceof Error ? result.error : new Error(String(result.error));
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  return (
    <AuthContext.Provider value={{ session, user, loading, profile, profileLoading, refetchProfile, signInWithPassword, signUpWithPassword, signInWithGoogle, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an <AuthProvider>');
  return ctx;
}
