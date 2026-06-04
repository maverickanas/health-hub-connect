import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.610472d1765f411983281e3c15720a01',
  appName: 'healthyhubapp',
  webDir: 'dist',
  server: {
    url: 'https://610472d1-765f-4119-8328-1e3c15720a01.lovableproject.com?forceHideBadge=true',
    cleartext: true,
  },
  plugins: {
    BackgroundGeolocation: {
      // iOS: shown in the "always allow" permission dialog
      backgroundMessage: 'HEALTHY.HUB is tracking your workout in the background',
      backgroundTitle: 'Workout in progress',
    },
  },
};

export default config;
