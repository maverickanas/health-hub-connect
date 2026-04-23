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

    const fetch = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('display_name, avatar_url, height, weight, age')
        .eq('user_id', user.id)
        .maybeSingle();

      if (data) {
        let avatar_url = data.avatar_url;
        // If avatar_url is a storage path (not a full URL), generate a signed URL.
        if (avatar_url && !/^https?:\/\//i.test(avatar_url)) {
          const { data: signed } = await supabase
            .storage
            .from('avatars')
            .createSignedUrl(avatar_url, 60 * 60);
          avatar_url = signed?.signedUrl ?? null;
        }
        setProfile({ ...data, avatar_url });
      }
      setLoading(false);
    };
    fetch();
  }, [user]);

  return { profile, loading };
}
