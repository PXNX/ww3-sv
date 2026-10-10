<!--
	The Bureaucracy Maze floor plan, top-down. Walls and doors are drawn only for offices already
	visited; the offices behind their doors show as fog with a question mark, everything else stays
	dark. Locked doors carry the colored badge of the stamp or form that opens them. The goal, the
	counter with Passierschein B-38, is always marked.

	Input, all one step per gesture: swipe in a direction (the shared PointerDrag helper tells a
	swipe from a tap), tap an office to step towards it, the arrow keys or WASD, and the d-pad next
	to this board.
-->
<script lang="ts">
	import { ITEM_COLORS } from '#lib/game/maze/items.js';
	import {
		DIRECTIONS,
		colOf,
		neighbour,
		rowOf,
		type Direction,
		type ItemKind
	} from '#lib/game/maze/maze.js';
	import { directionOfVector, directionToward } from '#lib/game/maze/play.js';
	import { cellAt, PointerDrag } from '#lib/game/pointerDrag.js';
	import { m } from '#lib/paraglide/messages.js';
	import type { MazeGame } from '#lib/stores/mazeGame.svelte.js';
	import IconCalendarX from '~icons/lucide/calendar-x';
	import MazeItemIcon from './MazeItemIcon.svelte';
	import { ITEM_NAMES } from './mazeItems.js';

	let { game, disabled = false }: { game: MazeGame; disabled?: boolean } = $props();

	const CELL = 10;
	/** Pixels a press has to move before it counts as a swipe rather than a tap */
	const SWIPE_THRESHOLD = 18;
	const KEYS: Record<string, Direction> = {
		ArrowUp: 'up',
		ArrowRight: 'right',
		ArrowDown: 'down',
		ArrowLeft: 'left',
		w: 'up',
		d: 'right',
		s: 'down',
		a: 'left'
	};

	const maze = $derived(game.maze);
	const rooms = $derived(Array.from({ length: maze.width * maze.height }, (_, room) => room));
	const seen = $derived(game.seen);
	const visited = $derived(game.play.visited);
	const carried = $derived(game.collected);
	const knownClosed = $derived(game.play.knownClosed);

	const left = (room: number) => colOf(maze, room) * CELL;
	const top = (room: number) => rowOf(maze, room) * CELL;
	const centerX = (room: number) => left(room) + CELL / 2;
	const centerY = (room: number) => top(room) + CELL / 2;

	/** End points of the edge of a room in a direction */
	function edgeOf(room: number, direction: Direction): [number, number, number, number] {
		const x = left(room);
		const y = top(room);
		switch (direction) {
			case 'up':
				return [x, y, x + CELL, y];
			case 'right':
				return [x + CELL, y, x + CELL, y + CELL];
			case 'down':
				return [x, y + CELL, x + CELL, y + CELL];
			default:
				return [x, y, x, y + CELL];
		}
	}

	/** Walls, open doors and locked doors around the visited offices, each edge once */
	const edges = $derived.by(() => {
		const list: {
			key: string;
			points: [number, number, number, number];
			type: 'wall' | 'door' | 'lock';
			lock: ItemKind | null;
		}[] = [];
		for (const room of rooms) {
			if (!visited[room]) continue;
			DIRECTIONS.forEach((direction, index) => {
				const door = maze.doors[room][index];
				const other = door ? door.to : neighbour(maze, room, direction);
				// An edge between two visited offices is drawn from the one with the lower number
				if (other !== null && visited[other] && other < room) return;
				list.push({
					key: `${room}-${direction}`,
					points: edgeOf(room, direction),
					type: door ? (door.lock ? 'lock' : 'door') : 'wall',
					lock: door?.lock ?? null
				});
			});
		}
		return list;
	});

	let svgElement: SVGSVGElement | undefined = $state();

	const dragger = new PointerDrag({
		threshold: SWIPE_THRESHOLD,
		// A swipe steps as soon as it is recognized; the rest of the gesture is ignored
		onStart: (session) => {
			const direction = directionOfVector(
				session.pointer.x - session.start.x,
				session.pointer.y - session.start.y
			);
			if (direction) game.move(direction);
		},
		onTap: (session) => {
			if (!svgElement) return;
			const hit = cellAt(
				svgElement.getBoundingClientRect(),
				session.pointer,
				maze.width,
				maze.height
			);
			if (!hit) return;
			const direction = directionToward(maze, game.play.room, hit.row * maze.width + hit.col);
			if (direction) game.move(direction);
		}
	});

	function down(event: PointerEvent) {
		if (disabled || !svgElement) return;
		if (dragger.begin(event, { capture: svgElement })) event.preventDefault();
	}

	function keyDown(event: KeyboardEvent) {
		if (disabled || event.ctrlKey || event.metaKey || event.altKey) return;
		const direction = KEYS[event.key];
		if (!direction || document.querySelector('dialog[open]')) return;
		event.preventDefault();
		game.move(direction);
	}
