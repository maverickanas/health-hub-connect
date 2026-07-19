import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Capacitor config for Healthy Hub Android APK.
 *
 * Two modes:
 *  1. DEV (hot-reload from Lovable sandbox):
 *       set CAP_ENV=dev before `npx cap sync`
 *  2. PROD (bundled web assets, real installable APK) — DEFAULT:
 *       run `npm run build && npx cap sync android`
 */
const isDev = process.env.CAP_ENV === 'dev';

const config: CapacitorConfig = {
  appId: 'app.lovable.610472d1765f411983281e3c15720a01',
  appName: 'Healthy Hub',
  webDir: 'dist',
  ...(isDev
    ? {
        server: {
          url: 'https://610472d1-765f-4119-8328-1e3c15720a01.lovableproject.com?forceHideBadge=true',
          cleartext: true,
        },
      }
    : {
        server: {
          androidScheme: 'https',
        },
      }),
  android: {
    allowMixedContent: false,
    backgroundColor: '#050505',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      backgroundColor: '#050505',
      androidSplashResourceName: 'splash',
      showSpinner: true,
      spinnerColor: '#CCFF00',
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#050505',
      overlaysWebView: false,
    },
    BackgroundGeolocation: {
      backgroundMessage: 'Healthy Hub is tracking your workout in the background',
      backgroundTitle: 'Workout in progress',
    },
  },
};

export default config;
