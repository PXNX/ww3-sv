<script lang="ts">
	import { resolve } from '$app/paths';
</script>

<svelte:head><title>Vest | Raid</title></svelte:head>
<main class="mx-auto max-w-xl px-6 py-10 text-white">
	<a href={resolve('/play/raid')} class="mb-4 inline-block underline">← Back</a>
	<h1 class="text-3xl font-black">Vest</h1>
	<p class="mt-2">Extra armor. Base: 25 armor at common rarity, scaled by rarity and level.</p>
	<ul class="mt-4 list-disc pl-5"><li>Armor bonus = VEST_ARMOR × rarity × level factor</li></ul>
</main>
