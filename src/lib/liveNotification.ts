/**
 * Ongoing "live activity" notifications for native builds.
 *
 * Two persistent channels:
 *  - Step tracking  → live step count + goal progress
 *  - Route tracking → live distance / duration / calories
 *
 * Both are posted as ongoing (non-dismissable) notifications so the OS keeps
 * the app alive with the screen off, and both are configured for expanded,
 * heads-up and lock-screen presentation. On devices that surface ongoing
 * notifications as a status-bar chip / pill ("island"), the short title plus
 * monochrome small icon is what gets rendered there.
 *
 * All functions are no-ops on the web build.
 */
import { Capacitor } from '@capacitor/core';

const STEP_NOTIFICATION_ID = 4201;
const ROUTE_NOTIFICATION_ID = 4202;
const CHANNEL_ID = 'healthyhub_live_v2';
const GROUP_ID = 'healthyhub_live_group';

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
      description: 'Ongoing step and route tracking',
      // 4 = HIGH → allows heads-up on the first post and a status-bar chip on
      // devices that support ongoing-activity pills. Sound/vibration are off,
      // so repeated updates stay silent.
      importance: 4,
      // 1 = VISIBILITY_PUBLIC → full content shown on the lock screen.
      visibility: 1,
      lights: false,
      vibration: false,
      sound: undefined,
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

function progressBar(pct: number): string {
  const filled = Math.max(0, Math.min(10, Math.round(pct / 10)));
  return `${'▰'.repeat(filled)}${'▱'.repeat(10 - filled)}`;
}

/** Create / update the ongoing step-tracking notification. */
export async function showStepNotification(steps: number, goal?: number) {
  if (!isNative()) return;
  try {
    const LocalNotifications = await plugin();
    await ensureChannel();

    const pct = goal ? Math.min(100, Math.round((steps / goal) * 100)) : 0;
    const short = goal
      ? `${steps.toLocaleString()} steps · ${pct}%`
      : `${steps.toLocaleString()} steps`;
    const expanded = goal
      ? `${progressBar(pct)}  ${pct}%\n${steps.toLocaleString()} of ${goal.toLocaleString()} steps`
      : `${steps.toLocaleString()} steps counted this session`;

    await LocalNotifications.schedule({
      notifications: [
        {
          id: STEP_NOTIFICATION_ID,
          channelId: CHANNEL_ID,
          title: 'Healthy Hub · Steps',
          body: short,
          // Expanded (BigText) content shown when the user pulls the shade down.
          largeBody: expanded,
          summaryText: 'Live step tracking',
          smallIcon: 'ic_stat_healthyhub',
          iconColor: '#CCFF00',
          group: GROUP_ID,
          ongoing: true,
          autoCancel: false,
          silent: true,
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

/** Create / update the ongoing route (GPS workout) notification. */
export async function showRouteNotification(opts: {
  distanceKm: number;
  seconds: number;
  calories: number;
  paused?: boolean;
  mode?: string;
}) {
  if (!isNative()) return;
  try {
    const LocalNotifications = await plugin();
    await ensureChannel();

    const m = Math.floor(opts.seconds / 60);
    const s = opts.seconds % 60;
    const time = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    const km = opts.distanceKm.toFixed(2);
    const pace =
      opts.distanceKm > 0.05 ? `${(opts.seconds / 60 / opts.distanceKm).toFixed(1)} min/km` : '--';

    await LocalNotifications.schedule({
      notifications: [
        {
          id: ROUTE_NOTIFICATION_ID,
          channelId: CHANNEL_ID,
          title: opts.paused ? 'Healthy Hub · Paused' : 'Healthy Hub · Route',
          body: `${km} km · ${time}`,
          largeBody: `${km} km · ${time}\n${opts.calories} kcal · ${pace}`,
          summaryText: opts.mode ? `Live ${opts.mode} tracking` : 'Live route tracking',
          smallIcon: 'ic_stat_healthyhub',
          iconColor: '#CCFF00',
          group: GROUP_ID,
          ongoing: true,
          autoCancel: false,
          silent: true,
        },
      ],
    });
  } catch {
    /* noop */
  }
}

/** Remove the ongoing route notification. */
export async function clearRouteNotification() {
  if (!isNative()) return;
  try {
    const LocalNotifications = await plugin();
    await LocalNotifications.cancel({ notifications: [{ id: ROUTE_NOTIFICATION_ID }] });
  } catch {
    /* noop */
  }
}
