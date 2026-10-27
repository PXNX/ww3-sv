<!--
	Raid playfield: a crisp high-DPI canvas that fills the space it gets (landscape), driven by the
	fixed-step loop, with the HUD and the touch controls laid over it. Dragging anywhere on the
	field opens a floating stick to walk. The big weapon button at the bottom right attacks (tap
	or hold; every shot aims at the closest enemy), and the held weapon's two skills and the
	weapon swap sit in an arc towards its top left, the sprint button to their left. A live event
	shows under the time with its seconds left. Keys work too. The playfield never mirrors in
	right-to-left languages and never scrolls.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { m } from '#lib/paraglide/messages.js';
	import { createFixedLoop, onAppHidden } from '#lib/game/loop.js';
	import { RARITY_COLOR } from '#lib/game/raid/config.js';
	import { avatar } from '#lib/game/avatar/store.svelte.js';
	import { drawRaid, raiderLook } from '#lib/game/raid/render.js';
	import type { RaidGame } from '#lib/stores/raidGame.svelte.js';
	import LivesBar from './LivesBar.svelte';
	import PauseOverlay from './PauseOverlay.svelte';
	import RaidItemIcon from './RaidItemIcon.svelte';
	import RaidSkillIcon from './RaidSkillIcon.svelte';
	import {
		BOSS_NAMES,
		EVENT_NAMES,
		formatTime,
		itemName,
		RARITY_NAMES,
		SKILL_NAMES,
		WEAPON_NAMES
	} from './raidText';
	import IconHeartPulse from '~icons/lucide/heart-pulse';
	import IconWind from '~icons/lucide/wind';
	import IconZap from '~icons/lucide/zap';
	import IconRepeat from '~icons/lucide/repeat';
	import IconCoins from '~icons/lucide/coins';
	import IconGem from '~icons/lucide/gem';
	import IconSkull from '~icons/lucide/skull';

	let { game }: { game: RaidGame } = $props();

	// The raider wears the player's own agent colours
	const avatarState = avatar();
	const look = $derived(raiderLook(avatarState.look));

	let canvas: HTMLCanvasElement | undefined = $state();
	let context: CanvasRenderingContext2D | null = null;
	let cssWidth = 1;
	let cssHeight = 1;

	function draw() {
		if (!canvas || !context) return;
		const ratio = window.devicePixelRatio || 1;
		context.setTransform(ratio, 0, 0, ratio, 0, 0);
		drawRaid(context, game.state, cssWidth, cssHeight, { ...game.sceneExtras(), look });
	}

	function resize() {
		if (!canvas) return;
		const ratio = window.devicePixelRatio || 1;
		cssWidth = Math.max(1, canvas.clientWidth);
		cssHeight = Math.max(1, canvas.clientHeight);
		canvas.width = Math.round(cssWidth * ratio);
		canvas.height = Math.round(cssHeight * ratio);
		draw();
	}

	const loop = createFixedLoop({
		update: (dtMs) => {
			applyKeys();
			game.update(dtMs);
		},
		render: draw
	});

	onMount(() => {
		if (!canvas) return;
		context = canvas.getContext('2d');
		const observer = new ResizeObserver(resize);
		observer.observe(canvas);
		const stopHidden = onAppHidden(() => game.pause());
		return () => {
			loop.pause();
			observer.disconnect();
			stopHidden();
		};
	});

	$effect(() => {
		if (game.status === 'playing') loop.start();
		else {
			loop.pause();
			releaseAll();
		}
		void game.status;
		draw();
	});

	// --- Floating stick --------------------------------------------------------------------------

	const STICK_RADIUS = 56;
	const DEAD_ZONE = 0.12;
	let stick = $state<{ id: number; baseX: number; baseY: number; dx: number; dy: number } | null>(
		null
	);

	function localPoint(event: PointerEvent) {
		const rect = canvas!.getBoundingClientRect();
		return { x: event.clientX - rect.left, y: event.clientY - rect.top };
	}

	function onStickDown(event: PointerEvent) {
		if (game.status !== 'playing' || stick || !canvas) return;
		event.preventDefault();
		canvas.setPointerCapture?.(event.pointerId);
		const point = localPoint(event);
		stick = { id: event.pointerId, baseX: point.x, baseY: point.y, dx: 0, dy: 0 };
	}

	function onStickMove(event: PointerEvent) {
		if (!stick || event.pointerId !== stick.id) return;
		const point = localPoint(event);
		let dx = point.x - stick.baseX;
		let dy = point.y - stick.baseY;
		const length = Math.hypot(dx, dy);
		if (length > STICK_RADIUS) {
			// The base follows the finger, so a long drag never leaves the stick stuck at its edge
			stick.baseX += (dx / length) * (length - STICK_RADIUS);
			stick.baseY += (dy / length) * (length - STICK_RADIUS);
			dx = (dx / length) * STICK_RADIUS;
			dy = (dy / length) * STICK_RADIUS;
		}
		stick.dx = dx;
		stick.dy = dy;
		const share = Math.min(1, Math.hypot(dx, dy) / STICK_RADIUS);
		if (share < DEAD_ZONE) game.move(0, 0);
		else game.move(dx / STICK_RADIUS, dy / STICK_RADIUS);
	}

	function onStickUp(event: PointerEvent) {
		if (!stick || event.pointerId !== stick.id) return;
		stick = null;
		game.move(0, 0);
	}

	// --- Attack button -----------------------------------------------------------------------------

	let attackPointer: number | null = null;

	function onAttackDown(event: PointerEvent) {
		if (game.status !== 'playing') return;
		event.preventDefault();
		(event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
		attackPointer = event.pointerId;
		game.attack(true);
	}

	function onAttackUp(event: PointerEvent) {
		if (event.pointerId !== attackPointer) return;
		attackPointer = null;
		game.attack(false);
	}

	/** Skill buttons act on pointer down, so they never wait for a finger to lift */
	function skill(action: () => void) {
		return (event: PointerEvent) => {
			event.preventDefault();
			event.stopPropagation();
			action();
		};
	}

	// --- Keyboard ------------------------------------------------------------------------------------

	/** Movement keys held down, read every step */
	let held: Record<string, boolean> = {};
	const isHeld = (...codes: string[]) => codes.some((code) => held[code]);
	let keyAttack = false;

	const isInteractive = (target: EventTarget | null) =>
		target instanceof HTMLElement &&
		target.closest('button, a, input, select, textarea, [contenteditable]') !== null;

	function applyKeys() {
		if (stick) return;
		const x = (isHeld('ArrowRight', 'KeyD') ? 1 : 0) - (isHeld('ArrowLeft', 'KeyA') ? 1 : 0);
		const y = (isHeld('ArrowDown', 'KeyS') ? 1 : 0) - (isHeld('ArrowUp', 'KeyW') ? 1 : 0);
		game.move(x, y);
	}

	function releaseAll() {
		held = {};
		stick = null;
		attackPointer = null;
		keyAttack = false;
		game.attack(false);
	}

	function onKeyDown(event: KeyboardEvent) {
		if (event.ctrlKey || event.metaKey || event.altKey) return;
		if (event.code === 'Escape') {
			if (game.status === 'playing') game.pause();
			return;
		}
		if (game.status !== 'playing' && game.status !== 'paused') return;
		if (isInteractive(event.target) && event.code !== 'KeyP') return;
		if (event.code === 'KeyP') {
			if (!event.repeat) game.togglePause();
			return;
		}
		if (game.status !== 'playing') return;
		switch (event.code) {
			case 'Space':
			case 'KeyJ':
				event.preventDefault();
				if (!keyAttack) {
					keyAttack = true;
					game.attack(true);
				}
				return;
			case 'KeyQ':
				if (!event.repeat) game.swap();
				return;
			case 'KeyE':
				if (!event.repeat) game.skill(0);
				return;
			case 'KeyR':
				if (!event.repeat) game.skill(1);
				return;
			case 'KeyF':
				if (!event.repeat) game.equipFound();
				return;
			case 'ShiftLeft':
			case 'ShiftRight':
				if (!event.repeat) game.sprint();
				return;
		}
		if (event.code.startsWith('Arrow') || ['KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(event.code)) {
			event.preventDefault();
			held[event.code] = true;
		}
	}

	function onKeyUp(event: KeyboardEvent) {
		held[event.code] = false;
		if ((event.code === 'Space' || event.code === 'KeyJ') && keyAttack) {
			keyAttack = false;
			game.attack(false);
		}
	}

	const hpShare = $derived(Math.max(0, Math.min(1, game.hp / game.maxHp)));
	const cooldownStyle = (share: number) =>
		share > 0
			? `background-image: conic-gradient(rgb(17 17 17 / 0.55) ${share * 360}deg, transparent 0)`
			: '';

	// The skills sit on an arc towards the top left of the attack button, the sprint to their left
	const ATTACK_SIZE = 88;
	const SKILL_SIZE = 58;
	const ARC = 102;
	function arcSpot(degrees: number) {
		const angle = (degrees * Math.PI) / 180;
		const center = 14 + ATTACK_SIZE / 2;
		return `right: ${center - Math.cos(angle) * ARC - SKILL_SIZE / 2}px; bottom: ${center + Math.sin(angle) * ARC - SKILL_SIZE / 2}px; width: ${SKILL_SIZE}px; height: ${SKILL_SIZE}px;`;
	}
</script>

<svelte:window onkeydown={onKeyDown} onkeyup={onKeyUp} />

<div data-playfield class="relative h-full min-h-0 w-full flex-1 select-none">
	<canvas
		bind:this={canvas}
		class="block h-full w-full touch-none"
		style:touch-action="none"
		aria-label={m.raid_playfield_label()}
		onpointerdown={onStickDown}
		onpointermove={onStickMove}
		onpointerup={onStickUp}
		onpointercancel={onStickUp}
		oncontextmenu={(event) => event.preventDefault()}
	></canvas>

	{#key game.hurtCount}
		{#if game.hurtCount > 0 && game.status === 'playing'}
			<div class="hurt pointer-events-none absolute inset-0 border-8 border-tie-red"></div>
		{/if}
	{/key}

	{#if game.status !== 'lobby'}
		<!-- HUD: health, revive, time and threat on the left; XP, gold, kills and crystals on the right -->
		<div
			class="pointer-events-none absolute inset-x-2 top-(--hud-top) flex items-start justify-between gap-2"
		>
			<div class="flex flex-col gap-1">
				<div
					class="flex items-center gap-2 rounded-lg border-2 border-ink bg-paper/90 px-2 py-1 font-display text-sm font-bold"
				>
					<div
						class="relative h-4 w-28 overflow-hidden rounded-full border-2 border-ink bg-sand sm:w-40"
					>
						<div
							class="h-full bg-tie-red transition-[width] duration-150"
							style:width="{hpShare * 100}%"
						></div>
					</div>
					<span class="tabular-nums">{game.hp}/{game.maxHp}</span>
					<span title={game.revivesLeft > 0 ? m.raid_hud_revive_ready() : m.raid_hud_revive_used()}>
						<LivesBar lives={game.revivesLeft} max={1} class="text-base" />
						<span class="sr-only"
							>{game.revivesLeft > 0 ? m.raid_hud_revive_ready() : m.raid_hud_revive_used()}</span
						>
					</span>
				</div>
				<div
					class="flex w-fit items-center gap-2 rounded-lg border-2 border-ink bg-paper/90 px-2 py-0.5 font-display text-xs font-bold"
				>
					<span class="tabular-nums">{formatTime(game.timeMs)}</span>
					<span class="rounded bg-tie-red px-1 text-paper"
						>{m.raid_hud_threat({ level: game.threat })}</span
					>
				</div>
				{#if game.liveEvent}
					<div
						class="live-event flex w-fit items-center gap-1 rounded-lg border-2 border-ink bg-explosion-yellow px-2 py-0.5 font-display text-xs font-bold"
					>
						<IconZap class="size-3.5" aria-hidden="true" />
						<span>{m.raid_event_live({ event: EVENT_NAMES[game.liveEvent.kind]() })}</span>
						<span class="tabular-nums opacity-80"
							>{m.raid_event_seconds({ seconds: game.liveEventSeconds })}</span
						>
					</div>
				{/if}
			</div>

			{#if game.boss}
				<div
					class="mx-auto flex max-w-[40%] flex-1 flex-col items-center rounded-lg border-2 border-ink bg-paper/90 px-2 py-1"
				>
					<span dir="auto" class="flex items-center gap-1 font-display text-xs font-bold">
						{#if game.boss.variant !== 'normal'}
							<span class={game.boss.variant === 'mega' ? 'text-tie-red' : 'text-mustard'}
								>{game.boss.variant === 'mega' ? '★★' : '★'}</span
							>
						{/if}
						{BOSS_NAMES[game.map]()}
					</span>
					<div class="h-3 w-full overflow-hidden rounded-full border-2 border-ink bg-sand">
						<div class="h-full bg-[#a64dff]" style:width="{game.boss.share * 100}%"></div>
					</div>
				</div>
			{/if}

			<div
				class="flex items-center gap-2 rounded-lg border-2 border-ink bg-paper/90 px-2 py-1 font-display text-sm font-bold tabular-nums"
			>
				<span class="text-flag-blue">{game.xp} XP</span>
				<span class="flex items-center gap-0.5"
					><IconCoins class="size-4" aria-hidden="true" />{game.gold}</span
				>
				<span class="flex items-center gap-0.5"
					><IconSkull class="size-4" aria-hidden="true" />{game.kills}</span
				>
				{#if game.crystalsFound > 0}
					<span class="flex items-center gap-0.5 text-[#a64dff]"
						><IconGem class="size-4" aria-hidden="true" />{game.crystalsFound}</span
					>
				{/if}
			</div>
		</div>
	{/if}

	{#if game.found && (game.status === 'playing' || game.status === 'paused')}
		{@const item = game.found.item}
		<div
			class="pop-in absolute top-[calc(var(--hud-top)+4.75rem)] left-2 flex max-w-[15rem] items-center gap-2 rounded-xl border-3 bg-paper p-2 shadow-[3px_3px_0_var(--color-ink)]"
			style:border-color={RARITY_COLOR[item.rarity]}
		>
			<RaidItemIcon
				kind={item.type === 'weapon' ? item.kind : item.slot}
				rarity={item.rarity}
				class="size-11 shrink-0"
			/>
			<div class="flex min-w-0 flex-col font-display leading-tight">
				<span class="text-[0.65rem] font-bold uppercase opacity-70">{m.raid_found()}</span>
				<span dir="auto" class="truncate text-sm font-bold">{itemName(item)}</span>
				<span class="text-xs font-bold" style:color={RARITY_COLOR[item.rarity]}
					>{RARITY_NAMES[item.rarity]()} · {m.raid_item_level({ level: item.level })}</span
				>
				{#if game.found.better}
					<span class="text-[0.65rem] font-bold text-khaki">▲ {m.raid_found_better()}</span>
				{/if}
			</div>
			<button
				type="button"
				class="btn-chunky shrink-0 bg-explosion-yellow px-2 py-1 text-sm"
				onclick={() => game.equipFound()}
			>
				{m.raid_found_equip()}
			</button>
		</div>
	{/if}

	{#if stick}
		<div
			class="pointer-events-none absolute rounded-full border-3 border-ink/60 bg-paper/25"
			style:left="{stick.baseX - STICK_RADIUS}px"
			style:top="{stick.baseY - STICK_RADIUS}px"
			style:width="{STICK_RADIUS * 2}px"
			style:height="{STICK_RADIUS * 2}px"
		>
			<div
				class="absolute size-12 rounded-full border-3 border-ink bg-paper/80"
				style:left="{STICK_RADIUS - 24 + stick.dx}px"
				style:top="{STICK_RADIUS - 24 + stick.dy}px"
			></div>
		</div>
	{/if}

	{#if game.status === 'playing' || game.status === 'paused'}
		<!-- Attack: tap or hold -->
		<button
			type="button"
			class="attack absolute flex touch-none flex-col items-center justify-center rounded-full border-4 border-ink bg-explosion-yellow shadow-[3px_3px_0_var(--color-ink)]"
			style="right: 14px; bottom: 14px; width: {ATTACK_SIZE}px; height: {ATTACK_SIZE}px; {cooldownStyle(
				game.fireCooldown
			)}"
			aria-label="{m.raid_button_attack()}: {WEAPON_NAMES[game.heldKind]()}"
			onpointerdown={onAttackDown}
			onpointerup={onAttackUp}
			onpointercancel={onAttackUp}
			onlostpointercapture={onAttackUp}
			oncontextmenu={(event) => event.preventDefault()}
		>
			<RaidItemIcon kind={game.heldKind} class="size-14" />
			<span
				class="absolute -bottom-1 rounded bg-ink px-1 font-display text-[0.65rem] font-bold text-paper"
				>{m.raid_item_level({ level: game.heldLevel })}</span
			>
		</button>

		{#each game.skills as id, slot (id)}
			<button
				type="button"
				class="skill absolute flex touch-none items-center justify-center rounded-full border-3 border-ink bg-paper shadow-[2px_2px_0_var(--color-ink)]"
				style="{arcSpot(slot === 0 ? 180 : 135)} {cooldownStyle(game.skillCooldowns[slot])}"
				title={SKILL_NAMES[id]()}
				aria-label={SKILL_NAMES[id]()}
				onpointerdown={skill(() => game.skill(slot === 0 ? 0 : 1))}
			>
				<RaidSkillIcon skill={id} />
			</button>
		{/each}
		<button
			type="button"
			class="skill absolute flex touch-none items-center justify-center rounded-full border-3 border-ink bg-paper shadow-[2px_2px_0_var(--color-ink)]"
			style="right: {14 +
				ATTACK_SIZE / 2 +
				ARC +
				SKILL_SIZE / 2 +
				12}px; bottom: 18px; width: {SKILL_SIZE}px; height: {SKILL_SIZE}px; {cooldownStyle(
				game.sprintCooldown
			)}"
			title={m.raid_button_sprint()}
			aria-label={m.raid_button_sprint()}
			onpointerdown={skill(() => game.sprint())}
		>
			<IconWind class="size-7 text-flag-blue" aria-hidden="true" />
		</button>
		<button
			type="button"
			class="skill absolute flex touch-none items-center justify-center rounded-full border-3 border-ink bg-sky shadow-[2px_2px_0_var(--color-ink)]"
			style={arcSpot(90)}
			title="{m.raid_button_swap()}: {WEAPON_NAMES[game.otherKind]()}"
			aria-label="{m.raid_button_swap()}: {WEAPON_NAMES[game.otherKind]()}"
			onpointerdown={skill(() => game.swap())}
		>
			<RaidItemIcon kind={game.otherKind} class="size-9" />
			<IconRepeat
				class="absolute -top-1 -right-1 size-5 rounded-full border-2 border-ink bg-paper p-0.5"
				aria-hidden="true"
			/>
		</button>
	{/if}

	{#if game.status === 'paused'}
		<PauseOverlay onResume={() => game.resume()} />
	{:else if game.status === 'down'}
		<div
			class="absolute inset-0 z-20 flex items-center justify-center bg-tie-red/40 p-4"
			role="dialog"
			aria-modal="true"
			aria-labelledby="raid-down-title"
		>
			<div
				class="sticker pop-in flex max-w-xs flex-col items-center gap-3 p-5 text-center"
				style:--tilt="1.5deg"
			>
				<h2 id="raid-down-title" dir="auto" class="font-display text-3xl font-bold">
					{m.raid_down_title()}
				</h2>
				<p dir="auto" class="text-sm leading-snug">{m.raid_down_body()}</p>
				<!-- svelte-ignore a11y_autofocus -->
				<button
					type="button"
					class="btn-chunky min-w-44 bg-explosion-yellow text-lg"
					autofocus
					onclick={() => game.revive()}
				>
					<IconHeartPulse class="size-5" aria-hidden="true" />
					{m.raid_revive()}
				</button>
				<button type="button" class="btn-chunky min-w-44 text-sm" onclick={() => game.giveUp()}>
					{m.raid_give_up()}
				</button>
			</div>
		</div>
	{/if}
</div>

<style>
	.attack:active,
	.skill:active {
		scale: 0.92;
	}

	.hurt {
		animation: hurt 380ms ease-out forwards;
	}

	@keyframes hurt {
		from {
			opacity: 0.7;
		}
		to {
			opacity: 0;
		}
	}

	.live-event {
		animation: live-event 900ms ease-in-out infinite alternate;
	}

	@keyframes live-event {
		to {
			scale: 1.06;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.hurt {
			animation-duration: 1ms;
		}

		.live-event {
			animation: none;
		}
	}
</style>
