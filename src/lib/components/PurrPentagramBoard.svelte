<!--
	Purr Pentagram playfield: one square SVG with the room (rug, candles, window, door), the five
	cats on the points of the star, the lines the player has drawn and the finale glow. A slow stroke
	inside a cat's circle pets it; dragging out of the circle draws the star stroke. The cats are
	also buttons for the keyboard: Space pets, Enter joins them into the star.

	Everything that moves comes from the game state (the room event, the cats, the finale clock),
	so with reduced motion the same picture is simply drawn without animation. The field never
	mirrors in right-to-left languages and never scrolls (touch-action: none).
-->
<script lang="ts">
	import { onMount, type Snippet } from 'svelte';
	import { CAT_RADIUS, FIELD } from '#lib/game/purrpentagram/config.js';
	import { finaleStage } from '#lib/game/purrpentagram/finale.js';
	import { seatPosition, type Point } from '#lib/game/purrpentagram/geometry.js';
	import { roomLook } from '#lib/game/purrpentagram/room.js';
	import { createFixedLoop, onAppHidden } from '#lib/game/loop.js';
	import { m } from '#lib/paraglide/messages.js';
	import type { PurrPentagramGame } from '#lib/stores/purrPentagramGame.svelte.js';
	import { coatText } from '#lib/theme/purrText.js';
	import PauseOverlay from './PauseOverlay.svelte';
	import PurrCat from './PurrCat.svelte';
	import IconPlay from '~icons/lucide/play';

	let { game, children }: { game: PurrPentagramGame; children?: Snippet } = $props();

	let svg: SVGSVGElement | undefined = $state();

	const loop = createFixedLoop({ update: (dtMs) => game.update(dtMs), render: () => {} });

	onMount(() => {
		const stopHidden = onAppHidden(() => game.pause());
		return () => {
			loop.pause();
			stopHidden();
			game.pointerCancel();
		};
	});

	// The loop runs while the ritual is on, and on through the finale until the player leaves
	$effect(() => {
		if (game.status === 'playing' || game.status === 'won') loop.start();
		else loop.pause();
	});

	const calm = $derived(game.reducedMotion);
	const won = $derived(game.status === 'won');
	const ritual = $derived(game.state);
	const look = $derived(roomLook(ritual.event, calm));
	const stage = $derived(won ? finaleStage(ritual.finaleMs, calm) : null);

	const seats = $derived(ritual.cats.map((cat) => seatPosition(cat.seat)));

	/** The star as drawn so far, or all five lines once the ritual is complete */
	const lines = $derived.by(() => {
		const chain = ritual.chain;
		const result: { from: Point; to: Point }[] = [];
		const point = (id: number) => seats[id];
		for (let i = 0; i + 1 < chain.length; i++) {
			result.push({ from: point(chain[i]), to: point(chain[i + 1]) });
		}
		if (ritual.closed) {
			result.push({ from: point(chain[chain.length - 1]), to: point(chain[0]) });
		}
		return result;
	});

	/** Colour, width and length of one line: chalk-gold while drawing, burning red-violet in the finale */
	function lineLook(line: { from: Point; to: Point }, index: number) {
		if (!stage) return { ...line, color: '#ffd45e', width: 7, opacity: 1, glow: 'line-glow' };
		const burning = index < stage.litLines;
		const growing = stage.igniting?.line === index ? stage.igniting.progress : 0;
		const length = burning ? 1 : growing;
		const pulse = 0.65 + 0.35 * stage.breath;
		return {
			from: line.from,
			to: {
				x: line.from.x + (line.to.x - line.from.x) * length,
				y: line.from.y + (line.to.y - line.from.y) * length
			},
			color: burning ? '#ff4fa3' : growing > 0 ? '#ffb3d9' : '#ffd45e',
			width: burning ? 9 + 3 * stage.breath : 7,
			opacity: burning ? pulse : growing > 0 ? 1 : 0.28,
			glow: burning || growing > 0 ? 'star-glow' : 'line-glow'
		};
	}

	/** Where a cat that has run off after the laser dot is (relative to its seat) */
	function wander(index: number) {
		const cat = ritual.cats[index];
		if (cat.motion?.kind !== 'chase' || !look.laser) return { x: 0, y: 0 };
		return { x: (look.laser.x - seats[index].x) * 0.62, y: (look.laser.y - seats[index].y) * 0.62 };
	}

	function catLabel(index: number): string {
		const cat = ritual.cats[index];
		const name = cat.nameShown ? `, ${cat.profile.name}` : '';
		return m.purr_cat_label({ cat: coatText(cat.profile.coat) + name });
	}

	// Pointer: coordinates are mapped from the screen into the 1000-unit field
	function toField(event: PointerEvent): Point | null {
		if (!svg) return null;
		const rect = svg.getBoundingClientRect();
		if (rect.width === 0) return null;
		return {
			x: ((event.clientX - rect.left) / rect.width) * FIELD,
			y: ((event.clientY - rect.top) / rect.height) * FIELD
		};
	}

	function onPointerDown(event: PointerEvent) {
		if (!event.isPrimary || (event.pointerType === 'mouse' && event.button !== 0)) return;
		const point = toField(event);
		if (!point) return;
		if (game.pointerDown(point, event.timeStamp)) {
			svg?.setPointerCapture(event.pointerId);
			event.preventDefault();
		}
	}

	function onPointerMove(event: PointerEvent) {
		if (!event.isPrimary) return;
		// A coalesced event is a real sample of the finger's path, so use them all for a true speed
		const samples = event.getCoalescedEvents?.() ?? [];
		for (const sample of samples.length > 0 ? samples : [event]) {
			const point = toField(sample);
			if (point) game.pointerMove(point, sample.timeStamp);
		}
	}

	function onPointerUp(event: PointerEvent) {
		if (!event.isPrimary) return;
		const point = toField(event);
		if (point) game.pointerUp(point);
		else game.pointerCancel();
	}

	function onCatKey(event: KeyboardEvent, id: number) {
		if (event.ctrlKey || event.metaKey || event.altKey) return;
		if (event.code === 'Space') {
			event.preventDefault();
			game.keyPet(id);
		} else if (event.code === 'Enter' && !event.repeat) {
			event.preventDefault();
			game.keySelect(id);
		}
	}

	function onKey(event: KeyboardEvent) {
		if (event.ctrlKey || event.metaKey || event.altKey) return;
		const interactive =
			event.target instanceof HTMLElement &&
			event.target.closest('button, a, input, select, textarea, [contenteditable]') !== null;
		if (event.code === 'Escape') {
			if (game.status === 'playing') game.pause();
		} else if (event.code === 'KeyP' && !event.repeat && !interactive) {
			game.togglePause();
		}
	}

	// Candles stand between the cats, on the rug's outer ring
	const CANDLES = Array.from({ length: 5 }, (_, i) => {
		const angle = -Math.PI / 2 + (Math.PI / 5) * (2 * i + 1);
		return { x: 500 + 452 * Math.cos(angle), y: 510 + 452 * Math.sin(angle), phase: i * 0.37 };
	});
