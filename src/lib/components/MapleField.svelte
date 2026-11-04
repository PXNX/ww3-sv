<!--
	Maple Reserve Heist playfield: the warehouse seen from above as one SVG. Shelves, the truck,
	barrels on the floor, the cart (head plus the barrels in tow), and the moose guards with their
	vision cones (hatched as well as red, so the cones never depend on colour alone), the lever,
	gadget pads, noise pulses and particles. Controls:
	arrow keys or WASD step the cart, Space or the dot key waits a tick, a swipe on the floor steps
	too. The playfield never mirrors in right-to-left languages and never scrolls.
-->
<script lang="ts">
	import {
		isGadgetKey,
		isRewindKey,
		isWaitKey,
		keyDirection,
		swipeDirection
	} from '#lib/game/maple/input.js';
	import { cellsSeenBy, guardCell } from '#lib/game/maple/state.js';
	import { m } from '#lib/paraglide/messages.js';
	import type { MapleGame } from '#lib/stores/mapleGame.svelte.js';
	import MapleMoose from './MapleMoose.svelte';

	let { game, active = true }: { game: MapleGame; active?: boolean } = $props();

	/** One cell is 40 units wide in the drawing */
	const U = 40;

	const state = $derived(game.state);
	const level = $derived(state.level);
	const cones = $derived(
		level.guards.flatMap((_guard, guard) =>
			cellsSeenBy(state, guard).map((cell, order) => ({
				...cell,
				order,
				key: `${guard}:${cell.row}:${cell.col}`
			}))
		)
	);
	/** Every second floor tile is lighter, like a checkerboard */
	const tiles = $derived(
		Array.from({ length: level.width * level.height }, (_, index) => ({
			row: Math.floor(index / level.width),
			col: index % level.width,
			key: index
		})).filter((tile) => (tile.row + tile.col) % 2 === 0)
	);
	const shelves = $derived(
		level.walls.flatMap((line, row) =>
			line.flatMap((wall, col) => (wall ? [{ row, col, key: `${row}:${col}` }] : []))
		)
	);

	let swipeStart: { id: number; x: number; y: number } | null = null;

	function onKeydown(event: KeyboardEvent) {
		if (!active || event.ctrlKey || event.metaKey || event.altKey) return;
		const dir = keyDirection(event.code);
		if (dir) {
			event.preventDefault();
			game.step(dir);
		} else if (isGadgetKey(event.code)) {
			if (event.target instanceof HTMLButtonElement) return;
			event.preventDefault();
			game.useGadget();
		} else if (isRewindKey(event.code)) {
			event.preventDefault();
			game.rewind();
		} else if (isWaitKey(event.code)) {
			// On a focused button, Space belongs to the button
			if (event.target instanceof HTMLButtonElement && event.code === 'Space') return;
			event.preventDefault();
			game.waitTick();
		}
	}

	function onPointerDown(event: PointerEvent) {
		if (!active || swipeStart) return;
		swipeStart = { id: event.pointerId, x: event.clientX, y: event.clientY };
		(event.currentTarget as Element).setPointerCapture?.(event.pointerId);
	}

	function onPointerUp(event: PointerEvent) {
		if (!swipeStart || swipeStart.id !== event.pointerId) return;
		const dir = swipeDirection(event.clientX - swipeStart.x, event.clientY - swipeStart.y);
		swipeStart = null;
		if (dir) game.step(dir);
	}

	function onPointerCancel() {
		swipeStart = null;
	}

	const place = (row: number, col: number) => `transform: translate(${col * U}px, ${row * U}px)`;
	/** The head squashes along the way it moved: wide steps stretch it sideways */
	const horizontal = $derived(game.lastDir === 'left' || game.lastDir === 'right');
	const hidden = $derived(state.hidden > 0);
	const frozen = $derived(state.freeze > 0);
	const sparkles = $derived(
		level.barrels.flatMap((barrel, index) =>
			state.barrels[index] === 'floor' ? [{ ...barrel, golden: level.golden[index], index }] : []
		)
	);
	const pulses = $derived(game.fx.filter((item) => item.kind === 'pulse'));
	const particles = $derived(game.fx.filter((item) => item.kind !== 'pulse'));
</script>

<svelte:window onkeydown={onKeydown} />

<div
	data-playfield
	class="relative w-full touch-none select-none"
	class:maple-hurt-odd={!game.reducedMotion && game.hurtCount % 2 === 1}
	class:maple-hurt-even={!game.reducedMotion && game.hurtCount > 0 && game.hurtCount % 2 === 0}
	style:touch-action="none"
