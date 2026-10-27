<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import '../app.css';
	import { APP_NAME } from '#lib/config.js';
	import { launchStartParam, startRoute } from '#lib/services/telegram.js';
	import { clipPreload } from '#lib/sound/preload.svelte.js';
	import { soundManager } from '#lib/sound/soundManager.svelte.js';
	import { telegram } from '#lib/stores/telegram.svelte.js';

	let { children } = $props();

	onMount(() => {
		// Voice clips are fetched while the player is still on the start screen; a muted player
		// starts the same prefetch when they turn sound on.
		if (!soundManager().muted) clipPreload().start();
		// Early, while the URL hash still holds the Mini App launch parameters
		void telegram().start();
		// A `startapp=shop` or `startapp=profile` link opens that page instead of the start screen
		void launchStartParam().then((param) => {
			const route = startRoute(param);
			if (route && page.url.pathname === resolve('/')) void goto(resolve(route));
		});
		if ('serviceWorker' in navigator) {
			navigator.serviceWorker.register('/service-worker.js', {
				type: import.meta.env.DEV ? 'module' : 'classic'
			});
		}
	});
</script>

<svelte:head>
	<title>{APP_NAME}</title>
</svelte:head>

<div class="min-h-dvh">
	{@render children()}
</div>
