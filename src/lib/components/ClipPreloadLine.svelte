<!-- A thin progress line while the recorded voice clips are being fetched, with an ETA. -->
<script lang="ts">
	import { m } from '#lib/paraglide/messages.js';
	import { clipPreload } from '#lib/sound/preload.svelte.js';

	let { class: className = '' }: { class?: string } = $props();

	const preload = clipPreload();
	// The first report may be one byte in, so never claim "0 s left" while still loading
	const eta = $derived(Math.max(1, preload.eta ?? 1));
</script>

{#if preload.state === 'loading'}
	<p
		class="pop-in flex min-w-0 flex-col gap-1 text-start text-[0.7rem] leading-tight font-bold {className}"
		role="status"
		aria-live="polite"
	>
		<span>{m.sound_preload({ percent: preload.percent, eta })}</span>
		<span
			class="block h-1.5 w-full overflow-hidden rounded-full border-2 border-ink bg-paper"
			aria-hidden="true"
		>
			<span
				class="block h-full bg-khaki transition-[width] duration-200"
				style:width="{preload.percent}%"
			></span>
		</span>
	</p>
{/if}
