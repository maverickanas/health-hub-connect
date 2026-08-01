/**
 * Requests every runtime permission the native app needs, up-front and in a
 * user-friendly order. No-ops on web (browsers prompt contextually instead).
 *
 * - Notifications  → ongoing tracking notification (Android 13+ requires it)
 * - Location       → GPS route tracking, foreground + background
 * - Motion         → step counting (iOS DeviceMotion gate)
 */
import { Capacitor } from '@capacitor/core';
import { requestNotificationPermission } from './liveNotification';

export interface PermissionReport {
  notifications: boolean;
  location: boolean;
  motion: boolean;
}

export async function requestAppPermissions(): Promise<PermissionReport> {
  const report: PermissionReport = { notifications: false, location: false, motion: false };

  const native = (() => {
    try {
      return Capacitor.isNativePlatform();
    } catch {
      return false;
    }
  })();

  if (!native) return report;

  report.notifications = await requestNotificationPermission();

  try {
    const { Geolocation } = await import('@capacitor/geolocation');
    const status = await Geolocation.requestPermissions({ permissions: ['location'] });
    report.location = status.location === 'granted' || status.coarseLocation === 'granted';
  } catch {
    /* plugin unavailable */
  }

  try {
    const DM = (window as unknown as { DeviceMotionEvent?: { requestPermission?: () => Promise<string> } })
      .DeviceMotionEvent;
    if (typeof DM?.requestPermission === 'function') {
      report.motion = (await DM.requestPermission()) === 'granted';
    } else {
      report.motion = typeof window !== 'undefined' && 'DeviceMotionEvent' in window;
    }
  } catch {
    report.motion = false;
  }

  return report;
}
