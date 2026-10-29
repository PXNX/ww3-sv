<!--
	Landscape games: on a phone or tablet held upright the game is covered by a full-screen "turn your
	phone" card that cannot be dismissed, so the game is only ever seen sideways. While it is up, the
	game is told to pause (`onportrait`), and the only other way out is the link back to the menu.
	The page also asks the browser to lock the screen sideways, which is only granted where the page
	may do that (an installed app, or full screen); the card covers everything else. Desktop windows,
	where a tall window is a choice and not a held phone, are left alone.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import { m } from '#lib/paraglide/messages.js';
	import IconArrowLeft from '~icons/lucide/arrow-left';
	import IconRotate from '~icons/lucide/smartphone';

	let {
		title = m.game_rotate_title(),
		body = m.game_rotate_body(),
		onportrait
	}: {
		title?: string;
		body?: string;
		/** Called with true when the screen is upright and with false when it turns sideways */
		onportrait?: (portrait: boolean) => void;
	} = $props();

	let portrait = $state(false);

	onMount(() => {
		const orientation = screen.orientation as
			(ScreenOrientation & { lock?: (orientation: string) => Promise<void> }) | undefined;
		// Refused outside full screen on most browsers: the card below covers that
		orientation?.lock?.('landscape').catch(() => {});
		const touch = matchMedia('(pointer: coarse)');
		const upright = matchMedia('(orientation: portrait)');
		const update = () => {
			const now = touch.matches && upright.matches;
			if (now === portrait) return;
			portrait = now;
			onportrait?.(now);
		};
		update();
		upright.addEventListener('change', update);
		touch.addEventListener('change', update);
		return () => {
			upright.removeEventListener('change', update);
			touch.removeEventListener('change', update);
			try {
				orientation?.unlock();
			} catch {
				// Never locked here
			}
		};
	});
</script>

{#if portrait}
	<div
		class="fixed inset-0 z-100 flex flex-col items-center justify-center gap-4 bg-banner-slate p-4 pt-[calc(1rem+env(safe-area-inset-top))] pb-[calc(1rem+env(safe-area-inset-bottom))]"
		style:touch-action="none"
		role="alertdialog"
		aria-modal="true"
		aria-labelledby="rotate-hint-title"
		aria-describedby="rotate-hint-body"
	>
		<div class="sticker flex max-w-xs flex-col items-center gap-3 p-5 text-center">
			<IconRotate class="rotate-hint size-14" aria-hidden="true" />
			<h2 id="rotate-hint-title" dir="auto" class="font-display text-2xl font-bold">{title}</h2>
			<p id="rotate-hint-body" dir="auto" class="text-sm">{body}</p>
		</div>
		<a href={resolve('/')} class="btn-chunky bg-paper px-3 py-1 text-sm">
			<IconArrowLeft class="size-4 rtl:rotate-180" aria-hidden="true" />
			{m.game_back()}
		</a>
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
