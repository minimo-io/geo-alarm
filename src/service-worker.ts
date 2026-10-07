/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />

import { immutable, assets, prerendered } from '$app/manifest';
import { version } from '$app/env';

const sw = self as unknown as ServiceWorkerGlobalScope;
const APP_CACHE = `app-${version}`;
const TILE_CACHE = 'osm-tiles-v1';
const MAX_TILES = 300;
const ASSETS = [
	...new Set<string>([
		...immutable.map((f) => f.path),
		...assets.map((f) => f.path),
		...prerendered.map((f) => f.path),
		'/'
	])
];

sw.addEventListener('install', (event) => {
	event.waitUntil(
		caches
			.open(APP_CACHE)
			.then((c) => c.addAll(ASSETS))
			.then(() => sw.skipWaiting())
	);
});

sw.addEventListener('activate', (event) => {
	event.waitUntil(
		(async () => {
			for (const key of await caches.keys()) {
				if (key !== APP_CACHE && key !== TILE_CACHE) await caches.delete(key);
			}
			await sw.clients.claim();
		})()
	);
});

sw.addEventListener('fetch', (event) => {
	const { request } = event;
	if (request.method !== 'GET') return;
	const url = new URL(request.url);

	// Map tiles: network first, keep the ones you already looked at for offline use.
	if (url.hostname.endsWith('tile.openstreetmap.org')) {
		event.respondWith(
			(async () => {
				const cache = await caches.open(TILE_CACHE);
				try {
					const res = await fetch(request);
					if (res.ok) {
						cache.put(request, res.clone());
						const keys = await cache.keys();
						if (keys.length > MAX_TILES) await cache.delete(keys[0]);
					}
					return res;
				} catch {
					return (await cache.match(request)) ?? Response.error();
				}
			})()
		);
		return;
	}

	if (url.origin !== location.origin) return;

	// App shell: cache first, fall back to the cached root page for navigations.
	event.respondWith(
		(async () => {
			const cached = await caches.match(request);
			if (cached) return cached;
			try {
				return await fetch(request);
			} catch {
				if (request.mode === 'navigate') return (await caches.match('/')) ?? Response.error();
				return Response.error();
			}
		})()
	);
});

// Tapping a notification brings the app to the front.
sw.addEventListener('notificationclick', (event) => {
	event.notification.close();
	event.waitUntil(
		(async () => {
			const all = await sw.clients.matchAll({ type: 'window', includeUncontrolled: true });
			if (all[0]) return all[0].focus();
			return sw.clients.openWindow('/');
		})()
	);
});
