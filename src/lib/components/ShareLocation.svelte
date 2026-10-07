<script lang="ts">
	import { alarm } from '../alarm.svelte';
</script>

<div class="flex h-full flex-col items-center justify-center gap-6 bg-neutral p-8 text-center text-neutral-content">
	<svg viewBox="0 0 120 120" class="size-32" aria-hidden="true">
		<circle cx="60" cy="60" r="52" fill="none" stroke="var(--color-secondary)" stroke-width="3" stroke-dasharray="2 9" stroke-linecap="round" />
		<circle cx="60" cy="60" r="30" fill="var(--color-secondary)" fill-opacity=".2" stroke="var(--color-secondary)" stroke-width="3" />
		<circle cx="60" cy="60" r="8" fill="currentColor" />
	</svg>

	{#if alarm.permission === 'unsupported'}
		<div class="max-w-xs space-y-2">
			<h1 class="text-2xl font-bold">This device can't share location</h1>
			<p class="opacity-80">Geo Alarm needs a browser with location support, such as Chrome.</p>
		</div>
	{:else if alarm.permission === 'denied'}
		<div class="max-w-xs space-y-2">
			<h1 class="text-2xl font-bold">Location is blocked</h1>
			<p class="opacity-80">
				Allow location for this site in your browser or phone settings, then reload the app.
			</p>
		</div>
		<button class="btn btn-secondary btn-wide" onclick={() => location.reload()}>Reload</button>
	{:else}
		<div class="max-w-xs space-y-2">
			<h1 class="text-2xl font-bold">Share your location</h1>
			<p class="opacity-80">
				Geo Alarm needs your location to know when you enter the area you draw. Without it, the map stays off.
			</p>
		</div>
		<button class="btn btn-secondary btn-wide" onclick={() => alarm.requestLocation()}>Share location</button>
	{/if}
</div>
