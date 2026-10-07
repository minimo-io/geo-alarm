<script lang="ts">
	import { alarm, type Zone } from '../alarm.svelte';
	import { formatMeters } from '../geo';
	import { playBeep, unlockAudio } from '../beep';

	let {
		open,
		onclose,
		onfocus
	}: { open: boolean; onclose: () => void; onfocus: (zone: Zone) => void } = $props();

	const insideIds = $derived(new Set(alarm.insideZones.map((z) => z.id)));
	const ringingIds = $derived(new Set(alarm.ringingZones.map((z) => z.id)));
</script>

<!-- Backdrop: phones only. On wider screens the map stays usable beside the panel. -->
{#if open}
	<button
		class="fixed inset-0 z-[700] cursor-default bg-black/30 md:hidden"
		aria-label="Close points panel"
		onclick={onclose}
		tabindex="-1"
	></button>
{/if}

<aside
	class="fixed inset-y-0 right-0 z-[800] flex w-80 max-w-[88vw] flex-col bg-base-100 shadow-2xl transition-transform duration-200 motion-reduce:transition-none {open
		? 'translate-x-0'
		: 'translate-x-full'}"
	style="padding-top: env(safe-area-inset-top); padding-bottom: env(safe-area-inset-bottom)"
	aria-label="Alarm points"
	inert={!open}
>
	<header class="flex items-center justify-between gap-2 border-b border-base-300 p-4">
		<div>
			<h2 class="text-lg font-bold">Points</h2>
			<p class="text-sm opacity-70">
				{alarm.activeZones.length} on, {alarm.zones.length - alarm.activeZones.length} off
			</p>
		</div>
		<button class="btn btn-ghost btn-sm btn-circle" onclick={onclose} aria-label="Close points panel">✕</button>
	</header>

	<div class="flex items-center justify-between gap-3 border-b border-base-300 px-4 py-3">
		<label class="flex flex-1 cursor-pointer items-center gap-3">
			<input type="checkbox" class="toggle toggle-secondary" bind:checked={alarm.soundEnabled} />
			<span>
				<span class="block font-semibold">Beep</span>
				<span class="block text-sm opacity-70">Sound with each notification</span>
			</span>
		</label>
		<button
			class="btn btn-outline btn-sm"
			disabled={!alarm.soundEnabled}
			onclick={() => {
				unlockAudio();
				playBeep();
			}}
		>
			Test
		</button>
	</div>

	<div class="flex-1 overflow-y-auto p-3">
		{#if alarm.zones.length === 0}
			<div class="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
				<p class="font-semibold">No points yet</p>
				<p class="text-sm opacity-70">Tap the map, set a radius, then choose Add point.</p>
			</div>
		{:else}
			<ul class="space-y-3">
				{#each alarm.zones as zone (zone.id)}
					<li class="space-y-2 rounded-box border border-base-300 p-3 {zone.enabled ? '' : 'bg-base-200'}">
						<div class="flex items-center gap-2">
							<input
								class="input input-ghost input-sm min-w-0 flex-1 font-semibold"
								bind:value={zone.name}
								aria-label="Point name"
							/>
							<input
								type="checkbox"
								class="toggle toggle-secondary"
								bind:checked={zone.enabled}
								aria-label="{zone.enabled ? 'Turn off' : 'Turn on'} {zone.name}"
							/>
						</div>

						<div class="flex items-center gap-2 text-sm">
							<input
								type="range"
								min="50"
								max="5000"
								step="50"
								bind:value={zone.radius}
								class="range range-xs range-secondary flex-1"
								aria-label="Radius of {zone.name}"
							/>
							<output class="w-14 text-right tabular-nums">{formatMeters(zone.radius)}</output>
						</div>

						<div class="flex items-center justify-between">
							{#if !zone.enabled}
								<span class="badge badge-ghost">Off</span>
							{:else if alarm.armed && ringingIds.has(zone.id)}
								<span class="badge badge-secondary">Notifying</span>
							{:else if alarm.armed && insideIds.has(zone.id)}
								<span class="badge badge-neutral">Inside, done</span>
							{:else}
								<span class="badge badge-outline">On</span>
							{/if}
							<div class="flex gap-1">
								<button
									class="btn btn-ghost btn-xs"
									onclick={() => {
										onfocus(zone);
										onclose();
									}}
								>
									Show on map
								</button>
								<button class="btn btn-ghost btn-xs text-error" onclick={() => alarm.removeZone(zone.id)}>
									Delete
								</button>
							</div>
						</div>
					</li>
				{/each}
			</ul>
		{/if}
	</div>
</aside>
