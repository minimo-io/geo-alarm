<script lang="ts">
	import { onMount } from 'svelte';
	import 'leaflet/dist/leaflet.css';
	import type * as Leaflet from 'leaflet';
	import { alarm, type Zone } from '../alarm.svelte';

	let el: HTMLDivElement;
	let L: typeof Leaflet;
	let map: Leaflet.Map | undefined;
	let me: Leaflet.Marker | undefined;
	let draftCircle: Leaflet.Circle | undefined;
	let draftPin: Leaflet.Marker | undefined;
	const layers = new Map<string, { circle: Leaflet.Circle; pin: Leaflet.Marker }>();
	let centeredOnUser = false;

	const pinIcon = () =>
		L.divIcon({ className: '', html: '<div class="pin"></div>', iconSize: [26, 26], iconAnchor: [4, 26] });

	const css = (name: string, fallback: string) =>
		getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;

	onMount(() => {
		let destroyed = false;

		(async () => {
			L = (await import('leaflet')).default;
			if (destroyed) return;

			const start: Leaflet.LatLngExpression = alarm.position
				? [alarm.position.lat, alarm.position.lng]
				: [0, 0];
			map = L.map(el, { zoomControl: false, attributionControl: true }).setView(
				start,
				alarm.position ? 16 : 2
			);
			// Classic white +/- control, top left (app buttons live top right).
			L.control.zoom({ position: 'topleft' }).addTo(map);

			L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
				maxZoom: 19,
				attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
			}).addTo(map);

			// Tap anywhere to place the new point. Locked while the alarm is on.
			map.on('click', (e: Leaflet.LeafletMouseEvent) => {
				if (alarm.armed) return;
				alarm.setDraft({ lat: e.latlng.lat, lng: e.latlng.lng });
			});

			sync();
		})();

		return () => {
			destroyed = true;
			map?.remove();
		};
	});

	function zoneStyle(z: Zone): Leaflet.CircleOptions {
		const color = z.enabled ? css('--color-secondary', '#ff7a45') : '#7d8c88';
		return {
			radius: z.radius,
			color,
			weight: 2,
			dashArray: z.enabled ? undefined : '4 6',
			fillColor: color,
			fillOpacity: z.enabled ? (alarm.armed ? 0.25 : 0.18) : 0.06,
			interactive: false // taps pass through to the map
		};
	}

	function sync() {
		if (!map || !L) return;

		// --- user position ---
		if (alarm.position) {
			const ll: Leaflet.LatLngExpression = [alarm.position.lat, alarm.position.lng];
			if (!me) {
				me = L.marker(ll, {
					icon: L.divIcon({ className: '', html: '<div class="me-dot"></div>', iconSize: [16, 16] }),
					interactive: false,
					keyboard: false
				}).addTo(map);
			} else me.setLatLng(ll);

			if (!centeredOnUser) {
				centeredOnUser = true;
				map.setView(ll, 16);
			}
		}

		// --- saved points ---
		const seen = new Set<string>();
		const insideIds = new Set(alarm.insideZones.map((z) => z.id));
		for (const z of alarm.zones) {
			seen.add(z.id);
			const ll: Leaflet.LatLngExpression = [z.lat, z.lng];
			let layer = layers.get(z.id);
			if (!layer) {
				layer = {
					circle: L.circle(ll, zoneStyle(z)).addTo(map),
					pin: L.marker(ll, { icon: pinIcon(), interactive: false, keyboard: false }).addTo(map)
				};
				layers.set(z.id, layer);
			} else {
				layer.circle.setLatLng(ll).setRadius(z.radius).setStyle(zoneStyle(z));
			}
			layer.pin.setOpacity(z.enabled ? 1 : 0.4);
			layer.circle.getElement()?.classList.toggle('zone-inside', alarm.armed && insideIds.has(z.id));
		}
		for (const [id, layer] of layers) {
			if (!seen.has(id)) {
				layer.circle.remove();
				layer.pin.remove();
				layers.delete(id);
			}
		}

		// --- the point being placed (dashed) ---
		if (alarm.draft && !alarm.armed) {
			const ll: Leaflet.LatLngExpression = [alarm.draft.lat, alarm.draft.lng];
			const color = css('--color-secondary', '#ff7a45');
			const style: Leaflet.CircleOptions = {
				radius: alarm.draftRadius,
				color,
				weight: 2,
				dashArray: '6 6',
				fillColor: color,
				fillOpacity: 0.12,
				interactive: false
			};
			if (!draftCircle) {
				draftCircle = L.circle(ll, style).addTo(map);
				draftPin = L.marker(ll, { icon: pinIcon(), interactive: false, keyboard: false }).addTo(map);
			} else {
				draftCircle.setLatLng(ll).setRadius(alarm.draftRadius).setStyle(style);
				draftPin!.setLatLng(ll);
			}
		} else if (draftCircle) {
			draftCircle.remove();
			draftPin?.remove();
			draftCircle = draftPin = undefined;
		}
	}

	// Re-draw whenever anything reactive changes.
	$effect(() => {
		void [alarm.position, alarm.draft, alarm.draftRadius, alarm.armed, alarm.insideZones];
		void JSON.stringify(alarm.zones); // deep: name/radius/enabled edits
		sync();
	});

	/** Fit the point being placed on screen (after a big radius change). */
	export function fitDraft() {
		if (draftCircle && map) map.fitBounds(draftCircle.getBounds(), { padding: [40, 40], maxZoom: 18 });
	}
	/** Zoom to a saved point. */
	export function focusZone(z: Zone) {
		const layer = layers.get(z.id);
		if (layer && map) map.fitBounds(layer.circle.getBounds(), { padding: [60, 60], maxZoom: 18 });
	}
	export function centerOnMe() {
		if (alarm.position && map) map.setView([alarm.position.lat, alarm.position.lng], Math.max(map.getZoom(), 16));
	}
	/** Zoom the view so every saved point (and the draft, if any) is visible. */
	export function fitAll() {
		if (!map || !L) return;
		const bounds = L.latLngBounds([]);
		for (const z of alarm.zones) {
			const layer = layers.get(z.id);
			if (layer) bounds.extend(layer.circle.getBounds());
			else bounds.extend([z.lat, z.lng]);
		}
		if (alarm.draft) bounds.extend([alarm.draft.lat, alarm.draft.lng]);
		if (bounds.isValid()) map.fitBounds(bounds, { padding: [60, 60], maxZoom: 18 });
	}
</script>

<!-- isolate: keeps Leaflet's internal z-indexes below our overlays (panel, buttons) -->
<div bind:this={el} class="isolate h-full w-full bg-base-300" role="application" aria-label="Map"></div>
