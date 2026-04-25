import { useState, useEffect, useRef, useCallback } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface StepCounterState {
  steps: number;
  isActive: boolean;
  isSupported: boolean;
  permissionState: 'prompt' | 'requesting' | 'granted' | 'denied' | 'unsupported';
}

interface UseStepCounterOptions {
  userId?: string;
  onStepUpdate?: (steps: number) => void;
  onSessionSaved?: (totalSteps: number) => void;
}

const STEP_MAGNITUDE_THRESHOLD = 12; // m/s² — peak above this counts as a step impact
const STEP_DEBOUNCE_MS = 300; // min interval between steps

export function useStepCounter(options: UseStepCounterOptions | ((steps: number) => void) = {}) {
  // Backward compat: allow passing a callback directly
  const opts: UseStepCounterOptions =
    typeof options === 'function' ? { onStepUpdate: options } : options;
  const { userId, onStepUpdate, onSessionSaved } = opts;

  const [state, setState] = useState<StepCounterState>({
    steps: 0,
    isActive: false,
    isSupported: typeof window !== 'undefined' && typeof DeviceMotionEvent !== 'undefined',
    permissionState: 'prompt',
  });

  const stepsRef = useRef(0);
  const lastStepTimeRef = useRef(0);
  const aboveThresholdRef = useRef(false);
  const handlerRef = useRef<((e: DeviceMotionEvent) => void) | null>(null);

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

  const start = useCallback(async () => {
    if (state.permissionState !== 'granted') {
      const ok = await requestPermission();
      if (!ok) return;
    }
    handlerRef.current = handleMotion;
    window.addEventListener('devicemotion', handleMotion);
    setState(prev => ({ ...prev, isActive: true }));
  }, [state.permissionState, requestPermission, handleMotion]);

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
    if (handlerRef.current) {
      window.removeEventListener('devicemotion', handlerRef.current);
      handlerRef.current = null;
    }
    const sessionSteps = stepsRef.current;
    setState(prev => ({ ...prev, isActive: false }));
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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (handlerRef.current) {
        window.removeEventListener('devicemotion', handlerRef.current);
      }
    };
  }, []);

  return { ...state, start, stop, reset, calibrate, requestPermission };
}
