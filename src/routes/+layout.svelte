<script lang="ts">
	import '../app.css';
	import { APP_NAME } from '$lib/config';

	let { children } = $props();
</script>

<svelte:head>
	<title>{APP_NAME}</title>
</svelte:head>

<div class="min-h-dvh">
	{@render children()}
</div>
