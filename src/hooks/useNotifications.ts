import { useEffect, useRef, useCallback } from 'react';

interface NotificationConfig {
  waterIntervalMinutes: number;
  stepCheckIntervalMinutes: number;
  stepGoal: number;
  currentSteps: number;
  hydration: number;
  hydrationGoal: number;
  enabled: boolean;
}

export function useNotifications(config: NotificationConfig) {
  const waterTimerRef = useRef<ReturnType<typeof setInterval>>();
  const stepTimerRef = useRef<ReturnType<typeof setInterval>>();
  const permissionRef = useRef<NotificationPermission>('default');

  const requestPermission = useCallback(async () => {
    if (!('Notification' in window)) return false;
    if (Notification.permission === 'granted') {
      permissionRef.current = 'granted';
      return true;
    }
    if (Notification.permission === 'denied') {
      permissionRef.current = 'denied';
      return false;
    }
    const result = await Notification.requestPermission();
    permissionRef.current = result;
    return result === 'granted';
  }, []);

  const sendNotification = useCallback((title: string, body: string, icon?: string) => {
    if (permissionRef.current !== 'granted') return;
    try {
      new Notification(title, {
        body,
        icon: icon || '/favicon.ico',
        badge: '/favicon.ico',
        tag: title.toLowerCase().replace(/\s/g, '-'),
        renotify: true,
      });
    } catch {
      // Fallback: some browsers don't support Notification constructor
    }
  }, []);

  // Water reminders
  useEffect(() => {
    if (!config.enabled) return;
    
    waterTimerRef.current = setInterval(() => {
      if (config.hydration < config.hydrationGoal) {
        const remaining = (config.hydrationGoal - config.hydration).toFixed(1);
        sendNotification(
          '💧 Hydration Reminder',
          `You've had ${config.hydration.toFixed(1)}L today. Drink ${remaining}L more to reach your goal!`
        );
      }
    }, config.waterIntervalMinutes * 60 * 1000);

    return () => clearInterval(waterTimerRef.current);
  }, [config.enabled, config.waterIntervalMinutes, config.hydration, config.hydrationGoal, sendNotification]);

  // Step goal reminders
  useEffect(() => {
    if (!config.enabled) return;

    stepTimerRef.current = setInterval(() => {
      const progress = Math.round((config.currentSteps / config.stepGoal) * 100);
      if (config.currentSteps < config.stepGoal) {
        const remaining = (config.stepGoal - config.currentSteps).toLocaleString();
        sendNotification(
          '🏃 Step Goal Reminder',
          `${progress}% done! Just ${remaining} more steps to crush your goal. Keep moving!`
        );
      }
    }, config.stepCheckIntervalMinutes * 60 * 1000);

    return () => clearInterval(stepTimerRef.current);
  }, [config.enabled, config.stepCheckIntervalMinutes, config.currentSteps, config.stepGoal, sendNotification]);

  return { requestPermission, sendNotification };
}
