/**
 * /auth/native — sign-in bridge for the Android APK.
 *
 * Opened in the phone's system browser on the published https origin (the only
 * origin the managed OAuth broker allows). Once a session exists it bounces the
 * tokens back into the app via the `healthyhub://auth` deep link.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

const NativeAuth: React.FC = () => {
  const [status, setStatus] = useState('Connecting to Google…');
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const params = new URLSearchParams(window.location.search);
    const ret = params.get('return') || 'healthyhub://auth';

    const handoff = (access_token: string, refresh_token: string) => {
      setStatus('Returning to Healthy Hub…');
      window.location.href = `${ret}#access_token=${encodeURIComponent(access_token)}&refresh_token=${encodeURIComponent(refresh_token)}`;
    };

    (async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        handoff(data.session.access_token, data.session.refresh_token);
        return;
      }

      try {
        const { lovable } = await import('@/integrations/lovable');
        const result = await lovable.auth.signInWithOAuth('google', {
          redirect_uri: `${window.location.origin}/auth/native?return=${encodeURIComponent(ret)}`,
        });
        if (result.error) throw result.error;
        if (result.redirected) return;
        const { data: after } = await supabase.auth.getSession();
        if (after.session) handoff(after.session.access_token, after.session.refresh_token);
      } catch (err: any) {
        setStatus(err?.message || 'Sign-in failed. Close this window and try again.');
      }
    })();
  }, []);

  return (
    <main className="min-h-[100dvh] flex flex-col items-center justify-center gap-4 bg-background text-foreground px-6 text-center">
      <h1 className="text-xs font-black uppercase tracking-[0.3em] text-primary">Healthy Hub</h1>
      <Loader2 className="animate-spin text-primary" size={28} />
      <p className="text-sm text-muted-foreground">{status}</p>
    </main>
  );
};

export default NativeAuth;
