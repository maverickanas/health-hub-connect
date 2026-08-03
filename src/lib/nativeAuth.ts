/**
 * Native (APK) Google sign-in bridge.
 *
 * Why: inside the Capacitor WebView the page origin is `https://localhost`,
 * which the managed OAuth broker rejects with a 403. Instead we hand the flow
 * to the system browser on the PUBLISHED https origin (which IS allowlisted),
 * and the published page hands the tokens back through a custom-scheme deep
 * link that the APK intercepts.
 */
import { Capacitor } from '@capacitor/core';
import { supabase } from '@/integrations/supabase/client';

/** Published web origin — must match the deployed Lovable app. */
export const PUBLISHED_ORIGIN = 'https://healthyhubapp.lovable.app';
/** Custom scheme registered in AndroidManifest.xml. */
export const NATIVE_AUTH_SCHEME = 'healthyhub://auth';

export const isNative = () => Capacitor.isNativePlatform();

/** Parse `#access_token=..&refresh_token=..` (or query form) out of a deep link. */
export function parseAuthTokens(url: string): { access_token: string; refresh_token: string } | null {
  try {
    const hash = url.includes('#') ? url.split('#')[1] : '';
    const query = url.includes('?') ? url.split('?')[1].split('#')[0] : '';
    const params = new URLSearchParams(hash || query);
    const access_token = params.get('access_token');
    const refresh_token = params.get('refresh_token');
    if (access_token && refresh_token) return { access_token, refresh_token };
  } catch {
    /* ignore malformed links */
  }
  return null;
}

/**
 * Opens the system browser on the published sign-in bridge and resolves once
 * the deep link comes back with a valid session (or the user aborts).
 */
export async function signInWithGoogleNative(): Promise<void> {
  const [{ Browser }, { App }] = await Promise.all([
    import('@capacitor/browser'),
    import('@capacitor/app'),
  ]);

  const target = `${PUBLISHED_ORIGIN}/auth/native?return=${encodeURIComponent(NATIVE_AUTH_SCHEME)}`;

  return new Promise<void>((resolve, reject) => {
    let settled = false;

    const finish = async (err?: unknown) => {
      if (settled) return;
      settled = true;
      try { await urlHandle.remove(); } catch { /* noop */ }
      try { await closeHandle?.remove(); } catch { /* noop */ }
      try { await Browser.close(); } catch { /* noop */ }
      err ? reject(err) : resolve();
    };

    let closeHandle: { remove: () => Promise<void> } | undefined;

    const urlHandlePromise = App.addListener('appUrlOpen', async ({ url }) => {
      if (!url?.startsWith('healthyhub://')) return;
      const tokens = parseAuthTokens(url);
      if (!tokens) {
        await finish(new Error('Sign-in was cancelled.'));
        return;
      }
      const { error } = await supabase.auth.setSession(tokens);
      await finish(error ?? undefined);
    });

    let urlHandle: { remove: () => Promise<void> };

    urlHandlePromise
      .then(async (handle) => {
        urlHandle = handle;
        closeHandle = await Browser.addListener('browserFinished', () => {
          // User dismissed the tab without completing — resolve quietly.
          setTimeout(() => { if (!settled) finish(); }, 400);
        });
        await Browser.open({ url: target, presentationStyle: 'popover' });
      })
      .catch((err) => finish(err));
  });
}
