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

/** True only on Android. The NativeSetup plugin is Android-only Java. */
export function isAndroid(): boolean {
	return Capacitor.getPlatform() === 'android';
}

/**
 * Silent permission probe for cold start (native only). Adds a watcher with
 * `requestPermissions: false`, so the OS never prompts: granted permission
 * delivers a fix, anything else rejects (Android) or stays quiet (iOS).
 * Resolves true on the first fix, false after a short wait. Always cleans up.
 */
export function probeNativePermission(): Promise<boolean> {
	return new Promise((resolve) => {
		let done = false;
		let currentId: string | null = null;
		const finish = (v: boolean) => {
			if (!done) {
				done = true;
				resolve(v);
			}
		};
		const stop = (id: string | null) => {
			if (id !== null) void BgGeo.removeWatcher({ id }).catch(() => {});
		};
		void BgGeo.addWatcher(
			{
				backgroundMessage: 'Geo Alarm is watching your points.',
				backgroundTitle: 'Geo Alarm is on',
				requestPermissions: false,
				stale: false,
				distanceFilter: 0
			},
			(loc, err) => {
				if (loc && !err) {
					finish(true);
					stop(currentId);
				}
			}
		).then((id) => {
			currentId = id;
			if (done) stop(id);
			else
				setTimeout(() => {
					finish(false);
					stop(id);
				}, 2500);
		}, () => finish(false));
	});
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
