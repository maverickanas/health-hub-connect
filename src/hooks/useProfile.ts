import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { User } from '@supabase/supabase-js';

interface Profile {
  display_name: string;
  avatar_url: string | null;
  height: number | null;
  weight: number | null;
  age: number | null;
}

const sleep = (ms: number) => new Promise(res => setTimeout(res, ms));

// Retry the profile fetch with exponential backoff to absorb the brief race
// between auth signup and the profile row being created (trigger or client-side bootstrap).
async function fetchProfileWithRetry(userId: string, maxRetries = 5) {
  let lastError: unknown = null;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const { data, error } = await supabase
      .from('profiles')
      .select('display_name, avatar_url, height, weight, age')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      lastError = error;
      console.warn(`[useProfile] fetch attempt ${attempt + 1} errored:`, error);
    } else if (data) {
      return { data, error: null as const };
    }

    if (attempt < maxRetries - 1) {
      // 100ms, 200ms, 400ms, 800ms, 1600ms
      await sleep(100 * Math.pow(2, attempt));
    }
  }
  return { data: null, error: lastError };
}

export function useProfile(user: User | null) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setProfile(null); setLoading(false); return; }
    setLoading(true);

    let cancelled = false;
    const fetchProfile = async () => {
      try {
        const { data, error } = await fetchProfileWithRetry(user.id);
        if (cancelled) return;

        if (error) {
          console.error('[useProfile] Failed to fetch profile after retries:', error);
          setProfile(null);
          return;
        }

        if (!data) {
          console.warn('[useProfile] No profile row found for user', user.id);
          setProfile(null);
          return;
        }

        let avatar_url = data.avatar_url;
        if (avatar_url && !/^https?:\/\//i.test(avatar_url)) {
          try {
            const { data: signed } = await supabase
              .storage
              .from('avatars')
              .createSignedUrl(avatar_url, 60 * 60);
            avatar_url = signed?.signedUrl ?? null;
          } catch (avatarErr) {
            console.error('[useProfile] Avatar signed URL failed:', avatarErr);
            avatar_url = null;
          }
        }
        if (!cancelled) setProfile({ ...data, avatar_url });
      } catch (err) {
        console.error('[useProfile] Unexpected error:', err);
        if (!cancelled) setProfile(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchProfile();
    return () => { cancelled = true; };
  }, [user]);

  return { profile, loading };
}
