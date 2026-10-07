<script lang="ts">
	import { onMount } from 'svelte';

	const KEY = 'geoalarm:install-hint-dismissed';

	let deferred = $state<BeforeInstallPromptEvent | null>(null);
	let visible = $state(false);
	let ios = $state(false);

	onMount(() => {
		const standalone =
			matchMedia('(display-mode: standalone)').matches ||
			(navigator as Navigator & { standalone?: boolean }).standalone === true;
		if (standalone || localStorage.getItem(KEY)) return;

		ios = /iphone|ipad|ipod/i.test(navigator.userAgent);

		// Chrome / Edge / Samsung Internet (Android + desktop) fire this when installable.
		const onPrompt = (e: BeforeInstallPromptEvent) => {
			e.preventDefault();
			deferred = e;
			setTimeout(() => (visible = true), 2500);
		};
		window.addEventListener('beforeinstallprompt', onPrompt);
		window.addEventListener('appinstalled', () => (visible = false));

		// iOS Safari never fires it: show manual instructions instead.
		if (ios) setTimeout(() => (visible = true), 4000);

		return () => window.removeEventListener('beforeinstallprompt', onPrompt);
	});

	function dismiss() {
		visible = false;
		localStorage.setItem(KEY, '1');
	}

	async function install() {
		if (!deferred) return;
		await deferred.prompt();
		const { outcome } = await deferred.userChoice;
		deferred = null;
		visible = false;
		if (outcome === 'dismissed') localStorage.setItem(KEY, '1');
	}
</script>

{#if visible}
	<div class="toast toast-top toast-center z-[1000] w-full max-w-sm px-3 pt-[max(0.75rem,env(safe-area-inset-top))]" role="dialog" aria-label="Install Geo Alarm">
		<div class="card w-full bg-neutral text-neutral-content shadow-xl">
			<div class="card-body gap-2 p-4">
				<div class="flex items-start gap-3">
					<img src="/icons/icon-192.png" alt="" class="size-10 rounded-xl" />
					<div class="flex-1">
						<p class="font-semibold">Keep Geo Alarm on your home screen</p>
						{#if ios}
							<p class="text-sm opacity-80">
								Tap <span class="font-semibold">Share</span>, then
								<span class="font-semibold">Add to Home Screen</span>. iPhone only sends notifications to installed apps.
							</p>
						{:else}
							<p class="text-sm opacity-80">Install it for quicker access and reliable notifications.</p>
						{/if}
					</div>
					<button class="btn btn-ghost btn-sm btn-circle" onclick={dismiss} aria-label="Close">✕</button>
				</div>
				{#if deferred}
					<div class="card-actions justify-end">
						<button class="btn btn-secondary btn-sm" onclick={install}>Install app</button>
					</div>
				{/if}
			</div>
		</div>
	</div>
{/if}
