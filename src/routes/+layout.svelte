<script lang="ts">
	import { onMount } from 'svelte';
	import '../app.css';
	import { APP_NAME } from '#lib/config.js';
	import { telegram } from '#lib/stores/telegram.svelte.js';

	let { children } = $props();

	onMount(() => {
		// Early, while the URL hash still holds the Mini App launch parameters
		void telegram().start();
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
