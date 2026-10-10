<!--
	Drone Wall playfield: a crisp high-DPI canvas driven by the fixed-step loop. Fallen enemies drop
	helmets that fly to the helmet counter in the corner of the field (the canvas measures where it
	sits, so they land right on it). The fixed defense slots are real buttons laid over the canvas, so
	they work with touch, mouse and keyboard alike. The playfield never mirrors in right-to-left
	languages.

	Most maps are exactly one screen tall. Big maps are several screens tall: the canvas then sits in
	a scroll box one screen high, the counter, banners, build panel and the overview strip stay put
	over it, and the view can follow the front of the attack by itself.
-->
<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { m } from '#lib/paraglide/messages.js';
	import { createFixedLoop, onAppHidden } from '#lib/game/loop.js';
	import { WORLD_WIDTH, isTallMap, type Point } from '#lib/game/dronewall/config.js';
	import { drawScene } from '#lib/game/dronewall/render.js';
	import { clientToLocal } from '#lib/game/pointerDrag.js';
	import type { DroneWallGame } from '#lib/stores/dronewallGame.svelte.js';
	import PauseOverlay from './PauseOverlay.svelte';
	import DroneWallDefense from './DroneWallDefense.svelte';
	import DroneWallMapPicker from './DroneWallMapPicker.svelte';
	import DroneWallPanel from './DroneWallPanel.svelte';
	import { DEFENSE_NAMES, POWER_NAMES, WEATHER_EFFECTS, WEATHER_NAMES } from './droneWallText.js';
	import IconLocate from '~icons/lucide/locate-fixed';
	import IconPlay from '~icons/lucide/play';

	let { game }: { game: DroneWallGame } = $props();

	let scroller: HTMLDivElement | undefined = $state();
	let canvas: HTMLCanvasElement | undefined = $state();
	let radar: HTMLCanvasElement | undefined = $state();
	let counter: HTMLElement | undefined = $state();
	let context: CanvasRenderingContext2D | null = null;
	let radarContext: CanvasRenderingContext2D | null = null;
	/** CSS pixels per world unit */
	let scale = $state(1);
	/** How far the scroll box is scrolled and how tall it is, in CSS pixels */
	let scrollTop = $state(0);
	let viewHeight = $state(0);

	/** The map being shown (a new game can bring another map) */
	const map = $derived.by(() => {
		void game.revision;
		return game.state.map;
	});
	const tall = $derived(isTallMap(map));

	/** Slot buttons are this many world units wide, centred on the slot */
	const SLOT_BUTTON = 46;
	const RADAR_WIDTH = 14;

	/** The enemy closest to getting through, which the view follows on big maps */
	function frontOfAttack(): Point | null {
		const state = game.state;
		let best: Point | null = null;
		let bestLeft = Infinity;
		for (const soldier of state.soldiers) {
			const left = state.map.road.length - soldier.progress;
			if (soldier.hp > 0 && soldier.y >= 0 && left < bestLeft) {
				bestLeft = left;
				best = soldier;
			}
		}
		for (const flyer of state.flyers) {
			const left = flyer.length - flyer.progress;
			if (flyer.hp > 0 && flyer.y >= 0 && left < bestLeft) {
				bestLeft = left;
				best = flyer;
			}
		}
		return best;
	}

	function followAttack() {
		if (!scroller || !tall || !game.follow || game.status !== 'playing') return;
		if (game.state.phase !== 'wave' || game.selectedSlot !== null || game.armed) return;
		const front = frontOfAttack();
		if (!front) return;
		const wanted = Math.min(
			Math.max(0, front.y * scale - viewHeight * 0.6),
			scroller.scrollHeight - viewHeight
		);
		const gap = wanted - scroller.scrollTop;
		if (Math.abs(gap) > 3) scroller.scrollTop += gap * 0.07;
	}

	function draw() {
		if (!canvas || !context) return;
		const ratio = window.devicePixelRatio || 1;
		context.setTransform(scale * ratio, 0, 0, scale * ratio, 0, 0);
		followAttack();
		game.view = { top: scrollTop / scale, bottom: (scrollTop + viewHeight) / scale };
		drawScene(context, game.state, game.sceneExtras());
		drawRadar();
	}

	/** The overview strip: the whole map as a thin column with the enemies as dots */
	function drawRadar() {
		if (!radar || !radarContext || !tall) return;
		const ratio = window.devicePixelRatio || 1;
		const ctx = radarContext;
		const w = radar.width / ratio;
		const h = radar.height / ratio;
		ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
		ctx.clearRect(0, 0, w, h);
		const k = h / map.height;
		ctx.fillStyle = map.theme.field;
		ctx.fillRect(0, 0, w, h);
		// The road, thin
		ctx.beginPath();
		map.points.forEach((point, index) => {
			const x = 1.5 + (point.x / WORLD_WIDTH) * (w - 3);
			if (index === 0) ctx.moveTo(x, point.y * k);
			else ctx.lineTo(x, point.y * k);
		});
		ctx.lineWidth = 2;
		ctx.strokeStyle = map.theme.road;
		ctx.stroke();
		ctx.fillStyle = '#4fa8d8';
		ctx.fillRect(0, map.lineY * k, w, h - map.lineY * k);
		const dot = (x: number, y: number, color: string, r: number) => {
			ctx.beginPath();
			ctx.arc(1.5 + (x / WORLD_WIDTH) * (w - 3), y * k, r, 0, Math.PI * 2);
			ctx.fillStyle = color;
			ctx.fill();
		};
		game.state.defenses.forEach((defense, slot) => {
			if (defense) dot(map.slots[slot].x, map.slots[slot].y, '#1e5a8a', 1.8);
		});
		for (const soldier of game.state.soldiers) {
			if (soldier.hp > 0 && soldier.y >= 0) dot(soldier.x, soldier.y, '#e5484d', 2.2);
		}
		for (const flyer of game.state.flyers) {
			if (flyer.hp > 0 && flyer.y >= 0) dot(flyer.x, flyer.y, '#f5c83a', 2.4);
		}
		// The part of the map that is on screen
		const top = (scrollTop / scale) * k;
		const span = (viewHeight / scale) * k;
		ctx.lineWidth = 2;
		ctx.strokeStyle = '#ffffff';
		ctx.strokeRect(1, top + 1, w - 2, Math.max(4, span - 2));
		ctx.lineWidth = 1;
		ctx.strokeStyle = '#111111';
		ctx.strokeRect(0, top, w, Math.max(6, span));
	}

	/** Tells the game where the helmet counter is, in world units, so helmets fly to its centre */
	function measureCounter() {
		if (!canvas || !counter) return;
		const field = canvas.getBoundingClientRect();
		const box = counter.getBoundingClientRect();
		if (field.width === 0) return;
		game.helmetTarget = clientToLocal(
			field,
			{ x: box.left + box.width / 2, y: box.top + box.height / 2 },
			{ width: WORLD_WIDTH, height: map.height }
		);
	}

	function resize() {
		if (!canvas) return;
		const ratio = window.devicePixelRatio || 1;
		const width = canvas.clientWidth;
		scale = width / WORLD_WIDTH;
		canvas.width = Math.round(width * ratio);
		canvas.height = Math.round(((width * map.height) / WORLD_WIDTH) * ratio);
		if (radar) {
			radar.width = Math.round(RADAR_WIDTH * ratio);
			radar.height = Math.round(radar.clientHeight * ratio);
		}
		measureCounter();
		draw();
	}

	const loop = createFixedLoop({ update: (dtMs) => game.update(dtMs), render: draw });

	onMount(() => {
		if (!canvas) return;
		context = canvas.getContext('2d');
		radarContext = radar?.getContext('2d') ?? null;
		const observer = new ResizeObserver(resize);
		observer.observe(canvas);
		if (radar) observer.observe(radar);
		const stopHidden = onAppHidden(() => game.pause());
		// A swipe or the wheel takes the view back from the follow mode
		scroller?.addEventListener('wheel', takeOverView, { passive: true });
		scroller?.addEventListener('touchmove', takeOverView, { passive: true });
		const box = scroller;
		return () => {
			box?.removeEventListener('wheel', takeOverView);
			box?.removeEventListener('touchmove', takeOverView);
			loop.pause();
			observer.disconnect();
			stopHidden();
		};
	});

	// The radar canvas only exists on big maps
	$effect(() => {
		radarContext = radar?.getContext('2d') ?? null;
		if (radar) untrack(resize);
	});

	$effect(() => {
		if (game.status === 'playing') {
			loop.start();
		} else {
			loop.pause();
		}
		// Redraw when something changes while the loop is stopped (selection, building, a new game,
		// scrolling)
		void game.revision;
		void scrollTop;
		void viewHeight;
		void scale;
		draw();
	});

	// A new map starts at the top, where the enemies come in
	$effect(() => {
		void map.id;
		if (scroller) scroller.scrollTop = 0;
	});

	// The counter grows with its number of digits, so measure again when that changes
	$effect(() => {
		void String(game.helmets).length;
		measureCounter();
	});

	function onScroll() {
		if (!scroller) return;
		scrollTop = scroller.scrollTop;
		measureCounter();
	}

	/** A swipe or the wheel takes the view back from the follow mode */
	function takeOverView() {
		if (game.follow) game.follow = false;
	}

	function jumpTo(event: PointerEvent) {
		if (!radar || !scroller || (event.type === 'pointermove' && event.buttons === 0)) return;
		const box = radar.getBoundingClientRect();
		const along = (event.clientY - box.top) / box.height;
		game.follow = false;
		scroller.scrollTop = along * scroller.scrollHeight - viewHeight / 2;
	}

	/** Where a pointer is on the field, in world units */
	function fieldPoint(event: { clientX: number; clientY: number }): Point | null {
		if (!canvas) return null;
		const field = canvas.getBoundingClientRect();
		if (field.width === 0) return null;
		return clientToLocal(
			field,
			{ x: event.clientX, y: event.clientY },
			{ width: WORLD_WIDTH, height: map.height }
		);
	}

	let pressedAt: Point | null = null;

	function onCanvasDown(event: PointerEvent) {
		pressedAt = { x: event.clientX, y: event.clientY };
		// A tap on the open field closes the build panel
		if (game.status === 'playing' && !game.armed) game.select(null);
	}

	function onCanvasMove(event: PointerEvent) {
		if (!game.armed) return;
		game.aimPoint = fieldPoint(event);
		if (game.status !== 'playing') draw();
	}

	/** Aimed powers are called by a tap, not by the start of a swipe that scrolls a big map */
	function onCanvasUp(event: PointerEvent) {
		const pressed = pressedAt;
		pressedAt = null;
		if (!game.armed || !pressed) return;
		if (Math.hypot(event.clientX - pressed.x, event.clientY - pressed.y) > 10) return;
		const point = fieldPoint(event);
		if (point) game.callArmed(point.x, point.y);
	}

	const isInteractive = (target: EventTarget | null) =>
		target instanceof HTMLElement &&
		target.closest('button, a, input, select, textarea, [contenteditable]') !== null;

	function onKey(event: KeyboardEvent) {
		if (game.status === 'over' || event.ctrlKey || event.metaKey || event.altKey) return;
		if (event.code === 'Escape') {
			if (game.armed) game.disarm();
			else if (game.status === 'playing') game.pause();
		} else if (event.code === 'KeyP' && !event.repeat && !isInteractive(event.target)) {
			game.togglePause();
		}
	}

	/** The defense spots of the map being played */
	const slots = $derived(map.slots);

	/** The build panel sits on the half of the screen away from the selected spot */
	const panelOnTop = $derived(
		game.selectedSlot !== null &&
			(slots[game.selectedSlot]?.y ?? 0) * scale - scrollTop > viewHeight / 2
	);

	/** What stands on each slot; the simulation state is not reactive, so this follows `revision` */
	const built = $derived.by(() => {
		void game.revision;
		return game.state.defenses.map(
			(defense) => defense && { kind: defense.kind, level: defense.level }
		);
	});

	const touchClass = $derived(tall ? 'touch-pan-y' : 'touch-none');
