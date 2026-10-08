import { registerPlugin } from '@capacitor/core';

export interface NativeSetupPlugin {
	isBackgroundLocationGranted(): Promise<{ granted: boolean }>;
	isBatteryOptimizationIgnored(): Promise<{ ignored: boolean }>;
	requestIgnoreBatteryOptimizations(): Promise<void>;
}

export const NativeSetup = registerPlugin<NativeSetupPlugin>('NativeSetup');

// Single registration lives in location-provider.ts (registering twice warns).
export { openAppSettings } from './location-provider';
