import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
	appId: 'io.minimo.geoalarm',
	appName: 'Geo Alarm',
	webDir: 'build',
	android: {
		// Required by @capacitor-community/background-geolocation: keeps location
		// updates flowing after 5 minutes in the background.
		useLegacyBridge: true
	},
	plugins: {
		LocalNotifications: {
			// Default channel sound (Android 8+ locks it at first install).
			sound: 'geoalarm_beep.wav'
		}
	}
};

export default config;
