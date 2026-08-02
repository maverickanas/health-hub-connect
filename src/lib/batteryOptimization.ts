/**
 * Battery-optimization (Doze / App Standby) exemption helper.
 *
 * Android aggressively suspends apps once the screen turns off. Without this
 * exemption, sensor listeners and the ongoing notification stop updating.
 * No-ops on web and on iOS (where the concept does not exist).
 */
import { Capacitor, registerPlugin } from '@capacitor/core';

interface BatteryOptimizationPlugin {
  isIgnoringBatteryOptimizations(): Promise<{ granted: boolean }>;
  requestIgnoreBatteryOptimizations(): Promise<{ granted: boolean; prompted?: boolean }>;
  openBatterySettings(): Promise<void>;
}

const BatteryOptimization = registerPlugin<BatteryOptimizationPlugin>('BatteryOptimization');

const isAndroidNative = () => {
  try {
    return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
  } catch {
    return false;
  }
};

export async function isBatteryOptimizationDisabled(): Promise<boolean> {
  if (!isAndroidNative()) return true;
  try {
    const { granted } = await BatteryOptimization.isIgnoringBatteryOptimizations();
    return granted;
  } catch {
    return false;
  }
}

/**
 * Prompts the user with the system "allow background activity" dialog.
 * Returns true only when the exemption is already (or immediately) granted.
 */
export async function requestBatteryOptimizationExemption(): Promise<boolean> {
  if (!isAndroidNative()) return true;
  try {
    if (await isBatteryOptimizationDisabled()) return true;
    const { granted } = await BatteryOptimization.requestIgnoreBatteryOptimizations();
    return granted;
  } catch {
    return false;
  }
}

export async function openBatterySettings(): Promise<void> {
  if (!isAndroidNative()) return;
  try {
    await BatteryOptimization.openBatterySettings();
  } catch {
    /* noop */
  }
}
