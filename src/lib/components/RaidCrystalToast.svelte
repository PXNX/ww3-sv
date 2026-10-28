<!--
	A crystal was picked up: a banner drops in at the top, with the crystal spinning in on a burst
	of light in its rarity's colour, its name, and a shine sweeping over it. It goes again by itself.
-->
<script lang="ts">
	import { m } from '#lib/paraglide/messages.js';
	import { RARITY_COLOR } from '#lib/game/raid/config.js';
	import type { Crystal } from '#lib/game/raid/items.js';
	import RaidCrystalIcon from './RaidCrystalIcon.svelte';
	import { crystalName, RARITY_NAMES } from './raidText';

	let { crystal }: { crystal: Crystal } = $props();

	const color = $derived(RARITY_COLOR[crystal.rarity]);
</script>

<div
	class="pointer-events-none toast relative flex items-center gap-2.5 overflow-hidden rounded-xl border-b-4 bg-[#1b1036]/90 py-1.5 ps-2 pe-4 text-white shadow-[0_4px_0_rgb(0_0_0/0.3)]"
	style:border-color={color}
	style:--glow={color}
	role="status"
>
	<span class="relative flex size-11 shrink-0 items-center justify-center">
		<span class="burst absolute inset-0 rounded-full" aria-hidden="true"></span>
		<RaidCrystalIcon kind={crystal.kind} rarity={crystal.rarity} class="gem relative size-10" />
	</span>
	<span class="flex min-w-0 flex-col leading-tight">
		<span class="font-display text-xs font-black text-[#ffd23a] uppercase italic"
			>{m.raid_popup_crystal()}</span
		>
		<span dir="auto" class="truncate font-display text-sm font-black">{crystalName(crystal)}</span>
		<span class="font-display text-[0.65rem] font-bold uppercase" style:color
			>{RARITY_NAMES[crystal.rarity]()}</span
		>
	</span>
	<span class="shine absolute inset-0" aria-hidden="true"></span>
</div>

<style>
	.toast {
		animation: drop-in 420ms cubic-bezier(0.34, 1.56, 0.64, 1) both;
	}

	@keyframes drop-in {
		from {
			opacity: 0;
			translate: 0 -24px;
			scale: 0.8;
		}
	}

	.burst {
		background: radial-gradient(circle, var(--glow), transparent 70%);
		animation: burst 900ms ease-out both;
	}

	@keyframes burst {
		from {
			scale: 0.3;
			opacity: 1;
		}
		to {
			scale: 2.2;
			opacity: 0;
		}
	}

	.toast :global(.gem) {
		animation: spin-in 600ms cubic-bezier(0.34, 1.56, 0.64, 1) both;
	}

	@keyframes spin-in {
		from {
			rotate: -200deg;
			scale: 0.2;
		}
	}

	.shine {
		background: linear-gradient(
			105deg,
			transparent 35%,
			rgb(255 255 255 / 0.35) 50%,
			transparent 65%
		);
		translate: -120% 0;
		animation: shine 1100ms 250ms ease-in-out both;
	}

	@keyframes shine {
		to {
			translate: 120% 0;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.toast,
		.burst,
		.toast :global(.gem),
		.shine {
			animation: none;
		}

		.burst,
		.shine {
			opacity: 0;
		}
	}
</style>
