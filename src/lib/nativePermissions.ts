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
import { isNativeAndroid, requestNativeTrackingPermissions } from './backgroundTracker';
import {
  isBatteryOptimizationDisabled,
  requestBatteryOptimizationExemption,
} from './batteryOptimization';

export interface PermissionReport {
  notifications: boolean;
  location: boolean;
  motion: boolean;
  camera: boolean;
  battery: boolean;
}

export async function requestAppPermissions(): Promise<PermissionReport> {
  const report: PermissionReport = {
    notifications: false,
    location: false,
    motion: false,
    camera: false,
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

  // 1. Motion / activity recognition (MANDATORY for step counting), plus
  //    notifications and camera — asked in a single native chain on Android.
  if (isNativeAndroid()) {
    const res = await requestNativeTrackingPermissions();
    report.motion = res.activity;
    report.notifications = res.notifications;
    report.camera = res.camera;
  }

  // 2. Notification channel setup / iOS notification prompt.
  if (!report.notifications) {
    report.notifications = await requestNotificationPermission();
  }

  // 3. Location — foreground + background for GPS route tracking.
  try {
    const { Geolocation } = await import('@capacitor/geolocation');
    const status = await Geolocation.requestPermissions({ permissions: ['location'] });
    report.location = status.location === 'granted' || status.coarseLocation === 'granted';
  } catch {
    /* plugin unavailable */
  }

  // 4. iOS DeviceMotion gate (no-op on Android where step 1 already ran).
  if (!report.motion) {
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
