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

export function useProfile(user: User | null) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setProfile(null); setLoading(false); return; }
    setLoading(true);

    const fetchProfile = async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('display_name, avatar_url, height, weight, age')
          .eq('user_id', user.id)
          .maybeSingle();

        if (error) {
          console.error('[useProfile] Failed to fetch profile:', error);
          setProfile(null);
          return;
        }

        if (!data) {
          // Brand-new user — profile row not yet created. Routing layer will send to onboarding.
          console.warn('[useProfile] No profile row found for user', user.id);
          setProfile(null);
          return;
        }

        let avatar_url = data.avatar_url;
        // If avatar_url is a storage path (not a full URL), generate a signed URL.
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
        setProfile({ ...data, avatar_url });
      } catch (err) {
        console.error('[useProfile] Unexpected error:', err);
        setProfile(null);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [user]);

  return { profile, loading };
}
