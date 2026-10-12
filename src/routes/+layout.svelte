<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import { alarm } from '../lib/alarm.svelte';
	import { isNative } from '../lib/location-provider';

	let { children } = $props();

	onMount(() => {
		alarm.init();
		// Native shells (coarse pointers) zero the panel padding; flag them for extra room.
		document.documentElement.classList.toggle('native', isNative());
		const onVis = () => alarm.onVisible();
		document.addEventListener('visibilitychange', onVis);
		return () => document.removeEventListener('visibilitychange', onVis);
	});
</script>

{@render children()}