</script>

<svelte:window
	onpointermove={(event) => dragger.pointerMove(event)}
	onpointerup={(event) => dragger.pointerUp(event)}
	onpointercancel={(event) => dragger.pointerCancel(event)}
	onkeydown={keyDown}
/>

<div
	data-playfield
	class="relative w-full touch-none rounded-[10px_6px_12px_8px] border-3 border-ink bg-sand p-1.5 shadow-[4px_4px_0_var(--color-ink)] select-none"
	style:touch-action="none"
>
	<svg
		bind:this={svgElement}
		role="application"
		aria-roledescription={m.maze_board_role()}
		aria-label={m.maze_playfield_label()}
		viewBox="0 0 {maze.width * CELL} {maze.height * CELL}"
		class="block w-full cursor-pointer overflow-visible"
		style:aspect-ratio="{maze.width} / {maze.height}"
		style:touch-action="none"
		onpointerdown={down}
	>
		<defs>
			<pattern
				id="maze-closed-stripes"
				width="2.6"
				height="2.6"
				patternUnits="userSpaceOnUse"
				patternTransform="rotate(45)"
			>
				<rect width="1.3" height="2.6" fill="var(--color-tie-red)" />
				<rect x="1.3" width="1.3" height="2.6" fill="var(--color-paper)" />
			</pattern>
		</defs>

		<!-- Floors: visited offices plain, offices behind a door as fog, the rest dark -->
		{#each rooms as room (room)}
			{#if visited[room]}
				<rect x={left(room)} y={top(room)} width={CELL} height={CELL} fill="var(--color-paper)" />
			{:else if seen[room]}
				<rect
					x={left(room)}
					y={top(room)}
					width={CELL}
					height={CELL}
					fill="var(--color-base-300)"
				/>
				<text
					x={centerX(room)}
					y={centerY(room) + 2}
					text-anchor="middle"
					font-size="6"
					font-weight="800"
					fill="var(--color-ink)"
					fill-opacity="0.35">?</text
				>
			{:else}
				<rect
					x={left(room)}
					y={top(room)}
					width={CELL}
					height={CELL}
					fill="var(--color-ink)"
					fill-opacity="0.14"
				/>
			{/if}
		{/each}

		<!-- Offices found closed until Tuesday -->
		{#each knownClosed as room (room)}
			<g>
				<title>{m.maze_room_closed_label()}</title>
				<rect
					x={left(room)}
					y={top(room)}
					width={CELL}
					height={CELL}
					fill="url(#maze-closed-stripes)"
					fill-opacity="0.55"
				/>
				<rect
					x={left(room) + 1.8}
					y={top(room) + 1.8}
					width={CELL - 3.6}
					height={CELL - 3.6}
					rx="1"
					fill="var(--color-paper)"
					stroke="var(--color-ink)"
					stroke-width="0.6"
				/>
				<IconCalendarX
					x={left(room) + 2.9}
					y={top(room) + 2.9}
					width={CELL - 5.8}
					height={CELL - 5.8}
					color="var(--color-ink)"
				/>
			</g>
		{/each}

		<!-- Documents already found stay on the map, faded, so that you remember where they were -->
		{#each rooms as room (room)}
			{@const item = maze.items[room]}
			{#if item && visited[room]}
				<MazeItemIcon
					kind={item}
					x={left(room) + 0.8}
					y={top(room) + 0.8}
					width="3.6"
					height="3.6"
					opacity="0.55"
				/>
			{/if}
		{/each}

		<!-- The counter with Passierschein B-38 is always marked -->
		<g>
			<title>{m.maze_goal_label()}</title>
			<MazeItemIcon
				kind="permit"
				x={centerX(maze.goal) - 3.4}
				y={centerY(maze.goal) - 3.4}
				width="6.8"
				height="6.8"
			/>
		</g>

		<!-- Walls and doors -->
		<g stroke="var(--color-ink)" stroke-linecap="round" fill="none">
			{#each edges as edge (edge.key)}
				{@const [x1, y1, x2, y2] = edge.points}
				{#if edge.type === 'wall'}
					<line {x1} {y1} {x2} {y2} stroke-width="1.2" />
				{:else if edge.type === 'door'}
					<line
						{x1}
						{y1}
						{x2}
						{y2}
						stroke-width="0.5"
						stroke-dasharray="0.8 1.2"
						stroke-opacity="0.35"
					/>
				{/if}
			{/each}
		</g>
		{#each edges as edge (edge.key)}
			{#if edge.type === 'lock' && edge.lock}
				{@const [x1, y1, x2, y2] = edge.points}
				{@const open = carried.includes(edge.lock)}
				<g opacity={open ? 0.5 : 1}>
					<title>{m.maze_door_locked_label({ item: ITEM_NAMES[edge.lock]() })}</title>
					<line
						{x1}
						{y1}
						{x2}
						{y2}
						stroke="var(--color-ink)"
						stroke-width="2.6"
						stroke-linecap="round"
					/>
					<line
						{x1}
						{y1}
						{x2}
						{y2}
						stroke={open ? 'var(--color-paper)' : ITEM_COLORS[edge.lock]}
						stroke-width="1.4"
						stroke-linecap="round"
						stroke-dasharray={open ? '1 1.2' : undefined}
					/>
					<circle
						cx={(x1 + x2) / 2}
						cy={(y1 + y2) / 2}
						r="2.5"
						fill="var(--color-paper)"
						stroke="var(--color-ink)"
						stroke-width="0.7"
					/>
					<MazeItemIcon
						kind={edge.lock}
						x={(x1 + x2) / 2 - 1.9}
						y={(y1 + y2) / 2 - 1.9}
						width="3.8"
						height="3.8"
					/>
				</g>
			{/if}
		{/each}

		<!-- The clerk: the player's token -->
		<g
			class="maze-pawn"
			style:transform="translate({centerX(game.play.room)}px, {centerY(game.play.room)}px)"
		>
			<ellipse cx="0" cy="3.7" rx="2.8" ry="0.7" fill="var(--color-ink)" fill-opacity="0.25" />
			<g stroke="var(--color-ink)" stroke-width="0.55" stroke-linejoin="round">
				<rect x="-2.3" y="-0.4" width="4.6" height="4" rx="1.2" fill="var(--color-banner-slate)" />
				<path d="M0 -0.2l.8 1.2-.8 2-.8-2z" fill="var(--color-tie-red)" stroke-width="0.3" />
				<circle cx="0" cy="-2.2" r="2" fill="var(--color-skin)" />
				<path d="M-2 -2.6a2 2 0 0 1 4 0c-1-.7-3-.7-4 0z" fill="var(--color-ink)" />
				<rect x="2" y="1" width="2.2" height="2.6" rx="0.3" fill="var(--color-paper)" />
			</g>
		</g>
	</svg>
</div>

<style>
	.maze-pawn {
		transition: transform 150ms ease-out;
	}

	@media (prefers-reduced-motion: reduce) {
		.maze-pawn {
			transition: none;
		}
	}
</style>
