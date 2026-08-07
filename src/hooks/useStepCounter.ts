import { useState, useEffect, useRef, useCallback } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { showStepNotification, clearStepNotification, requestNotificationPermission } from '@/lib/liveNotification';
import {
  requestBatteryOptimizationExemption,
  isBatteryOptimizationDisabled,
  openBatterySettings,
} from '@/lib/batteryOptimization';
import {
  isNativeAndroid,
  nativeTrackingAvailable,
  nativeMotionGranted,
  requestNativeTrackingPermissions,
  startNativeWorkout,
  stopNativeWorkout,
  onWorkoutUpdate,
  syncNativeWorkout,
  nativeWorkoutRunning,
} from '@/lib/backgroundTracker';


interface StepCounterState {
  steps: number;
  isActive: boolean;
  isSupported: boolean;
  permissionState: 'prompt' | 'requesting' | 'granted' | 'denied' | 'unsupported';
  /** Which sensor pipeline is currently feeding the counter. */
  source: 'none' | 'native' | 'motion';
  /** False when Android battery optimization may kill background tracking. */
  batteryUnrestricted: boolean;
}

interface UseStepCounterOptions {
  userId?: string;
  onStepUpdate?: (steps: number) => void;
  onSessionSaved?: (totalSteps: number) => void;
}

const STEP_MAGNITUDE_THRESHOLD = 12; // m/s² — peak above this counts as a step impact
const STEP_DEBOUNCE_MS = 300; // min interval between steps
const NATIVE_WATCHDOG_MS = 4000; // native service must report in within this window

