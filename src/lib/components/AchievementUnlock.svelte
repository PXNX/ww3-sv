<script lang="ts">
	export let name: string;
	export let hat: string | null = null;
	export let onDone: () => void = () => {};

	import Confetti from './Confetti.svelte';

	setTimeout(onDone, 2000);
</script>

<div class="pointer-events-none fixed inset-0 z-50 flex items-center justify-center" aria-live="polite" aria-label="Achievement unlocked">
	<div class="relative flex flex-col items-center gap-3 rounded-3xl border-4 border-ink bg-paper px-8 py-6 shadow-[8px_8px_0_var(--color-chartreuse)] animate-[pop_600ms_ease-out_both]">
		<div class="text-6xl leading-none">✨</div>
		{#if hat}
			<div class="font-display text-4xl">🎩</div>
		{/if}
		<p class="font-display text-xl font-bold leading-tight text-center">{name}</p>
		<p class="font-display text-sm font-bold tracking-wide uppercase text-ink/70">Unlocked</p>
	</div>
	<Confetti />
</div>

<style>
	@keyframes pop {
		from { opacity: 0; transform: scale(0.6); }
		to { opacity: 1; transform: scale(1); }
	}
</style>
