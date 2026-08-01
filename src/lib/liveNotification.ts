/**
 * Ongoing "live activity" notification for native builds.
 *
 * Shows a persistent, non-dismissable notification while a step-tracking or
 * GPS session is running, so the OS keeps the app alive in the background and
 * the user sees live progress from the shade / lock screen (and in the
 * dynamic-island style pill on devices that surface ongoing notifications).
 *
 * All functions are no-ops on the web build.
 */
import { Capacitor } from '@capacitor/core';

const STEP_NOTIFICATION_ID = 4201;
const CHANNEL_ID = 'healthyhub_live';

const isNative = () => {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
};

async function plugin() {
  const { LocalNotifications } = await import('@capacitor/local-notifications');
  return LocalNotifications;
}

let channelReady = false;

async function ensureChannel() {
  if (channelReady) return;
  const LocalNotifications = await plugin();
  try {
    await LocalNotifications.createChannel({
      id: CHANNEL_ID,
      name: 'Live Activity',
      description: 'Ongoing step and workout tracking',
      importance: 3,
      visibility: 1,
      lights: false,
      vibration: false,
    });
  } catch {
    /* channel already exists */
  }
  channelReady = true;
}

/** Ask for POST_NOTIFICATIONS (Android 13+) / iOS notification permission. */
export async function requestNotificationPermission(): Promise<boolean> {
  if (!isNative()) return false;
  try {
    const LocalNotifications = await plugin();
    const current = await LocalNotifications.checkPermissions();
    if (current.display === 'granted') return true;
    const result = await LocalNotifications.requestPermissions();
    return result.display === 'granted';
  } catch {
    return false;
  }
}

/** Create / update the ongoing step-tracking notification. */
export async function showStepNotification(steps: number, goal?: number) {
  if (!isNative()) return;
  try {
    const LocalNotifications = await plugin();
    await ensureChannel();
    const body = goal
      ? `${steps.toLocaleString()} steps · ${Math.min(100, Math.round((steps / goal) * 100))}% of goal`
      : `${steps.toLocaleString()} steps counted`;

    await LocalNotifications.schedule({
      notifications: [
        {
          id: STEP_NOTIFICATION_ID,
          channelId: CHANNEL_ID,
          title: 'Healthy Hub · Tracking steps',
          body,
          smallIcon: 'ic_stat_healthyhub',
          iconColor: '#CCFF00',
          ongoing: true,
          autoCancel: false,
        },
      ],
    });
  } catch {
    /* notification failures must never break tracking */
  }
}

/** Remove the ongoing step-tracking notification. */
export async function clearStepNotification() {
  if (!isNative()) return;
  try {
    const LocalNotifications = await plugin();
    await LocalNotifications.cancel({ notifications: [{ id: STEP_NOTIFICATION_ID }] });
  } catch {
    /* noop */
  }
}
