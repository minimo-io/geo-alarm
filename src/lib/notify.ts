import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

/** Ask for notification permission. Must be called from a user gesture (tap). */
export async function ensureNotificationPermission(): Promise<NotificationPermission> {
	if (Capacitor.isNativePlatform()) {
		const cur = await LocalNotifications.checkPermissions();
		if (cur.display === 'granted') return 'granted';
		if (cur.display === 'prompt') {
			const req = await LocalNotifications.requestPermissions();
			return req.display === 'granted' ? 'granted' : 'denied';
		}
		return 'denied';
	}
	if (!('Notification' in window)) return 'denied';
	if (Notification.permission === 'default') return await Notification.requestPermission();
	return Notification.permission;
}

/**
 * Show a notification. On the web it uses the service worker registration when
 * available (required on Android Chrome and installed PWAs), falling back to
 * the Notification API. In the native shell the Web Notification API does not
 * exist, so it uses the local-notifications plugin (same fixed id replaces the
 * previous alert, like `tag` does on the web).
 */
export async function notify(title: string, body: string): Promise<void> {
	if (Capacitor.isNativePlatform()) {
		try {
			// Immediate, tolerance-friendly alert: never exact, so the OS never
			// holds the call for the Alarms & reminders permission screen.
			await LocalNotifications.schedule({
				notifications: [{ title, body, id: 7, isExactNotification: false, sound: 'geoalarm_beep.wav' }]
			});
		} catch {
			/* permission denied: stay silent */
		}
		return;
	}
	if (!('Notification' in window) || Notification.permission !== 'granted') return;

	const options = {
		body,
		icon: '/icons/icon-192.png',
		badge: '/icons/icon-192.png',
		tag: 'geo-alarm', // same tag => replaces the previous one instead of stacking
		renotify: true, // ...but still buzzes/sounds every time
		requireInteraction: false,
		vibrate: [250, 100, 250]
	} as NotificationOptions;

	try {
		const reg = await navigator.serviceWorker?.getRegistration();
		if (reg) return await reg.showNotification(title, options);
	} catch {
		/* fall through */
	}
	new Notification(title, options);
}