</script>

<svelte:window onkeydown={onKey} />

<div data-playfield class="relative w-full select-none">
	<svg
		bind:this={svg}
		viewBox="0 0 {FIELD} {FIELD}"
		class="block aspect-square w-full touch-none rounded-[14px_8px_16px_10px] border-3 border-ink bg-[#150a22] shadow-[4px_4px_0_var(--color-ink)]"
		class:calm
		role="group"
		aria-label={m.purr_playfield_label()}
		onpointerdown={onPointerDown}
		onpointermove={onPointerMove}
		onpointerup={onPointerUp}
		onpointercancel={() => game.pointerCancel()}
		oncontextmenu={(event) => event.preventDefault()}
	>
		<defs>
			<radialGradient id="rug">
				<stop offset="0" stop-color="#4a2466" />
				<stop offset="0.75" stop-color="#2b1440" />
				<stop offset="1" stop-color="#1b0c2b" />
			</radialGradient>
			<radialGradient id="halo">
				<stop offset="0" stop-color="#ff3fa0" stop-opacity="0.75" />
				<stop offset="0.45" stop-color="#9a2bd6" stop-opacity="0.5" />
				<stop offset="1" stop-color="#4a1580" stop-opacity="0" />
			</radialGradient>
			<radialGradient id="burst">
				<stop offset="0" stop-color="#fff2fb" stop-opacity="0.95" />
				<stop offset="0.5" stop-color="#ff8ad8" stop-opacity="0.5" />
				<stop offset="1" stop-color="#8a2be2" stop-opacity="0" />
			</radialGradient>
			<filter id="purr-glow" x="-30%" y="-30%" width="160%" height="160%">
				<feGaussianBlur stdDeviation="6" result="blur" />
				<feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
			</filter>
			<filter id="eye-glow" x="-60%" y="-60%" width="220%" height="220%">
				<feGaussianBlur stdDeviation="3.5" result="blur" />
				<feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
			</filter>
			<filter id="line-glow" x="-10%" y="-10%" width="120%" height="120%">
				<feGaussianBlur stdDeviation="4" result="blur" />
				<feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
			</filter>
			<filter id="star-glow" x="-10%" y="-10%" width="120%" height="120%">
				<feGaussianBlur stdDeviation="10" result="blur" />
				<feMerge>
					<feMergeNode in="blur" /><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" />
				</feMerge>
			</filter>
		</defs>

		<!-- The room -->
		<rect width={FIELD} height={FIELD} fill="#150a22" />
		<circle cx="500" cy="510" r="470" fill="url(#rug)" stroke="#6b3f8c" stroke-width="6" />
		<circle
			cx="500"
			cy="510"
			r="440"
			fill="none"
			stroke="#6b3f8c"
			stroke-opacity="0.5"
			stroke-width="2"
			stroke-dasharray="4 14"
		/>
		<circle
			cx="500"
			cy="510"
			r="335"
			fill="none"
			stroke="#8a5bb0"
			stroke-opacity="0.18"
			stroke-width="2"
		/>

		<!-- The window, top left: the curtains billow when a draft comes in -->
		<g transform="translate(24 24)">
			<rect width="150" height="170" rx="6" fill="#1a2a4a" stroke="#6b4a2a" stroke-width="8" />
			<path d="M75 0 V170 M0 85 H150" stroke="#6b4a2a" stroke-width="5" />
			<circle cx="112" cy="40" r="16" fill="#f5f0d0" opacity="0.8" />
			<path
				class="curtain"
				d={`M0 0 H${52 + look.window * 18} Q${34 + look.window * 22} 90 ${44 + look.window * 14} 170 H0 Z`}
				fill="#7a1f3d"
				opacity="0.9"
			/>
			<path
				class="curtain"
				d={`M150 0 H${98 - look.window * 18} Q${116 - look.window * 22} 90 ${106 - look.window * 14} 170 H150 Z`}
				fill="#7a1f3d"
				opacity="0.9"
			/>
			{#if look.window > 0.05}
				<g
					stroke="#bfe3ff"
					stroke-width="3"
					stroke-linecap="round"
					fill="none"
					opacity={look.window * 0.8}
				>
					<path d="M170 60 q40 -14 80 0 t80 0" />
					<path d="M174 100 q40 -14 80 0 t80 0" />
					<path d="M166 140 q40 -14 80 0 t80 0" />
				</g>
			{/if}
		</g>

		<!-- The door, bottom right: it swings open a crack when it creaks -->
		<g transform="translate(852 790)">
			<rect width="124" height="196" rx="4" fill="#1b1030" stroke="#6b4a2a" stroke-width="8" />
			{#if look.door > 0.02}
				<path d="M0 0 H{124 * (1 - 0.55 * look.door)} V196 H0 Z" fill="#3a2410" />
				<path
					d="M{124 * (1 - 0.55 * look.door)} 0 L124 0 V196 H{124 * (1 - 0.55 * look.door)} Z"
					fill="#ffe6a8"
					opacity={0.18 * look.door}
				/>
			{:else}
				<rect x="4" y="4" width="116" height="188" fill="#3a2410" />
			{/if}
			<circle cx={100 * (1 - 0.55 * look.door)} cy="104" r="7" fill="#d9b44a" />
		</g>

		<!-- Candles between the cats -->
		{#each CANDLES as candle, i (i)}
			{@const lit = Math.max(stage ? stage.candles : 0, 1 - look.candlesOut)}
			{@const big = stage ? stage.candles + 0.35 * stage.candles * stage.breath : 0}
			<g transform="translate({candle.x} {candle.y})">
				<rect
					x="-7"
					y="-4"
					width="14"
					height="36"
					rx="3"
					fill="#efe6c8"
					stroke="#8a7a52"
					stroke-width="2"
				/>
				{#if lit > 0.05}
					<g class="flame" style:animation-delay="{candle.phase}s" class:flicker={look.flicker}>
						<ellipse
							cx="0"
							cy="-18"
							rx={7 + big * 7}
							ry={14 + big * 12}
							fill="#ffb347"
							opacity={0.55 + 0.4 * lit}
							filter="url(#purr-glow)"
						/>
						<ellipse cx="0" cy="-15" rx="3.5" ry="8" fill="#fff3c4" />
					</g>
				{:else}
					<path
						d="M0 -6 q-8 -14 0 -26 q8 -10 0 -22"
						fill="none"
						stroke="#9a94a8"
						stroke-width="3"
						opacity="0.5"
					/>
				{/if}
			</g>
		{/each}

		<!-- The finale: a halo spreading over the floor and breathing -->
		{#if stage}
			<circle
				cx="500"
				cy="510"
				r="560"
				fill="url(#halo)"
				opacity={stage.halo * (0.55 + 0.45 * stage.breath)}
			/>
		{/if}

		<!-- The star -->
		{#each lines as line, index (index)}
			{@const drawn = lineLook(line, index)}
			<line
				x1={drawn.from.x}
				y1={drawn.from.y}
				x2={drawn.to.x}
				y2={drawn.to.y}
				stroke={drawn.color}
				stroke-width={drawn.width}
				stroke-linecap="round"
				opacity={drawn.opacity}
				filter="url(#{drawn.glow})"
			/>
		{/each}

		<!-- The stroke being dragged -->
		{#if game.drag}
			<line
				x1={seats[game.drag.from].x}
				y1={seats[game.drag.from].y}
				x2={game.drag.over !== null ? seats[game.drag.over].x : game.drag.x}
				y2={game.drag.over !== null ? seats[game.drag.over].y : game.drag.y}
				stroke={game.drag.over !== null ? '#ffe9a8' : '#d9a8ff'}
				stroke-width="6"
				stroke-linecap="round"
				stroke-dasharray="4 14"
			/>
		{/if}

		<!-- The cats -->
		{#each ritual.cats as cat, index (cat.profile.id)}
			<g
				class="seat"
				role="button"
				tabindex="0"
				aria-label={catLabel(index)}
				transform="translate({seats[index].x} {seats[index].y})"
				onkeydown={(event) => onCatKey(event, index)}
			>
				<circle
					class="focus"
					r={CAT_RADIUS + 16}
					fill="none"
					stroke="#ffffff"
					stroke-width="4"
					stroke-dasharray="8 8"
				/>
				<PurrCat
					{cat}
					{calm}
					eyes={stage?.eyes ?? 0}
					anchored={game.anchor === index}
					offset={wander(index)}
				/>
			</g>
		{/each}

		<!-- The laser dot -->
		{#if look.laser}
			<circle cx={look.laser.x} cy={look.laser.y} r="13" fill="#ff2030" filter="url(#purr-glow)" />
			<circle cx={look.laser.x} cy={look.laser.y} r="5" fill="#ffd0d0" />
		{/if}

		<!-- Darkness and lightning over everything -->
		<rect width={FIELD} height={FIELD} fill="#06020c" opacity={look.dim} pointer-events="none" />
		<rect
			width={FIELD}
			height={FIELD}
			fill="#ffffff"
			opacity={look.flash * 0.7}
			pointer-events="none"
		/>
		{#if stage && stage.burst > 0}
			<circle
				cx="500"
				cy="510"
				r="700"
				fill="url(#burst)"
				opacity={stage.burst}
				pointer-events="none"
			/>
		{/if}
	</svg>

	{#if game.status === 'ready'}
		<div
			class="absolute inset-0 flex flex-col items-center justify-center gap-4 rounded-[14px_8px_16px_10px] bg-ink/45 p-4"
		>
			<div
				class="sticker pop-in flex w-full max-w-xs flex-col items-center gap-3 p-4 text-center"
				style:--tilt="-1.5deg"
			>
				<p dir="auto" class="text-sm leading-snug font-semibold">{m.purr_ready_hint()}</p>
				{#if game.best !== null}
					<p class="text-sm font-semibold">{m.purr_best({ score: game.best })}</p>
				{/if}
				<button type="button" class="btn-chunky bg-tie-red text-xl" onclick={() => game.start()}>
					<IconPlay class="size-5" aria-hidden="true" />
					{m.purr_start()}
				</button>
			</div>
		</div>
	{:else if game.status === 'paused'}
		<PauseOverlay onResume={() => game.resume()} />
	{/if}

	{@render children?.()}
</div>

<style>
	.seat {
		outline: none;
		cursor: pointer;
	}

	.focus {
		opacity: 0;
	}

	.seat:focus-visible .focus {
		opacity: 1;
	}

	.flame {
		transform-origin: 0 0;
		transform-box: fill-box;
	}

	.flame.flicker {
		animation: flicker 220ms ease-in-out infinite alternate;
	}

	@keyframes flicker {
		from {
			transform: scale(1, 1) translateX(-2px);
		}
		to {
			transform: scale(0.9, 1.12) translateX(2px);
		}
	}

	.curtain {
		transition: d 500ms ease;
	}

	.calm .flame,
	.calm .curtain {
		animation: none;
		transition: none;
	}
</style>
