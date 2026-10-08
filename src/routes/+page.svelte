<script lang="ts">
	import { alarm } from '../lib/alarm.svelte';
	import AlarmMap from '../lib/components/AlarmMap.svelte';
	import ControlPanel from '../lib/components/ControlPanel.svelte';
	import InstallHint from '../lib/components/InstallHint.svelte';
	import ShareLocation from '../lib/components/ShareLocation.svelte';
	import ZonesPanel from '../lib/components/ZonesPanel.svelte';

	let map: AlarmMap | undefined = $state();
	let panelOpen = $state(false);
</script>

<svelte:head>
	<title>Geo Alarm</title>
</svelte:head>

<main class="relative h-dvh w-full overflow-hidden bg-neutral">
	{#if alarm.permission === 'granted'}
		<AlarmMap bind:this={map} />

		<div class="absolute right-3 top-[max(0.75rem,env(safe-area-inset-top))] z-[400] flex flex-col gap-2">
			<div class="indicator">
				{#if alarm.activeZones.length > 0}
					<span class="indicator-item badge badge-secondary badge-sm">{alarm.activeZones.length}</span>
				{/if}
				<button
					class="btn btn-circle btn-neutral shadow-lg"
					onclick={() => (panelOpen = true)}
					aria-label="Show all points ({alarm.zones.length})"
				>
					☰
				</button>
			</div>
			<button
				class="btn btn-circle btn-neutral shadow-lg"
				onclick={() => map?.centerOnMe()}
				aria-label="Center on my location"
			>
				◎
			</button>
			<button
				class="btn btn-circle btn-neutral shadow-lg"
				onclick={() => map?.fitAll()}
				aria-label="Fit all points on map"
				disabled={alarm.zones.length === 0 && !alarm.draft}
			>
				⤢
			</button>
		</div>

		<ControlPanel onradius={() => map?.fitDraft()} />
		<ZonesPanel open={panelOpen} onclose={() => (panelOpen = false)} onfocus={(z) => map?.focusZone(z)} />
	{:else if alarm.permission === 'checking'}
		<div class="flex h-full items-center justify-center text-neutral-content">
			<span class="loading loading-ring loading-lg"></span>
		</div>
	{:else}
		<ShareLocation />
	{/if}
	<InstallHint />
</main>
