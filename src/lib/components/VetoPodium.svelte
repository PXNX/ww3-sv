<!--
	One permanent seat at the Security Council table: a generic cartoon delegate behind a podium that
	carries the seat's Circle Flags icon, holding up a card (aye, nay or meh). No insignia, no
	likeness of anyone: only a suit colour, a skin tone and a hairdo tell the five delegates apart.
-->
<script lang="ts">
	import type { Component } from 'svelte';
	import type { SvelteHTMLElements } from 'svelte/elements';
	import type { SeatId } from '#lib/game/veto/seats.js';
	import type { Stance } from '#lib/game/veto/vote.js';
	import { m } from '#lib/paraglide/messages.js';
	import IconCn from '~icons/circle-flags/cn';
	import IconFr from '~icons/circle-flags/fr';
	import IconGb from '~icons/circle-flags/gb';
	import IconRu from '~icons/circle-flags/ru';
	import IconUs from '~icons/circle-flags/us';
	import IconAye from '~icons/lucide/check';
	import IconMeh from '~icons/lucide/minus';
	import IconNay from '~icons/lucide/x';
	import { cardName, seatName } from './vetoText.js';

	type Icon = Component<SvelteHTMLElements['svg']>;

	let {
		seat,
		card,
		position,
		/** The card matches what the majority wants: ringed once the verdict is up */
		marked = false,
		/** The card is in the minority: dimmed once the verdict is up */
		dimmed = false
	}: {
		seat: SeatId;
		card: Stance;
		/** 0 to 4, staggers the card flip */
		position: number;
		marked?: boolean;
		dimmed?: boolean;
	} = $props();

	const FLAGS: Record<SeatId, Icon> = {
		us: IconUs,
		gb: IconGb,
		fr: IconFr,
		ru: IconRu,
		cn: IconCn
	};
	const CARD_ICONS: Record<Stance, Icon> = { aye: IconAye, nay: IconNay, meh: IconMeh };
	const CARD_CLASS: Record<Stance, string> = {
		aye: 'bg-[#8fd19e]',
		nay: 'bg-tie-red text-paper',
		meh: 'bg-explosion-yellow'
	};
	// Suit, skin and hair per seat: generic cartoon delegates, in the order of the table
	const LOOKS: Record<SeatId, { suit: string; skin: string; hair: string }> = {
		us: { suit: '#3a5a99', skin: '#f6c9a0', hair: '#d9b45a' },
		gb: { suit: '#4b4f5c', skin: '#f2d2b6', hair: '#a9552f' },
		fr: { suit: '#2f6f5e', skin: '#d9a273', hair: '#3b2a20' },
		ru: { suit: '#7a3b4a', skin: '#f6c9a0', hair: '#8a8f99' },
		cn: { suit: '#b0442f', skin: '#e8b98a', hair: '#1c1c1c' }
	};

	const Flag = $derived(FLAGS[seat]);
	const CardIcon = $derived(CARD_ICONS[card]);
	const look = $derived(LOOKS[seat]);
</script>

<div
	class="flex min-w-0 flex-1 flex-col items-center"
	role="group"
	aria-label={m.veto_seat_card_aria({ seat: seatName(seat), card: cardName(card) })}
>
	{#key card}
		<div
			class="deal flex aspect-[3/4] w-full max-w-[4.5rem] flex-col items-center justify-center gap-0.5 rounded-md border-3 border-ink px-0.5 shadow-[2px_2px_0_var(--color-ink)] transition-[box-shadow,filter] {CARD_CLASS[
				card
			]}"
			class:marked
			class:grayscale={dimmed}
			style:--i={position}
		>
			<CardIcon class="size-5 sm:size-7" aria-hidden="true" />
			<span
				dir="auto"
				class="max-w-full truncate font-display text-[0.65rem] leading-none font-bold sm:text-xs"
			>
				{cardName(card)}
			</span>
		</div>
	{/key}

	<svg viewBox="0 0 60 44" class="-mt-1 w-full max-w-[4.5rem]" aria-hidden="true">
		<!-- Shoulders, collar and tie -->
		<path
			d="M4 44 C4 30 14 25 30 25 C46 25 56 30 56 44 Z"
			fill={look.suit}
			stroke="#111111"
			stroke-width="2.5"
			stroke-linejoin="round"
		/>
		<path d="M24 25 L30 34 L36 25 Z" fill="#ffffff" stroke="#111111" stroke-width="2" />
		<path d="M30 30 L27.5 44 L32.5 44 Z" fill="#e5484d" stroke="#111111" stroke-width="1.5" />
		<!-- Head and hair -->
		<circle cx="30" cy="14" r="11" fill={look.skin} stroke="#111111" stroke-width="2.5" />
		<path
			d="M19.5 12 C20 3 40 3 40.5 12 C36 8 24 8 19.5 12 Z"
			fill={look.hair}
			stroke="#111111"
			stroke-width="2"
			stroke-linejoin="round"
		/>
		<circle cx="26" cy="15.5" r="1.4" fill="#111111" />
		<circle cx="34" cy="15.5" r="1.4" fill="#111111" />
		<path d="M26.5 20 Q30 22 33.5 20" fill="none" stroke="#111111" stroke-width="1.6" />
	</svg>

	<div
		class="-mt-5 flex w-full max-w-[4.5rem] flex-col items-center gap-0.5 rounded-t-lg border-3 border-ink bg-banner-slate px-0.5 pt-1 pb-1 shadow-[2px_2px_0_var(--color-ink)]"
	>
		<Flag class="size-6 sm:size-8" aria-hidden="true" />
		<span
			dir="auto"
			class="max-w-full truncate font-display text-[0.6rem] leading-none font-bold text-paper sm:text-[0.7rem]"
		>
			{seatName(seat)}
		</span>
	</div>
</div>

<style>
	.deal {
		animation: deal 260ms ease-out both;
		animation-delay: calc(var(--i) * 45ms);
	}

	.marked {
		box-shadow:
			0 0 0 3px var(--color-paper),
			0 0 0 6px var(--color-ink);
	}

	@keyframes deal {
		from {
			transform: translateY(0.75rem) rotateY(90deg);
			opacity: 0;
		}
		to {
			transform: none;
			opacity: 1;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.deal {
			animation: none;
		}
	}
</style>
