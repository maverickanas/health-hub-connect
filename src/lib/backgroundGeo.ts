/**
 * Unified geolocation wrapper.
 *
 * - On native (Capacitor): uses @capacitor-community/background-geolocation,
 *   which keeps emitting GPS updates while the app is backgrounded / screen off,
 *   via an Android foreground service notification.
 * - On web: falls back to navigator.geolocation.watchPosition.
 *
 * The API mirrors a subset of the W3C Geolocation API so consumers can swap
 * cleanly without restructuring their code.
 */

export interface GeoSample {
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  heading?: number | null;
  speed?: number | null;
  timestamp: number;
}

export type GeoErrorCode = 'permission' | 'unavailable' | 'timeout' | 'unknown';

export interface GeoError {
  code: GeoErrorCode;
  message: string;
}

export type GeoWatcherId = string | number;

const isNative = (): boolean => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { Capacitor } = require('@capacitor/core');
    return Capacitor?.isNativePlatform?.() === true;
  } catch {
    return false;
  }
};

async function getNativePlugin(): Promise<any> {
  const { registerPlugin } = await import('@capacitor/core');
  return registerPlugin('BackgroundGeolocation');
}

export async function startWatch(
  onUpdate: (sample: GeoSample) => void,
  onError: (err: GeoError) => void,
): Promise<GeoWatcherId | null> {
  if (isNative()) {
    try {
      const BackgroundGeolocation = await getNativePlugin();
      const id = await BackgroundGeolocation.addWatcher(
        {
          backgroundMessage: 'Tracking your workout in the background',
          backgroundTitle: 'HEALTHY.HUB · Workout in progress',
          requestPermissions: true,
          stale: false,
          distanceFilter: 3, // meters
        },
        (location, err) => {
          if (err) {
            if (err.code === 'NOT_AUTHORIZED') {
              onError({ code: 'permission', message: 'Location permission denied' });
            } else {
              onError({ code: 'unknown', message: err.message ?? 'GPS error' });
            }
            return;
          }
          if (!location) return;
          onUpdate({
            latitude: location.latitude,
            longitude: location.longitude,
            accuracy: location.accuracy,
            heading: location.bearing ?? null,
            speed: location.speed ?? null,
            timestamp: location.time ?? Date.now(),
          });
        },
      );
      return id;
    } catch (e: any) {
      onError({ code: 'unknown', message: e?.message ?? 'Failed to start tracker' });
      return null;
    }
  }

  // Web fallback
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    onError({ code: 'unavailable', message: 'GPS not available on this device' });
    return null;
  }
  const id = navigator.geolocation.watchPosition(
    (pos) => {
      onUpdate({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
        heading: pos.coords.heading,
        speed: pos.coords.speed,
        timestamp: pos.timestamp,
      });
    },
    (err) => {
      const code: GeoErrorCode =
        err.code === 1 ? 'permission' : err.code === 2 ? 'unavailable' : 'timeout';
      onError({ code, message: err.message });
    },
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 },
  );
  return id;
}

export async function stopWatch(id: GeoWatcherId | null): Promise<void> {
  if (id == null) return;
  if (isNative()) {
    try {
      const BackgroundGeolocation = (
        await import('@capacitor-community/background-geolocation')
      ).default;
      await BackgroundGeolocation.removeWatcher({ id: String(id) });
    } catch {
      /* noop */
    }
    return;
  }
  if (typeof navigator !== 'undefined' && navigator.geolocation) {
    navigator.geolocation.clearWatch(id as number);
  }
}

export async function getCurrent(): Promise<GeoSample> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject({ code: 'unavailable', message: 'GPS not available' } as GeoError);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          heading: pos.coords.heading,
          speed: pos.coords.speed,
          timestamp: pos.timestamp,
        }),
      (err) => {
        const code: GeoErrorCode =
          err.code === 1 ? 'permission' : err.code === 2 ? 'unavailable' : 'timeout';
        reject({ code, message: err.message } as GeoError);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 },
    );
  });
}
