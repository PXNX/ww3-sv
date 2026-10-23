<!--
	Landscape games: asks the browser to keep the screen sideways while mounted (only granted where
	the page may lock the orientation, such as an installed app) and, whenever the screen is upright
	anyway, covers the nearest `relative` wrapper with a "turn your phone" card that can be dismissed.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { m } from '#lib/paraglide/messages.js';
	import IconRotate from '~icons/lucide/smartphone';

	let portrait = $state(false);
	let dismissed = $state(false);

	onMount(() => {
		const orientation = screen.orientation as
			(ScreenOrientation & { lock?: (orientation: string) => Promise<void> }) | undefined;
		// Refused outside full screen on most browsers: the card below covers that
		orientation?.lock?.('landscape').catch(() => {});
		const query = matchMedia('(orientation: portrait)');
		const update = () => (portrait = query.matches);
		update();
		query.addEventListener('change', update);
		return () => {
			query.removeEventListener('change', update);
			try {
				orientation?.unlock();
			} catch {
				// Never locked here
			}
		};
	});
</script>

{#if portrait && !dismissed}
	<div
		class="absolute inset-0 z-30 flex items-center justify-center bg-banner-slate p-4"
		role="dialog"
		aria-modal="true"
		aria-labelledby="rotate-hint-title"
	>
		<div class="sticker flex max-w-xs flex-col items-center gap-3 p-5 text-center">
			<IconRotate class="rotate-hint size-14" aria-hidden="true" />
			<h2 id="rotate-hint-title" dir="auto" class="font-display text-2xl font-bold">
				{m.game_rotate_title()}
			</h2>
			<p dir="auto" class="text-sm">{m.game_rotate_body()}</p>
			<button type="button" class="btn-chunky text-sm" onclick={() => (dismissed = true)}>
				{m.game_rotate_dismiss()}
			</button>
		</div>
	</div>
{/if}

<style>
	:global(.rotate-hint) {
		animation: rotate-hint 1.6s ease-in-out infinite;
	}

	@keyframes rotate-hint {
		0%,
		30% {
			rotate: 0deg;
		}
		60%,
		100% {
			rotate: -90deg;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		:global(.rotate-hint) {
			animation: none;
		}
	}
</style>