>
	<svg
		viewBox="0 0 {level.width * U} {level.height * U}"
		class="block w-full rounded-[10px_6px_12px_8px] border-3 border-ink bg-sand shadow-[4px_4px_0_var(--color-ink)]"
		role="img"
		aria-label={m.maple_playfield_label()}
		onpointerdown={onPointerDown}
		onpointerup={onPointerUp}
		onpointercancel={onPointerCancel}
	>
		<defs>
			<!-- Diagonal stripes over the cones: the shape tells "seen", not only the colour -->
			<pattern id="maple-hatch" width="8" height="8" patternUnits="userSpaceOnUse">
				<path
					d="M-2 2 L2 -2 M0 8 L8 0 M6 10 L10 6"
					stroke="var(--color-tie-red)"
					stroke-width="2"
				/>
			</pattern>
		</defs>

		<!-- Floor tiles -->
		{#each tiles as tile (tile.key)}
			<rect
				x={tile.col * U}
				y={tile.row * U}
				width={U}
				height={U}
				fill="var(--color-paper)"
				opacity="0.35"
			/>
		{/each}

		<!-- Shelves: stacked planks -->
		{#each shelves as shelf (shelf.key)}
			<g stroke="var(--color-ink)" stroke-width="2" stroke-linejoin="round">
				<rect x={shelf.col * U} y={shelf.row * U} width={U} height={U} fill="#8a5a2b" />
				<path
					d="M{shelf.col * U} {shelf.row * U + U / 3} h{U} M{shelf.col * U} {shelf.row * U +
						(U * 2) / 3} h{U}"
					fill="none"
				/>
			</g>
		{/each}

		<!-- The truck: a red lorry with a loading ramp -->
		<g style={place(level.truck.row, level.truck.col)} stroke="var(--color-ink)" stroke-width="2">
			<rect x="2" y="6" width="24" height="26" rx="3" fill="var(--color-tie-red)" />
			<rect x="26" y="12" width="12" height="20" rx="2" fill="var(--color-paper)" />
			<rect x="29" y="15" width="6" height="6" fill="var(--color-flag-blue)" />
			<circle cx="11" cy="33" r="4" fill="var(--color-ink)" />
			<circle cx="30" cy="33" r="4" fill="var(--color-ink)" />
		</g>

		{#if !state.lever}
			<g
				transform="translate({level.truck.col * U + 20} {level.truck.row * U + 14})"
				stroke="var(--color-ink)"
				stroke-width="2"
			>
				<rect x="-6" y="-2" width="12" height="10" rx="2" fill="var(--color-explosion-yellow)" />
				<path d="M-3 -2 v-4 a3 3 0 0 1 6 0 v4" fill="none" />
			</g>
		{/if}

		<!-- The lever that unlocks the truck -->
		{#if level.lever}
			<g
				style={place(level.lever.row, level.lever.col)}
				stroke="var(--color-ink)"
				stroke-width="2"
				stroke-linecap="round"
			>
				<rect x="8" y="26" width="24" height="8" rx="2" fill="#8a5a2b" />
				<g class="maple-lever" class:maple-lever-on={state.lever}>
					<path d="M20 28 L20 10" fill="none" stroke-width="4" />
					<circle
						cx="20"
						cy="9"
						r="4.5"
						fill={state.lever ? 'var(--color-flag-blue)' : 'var(--color-tie-red)'}
					/>
				</g>
			</g>
		{/if}

		<!-- Gadget pads: a coffee cup and a toque, bobbing while they lie there -->
		{#each level.pads as pad, index (index)}
			<g style={place(pad.cell.row, pad.cell.col)} stroke="var(--color-ink)" stroke-width="2">
				<ellipse cx="20" cy="30" rx="13" ry="6" fill="var(--color-paper)" opacity="0.7" />
				{#if state.pads[index]}
					<g class:maple-bob={!game.reducedMotion}>
						{#if state.pads[index] === 'coffee'}
							<rect x="12" y="12" width="14" height="14" rx="3" fill="#ffffff" />
							<path d="M26 15 h4 a3 3 0 0 1 0 8 h-4" fill="none" />
							<path d="M15 9 q2 -3 0 -5 M21 9 q2 -3 0 -5" fill="none" stroke-width="1.5" />
						{:else}
							<path d="M10 26 q0 -14 10 -14 q10 0 10 14 z" fill="var(--color-tie-red)" />
							<rect x="9" y="24" width="22" height="5" rx="2" fill="var(--color-paper)" />
							<circle cx="20" cy="10" r="3" fill="var(--color-paper)" />
						{/if}
					</g>
				{/if}
			</g>
		{/each}

		<!-- Barrels on the floor -->
		{#each level.barrels as barrel, index (index)}
			{#if state.barrels[index] === 'floor'}
				<g style={place(barrel.row, barrel.col)} stroke="var(--color-ink)" stroke-width="2">
					<circle
						cx="20"
						cy="20"
						r="13"
						fill={level.golden[index] ? '#f2c230' : '#c8791a'}
						class:maple-glow={level.golden[index] && !game.reducedMotion}
					/>
					<path d="M9 14 Q20 18 31 14 M9 26 Q20 22 31 26" fill="none" />
					<path d="M20 12 l3 5 -6 0 z" fill="var(--color-paper)" stroke-width="1.5" />
				</g>
			{/if}
		{/each}

		<!-- Loot sparkle: little stars twinkling on the barrels, more on the golden one -->
		{#if !game.reducedMotion}
			{#each sparkles as spot (spot.index)}
				<g style={place(spot.row, spot.col)} fill="var(--color-explosion-yellow)" stroke="none">
					<path
						class="maple-twinkle"
						style:animation-delay="{(spot.index % 5) * 260}ms"
						d="M31 6 l1.5 3.5 l3.5 1.5 l-3.5 1.5 l-1.5 3.5 l-1.5 -3.5 l-3.5 -1.5 l3.5 -1.5 z"
					/>
					{#if spot.golden}
						<path
							class="maple-twinkle"
							style:animation-delay="500ms"
							d="M8 24 l1 2.5 l2.5 1 l-2.5 1 l-1 2.5 l-1 -2.5 l-2.5 -1 l2.5 -1 z"
						/>
					{/if}
				</g>
			{/each}
		{/if}

		<!-- Noise pulse: how far the last step carried along the aisles -->
		{#each pulses as item (item.id)}
			<circle
				class="maple-pulse"
				cx={item.cell.col * U + 20}
				cy={item.cell.row * U + 20}
				r={(item.radius ?? 2) * U}
				fill="none"
				stroke="var(--color-flag-blue)"
				stroke-width="2.5"
				onanimationend={() => game.dropFx(item.id)}
			/>
		{/each}

		<!-- Vision cones, under the cart and the moose -->
		{#each cones as cone (cone.key)}
			<rect
				class="maple-cone"
				style:animation-delay="{cone.order * 45}ms"
				x={cone.col * U + 1}
				y={cone.row * U + 1}
				width={U - 2}
				height={U - 2}
				fill="var(--color-tie-red)"
				opacity={frozen ? 0.1 : 0.22}
			/>
			<rect
				x={cone.col * U + 1}
				y={cone.row * U + 1}
				width={U - 2}
				height={U - 2}
				fill="url(#maple-hatch)"
				stroke="var(--color-tie-red)"
				stroke-width="1.5"
				stroke-dasharray="4 3"
				opacity="0.75"
			/>
		{/each}

		<!-- The cart: the tail first, so the head is drawn on top -->
		{#each state.cart as part, index (index)}
			{@const isHead = index === 0}
			<g
				class="maple-glide"
				class:maple-still={game.reducedMotion}
				style={place(part.row, part.col)}
				style:transition-delay="{game.reducedMotion ? 0 : index * 25}ms"
				stroke="var(--color-ink)"
				stroke-width="2"
				opacity={hidden ? 0.45 : 1}
			>
				{#key isHead ? game.moveSeq : 0}
					<g
						class="maple-body"
						class:maple-squash-x={isHead && !game.reducedMotion && horizontal && game.moveSeq > 0}
						class:maple-squash-y={isHead && !game.reducedMotion && !horizontal && game.moveSeq > 0}
					>
						<rect x="5" y="5" width="30" height="30" rx="4" fill="var(--color-flag-blue)" />
						{#if isHead}
							<path d="M12 12 H28 M12 28 H28" fill="none" />
							<circle cx="20" cy="20" r="5" fill="var(--color-explosion-yellow)" />
						{:else}
							<circle cx="20" cy="20" r="11" fill="#c8791a" />
							<path d="M10 15 Q20 19 30 15 M10 25 Q20 21 30 25" fill="none" />
						{/if}
					</g>
				{/key}
			</g>
		{/each}

		<!-- The moose -->
		{#each level.guards as guard, index (index)}
			{@const at = guardCell(state, index)}
			<g class="maple-glide" class:maple-still={game.reducedMotion} style={place(at.row, at.col)}>
				<g class:maple-frozen={frozen}>
					<MapleMoose
						facing={state.guards[index].facing === 'left' ? 'left' : 'right'}
						boss={guard.boss}
					/>
				</g>
				{#if frozen}
					<text
						x="20"
						y="4"
						text-anchor="middle"
						font-size="12"
						font-weight="700"
						fill="var(--color-flag-blue)"
						stroke="none">zZ</text
					>
				{/if}
				{#if state.alerted.includes(index)}
					{#key game.alertCount}
						<g class="maple-bubble" stroke="var(--color-ink)" stroke-width="2">
							<circle cx="20" cy="-2" r="8" fill="var(--color-explosion-yellow)" />
							<text
								x="20"
								y="3"
								text-anchor="middle"
								font-size="13"
								font-weight="800"
								fill="var(--color-ink)"
								stroke="none">?</text
							>
						</g>
					{/key}
				{/if}
			</g>
		{/each}

		<!-- "Sorry!" from the moose that spotted the cart -->
		{#if state.caught !== null}
			{@const at = guardCell(state, state.caught)}
			{@const x = Math.min(Math.max(at.col * U + U / 2, 40), level.width * U - 40)}
			{@const y = Math.max(at.row * U - 4, 16)}
			<g class="maple-bubble" stroke="var(--color-ink)" stroke-width="2" stroke-linejoin="round">
				<rect x={x - 34} y={y - 16} width="68" height="24" rx="8" fill="var(--color-paper)" />
				<path d="M{x - 4} {y + 8} l4 7 l4 -7" fill="var(--color-paper)" />
				<text
					{x}
					y={y + 1}
					text-anchor="middle"
					font-family="'Baloo 2', system-ui, sans-serif"
					font-size="15"
					font-weight="700"
					fill="var(--color-ink)"
					stroke="none">{m.maple_sorry()}</text
				>
			</g>
		{/if}

		<!-- Particles: dust puffs, sparks and coins hopping in an arc -->
		{#each particles as item (item.id)}
			<g transform="translate({item.cell.col * U + 20} {item.cell.row * U + 20})">
				<g
					class="maple-particle maple-{item.kind}"
					style:--dx="{item.dx * U}px"
					style:--up="{item.up * U}px"
					style:--fall="{item.fall * U}px"
					onanimationend={() => game.dropFx(item.id)}
				>
					{#if item.kind === 'coin'}
						<circle
							r="5"
							fill="var(--color-explosion-yellow)"
							stroke="var(--color-ink)"
							stroke-width="1.5"
						/>
					{:else if item.kind === 'spark'}
						<path
							d="M0 -5 L1.5 -1.5 L5 0 L1.5 1.5 L0 5 L-1.5 1.5 L-5 0 L-1.5 -1.5 Z"
							fill="var(--color-explosion-yellow)"
						/>
					{:else}
						<circle r="4" fill="var(--color-ink)" opacity="0.25" />
					{/if}
				</g>
			</g>
		{/each}
	</svg>
	{#if game.hurtCount > 0 && !game.reducedMotion}
		{#key game.hurtCount}
			<div
				class="maple-flash pointer-events-none absolute inset-0 rounded-[10px_6px_12px_8px]"
			></div>
		{/key}
	{/if}
</div>

<style>
	/* A little overshoot, so the cart and the moose settle like something with weight */
	.maple-glide {
		transition: transform 190ms cubic-bezier(0.34, 1.4, 0.64, 1);
	}

	.maple-body {
		transform-box: fill-box;
		transform-origin: center bottom;
	}

	.maple-squash-x {
		animation: maple-squash-x 230ms ease-out;
	}

	.maple-squash-y {
		animation: maple-squash-y 230ms ease-out;
	}

	@keyframes maple-squash-x {
		0% {
			transform: scale(0.78, 1.18);
		}
		45% {
			transform: scale(1.2, 0.86);
		}
		100% {
			transform: scale(1, 1);
		}
	}

	@keyframes maple-squash-y {
		0% {
			transform: scale(1.18, 0.78);
		}
		45% {
			transform: scale(0.86, 1.2);
		}
		100% {
			transform: scale(1, 1);
		}
	}

	/* The cones fade in outward from the moose, like a beam sweeping across the floor */
	.maple-cone {
		animation: maple-cone-in 260ms ease-out backwards;
	}

	@keyframes maple-cone-in {
		from {
			opacity: 0;
		}
	}

	.maple-frozen {
		filter: saturate(0.3) brightness(1.2);
	}

	.maple-pulse {
		transform-box: fill-box;
		transform-origin: center;
		animation: maple-pulse 650ms ease-out forwards;
	}

	@keyframes maple-pulse {
		from {
			transform: scale(0.1);
			opacity: 0.9;
		}
		to {
			transform: scale(1);
			opacity: 0;
		}
	}

	.maple-twinkle {
		transform-box: fill-box;
		transform-origin: center;
		animation: maple-twinkle 1.6s ease-in-out infinite;
	}

	@keyframes maple-twinkle {
		0%,
		100% {
			transform: scale(0);
			opacity: 0;
		}
		50% {
			transform: scale(1);
			opacity: 1;
		}
	}

	.maple-bob {
		animation: maple-bob 1.2s ease-in-out infinite;
	}

	@keyframes maple-bob {
		50% {
			transform: translateY(-3px);
		}
	}

	.maple-glow {
		animation: maple-glow 1.4s ease-in-out infinite;
	}

	@keyframes maple-glow {
		50% {
			opacity: 0.7;
		}
	}

	.maple-lever {
		transform-box: fill-box;
		transform-origin: 50% 100%;
		transition: transform 260ms cubic-bezier(0.34, 1.6, 0.64, 1);
	}

	.maple-lever-on {
		transform: rotate(60deg);
	}

	/* A particle hops up in an arc and falls: it rises with an ease-out and drops with an ease-in, like gravity */
	.maple-particle {
		animation: maple-hop 800ms linear forwards;
	}

	.maple-dust {
		animation-name: maple-puff;
	}

	@keyframes maple-hop {
		0% {
			transform: translate(0, 0);
			opacity: 1;
			animation-timing-function: cubic-bezier(0.2, 0.7, 0.4, 1);
		}
		40% {
			transform: translate(calc(var(--dx) * 0.4), calc(var(--up) * -1));
			opacity: 1;
			animation-timing-function: cubic-bezier(0.6, 0, 0.9, 0.6);
		}
		100% {
			transform: translate(var(--dx), var(--fall));
			opacity: 0;
		}
	}

	@keyframes maple-puff {
		from {
			transform: translate(0, 8px) scale(0.5);
			opacity: 0.8;
		}
		to {
			transform: translate(calc(var(--dx) * 0.3), -6px) scale(1.8);
			opacity: 0;
		}
	}

	.maple-flash {
		background: radial-gradient(transparent 40%, rgb(229 72 77 / 0.55));
		animation: maple-flash 450ms ease-out forwards;
	}

	@keyframes maple-flash {
		from {
			opacity: 1;
		}
		to {
			opacity: 0;
		}
	}

	.maple-still {
		transition: none;
	}

	/* A short shake when a moose spots the cart; two classes so every hurt replays the animation */
	.maple-hurt-odd {
		animation: maple-shake-odd 320ms ease-out;
	}

	.maple-hurt-even {
		animation: maple-shake-even 320ms ease-out;
	}

	.maple-bubble {
		transform-box: fill-box;
		transform-origin: center bottom;
		animation: maple-pop 220ms ease-out;
	}

	@keyframes maple-shake-odd {
		20% {
			transform: translateX(-5px);
		}
		50% {
			transform: translateX(5px);
		}
		80% {
			transform: translateX(-3px);
		}
	}

	@keyframes maple-shake-even {
		20% {
			transform: translateX(-5px);
		}
		50% {
			transform: translateX(5px);
		}
		80% {
			transform: translateX(-3px);
		}
	}

	@keyframes maple-pop {
		from {
			transform: scale(0.6);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.maple-glide,
		.maple-hurt-odd,
		.maple-hurt-even,
		.maple-bubble,
		.maple-cone,
		.maple-pulse,
		.maple-twinkle,
		.maple-bob,
		.maple-glow,
		.maple-lever,
		.maple-squash-x,
		.maple-squash-y,
		.maple-particle,
		.maple-flash {
			transition: none;
			animation: none;
		}
	}
</style>
