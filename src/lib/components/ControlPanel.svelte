<script lang="ts">
	import { alarm, NOTIFY_EVERY_MS } from '../alarm.svelte';
	import { formatMeters } from '../geo';

	let { onradius }: { onradius?: () => void } = $props();

	const durations = [
		{ label: 'Until I leave', value: 0 },
		{ label: '30 seconds', value: 30 },
		{ label: '1 minute', value: 60 },
		{ label: '5 minutes', value: 300 },
		{ label: '15 minutes', value: 900 }
	];

	function fmt(s: number) {
		const m = Math.floor(s / 60);
		return `${m}:${String(s % 60).padStart(2, '0')}`;
	}
</script>

<section
	class="card absolute inset-x-0 bottom-0 z-[500] mx-auto w-full max-w-md rounded-b-none bg-base-100 shadow-2xl"
	style="padding-bottom: var(--panel-bottom)"
>
	<div class="card-body gap-3 p-4 pb-3">
		{#if alarm.armed}
			<div class="flex items-center justify-between gap-3">
				<div class="min-w-0">
					<p class="text-lg font-semibold">
						{#if alarm.ringingZones.length}
							Inside {alarm.ringingZones.map((z) => z.name).join(', ')}
						{:else if alarm.inside}
							Inside {alarm.insideZones.map((z) => z.name).join(', ')}
						{:else}
							Alarm is on
						{/if}
					</p>
					<p class="text-sm opacity-70">
						Watching {alarm.activeZones.length}
						{alarm.activeZones.length === 1 ? 'point' : 'points'}
					</p>
				</div>
				{#if alarm.ringRemainingSec !== null}
					<div class="badge badge-neutral badge-lg tabular-nums" title="Notifying for">
						{fmt(alarm.ringRemainingSec)}
					</div>
				{/if}
			</div>
			{#if alarm.activeZones.length === 0}
				<p class="text-sm">Every point is turned off. Turn one on in the points list.</p>
			{:else if alarm.ringingZones.length}
				<p class="text-sm">Notifying every {NOTIFY_EVERY_MS / 1000} seconds. Keep this screen open.</p>
			{:else if alarm.inside}
				<p class="text-sm">Notifications finished. They start again when you leave and re-enter.</p>
			{/if}
			{#if alarm.notificationsDenied}
				<div role="alert" class="alert alert-warning alert-soft text-sm">
					{#if alarm.soundEnabled}
						Notifications are blocked. Allow them in your browser settings. The beep still sounds while this screen is open.
					{:else}
						Notifications are blocked and the beep is off, so the alarm will stay silent. Allow notifications in your browser settings or turn the beep on in the points panel.
					{/if}
				</div>
			{/if}
			<button class="btn btn-error" onclick={() => alarm.disarm()}>Turn alarm off</button>
		{:else}
			<div class="flex items-baseline justify-between">
				<label for="radius" class="font-semibold">New point radius</label>
				<output class="tabular-nums">{formatMeters(alarm.draftRadius)}</output>
			</div>
			<input
				id="radius"
				type="range"
				min="50"
				max="5000"
				step="50"
				bind:value={alarm.draftRadius}
				onchange={() => onradius?.()}
				class="range range-secondary range-sm w-full"
				disabled={!alarm.draft}
			/>

			<label class="flex items-center justify-between gap-3">
				<span class="font-semibold">Notify for</span>
				<select class="select select-sm w-auto" bind:value={alarm.notifyForSec}>
					{#each durations as d}
						<option value={d.value}>{d.label}</option>
					{/each}
				</select>
			</label>

			<p class="text-sm opacity-70">
				{#if alarm.draft}
					Set the radius, then add the point.
				{:else if alarm.zones.length === 0}
					Tap the map to place a point.
				{:else if alarm.activeZones.length === 0}
					Every point is turned off. Turn one on to start the alarm.
				{:else}
					Tap the map to add another point, or start the alarm.
				{/if}
			</p>

			<div class="grid grid-cols-2 gap-2">
				<button class="btn btn-outline btn-secondary" disabled={!alarm.draft} onclick={() => alarm.addZone()}>
					Add point
				</button>
				<button class="btn btn-secondary" disabled={alarm.activeZones.length === 0} onclick={() => alarm.arm()}>
					Start alarm
				</button>
			</div>
		{/if}
	</div>
</section>
