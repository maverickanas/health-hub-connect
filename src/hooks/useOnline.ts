import { useEffect, useState } from 'react';

/**
 * Live connectivity state. Uses the browser online/offline events and, on the
 * native APK, the Capacitor Network plugin (which is far more reliable inside
 * a WebView).
 */
export function useOnline(): boolean {
  const [online, setOnline] = useState<boolean>(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine
  );

  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);

    let remove: (() => void) | undefined;
    (async () => {
      try {
        const { Capacitor } = await import('@capacitor/core');
        if (!Capacitor.isNativePlatform()) return;
        const { Network } = await import('@capacitor/network');
        const initial = await Network.getStatus();
        setOnline(initial.connected);
        const handle = await Network.addListener('networkStatusChange', (s) => setOnline(s.connected));
        remove = () => { handle.remove(); };
      } catch {
        /* web / plugin unavailable */
      }
    })();

    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
      remove?.();
    };
  }, []);

  return online;
}

export default useOnline;
