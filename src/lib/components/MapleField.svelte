<!--
	Maple Reserve Heist playfield: the warehouse seen from above as one SVG. Shelves, the truck,
	barrels on the floor, the cart (head plus the barrels in tow), and the moose guards with their
	vision cones (hatched as well as red, so the cones never depend on colour alone). Controls:
	arrow keys or WASD step the cart, Space or the dot key waits a tick, a swipe on the floor steps
	too. The playfield never mirrors in right-to-left languages and never scrolls.
-->
<script lang="ts">
	import { isWaitKey, keyDirection, swipeDirection } from '#lib/game/maple/input.js';
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
			cellsSeenBy(state, guard).map((cell) => ({
				...cell,
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

		<!-- Barrels on the floor -->
		{#each level.barrels as barrel, index (index)}
			{#if state.barrels[index] === 'floor'}
				<g style={place(barrel.row, barrel.col)} stroke="var(--color-ink)" stroke-width="2">
					<circle cx="20" cy="20" r="13" fill="#c8791a" />
					<path d="M9 14 Q20 18 31 14 M9 26 Q20 22 31 26" fill="none" />
					<path d="M20 12 l3 5 -6 0 z" fill="var(--color-paper)" stroke-width="1.5" />
				</g>
			{/if}
		{/each}

		<!-- Vision cones, under the cart and the moose -->
		{#each cones as cone (cone.key)}
			<rect
				x={cone.col * U + 1}
				y={cone.row * U + 1}
				width={U - 2}
				height={U - 2}
				fill="var(--color-tie-red)"
				opacity="0.22"
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
				stroke="var(--color-ink)"
				stroke-width="2"
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
		{/each}

		<!-- The moose -->
		{#each level.guards as guard, index (index)}
			{@const at = guardCell(state, index)}
			<g class="maple-glide" class:maple-still={game.reducedMotion} style={place(at.row, at.col)}>
				<MapleMoose
					facing={state.guards[index].facing === 'left' ? 'left' : 'right'}
					boss={guard.boss}
				/>
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
	</svg>
</div>

<style>
	.maple-glide {
		transition: transform 140ms ease-out;
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
		.maple-bubble {
			transition: none;
			animation: none;
		}
	}
</style>
