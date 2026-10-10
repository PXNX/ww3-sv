<!--
	The Belt & Road grid. Press on a port and drag to draw its trade route through the cells; the shared
	PointerDrag helper tracks the pointer and cellAt turns it into a cell, so one gesture works for
	mouse, pen and touch. Dragging back over your own line retracts it, dragging into another route
	cuts that route off. Every cell has to be covered. The keyboard draws too: arrow keys move a
	cursor, Enter or Space puts the pen down on a port (or a route) and lifts it again.
-->
<script lang="ts">
	import { m } from '#lib/paraglide/messages.js';
	import { ownerGrid, type Cell } from '#lib/game/beltroad/board.js';
	import { portStyle } from '#lib/game/beltroad/ports.js';
	import { cellAt, PointerDrag } from '#lib/game/pointerDrag.js';
	import type { BeltRoadGame } from '#lib/stores/beltroadGame.svelte.js';
	import BeltRoadPortIcon from './BeltRoadPortIcon.svelte';

	let { game }: { game: BeltRoadGame } = $props();

	const level = $derived(game.level);
	const owners = $derived(ownerGrid(level, game.paths));
	const styles = $derived(level.pairs.map((pair) => portStyle(pair.port)));

	let svgElement: SVGSVGElement | undefined = $state();
	let focused = $state(false);
	/** The keyboard cursor, and whether the pen is down (a stroke is running) */
	let cursor = $state<Cell>([0, 0]);
	let penDown = $state(false);

	function cellFor(point: { x: number; y: number }): Cell | null {
		if (!svgElement) return null;
		const hit = cellAt(svgElement.getBoundingClientRect(), point, level.width, level.height);
		return hit ? [hit.row, hit.col] : null;
	}

	const dragger = new PointerDrag({
		onMove: (session) => {
			const cell = cellFor(session.pointer);
			if (cell) game.dragTo(cell);
		},
		onEnd: () => game.endStroke(),
		onTap: () => game.endStroke(),
		onCancel: () => game.cancelStroke()
	});

	function down(event: PointerEvent) {
		if (game.won || !svgElement) return;
		const cell = cellFor({ x: event.clientX, y: event.clientY });
		if (!cell || !game.beginStroke(cell)) return;
		if (!dragger.begin(event, { capture: svgElement })) {
			game.cancelStroke();
			return;
		}
		// Drawing must not scroll the page or select text
		event.preventDefault();
		focused = false;
	}

	function move(event: PointerEvent) {
		if (dragger.pointerMove(event) && dragger.dragging) event.preventDefault();
	}

	function keyDown(event: KeyboardEvent) {
		if (event.ctrlKey || event.metaKey || event.altKey) return;
		if (event.key === 'Escape') {
			if (dragger.active) dragger.abort();
			if (penDown) {
				game.cancelStroke();
				penDown = false;
			}
			return;
		}
		if (!svgElement || document.activeElement !== svgElement || game.won) return;
		const arrows: Record<string, [number, number]> = {
			ArrowUp: [-1, 0],
			ArrowDown: [1, 0],
			ArrowLeft: [0, -1],
			ArrowRight: [0, 1]
		};
		const delta = arrows[event.key];
		if (delta) {
			event.preventDefault();
			cursor = [
				Math.min(level.height - 1, Math.max(0, cursor[0] + delta[0])),
				Math.min(level.width - 1, Math.max(0, cursor[1] + delta[1]))
			];
			if (penDown) game.dragTo(cursor);
		} else if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			if (penDown) {
				game.endStroke();
				penDown = false;
			} else {
				penDown = game.beginStroke(cursor);
			}
		}
	}

	// A new level or a finished game puts the pen away
	$effect(() => {
		void game.levelIndex;
		if (game.won || game.activePair === null) penDown = false;
	});

	const center = (value: number) => value + 0.5;
	const points = (path: readonly Cell[]) =>
		path.map(([row, col]) => `${center(col)},${center(row)}`).join(' ');
</script>

