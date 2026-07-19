/**
 * Native shell bootstrap for the Capacitor Android/iOS build.
 *
 * - Hides splash after first paint
 * - Locks status bar to OLED black + light icons
 * - Hardware back button → browser history back (exits on root)
 * - Emits a "native:offline" custom event when connection drops
 *
 * Runs no-ops on web (Capacitor.isNativePlatform() === false), so it is safe
 * to import unconditionally from src/main.tsx.
 */
import { Capacitor } from '@capacitor/core';

export async function initNativeShell() {
  if (!Capacitor.isNativePlatform()) return;

  try {
    const [{ App }, { StatusBar, Style }, { SplashScreen }, { Network }] =
      await Promise.all([
        import('@capacitor/app'),
        import('@capacitor/status-bar'),
        import('@capacitor/splash-screen'),
        import('@capacitor/network'),
      ]);

    // Status bar: solid OLED black, light icons, do not overlay webview.
    try {
      await StatusBar.setStyle({ style: Style.Dark });
      await StatusBar.setBackgroundColor({ color: '#050505' });
      await StatusBar.setOverlaysWebView({ overlay: false });
    } catch {
      /* iOS lacks setBackgroundColor — safe to ignore */
    }

    // Hardware back button: pop web history, or exit on root.
    App.addListener('backButton', ({ canGoBack }) => {
      if (canGoBack) {
        window.history.back();
      } else {
        App.exitApp();
      }
    });

    // Deep-link / universal link → navigate inside the SPA.
    App.addListener('appUrlOpen', ({ url }) => {
      try {
        const parsed = new URL(url);
        const path = parsed.pathname + parsed.search + parsed.hash;
        if (path && path !== window.location.pathname + window.location.search) {
          window.history.pushState({}, '', path);
          window.dispatchEvent(new PopStateEvent('popstate'));
        }
      } catch {
        /* invalid URL — ignore */
      }
    });

    // Network events → surface to app for the offline banner.
    Network.addListener('networkStatusChange', (status) => {
      window.dispatchEvent(
        new CustomEvent('native:network', { detail: status }),
      );
    });

    // Dismiss splash after first paint.
    requestAnimationFrame(() => {
      SplashScreen.hide().catch(() => {});
    });
  } catch (err) {
    // Never crash the app because native init failed.
    console.warn('[native-shell] init failed', err);
  }
}
