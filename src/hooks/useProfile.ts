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
      if (data) setProfile(data);
      setLoading(false);
    };
    fetch();
  }, [user]);

  return { profile, loading };
}
