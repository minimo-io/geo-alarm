<script lang="ts">
	import { onMount } from 'svelte';
	import { NativeSetup, openAppSettings } from '../native-setup';

	let bgGranted = $state(true);
	let battIgnored = $state(true);
	let ready = $state(false);

	async function refresh() {
		try {
			bgGranted = (await NativeSetup.isBackgroundLocationGranted()).granted;
		} catch {
			bgGranted = false;
		}
		try {
			battIgnored = (await NativeSetup.isBatteryOptimizationIgnored()).ignored;
		} catch {
			battIgnored = false;
		}
		ready = true;
	}

	onMount(() => {
		void refresh();
		const onVis = () => {
			if (document.visibilityState === 'visible') void refresh();
		};
		document.addEventListener('visibilitychange', onVis);
		return () => document.removeEventListener('visibilitychange', onVis);
	});
</script>

{#if ready && (!bgGranted || !battIgnored)}
	<div class="space-y-2 rounded-box border border-warning/40 bg-warning/10 p-3 text-sm">
		<p class="font-semibold">Background alarm needs two permissions</p>
		{#if !bgGranted}
			<div class="flex items-center justify-between gap-2">
				<span>Location all the time</span>
				<button class="btn btn-warning btn-sm" onclick={() => void openAppSettings()}>
					Allow all the time
				</button>
			</div>
		{/if}
		{#if !battIgnored}
			<div class="flex items-center justify-between gap-2">
				<span>Battery optimization off</span>
				<button
					class="btn btn-warning btn-sm"
					onclick={() => void NativeSetup.requestIgnoreBatteryOptimizations()}
				>
					Disable optimization
				</button>
			</div>
		{/if}
	</div>
{/if}
