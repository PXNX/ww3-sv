<script lang="ts">
	import { onMount } from 'svelte';
	import '../app.css';
	import { APP_NAME } from '$lib/config';

	let { children } = $props();

	onMount(() => {
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
