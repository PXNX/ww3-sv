<!--
	One vault card: a button that flips like a safe-deposit door. Face down it shows a slate door
	with a dial, face up it shows its treasure. Matched cards stay open with a gold frame. A card
	that was moved by a phone call wobbles, and a wrong pair shakes.
-->
<script lang="ts">
	import type { Card } from '#lib/game/vault/deck.js';
	import { m } from '#lib/paraglide/messages.js';
	import VaultSymbol from './VaultSymbol.svelte';

	let {
		card,
		position,
		name,
		wrong = false,
		shuffled = false,
		locked = false,
		onflip
	}: {
		card: Card;
		/** 1-based position, for the screen reader label */
		position: number;
		/** Name of the treasure, spoken only when the card is face up */
		name: string;
		wrong?: boolean;
		shuffled?: boolean;
		/** True while the board takes no input (paused, a pair is waiting, a vault is opening) */
		locked?: boolean;
		onflip: () => void;
	} = $props();

	const open = $derived(card.state !== 'down');
	const label = $derived(
		card.state === 'down'
			? m.vault_card_down({ position })
			: card.state === 'matched'
				? m.vault_card_matched({ position, name })
				: m.vault_card_up({ position, name })
	);
</script>

<button
	type="button"
	class="card relative aspect-[10/11] w-full rounded-lg"
	class:wrong
	class:shuffled
	aria-label={label}
	disabled={locked || card.state !== 'down'}
	onclick={onflip}
>
	<span class="inner absolute inset-0" class:open>
		<span
			class="face back absolute inset-0 flex items-center justify-center rounded-lg border-3 border-ink bg-banner-slate shadow-[2px_2px_0_var(--color-ink)]"
		>
			<svg viewBox="0 0 40 40" class="size-3/5" aria-hidden="true">
				<circle cx="20" cy="20" r="15" fill="#aeb4be" stroke="#111" stroke-width="2.5" />
				<circle cx="20" cy="20" r="6" fill="#6a7c9b" stroke="#111" stroke-width="2.5" />
				<path
					d="M20 5 V10 M20 30 V35 M5 20 H10 M30 20 H35"
					stroke="#111"
					stroke-width="2.5"
					stroke-linecap="round"
				/>
				<path d="M20 20 L25 15" stroke="#111" stroke-width="2.5" stroke-linecap="round" />
			</svg>
		</span>
		<span
			class="face front absolute inset-0 flex items-center justify-center rounded-lg border-3 border-ink p-[10%] shadow-[2px_2px_0_var(--color-ink)]"
			class:bg-paper={card.state !== 'matched'}
			class:bg-explosion-yellow={card.state === 'matched'}
		>
			<VaultSymbol symbol={card.symbol} class="size-full" />
		</span>
	</span>
</button>

<style>
	.card {
		perspective: 600px;
		-webkit-tap-highlight-color: transparent;
	}

	.card:not(:disabled) {
		cursor: pointer;
	}

	.card:not(:disabled):active .inner {
		scale: 0.94;
	}

	.card:focus-visible {
		outline: 3px solid var(--color-ink);
		outline-offset: 2px;
	}

	.inner {
		transform-style: preserve-3d;
		transition:
			transform 280ms ease-out,
			scale 100ms ease-out;
	}

	.inner.open {
		transform: rotateY(180deg);
	}

	.face {
		backface-visibility: hidden;
		-webkit-backface-visibility: hidden;
	}

	.front {
		transform: rotateY(180deg);
	}

	.wrong .inner {
		animation: shake 420ms ease-in-out;
	}

	.shuffled {
		animation: wobble 800ms ease-in-out;
	}

	@keyframes shake {
		0%,
		100% {
			translate: 0;
		}
		20%,
		60% {
			translate: -4px;
		}
		40%,
		80% {
			translate: 4px;
		}
	}

	@keyframes wobble {
		0%,
		100% {
			rotate: 0deg;
			translate: 0;
		}
		15% {
			rotate: -9deg;
			translate: -5px -3px;
		}
		35% {
			rotate: 8deg;
			translate: 6px 2px;
		}
		55% {
			rotate: -6deg;
			translate: -3px 4px;
		}
		75% {
			rotate: 4deg;
			translate: 2px -2px;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.inner {
			transition: none;
		}

		.wrong .inner,
		.shuffled {
			animation: none;
		}
	}
</style>
