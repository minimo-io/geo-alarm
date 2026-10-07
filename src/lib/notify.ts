/** Ask for notification permission. Must be called from a user gesture (tap). */
export async function ensureNotificationPermission(): Promise<NotificationPermission> {
	if (!('Notification' in window)) return 'denied';
	if (Notification.permission === 'default') return await Notification.requestPermission();
	return Notification.permission;
}

/**
 * Show a notification. Uses the service worker registration when available
 * (required on Android Chrome and installed PWAs), falls back to the Notification API.
 */
export async function notify(title: string, body: string): Promise<void> {
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
