import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Session, User } from '@supabase/supabase-js';

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  // Single-flight lock — prevents concurrent profile-bootstrap runs for the same user.
  const bootstrappingRef = useRef<Set<string>>(new Set());

  // Ensure a minimal profiles row exists for the signed-in user.
  // Uses upsert to eliminate races with the handle_new_user trigger.
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

      if (error) {
        console.error('[useAuth] ensureProfileRow upsert failed:', error);
      }
    } catch (err) {
      console.error('[useAuth] ensureProfileRow unexpected error:', err);
    } finally {
      bootstrappingRef.current.delete(u.id);
    }
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      // Defer Supabase calls out of the auth callback to avoid deadlocks.
      if (session?.user) {
        setTimeout(() => { ensureProfileRow(session.user); }, 0);
      }
    });

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
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName },
        emailRedirectTo: window.location.origin,
      },
    });
    if (error) throw error;
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

  return { session, user, loading, signUp, signIn, signInAsGuest, signOut };
}
