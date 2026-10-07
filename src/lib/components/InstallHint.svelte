<script lang="ts">
	import { onMount } from 'svelte';

	const KEY = 'geoalarm:install-hint-dismissed';

	let deferred = $state<BeforeInstallPromptEvent | null>(null);
	let visible = $state(false);
	let ios = $state(false);

	onMount(() => {
		// Already installed / running as an app: never show the hint.
		const standalone =
			['standalone', 'fullscreen', 'minimal-ui'].some((m) => matchMedia(`(display-mode: ${m})`).matches) ||
			(navigator as Navigator & { standalone?: boolean }).standalone === true;
		if (standalone || localStorage.getItem(KEY)) return;

		ios = /iphone|ipad|ipod/i.test(navigator.userAgent);

		// Chrome / Edge / Samsung Internet (Android + desktop) fire this when installable.
		const onPrompt = (e: BeforeInstallPromptEvent) => {
			e.preventDefault();
			deferred = e;
			setTimeout(() => (visible = true), 2500);
		};
		const onKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape' && visible) dismiss();
		};
		window.addEventListener('beforeinstallprompt', onPrompt);
		window.addEventListener('appinstalled', () => (visible = false));
		window.addEventListener('keydown', onKey);

		// iOS Safari never fires it: show manual instructions instead.
		if (ios) setTimeout(() => (visible = true), 4000);

		return () => {
			window.removeEventListener('beforeinstallprompt', onPrompt);
			window.removeEventListener('keydown', onKey);
		};
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
	<div
		class="toast toast-top toast-center z-[1000] w-full max-w-sm px-3 pt-[max(0.75rem,env(safe-area-inset-top))]"
		role="dialog"
		aria-label="Install Geo Alarm"
	>
		<div class="card w-full bg-neutral text-neutral-content shadow-xl">
			<div class="card-body gap-3 p-4">
				<div class="flex items-start gap-3">
					<img src="/icons/icon-192.png" alt="" class="size-10 rounded-xl" />
					<div class="min-w-0 flex-1">
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
					<!-- Explicit light colours: ghost buttons are dark-on-dark on this card. -->
					<button
						class="btn btn-circle btn-sm shrink-0 border-neutral-content/40 bg-transparent text-neutral-content"
						onclick={dismiss}
						aria-label="Close"
					>
						<svg viewBox="0 0 24 24" class="size-4" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true">
							<path d="M6 6l12 12M18 6L6 18" />
						</svg>
					</button>
				</div>
				<div class="flex justify-end gap-2">
					<button class="btn btn-sm border-neutral-content/40 bg-transparent text-neutral-content" onclick={dismiss}>
						Not now
					</button>
					{#if deferred}
						<button class="btn btn-secondary btn-sm" onclick={install}>Install app</button>
					{/if}
				</div>
			</div>
		</div>
	</div>
{/if}
