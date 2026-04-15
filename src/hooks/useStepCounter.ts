import { useState, useEffect, useRef, useCallback } from 'react';

interface StepCounterState {
  steps: number;
  isActive: boolean;
  isSupported: boolean;
  permissionState: 'prompt' | 'granted' | 'denied' | 'unsupported';
}

export function useStepCounter(onStepUpdate?: (steps: number) => void) {
  const [state, setState] = useState<StepCounterState>({
    steps: 0,
    isActive: false,
    isSupported: typeof DeviceMotionEvent !== 'undefined',
    permissionState: 'prompt',
  });

  const stepsRef = useRef(0);
  const lastAccelRef = useRef<{ x: number; y: number; z: number } | null>(null);
  const lastStepTimeRef = useRef(0);
  const magnitudeHistoryRef = useRef<number[]>([]);
  const thresholdRef = useRef(1.2); // adaptive threshold
  const aboveThresholdRef = useRef(false);

  const handleMotion = useCallback((event: DeviceMotionEvent) => {
    const acc = event.accelerationIncludingGravity;
    if (!acc || acc.x === null || acc.y === null || acc.z === null) return;

    const { x, y, z } = acc;

    // Calculate magnitude of acceleration vector
    const magnitude = Math.sqrt(x * x + y * y + z * z);

    // Keep a rolling window for adaptive threshold
    const history = magnitudeHistoryRef.current;
    history.push(magnitude);
    if (history.length > 50) history.shift();

    // Calculate average magnitude
    const avg = history.reduce((a, b) => a + b, 0) / history.length;

    // Peak detection with debounce
    const now = Date.now();
    const timeSinceLastStep = now - lastStepTimeRef.current;

    // A step is detected when magnitude crosses above threshold then back below
    const dynamicThreshold = avg + 1.8;

    if (magnitude > dynamicThreshold && !aboveThresholdRef.current) {
      aboveThresholdRef.current = true;
    } else if (magnitude < avg + 0.5 && aboveThresholdRef.current) {
      aboveThresholdRef.current = false;

      // Debounce: min 250ms between steps (max ~4 steps/sec for running)
      if (timeSinceLastStep > 250) {
        lastStepTimeRef.current = now;
        stepsRef.current += 1;
        setState(prev => ({ ...prev, steps: stepsRef.current }));
      }
    }

    lastAccelRef.current = { x, y, z };
  }, []);

  const start = useCallback(async () => {
    if (!state.isSupported) {
      setState(prev => ({ ...prev, permissionState: 'unsupported' }));
      return;
    }

    // iOS 13+ requires permission
    if (typeof (DeviceMotionEvent as any).requestPermission === 'function') {
      try {
        const permission = await (DeviceMotionEvent as any).requestPermission();
        if (permission !== 'granted') {
          setState(prev => ({ ...prev, permissionState: 'denied' }));
          return;
        }
      } catch {
        setState(prev => ({ ...prev, permissionState: 'denied' }));
        return;
      }
    }

    window.addEventListener('devicemotion', handleMotion);
    setState(prev => ({ ...prev, isActive: true, permissionState: 'granted' }));
  }, [state.isSupported, handleMotion]);

  const stop = useCallback(() => {
    window.removeEventListener('devicemotion', handleMotion);
    setState(prev => ({ ...prev, isActive: false }));
  }, [handleMotion]);

  const reset = useCallback(() => {
    stepsRef.current = 0;
    magnitudeHistoryRef.current = [];
    aboveThresholdRef.current = false;
    setState(prev => ({ ...prev, steps: 0 }));
  }, []);

  // Propagate step updates
  useEffect(() => {
    if (state.steps > 0 && onStepUpdate) {
      onStepUpdate(state.steps);
    }
  }, [state.steps, onStepUpdate]);

  // Cleanup
  useEffect(() => {
    return () => {
      window.removeEventListener('devicemotion', handleMotion);
    };
  }, [handleMotion]);

  return { ...state, start, stop, reset };
}