export function useStepCounter(options: UseStepCounterOptions | ((steps: number) => void) = {}) {
  // Backward compat: allow passing a callback directly
  const opts: UseStepCounterOptions =
    typeof options === 'function' ? { onStepUpdate: options } : options;
  const { userId, onStepUpdate, onSessionSaved } = opts;


  const [state, setState] = useState<StepCounterState>({
    steps: 0,
    isActive: false,
    isSupported:
      isNativeAndroid() ||
      (typeof window !== 'undefined' && typeof DeviceMotionEvent !== 'undefined'),
    permissionState: 'prompt',
    source: 'none',
    batteryUnrestricted: true,
  });


  // Native: reflect the real hardware + ACTIVITY_RECOGNITION state on mount so
  // Start is enabled the moment the OS permission is already granted.
  useEffect(() => {
    if (!isNativeAndroid()) return;
    let cancelled = false;
    (async () => {
      const hardware = await nativeTrackingAvailable();
      const granted = hardware && (await nativeMotionGranted());
      if (cancelled) return;
      setState(prev => ({
        ...prev,
        isSupported: hardware || prev.isSupported,
        permissionState: granted ? 'granted' : prev.permissionState,
      }));
    })();
    return () => {
      cancelled = true;
    };
  }, []);


  const stepsRef = useRef(0);
  const lastStepTimeRef = useRef(0);
  const aboveThresholdRef = useRef(false);
  const handlerRef = useRef<((e: DeviceMotionEvent) => void) | null>(null);
  const nativeUnsubRef = useRef<(() => void) | null>(null);
  const nativeAliveRef = useRef(false);
  const watchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const applyNativeUpdate = useCallback((u: Parameters<Parameters<typeof onWorkoutUpdate>[0]>[0]) => {
    nativeAliveRef.current = true;
    if (watchdogRef.current) {
      clearTimeout(watchdogRef.current);
      watchdogRef.current = null;
    }
    stepsRef.current = u.steps;
    setState(prev => ({
      ...prev,
      steps: u.steps,
      isActive: u.event !== 'stop',
      source: u.event === 'stop' ? 'none' : 'native',
    }));
  }, []);

  // Reconnect to a foreground service that survived WebView suspension or app
  // recreation, then request an immediate snapshot so the UI never shows zero.
  useEffect(() => {
    if (!isNativeAndroid()) return;
    let cancelled = false;
    void (async () => {
      const running = await nativeWorkoutRunning();
      if (!running || cancelled) return;
      nativeUnsubRef.current?.();
      nativeUnsubRef.current = await onWorkoutUpdate(applyNativeUpdate);
      if (!cancelled) await syncNativeWorkout();
    })();
    return () => { cancelled = true; };
  }, [applyNativeUpdate]);

  // Android may freeze the WebView while minimized. Pull the authoritative
  // native count as soon as the document becomes visible again.
  useEffect(() => {
    if (!isNativeAndroid()) return;
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') void syncNativeWorkout();
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);


  const handleMotion = useCallback((event: DeviceMotionEvent) => {
    const acc = event.accelerationIncludingGravity;
    if (!acc || acc.x == null || acc.y == null || acc.z == null) return;

    const magnitude = Math.sqrt(acc.x * acc.x + acc.y * acc.y + acc.z * acc.z);
    const now = Date.now();

    // Rising edge detection with fixed threshold + debounce
    if (magnitude > STEP_MAGNITUDE_THRESHOLD && !aboveThresholdRef.current) {
      aboveThresholdRef.current = true;
      if (now - lastStepTimeRef.current > STEP_DEBOUNCE_MS) {
        lastStepTimeRef.current = now;
        stepsRef.current += 1;
        setState(prev => ({ ...prev, steps: stepsRef.current }));
      }
    } else if (magnitude < STEP_MAGNITUDE_THRESHOLD - 1.5 && aboveThresholdRef.current) {
      aboveThresholdRef.current = false;
    }
  }, []);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!state.isSupported) {
      setState(prev => ({ ...prev, permissionState: 'unsupported' }));
      toast.error('Hardware motion sensors are not supported or permitted on this browser.');
      return false;
    }

    setState(prev => ({ ...prev, permissionState: 'requesting' as any }));

    // Android native: ACTIVITY_RECOGNITION is mandatory for the hardware
    // pedometer — without it the foreground service registers no sensor.
    if (isNativeAndroid()) {
      const res = await requestNativeTrackingPermissions();
      if (!res.activity) {
        setState(prev => ({ ...prev, permissionState: 'denied' }));
        toast.error('Motion & fitness permission is required to count steps. Enable it in app settings.');
        return false;
      }
      setState(prev => ({ ...prev, permissionState: 'granted' }));
      return true;
    }



    // iOS 13+ requires explicit permission
    if (typeof (DeviceMotionEvent as any).requestPermission === 'function') {
      try {
        const permission = await (DeviceMotionEvent as any).requestPermission();
        if (permission !== 'granted') {
          setState(prev => ({ ...prev, permissionState: 'denied' }));
          toast.error('Hardware motion sensors are not supported or permitted on this browser.');
          return false;
        }
      } catch {
        setState(prev => ({ ...prev, permissionState: 'denied' }));
        toast.error('Hardware motion sensors are not supported or permitted on this browser.');
        return false;
      }
    }

    setState(prev => ({ ...prev, permissionState: 'granted' }));
    return true;
  }, [state.isSupported]);

  const attachMotionFallback = useCallback(() => {
    if (handlerRef.current) return;
    handlerRef.current = handleMotion;
    window.addEventListener('devicemotion', handleMotion);
    setState(prev => ({ ...prev, isActive: true, source: 'motion' }));
    showStepNotification(stepsRef.current);
  }, [handleMotion]);

  const start = useCallback(async () => {
    if (state.permissionState !== 'granted') {
      const ok = await requestPermission();
      if (!ok) return;
    }
    // Ongoing notification keeps the app alive in the background on native.
    requestNotificationPermission().catch(() => {});
    // Doze/App Standby exemption — without it the sensor stream and the
    // notification stop updating shortly after the screen turns off.
    (async () => {
      const ok = await requestBatteryOptimizationExemption().catch(() => false);
      setState(prev => ({ ...prev, batteryUnrestricted: ok }));
      if (!ok && isNativeAndroid()) {
        toast.warning('Set battery usage to "Unrestricted" so step tracking keeps running in the background.', {
          action: { label: 'Open settings', onClick: () => { void openBatterySettings(); } },
        });
      }
    })();

    // Preferred path: hardware pedometer inside the foreground service. The JS
    // thread can be frozen and the count keeps advancing natively. Requires the
    // motion / activity-recognition permission — without it the service
    // registers no sensor and the counter would sit at zero forever.
    if (isNativeAndroid() && (await nativeMotionGranted())) {
      // Subscribe before starting. The service emits its initial/restored state
      // immediately, so subscribing afterwards can miss it and display zero.
      nativeAliveRef.current = false;
      nativeUnsubRef.current?.();
      nativeUnsubRef.current = await onWorkoutUpdate(applyNativeUpdate);
      const started = await startNativeWorkout();
      if (started) {
        setState(prev => ({ ...prev, isActive: true, source: 'native' }));

        // Watchdog: if the foreground service never reports back (sensor
        // missing, OEM restriction, service killed), silently switch to the
        // accelerometer pipeline so the user still gets a live count.
        watchdogRef.current = setTimeout(() => {
          if (!nativeAliveRef.current) {
            nativeUnsubRef.current?.();
            nativeUnsubRef.current = null;
            void stopNativeWorkout();
            attachMotionFallback();
          }
        }, NATIVE_WATCHDOG_MS);
        return;
      }
    }

    // Web / no-pedometer / permission-less fallback: DeviceMotion in the JS thread.
    attachMotionFallback();
  }, [state.permissionState, requestPermission, attachMotionFallback, applyNativeUpdate]);


  const persistSteps = useCallback(async (sessionSteps: number) => {
    if (!userId || sessionSteps <= 0) return;
    const today = new Date().toISOString().slice(0, 10);

    try {
      // Read existing row to compute new total
      const { data: existing } = await supabase
        .from('activity_data')
        .select('steps')
        .eq('user_id', userId)
        .eq('date', today)
        .maybeSingle();

      const newTotal = (existing?.steps ?? 0) + sessionSteps;

      const { error } = await supabase
        .from('activity_data')
        .upsert(
          { user_id: userId, date: today, steps: newTotal },
          { onConflict: 'user_id,date' }
        );

      if (error) throw error;
      onSessionSaved?.(newTotal);
      toast.success(`Saved ${sessionSteps.toLocaleString()} steps`);
    } catch (err) {
      console.error('Failed to persist steps:', err);
      toast.error('Could not save your steps. Please try again.');
    }
  }, [userId, onSessionSaved]);

  const stop = useCallback(async () => {
    if (watchdogRef.current) {
      clearTimeout(watchdogRef.current);
      watchdogRef.current = null;
    }
    if (handlerRef.current) {
      window.removeEventListener('devicemotion', handlerRef.current);
      handlerRef.current = null;
    }
    if (nativeUnsubRef.current) {
      nativeUnsubRef.current();
      nativeUnsubRef.current = null;
    }
    await stopNativeWorkout();
    const sessionSteps = stepsRef.current;
    setState(prev => ({ ...prev, isActive: false, source: 'none' }));

    clearStepNotification();
    await persistSteps(sessionSteps);
    // Auto-reset local tracker so the next session starts fresh from 0
    stepsRef.current = 0;
    aboveThresholdRef.current = false;
    lastStepTimeRef.current = 0;
    setState(prev => ({ ...prev, steps: 0 }));
  }, [persistSteps]);

  const reset = useCallback(() => {
    stepsRef.current = 0;
    aboveThresholdRef.current = false;
    lastStepTimeRef.current = 0;
    setState(prev => ({ ...prev, steps: 0 }));
  }, []);

  // Calibrate: detach listener, reset detection state (no save), reattach if previously active
  const calibrate = useCallback(async () => {
    const wasActive = !!handlerRef.current;
    if (handlerRef.current) {
      window.removeEventListener('devicemotion', handlerRef.current);
      handlerRef.current = null;
    }
    stepsRef.current = 0;
    aboveThresholdRef.current = false;
    lastStepTimeRef.current = 0;
    setState(prev => ({ ...prev, steps: 0, isActive: false }));

    if (wasActive) {
      // Brief pause so the sensor stream resets cleanly
      await new Promise(r => setTimeout(r, 150));
      handlerRef.current = handleMotion;
      window.addEventListener('devicemotion', handleMotion);
      setState(prev => ({ ...prev, isActive: true }));
    }
    toast.success('Step detection calibrated');
  }, [handleMotion]);

  // Propagate live step updates to consumer
  useEffect(() => {
    if (state.steps > 0 && onStepUpdate) {
      onStepUpdate(state.steps);
    }
  }, [state.steps, onStepUpdate]);

  // Keep the ongoing notification in sync (throttled to every 10 steps)
  useEffect(() => {
    if (state.isActive && state.steps > 0 && state.steps % 10 === 0) {
      showStepNotification(state.steps);
    }
  }, [state.isActive, state.steps]);

  // Heartbeat: refresh the ongoing notification every 15s even when the step
  // count is unchanged, so it stays "live" while the screen is off.
  useEffect(() => {
    if (!state.isActive) return;
    const id = setInterval(() => showStepNotification(stepsRef.current), 15000);
    return () => clearInterval(id);
  }, [state.isActive]);


  // Battery-restriction status (Android): surfaced so the UI can nudge the user
  // to switch battery usage to "Unrestricted".
  const refreshBatteryStatus = useCallback(async () => {
    const ok = await isBatteryOptimizationDisabled().catch(() => false);
    setState(prev => ({ ...prev, batteryUnrestricted: ok }));
    return ok;
  }, []);

  useEffect(() => {
    void refreshBatteryStatus();
  }, [refreshBatteryStatus]);

  const fixBatteryRestriction = useCallback(async () => {
    const ok = await requestBatteryOptimizationExemption().catch(() => false);
    if (!ok) await openBatterySettings();
    await refreshBatteryStatus();
  }, [refreshBatteryStatus]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (watchdogRef.current) clearTimeout(watchdogRef.current);
      if (handlerRef.current) {
        window.removeEventListener('devicemotion', handlerRef.current);
        clearStepNotification();
      }
      nativeUnsubRef.current?.();
      nativeUnsubRef.current = null;
    };
  }, []);

  return {
    ...state,
    start,
    stop,
    reset,
    calibrate,
    requestPermission,
    fixBatteryRestriction,
    refreshBatteryStatus,
  };

}
