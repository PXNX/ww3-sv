<!--
	The oil derrick: a big tap target drawn as an original cartoon (a lattice tower and a nodding
	pumpjack on a patch of oily ground). A tap pumps barrels (pointer-down for instant response,
	Space or Enter through the click a keyboard produces), a little gusher squirts and a floating
	"+N" rises from the spot that was tapped.
-->
<script lang="ts">
	import { onDestroy } from 'svelte';
	import { formatBig } from '#lib/game/tycoon/format.js';
	import { getLocale } from '#lib/paraglide/runtime.js';
	import { m } from '#lib/paraglide/messages.js';
	import type { TycoonGame } from '#lib/stores/tycoonGame.svelte.js';

	let { game }: { game: TycoonGame } = $props();

	const locale = getLocale();
	const FLOATER_MS = 800;

	interface Floater {
		id: number;
		x: number;
		y: number;
		text: string;
	}

	let floaters = $state.raw<Floater[]>([]);
	let nextId = 0;
	let area: HTMLElement | undefined = $state();
	let art: SVGSVGElement | undefined = $state();
	let timers: ReturnType<typeof setTimeout>[] = [];
	onDestroy(() => timers.forEach(clearTimeout));

	function pump(x: number, y: number) {
		const gained = game.tap();
		if (game.status !== 'playing') return;
		if (!game.reducedMotion) {
			art?.animate(
				[{ transform: 'scale(1)' }, { transform: 'scale(0.965)' }, { transform: 'scale(1)' }],
				{ duration: 160, easing: 'ease-out' }
			);
		}
		const id = ++nextId;
		const text = gained > 0 ? `+${formatBig(gained, locale, 1)}` : '0';
		floaters = [...floaters.slice(-7), { id, x, y, text }];
		const timer = setTimeout(() => {
			floaters = floaters.filter((floater) => floater.id !== id);
			timers = timers.filter((other) => other !== timer);
		}, FLOATER_MS);
		timers.push(timer);
	}

	function onPointerDown(event: PointerEvent) {
		if (event.button > 0 || !area) return;
		const rect = area.getBoundingClientRect();
		pump(event.clientX - rect.left, event.clientY - rect.top);
	}

	// A click with no pointer behind it (detail 0) comes from the keyboard
	function onClick(event: MouseEvent) {
		if (event.detail !== 0 || !area) return;
		const rect = area.getBoundingClientRect();
		pump(rect.width / 2, rect.height / 3);
	}
</script>

<div bind:this={area} class="relative w-full select-none">
	<button
		type="button"
		class="tycoon-derrick block w-full cursor-pointer rounded-[16px_10px_18px_8px] border-3 border-ink bg-flag-blue shadow-[4px_4px_0_var(--color-ink)] focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-ink"
		style:touch-action="none"
		style:-webkit-tap-highlight-color="transparent"
		aria-label={m.tycoon_derrick_label({ amount: formatBig(game.tapGain, locale, 1) })}
		onpointerdown={onPointerDown}
		onclick={onClick}
	>
		<svg
			bind:this={art}
			viewBox="0 0 260 200"
			class="block h-auto w-full"
			aria-hidden="true"
			focusable="false"
		>
			<g stroke="#111" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">
				<!-- sky: a sun and a cloud -->
				<circle cx="212" cy="38" r="20" fill="#F5C83A" />
				<path d="M28 52 Q30 36 48 38 Q56 24 74 34 Q92 32 90 50 Z" fill="#FFFFFF" stroke-width="3" />
				<!-- ground with a dark puddle of crude -->
				<path d="M0 150 Q70 136 130 148 T260 144 V200 H0 Z" fill="#C9A66B" />
				<ellipse cx="128" cy="176" rx="46" ry="9" fill="#2A2A2A" stroke-width="3" />
				<!-- the lattice derrick tower -->
				<path d="M78 30 L48 150 M78 30 L108 150 M54 126 H102 M60 100 H96 M66 74 H90" fill="none" />
				<path
					d="M54 126 L102 100 M102 126 L60 100 M60 100 L96 74 M96 100 L66 74"
					fill="none"
					stroke-width="2.5"
				/>
				<rect x="66" y="22" width="24" height="12" rx="3" fill="#E5484D" />
				<!-- the pumpjack: base, post, nodding beam, counterweight -->
				<rect x="140" y="138" width="86" height="14" rx="3" fill="#6A7C9B" />
				<path d="M176 138 L196 138 L190 98 L182 98 Z" fill="#6A7C9B" />
				<g class="tycoon-beam">
					<path d="M126 92 Q108 96 106 118 L124 118 Z" fill="#DDB93C" />
					<rect x="124" y="90" width="116" height="14" rx="5" fill="#DDB93C" />
					<rect x="226" y="98" width="20" height="30" rx="4" fill="#4A4A4A" />
				</g>
				<circle cx="186" cy="97" r="7" fill="#111" />
				<path d="M236 128 L214 138" fill="none" />
			</g>
			<!-- a little gusher out of the tower top -->
			<g fill="#1B1B1B" stroke="#111" stroke-width="2">
				{#key game.tapCount}
					<g class="tycoon-gush">
						<circle cx="78" cy="14" r="5" />
						<circle cx="68" cy="22" r="3.5" />
						<circle cx="90" cy="20" r="3.5" />
					</g>
				{/key}
			</g>
		</svg>
		<span
			class="pointer-events-none absolute inset-x-0 bottom-2 mx-auto w-fit rounded-full border-3 border-ink bg-explosion-yellow px-3 py-0.5 font-display text-sm font-bold"
			dir="auto"
		>
			{m.tycoon_tap_hint()}
		</span>
	</button>

	{#each floaters as floater (floater.id)}
		<span
			class="tycoon-floater pointer-events-none absolute z-10 font-display text-3xl font-bold text-paper [-webkit-text-stroke:5px_var(--color-ink)] [paint-order:stroke]"
			style:left="{floater.x}px"
			style:top="{floater.y}px"
			aria-hidden="true"
		>
			{floater.text}
		</span>
	{/each}
</div>

<style>
	.tycoon-beam {
		transform-origin: 186px 97px;
		animation: tycoon-nod 1.8s ease-in-out infinite alternate;
	}

	.tycoon-gush {
		animation: tycoon-gush 600ms ease-out forwards;
		opacity: 0;
	}

	.tycoon-floater {
		translate: -50% -50%;
		animation: tycoon-float 800ms ease-out forwards;
	}

	@keyframes tycoon-nod {
		from {
			transform: rotate(-5deg);
		}
		to {
			transform: rotate(5deg);
		}
	}

	@keyframes tycoon-gush {
		0% {
			transform: translateY(8px);
			opacity: 1;
		}
		100% {
			transform: translateY(-14px);
			opacity: 0;
		}
	}

	@keyframes tycoon-float {
		0% {
			transform: translateY(0) scale(0.8);
			opacity: 1;
		}
		100% {
			transform: translateY(-64px) scale(1.15);
			opacity: 0;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.tycoon-beam,
		.tycoon-gush {
			animation: none;
		}

		.tycoon-floater {
			animation-duration: 400ms;
		}
	}
</style>
