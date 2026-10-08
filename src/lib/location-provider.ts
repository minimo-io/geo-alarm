import { Capacitor, registerPlugin } from '@capacitor/core';
import type { BackgroundGeolocationPlugin } from '@capacitor-community/background-geolocation';
import type { LatLng } from './geo';

export type Position = LatLng & { accuracy: number };

const BgGeo = registerPlugin<BackgroundGeolocationPlugin>('BackgroundGeolocation');

/** Open the app's system settings page (the user picks "Allow all the time" there). */
export function openAppSettings(): Promise<void> {
	return BgGeo.openSettings();
}

/** True inside the native Android shell, false on the web PWA. */
export function isNative(): boolean {
	return Capacitor.isNativePlatform();
}

/**
 * Deliver position fixes to `onpos`. Web uses `watchPosition` (unchanged
 * behaviour); native uses the background-geolocation watcher, which keeps
 * delivering with the app backgrounded (Android foreground service).
 * Resolves to a stop function.
 */
export async function startPositionDelivery(onpos: (p: Position) => void): Promise<() => void> {
	if (!isNative()) {
		const id = navigator.geolocation.watchPosition(
			(p) =>
				onpos({
					lat: p.coords.latitude,
					lng: p.coords.longitude,
					accuracy: p.coords.accuracy
				}),
			undefined,
			{ enableHighAccuracy: true, maximumAge: 2_000, timeout: 20_000 }
		);
		return () => navigator.geolocation.clearWatch(id);
	}

	const watcherId = await BgGeo.addWatcher(
		{
			backgroundMessage: 'Geo Alarm is watching your points.',
			backgroundTitle: 'Geo Alarm is on',
			requestPermissions: true,
			stale: false,
			distanceFilter: 0
		},
		(loc, err) => {
			if (err || !loc) return;
			onpos({ lat: loc.latitude, lng: loc.longitude, accuracy: loc.accuracy });
		}
	);
	let stopped = false;
	return () => {
		if (stopped) return;
		stopped = true;
		void BgGeo.removeWatcher({ id: watcherId });
	};
}
