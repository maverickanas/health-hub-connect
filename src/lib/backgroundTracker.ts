/**
 * Native background workout tracking bridge.
 *
 * Android: talks to the `WorkoutTracker` Capacitor plugin, which runs a
 * persistent foreground service holding a partial wakelock and reading the
 * hardware pedometer (Sensor.TYPE_STEP_COUNTER). Steps keep accumulating while
 * the app is backgrounded or the screen is off; the JS layer only *renders*
 * what the service reports.
 *
 * iOS: falls back to no-op until the ActivityKit extension is added
 * (see docs/ios-live-activities.md).
 *
 * Web: no-op — callers keep their existing DeviceMotion fallback.
 */
import { Capacitor, registerPlugin } from '@capacitor/core';

export interface WorkoutUpdate {
  event: 'start' | 'step' | 'pause' | 'resume' | 'stop' | 'metrics';
  steps: number;
  distanceKm: number;
  calories: number;
  elapsedSeconds: number;
  paused: boolean;
}

interface WorkoutTrackerPlugin {
  isAvailable(): Promise<{
    hardwareStepCounter: boolean;
    activityRecognitionGranted: boolean;
    running: boolean;
  }>;
  requestTrackingPermissions(): Promise<{
    activity: boolean;
    notifications: boolean;
    camera: boolean;
  }>;
  start(): Promise<void>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  stop(): Promise<void>;
  updateMetrics(opts: { distanceKm: number; calories: number; eta?: string }): Promise<void>;
  addListener(
    event: 'workoutUpdate',
    cb: (data: WorkoutUpdate) => void
  ): Promise<{ remove: () => void }>;
}

const WorkoutTracker = registerPlugin<WorkoutTrackerPlugin>('WorkoutTracker');

export const isNativeAndroid = () => {
  try {
    return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
  } catch {
    return false;
  }
};

/** True when the device exposes a hardware pedometer (regardless of permission). */
export async function nativeTrackingAvailable(): Promise<boolean> {
  if (!isNativeAndroid()) return false;
  try {
    const r = await WorkoutTracker.isAvailable();
    return r.hardwareStepCounter;
  } catch {
    return false;
  }
}

/** Has the mandatory motion / activity-recognition permission been granted? */
export async function nativeMotionGranted(): Promise<boolean> {
  if (!isNativeAndroid()) return false;
  try {
    const r = await WorkoutTracker.isAvailable();
    return r.hardwareStepCounter && r.activityRecognitionGranted;
  } catch {
    return false;
  }
}

/**
 * Prompts for motion (activity recognition), notifications and camera.
 * Motion is mandatory — the hardware pedometer cannot start without it.
 */
export async function requestNativeTrackingPermissions(): Promise<{
  activity: boolean;
  notifications: boolean;
  camera: boolean;
}> {
  if (!isNativeAndroid()) {
    return { activity: false, notifications: false, camera: false };
  }
  try {
    return await WorkoutTracker.requestTrackingPermissions();
  } catch {
    return { activity: false, notifications: false, camera: false };
  }
}


export async function startNativeWorkout(): Promise<boolean> {
  if (!isNativeAndroid()) return false;
  try {
    await WorkoutTracker.start();
    return true;
  } catch {
    return false;
  }
}

export async function stopNativeWorkout(): Promise<void> {
  if (!isNativeAndroid()) return;
  try {
    await WorkoutTracker.stop();
  } catch {
    /* noop */
  }
}

export async function pauseNativeWorkout(): Promise<void> {
  if (!isNativeAndroid()) return;
  try {
    await WorkoutTracker.pause();
  } catch {
    /* noop */
  }
}

export async function resumeNativeWorkout(): Promise<void> {
  if (!isNativeAndroid()) return;
  try {
    await WorkoutTracker.resume();
  } catch {
    /* noop */
  }
}

/** Feed GPS-derived distance / kcal / ETA into the ongoing notification. */
export async function updateNativeMetrics(opts: {
  distanceKm: number;
  calories: number;
  eta?: string;
}): Promise<void> {
  if (!isNativeAndroid()) return;
  try {
    await WorkoutTracker.updateMetrics({ eta: '--', ...opts });
  } catch {
    /* noop */
  }
}

/** Subscribe to live updates emitted by the foreground service. */
export async function onWorkoutUpdate(
  cb: (u: WorkoutUpdate) => void
): Promise<() => void> {
  if (!isNativeAndroid()) return () => {};
  try {
    const handle = await WorkoutTracker.addListener('workoutUpdate', cb);
    return () => handle.remove();
  } catch {
    return () => {};
  }
}
