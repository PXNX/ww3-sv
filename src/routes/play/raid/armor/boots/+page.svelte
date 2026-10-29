<script lang="ts">
	import { resolve } from '$app/paths';
</script>

<svelte:head><title>Boots | Raid</title></svelte:head>
<main class="mx-auto max-w-xl px-6 py-10 text-white">
	<a href={resolve('/play/raid')} class="mb-4 inline-block underline">← Back</a>
	<h1 class="text-3xl font-black">Boots</h1>
	<p class="mt-2">Extra walking speed, plus a small chance to run. Sprint boots add more.</p>
	<ul class="mt-4 list-disc pl-5"><li>Speed bonus = BOOTS_SPEED × rarity × √level</li></ul>
</main>