<svelte:window
	onpointermove={move}
	onpointerup={(event) => dragger.pointerUp(event)}
	onpointercancel={(event) => dragger.pointerCancel(event)}
	onkeydown={keyDown}
/>

<div data-playfield class="relative w-full touch-none select-none" style:touch-action="none">
	<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
	<svg
		bind:this={svgElement}
		role="application"
		aria-roledescription={m.beltroad_board_role()}
		aria-label={m.beltroad_playfield_label()}
		tabindex="0"
		viewBox="0 0 {level.width} {level.height}"
		class="block w-full cursor-crosshair rounded-[10px_6px_12px_8px] border-3 border-ink bg-paper shadow-[4px_4px_0_var(--color-ink)] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ink"
		style:aspect-ratio="{level.width} / {level.height}"
		style:touch-action="none"
		onpointerdown={down}
		onfocus={() => (focused = true)}
		onblur={() => {
			focused = false;
			if (penDown) {
				game.cancelStroke();
				penDown = false;
			}
		}}
	>
		<!-- Cells: tinted by the route that covers them, plain with a dot while still empty -->
		{#each { length: level.height }, row (row)}
			{#each { length: level.width }, col (col)}
				{@const owner = owners[row * level.width + col]}
				<rect
					x={col + 0.03}
					y={row + 0.03}
					width="0.94"
					height="0.94"
					rx="0.12"
					fill={owner >= 0 ? styles[owner].color : 'var(--color-sand)'}
					fill-opacity={owner >= 0 ? 0.32 : 0.7}
				/>
				{#if owner < 0}
					<circle
						cx={center(col)}
						cy={center(row)}
						r="0.07"
						fill="var(--color-ink)"
						opacity="0.35"
					/>
				{/if}
			{/each}
		{/each}

		<!-- Routes: an ink outline under the colored line -->
		{#each game.paths as path, pair (pair)}
			{#if path.length > 1}
				<polyline
					points={points(path)}
					fill="none"
					stroke="var(--color-ink)"
					stroke-width="0.6"
					stroke-linecap="round"
					stroke-linejoin="round"
				/>
			{/if}
		{/each}
		{#each game.paths as path, pair (pair)}
			{#if path.length > 1}
				<polyline
					points={points(path)}
					fill="none"
					stroke={styles[pair].color}
					stroke-width="0.4"
					stroke-linecap="round"
					stroke-linejoin="round"
				/>
			{/if}
		{/each}

		<!-- The tip being drawn -->
		{#if game.activePair !== null && game.paths[game.activePair].length > 0}
			{@const path = game.paths[game.activePair]}
			{@const tip = path[path.length - 1]}
			<circle
				cx={center(tip[1])}
				cy={center(tip[0])}
				r="0.3"
				fill={styles[game.activePair].color}
				stroke="var(--color-ink)"
				stroke-width="0.08"
			/>
		{/if}

		<!-- Ports: the same badge at both ends of a pair; a ring marks a joined pair -->
		{#each level.pairs as pair, index (pair.port)}
			{#each [pair.a, pair.b] as port (`${port[0]},${port[1]}`)}
				{#if game.connected(index)}
					<circle
						cx={center(port[1])}
						cy={center(port[0])}
						r="0.47"
						fill="none"
						stroke="var(--color-paper)"
						stroke-width="0.07"
					/>
				{/if}
				<BeltRoadPortIcon
					glyph={styles[index].glyph}
					color={styles[index].color}
					x={port[1] + 0.1}
					y={port[0] + 0.1}
					width="0.8"
					height="0.8"
				/>
			{/each}
		{/each}

		{#if focused && !game.won}
			<rect
				x={cursor[1] + 0.05}
				y={cursor[0] + 0.05}
				width="0.9"
				height="0.9"
				rx="0.12"
				fill="none"
				stroke="var(--color-ink)"
				stroke-width="0.09"
				stroke-dasharray={penDown ? undefined : '0.2 0.12'}
			/>
		{/if}
	</svg>
</div>
