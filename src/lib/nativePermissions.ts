/**
 * Requests every runtime permission the native app needs, up-front and in a
 * user-friendly order. No-ops on web (browsers prompt contextually instead).
 *
 * - Notifications  → ongoing tracking notification (Android 13+ requires it)
 * - Location       → GPS route tracking, foreground + background
 * - Motion         → step counting (iOS DeviceMotion gate)
 * - Battery        → Doze exemption so tracking survives a locked screen
 */
import { Capacitor } from '@capacitor/core';
import { requestNotificationPermission } from './liveNotification';
import {
  isBatteryOptimizationDisabled,
  requestBatteryOptimizationExemption,
} from './batteryOptimization';

export interface PermissionReport {
  notifications: boolean;
  location: boolean;
  motion: boolean;
  battery: boolean;
}

export async function requestAppPermissions(): Promise<PermissionReport> {
  const report: PermissionReport = {
    notifications: false,
    location: false,
    motion: false,
    battery: false,
  };

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

  // Asked last: it opens a full-screen system dialog, so it must not interrupt
  // the earlier in-line permission prompts.
  try {
    report.battery = await requestBatteryOptimizationExemption();
  } catch {
    report.battery = false;
  }

  return report;
}

/** Re-check (without prompting) whether background execution is unrestricted. */
export async function checkBackgroundExecutionAllowed(): Promise<boolean> {
  return isBatteryOptimizationDisabled();
}