</script>

<svelte:window onkeydown={onKey} />

<div data-playfield class="flex w-full flex-col gap-3 select-none">
	<div class="relative">
		<!-- One screen tall: a big map scrolls inside this box -->
		<div
			bind:this={scroller}
			bind:clientHeight={viewHeight}
			class="aspect-[9/16] w-full [scrollbar-width:none] overscroll-contain rounded-[14px_8px_16px_10px] border-3 border-ink shadow-[4px_4px_0_var(--color-ink)] [&::-webkit-scrollbar]:hidden {tall
				? 'overflow-y-auto'
				: 'overflow-hidden'}"
			onscroll={onScroll}
		>
			<div class="relative">
				<canvas
					bind:this={canvas}
					class="block w-full {touchClass}"
					style:aspect-ratio="{WORLD_WIDTH} / {map.height}"
					aria-label={m.dronewall_playfield_label()}
					onpointerdown={onCanvasDown}
					onpointermove={onCanvasMove}
					onpointerup={onCanvasUp}
					oncontextmenu={(event) => event.preventDefault()}
				></canvas>

				{#each slots as slot, index (index)}
					{@const defense = built[index]}
					<button
						type="button"
						class="absolute -translate-x-1/2 -translate-y-1/2 rounded-full focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-tie-red focus-visible:outline-dashed {touchClass} {game.armed
							? 'pointer-events-none'
							: ''}"
						style:left="{(slot.x / WORLD_WIDTH) * 100}%"
						style:top="{(slot.y / map.height) * 100}%"
						style:width="{(SLOT_BUTTON / WORLD_WIDTH) * 100}%"
						style:aspect-ratio="1"
						aria-pressed={game.selectedSlot === index}
						aria-label={defense
							? m.dronewall_slot_built({
									number: index + 1,
									defense: DEFENSE_NAMES[defense.kind](),
									level: defense.level
								})
							: m.dronewall_slot_empty({ number: index + 1 })}
						disabled={game.status !== 'playing'}
						onclick={() => game.select(index)}
					></button>
				{/each}
			</div>
		</div>

		<!-- The helmet counter: collected helmets fly in here -->
		<div bind:this={counter} class="pointer-events-none absolute top-[1.5%] right-[2.5%]">
			{#key game.collectPulse}
				<span
					class="bump inline-block rounded-[10px_6px_12px_8px] border-3 border-ink bg-paper px-2 py-0.5 shadow-[2px_2px_0_var(--color-ink)]"
				>
					{#key game.brokeCount}
						<span
							class="inline-flex items-center gap-1 font-display text-xl leading-none font-bold tabular-nums {game.brokeCount >
							0
								? 'shake'
								: ''}"
							role="img"
							aria-label={m.dronewall_helmets_label({ count: game.helmets })}
						>
							<DroneWallDefense kind="helmet" class="size-6" />
							<span aria-hidden="true" class="min-w-[1.5ch] text-end">{game.helmets}</span>
						</span>
					{/key}
				</span>
			{/key}
		</div>

		{#if tall}
			<!-- Big map: follow switch and the overview strip, tap or drag it to scroll there -->
			<button
				type="button"
				class="btn-chunky absolute top-2 left-2 size-9 p-0 {game.follow
					? 'bg-explosion-yellow'
					: 'bg-paper'}"
				aria-pressed={game.follow}
				aria-label={m.dronewall_follow()}
				title={m.dronewall_follow()}
				onclick={() => (game.follow = !game.follow)}
			>
				<IconLocate class="size-5" aria-hidden="true" />
			</button>
			<canvas
				bind:this={radar}
				class="absolute top-14 bottom-2.5 left-2.5 touch-none rounded-[3px] border-2 border-ink"
				style:width="{RADAR_WIDTH}px"
				aria-label={m.dronewall_radar_label()}
				onpointerdown={(event) => {
					radar?.setPointerCapture(event.pointerId);
					jumpTo(event);
				}}
				onpointermove={jumpTo}
			></canvas>
		{/if}

		<!-- The build panel floats over the field, so the field can use the whole screen -->
		{#if game.selectedSlot !== null && game.status === 'playing'}
			<div class="absolute inset-x-1.5 z-10 {panelOnTop ? 'top-1.5' : 'bottom-1.5'}">
				<DroneWallPanel {game} />
			</div>
		{/if}

		<!-- Aiming a power: say what to do -->
		{#if game.armed && game.status === 'playing'}
			<p
				class="pointer-events-none absolute inset-x-3 bottom-2 z-10 rounded-[10px_6px_12px_8px] border-3 border-ink bg-explosion-yellow px-2 py-1 text-center text-sm leading-tight font-bold shadow-[2px_2px_0_var(--color-ink)]"
			>
				{POWER_NAMES[game.armed]()}: {m.dronewall_power_aim()}
			</p>
		{/if}

		<!-- Wave, weather and breach announcements, also read out by screen readers -->
		<div
			class="pointer-events-none absolute inset-x-0 top-[34%] flex justify-center px-4"
			aria-live="polite"
		>
			{#if game.banner && game.status === 'playing'}
				{#key game.banner}
					<p
						class="pop-in rounded-[10px_6px_12px_8px] border-3 border-ink px-3 py-1 text-center font-display text-xl font-bold shadow-[3px_3px_0_var(--color-ink)] {game
							.banner.kind === 'breach' ||
						(game.banner.kind === 'rush' && game.banner.started)
							? 'bg-tie-red'
							: game.banner.kind === 'air' ||
								  game.banner.kind === 'unlock' ||
								  game.banner.kind === 'rush'
								? 'bg-explosion-yellow'
								: 'bg-paper'}"
						style:rotate="-2deg"
					>
						{#if game.banner.kind === 'incoming'}
							{m.dronewall_wave_incoming({ wave: game.banner.wave })}
						{:else if game.banner.kind === 'cleared'}
							{m.dronewall_wave_cleared({ bonus: game.banner.bonus })}
						{:else if game.banner.kind === 'air'}
							{m.dronewall_air_incoming()}
						{:else if game.banner.kind === 'weather'}
							{WEATHER_NAMES[game.banner.weather]()}: {WEATHER_EFFECTS[game.banner.weather]()}
						{:else if game.banner.kind === 'rush'}
							{game.banner.started
								? m.dronewall_banner_rush_started()
								: m.dronewall_banner_rush_warning()}
						{:else if game.banner.kind === 'unlock'}
							{m.dronewall_banner_unlock({ power: POWER_NAMES[game.banner.power]() })}
						{:else}
							{m.dronewall_breach()}
						{/if}
					</p>
				{/key}
			{/if}
		</div>

		{#if game.status === 'ready'}
			<div
				class="absolute inset-0 flex flex-col items-center justify-center gap-4 overflow-y-auto rounded-[14px_8px_16px_10px] bg-ink/35 p-3"
			>
				<div
					class="sticker pop-in flex max-w-xs min-w-0 flex-col items-center gap-3 p-4 text-center"
					style:--tilt="-1.5deg"
				>
					<p dir="auto" class="text-sm leading-snug font-semibold">{m.dronewall_ready_hint()}</p>
					<DroneWallMapPicker {game} />
					{#if tall}
						<p dir="auto" class="text-xs leading-snug">{m.dronewall_map_tall_hint()}</p>
					{/if}
					<button type="button" class="btn-chunky bg-tie-red text-xl" onclick={() => game.start()}>
						<IconPlay class="size-5" aria-hidden="true" />
						{m.dronewall_start()}
					</button>
				</div>
			</div>
		{:else if game.status === 'paused'}
			<PauseOverlay onResume={() => game.resume()} />
		{/if}
	</div>
</div>

<style>
	.bump {
		animation: bump 220ms ease-out;
	}

	.shake {
		animation: shake 360ms ease-in-out;
	}

	@keyframes bump {
		40% {
			transform: scale(1.14);
		}
	}

	@keyframes shake {
		20% {
			translate: -4px 0;
		}
		40% {
			translate: 4px 0;
		}
		60% {
			translate: -3px 0;
		}
		80% {
			translate: 2px 0;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.bump,
		.shake {
			animation: none;
		}
	}
</style>
