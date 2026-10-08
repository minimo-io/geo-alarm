import { distanceMeters, type LatLng } from './geo';
import { ensureNotificationPermission, notify } from './notify';
import { playBeep } from './beep';
import { startPositionDelivery } from './location-provider';

export type LocationPermission = 'checking' | 'prompt' | 'granted' | 'denied' | 'unsupported';

export type Zone = {
	id: string;
	name: string;
	lat: number;
	lng: number;
	/** metres */
	radius: number;
	/** Disabled zones stay in the list and on the map but never trigger the alarm. */
	enabled: boolean;
};

export const NOTIFY_EVERY_MS = 10_000;
const STORAGE_KEY = 'geoalarm:zones:v1';
const SOUND_KEY = 'geoalarm:sound:v1';

class GeoAlarm {
	// --- location ---
	permission = $state<LocationPermission>('checking');
	position = $state<(LatLng & { accuracy: number }) | null>(null);

	// --- saved points ---
	zones = $state<Zone[]>([]);

	// --- the point being placed (not saved until "Add point") ---
	draft = $state<LatLng | null>(null);
	draftRadius = $state(300);

	// --- alarm (global on/off, applies to every enabled zone) ---
	armed = $state(false);
	/**
	 * After a point fires (you enter it), keep notifying for this many seconds, then go quiet
	 * until you leave and re-enter. 0 = keep notifying until you leave or turn the alarm off.
	 */
	notifyForSec = $state(0);
	notificationsDenied = $state(false);

	/** Play a beep every time the alarm notifies. Can be switched off in the points panel. */
	soundEnabled = $state(true);

	/** Zones that are currently inside their notification window. */
	ringingIds = $state<string[]>([]);
	/** Seconds left in the longest running notification window (null = unlimited / not ringing). */
	ringRemainingSec = $state<number | null>(null);

	activeZones = $derived(this.zones.filter((z) => z.enabled));
	insideZones = $derived.by(() => {
		const pos = this.position;
		if (!pos) return [];
		return this.activeZones.filter((z) => distanceMeters(pos, z) <= z.radius);
	});
	inside = $derived(this.insideZones.length > 0);
	ringingZones = $derived(this.insideZones.filter((z) => this.ringingIds.includes(z.id)));

	#stopDelivery: (() => void) | null = null;
	#ticker: ReturnType<typeof setInterval> | null = null;
	#wakeLock: WakeLockSentinel | null = null;
	#lastNotifyAt = 0;
	/** zone id -> timestamp when its notification window ends (Infinity = until you leave) */
	#ringUntil = new Map<string, number>();
	#persisting = false;

	/** Check the permission state, load saved points and start watching if allowed. */
	async init() {
		this.#loadZones();
		try {
			this.soundEnabled = localStorage.getItem(SOUND_KEY) !== 'off';
		} catch {
			/* keep default */
		}
		this.#startPersisting();

		if (!('geolocation' in navigator)) {
			this.permission = 'unsupported';
			return;
		}
		try {
			const status = await navigator.permissions.query({ name: 'geolocation' });
			this.permission = status.state as LocationPermission;
			status.onchange = () => {
				this.permission = status.state as LocationPermission;
				if (status.state === 'granted') this.#startWatching();
			};
			if (status.state === 'granted') this.#startWatching();
		} catch {
			// Permissions API missing (older Safari): we find out when we ask.
			this.permission = 'prompt';
		}
	}

	// ---------- persistence ----------

