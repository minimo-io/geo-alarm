<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import { alarm } from '../lib/alarm.svelte';

	let { children } = $props();

	onMount(() => {
		alarm.init();
		const onVis = () => alarm.onVisible();
		document.addEventListener('visibilitychange', onVis);
		return () => document.removeEventListener('visibilitychange', onVis);
	});
</script>

{@render children()}