	#loadZones() {
		try {
			const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
			if (!Array.isArray(raw)) return;
			this.zones = raw
				.filter(
					(z) =>
						z &&
						typeof z.id === 'string' &&
						Number.isFinite(z.lat) &&
						Number.isFinite(z.lng) &&
						Number.isFinite(z.radius)
				)
				.map((z) => ({
					id: z.id,
					name: String(z.name ?? 'Point'),
					lat: z.lat,
					lng: z.lng,
					radius: z.radius,
					enabled: z.enabled !== false
				}));
		} catch {
			/* corrupted storage: start empty */
		}
	}

	#startPersisting() {
		if (this.#persisting) return;
		this.#persisting = true;
		$effect.root(() => {
			// Armed requires at least one enabled point: turning off (or deleting) the last
			// one while armed turns the alarm back off.
			$effect(() => {
				if (this.armed && this.activeZones.length === 0) this.disarm();
			});
			$effect(() => {
				const json = JSON.stringify(this.zones); // reads every field => reacts to any edit
				try {
					localStorage.setItem(STORAGE_KEY, json);
				} catch {
					/* private mode / quota: points just won't survive a reload */
				}
			});
			$effect(() => {
				try {
					localStorage.setItem(SOUND_KEY, this.soundEnabled ? 'on' : 'off');
				} catch {
					/* ignore */
				}
			});
		});
	}

	// ---------- location ----------

	/** Must be called from a tap so the browser shows the permission prompt. */
	requestLocation() {
		navigator.geolocation.getCurrentPosition(
			() => {
				this.permission = 'granted';
				this.#startWatching();
			},
			(err) => {
				this.permission = err.code === err.PERMISSION_DENIED ? 'denied' : this.permission;
			},
			{ enableHighAccuracy: true, timeout: 15_000 }
		);
	}

	#startWatching() {
		if (this.#stopDelivery !== null) return;
		// Web: plain watchPosition. Native shell: background watcher (foreground
		// service), so fixes keep arriving with the app backgrounded.
		void startPositionDelivery((pos) => {
			this.permission = 'granted';
			this.position = pos;
		}).then((stop) => {
			this.#stopDelivery = stop;
		});
	}

	// ---------- points ----------

	setDraft(c: LatLng) {
		this.draft = c;
	}

	/** Discard the point being placed without saving it. */
	clearDraft() {
		this.draft = null;
	}

	/** Save the draft as a new, enabled point. */
	addZone() {
		if (!this.draft) return;
		const names = new Set(this.zones.map((z) => z.name));
		let n = this.zones.length + 1;
		while (names.has(`Point ${n}`)) n++;

		this.zones.push({
			id: crypto.randomUUID(),
			name: `Point ${n}`,
			lat: this.draft.lat,
			lng: this.draft.lng,
			radius: this.draftRadius,
			enabled: true
		});
		this.draft = null;
	}

	removeZone(id: string) {
		this.zones = this.zones.filter((z) => z.id !== id);
	}

	// ---------- alarm ----------

	async arm() {
		if (this.armed || this.activeZones.length === 0) return;

		// Browsers only allow sound after a tap, so beep right now, before any await, but only
		// when this tap actually fires (standing inside an enabled point). Otherwise arming
		// stays silent: a beep with no notification reads as a phantom fire.
		if (this.soundEnabled && this.insideZones.length > 0) void playBeep();

		// Needs a user gesture, which is why arm() is called from the button.
		const perm = await ensureNotificationPermission();
		this.notificationsDenied = perm !== 'granted';

		this.draft = null;
		this.armed = true;
		this.#lastNotifyAt = 0; // notify right away if we are already inside
		this.#ringUntil.clear();

		await this.#requestWakeLock();
		this.#ticker = setInterval(() => this.#tick(), 1000);
		this.#tick();
	}

	disarm() {
		this.armed = false;
		this.#ringUntil.clear();
		this.ringingIds = [];
		this.ringRemainingSec = null;
		if (this.#ticker) clearInterval(this.#ticker);
		this.#ticker = null;
		this.#wakeLock?.release().catch(() => {});
		this.#wakeLock = null;
	}

	#tick() {
		const now = Date.now();
		const insideIds = new Set(this.insideZones.map((z) => z.id));

		// Left an area (or turned it off / deleted it): forget it so entering again fires again.
		for (const id of [...this.#ringUntil.keys()]) {
			if (!insideIds.has(id)) this.#ringUntil.delete(id);
		}

		// Just entered an area: open its notification window and notify right away.
		let entered = false;
		for (const id of insideIds) {
			if (!this.#ringUntil.has(id)) {
				this.#ringUntil.set(id, this.notifyForSec > 0 ? now + this.notifyForSec * 1000 : Infinity);
				entered = true;
			}
		}
		if (entered) this.#lastNotifyAt = 0;

		const ringing = this.insideZones.filter((z) => now < (this.#ringUntil.get(z.id) ?? 0));
		this.ringingIds = ringing.map((z) => z.id);

		const ends = ringing.map((z) => this.#ringUntil.get(z.id)!);
		const latest = ends.length ? Math.max(...ends) : Infinity;
		this.ringRemainingSec = Number.isFinite(latest) ? Math.max(Math.ceil((latest - now) / 1000), 0) : null;

		if (ringing.length && now - this.#lastNotifyAt >= NOTIFY_EVERY_MS) {
			this.#lastNotifyAt = now;
			if (this.soundEnabled) void playBeep();
			const names = ringing.map((z) => z.name);
			notify(
				names.length > 1 ? `You are inside ${names.length} alarm areas` : `You are inside ${names[0]}`,
				names.length > 1 ? names.join(', ') : 'Geo Alarm is on. Open the app to turn it off.'
			);
		}
	}

	/**
	 * Web apps cannot track location in the background. Keeping the screen awake
	 * keeps the page (and the 10 s notification loop) running while the alarm is on.
	 */
	async #requestWakeLock() {
		try {
			this.#wakeLock = (await navigator.wakeLock?.request('screen')) ?? null;
		} catch {
			/* not supported or denied: the alarm still works while the app is visible */
		}
	}

	/** Wake locks are released when the tab is hidden; take it again on return. */
	onVisible() {
		if (this.armed && document.visibilityState === 'visible') this.#requestWakeLock();
	}
}

export const alarm = new GeoAlarm();
