<!--
	Raid playfield: a crisp high-DPI canvas that fills the space it gets (landscape), driven by the
	fixed-step loop, with the HUD and the touch controls laid over it, laid out like a mobile
	brawler. The player's health and level float over their head on the canvas. The top left holds
	the shared goal: the boss's health while one is out, else the wait for the next one (in a
	defense the command post, the wave and the pot instead), with a live event under it. A new threat level is announced in the middle of the field. A picked-up crystal drops in as a banner at
	the top, and at every fifth wave of a defense the vote on cashing out covers the field. The minimap sits in the top right; tapping it opens the
	leave screen, as does the exit button and every pause. A resting stick waits at the bottom left
	and jumps to wherever the field is dragged. The big weapon button at the bottom right attacks
	(tap or hold; every shot aims at the closest enemy), the two skills, the weapon swap and the
	sprint sit around it with their seconds left while they recharge. Keys work too. The playfield
	never mirrors in right-to-left languages and never scrolls.
-->
<script lang="ts">
	import { onMount, type Snippet } from 'svelte';
	import { m } from '#lib/paraglide/messages.js';
	import { createFixedLoop, onAppHidden } from '#lib/game/loop.js';
	import { RARITY_COLOR } from '#lib/game/raid/config.js';
	import { avatar } from '#lib/game/avatar/store.svelte.js';
	import { drawRaid, raiderLook } from '#lib/game/raid/render.js';
	import type { RaidGame } from '#lib/stores/raidGame.svelte.js';
	import LivesBar from './LivesBar.svelte';
	import RaidCrystalToast from './RaidCrystalToast.svelte';
	import RaidDefenseVote from './RaidDefenseVote.svelte';
	import RaidItemIcon from './RaidItemIcon.svelte';
	import RaidLeaveScreen from './RaidLeaveScreen.svelte';
	import RaidMapOverlay from './RaidMapOverlay.svelte';
	import RaidMinimap from './RaidMinimap.svelte';
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
	import IconCoins from '~icons/lucide/coins';
	import IconGem from '~icons/lucide/gem';
	import IconHeartPulse from '~icons/lucide/heart-pulse';
	import IconShield from '~icons/lucide/shield';
	import IconWind from '~icons/lucide/wind';
	import IconZap from '~icons/lucide/zap';
	import IconRepeat from '~icons/lucide/repeat';
	import IconSkull from '~icons/lucide/skull';

	let { game }: { game: RaidGame } = $props();

	// The raider wears the player's own agent colours
	const avatarState = avatar();
	const look = $derived(raiderLook(avatarState.shown));

	let canvas: HTMLCanvasElement | undefined = $state();
	let context: CanvasRenderingContext2D | null = null;
	let cssWidth = 1;
	let cssHeight = 1;
	let mapOpen = $state(false);

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

	const cooldownStyle = (share: number) =>
		share > 0
			? `background-image: conic-gradient(rgb(10 6 24 / 0.6) ${share * 360}deg, transparent 0)`
			: '';

	// The skills, the swap and the sprint sit on an arc around the attack button
	const ATTACK_SIZE = 92;
	const ATTACK_RIGHT = 36;
	const ATTACK_BOTTOM = 30;
	const SKILL_SIZE = 60;
	const ARC = 106;
	function arcSpot(degrees: number, size = SKILL_SIZE) {
		const angle = (degrees * Math.PI) / 180;
		const right = ATTACK_RIGHT + ATTACK_SIZE / 2;
		const bottom = ATTACK_BOTTOM + ATTACK_SIZE / 2;
		return `right: ${right - Math.cos(angle) * ARC - size / 2}px; bottom: ${bottom + Math.sin(angle) * ARC - size / 2}px; width: ${size}px; height: ${size}px;`;
	}

	/** The small map keeps the battlefield's proportions inside a fixed box */
	const MINIMAP_BOX = { width: 128, height: 92 };
	const minimap = $derived.by(() => {
		const { map } = game.state;
		void game.map;
		const scale = Math.min(MINIMAP_BOX.width / map.width, MINIMAP_BOX.height / map.height);
		return { width: Math.round(map.width * scale), height: Math.round(map.height * scale) };
	});
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
		<!-- Top left: the shared goal (the boss), then time, threat and revive, a live event and found gear -->
		<div
			class="pointer-events-none absolute top-(--hud-top) left-(--hud-left) flex w-72 max-w-[45%] flex-col items-start gap-1.5"
		>
			{#if game.defense}
				{@const defense = game.defense}
				<!-- The command post, the wave and the pot -->
				<div
					class="w-full rounded-s-lg bg-linear-to-r from-[#0e3a3a]/90 via-[#0e3a3a]/60 to-transparent py-1.5 ps-3 pe-6 text-white"
				>
					<span
						class="block font-display text-[0.7rem] font-bold tracking-wide text-[#7ff0e0] uppercase"
						>{m.raid_hud_post()}</span
					>
					<span dir="auto" class="block text-sm leading-tight font-bold">
						{#if defense.wave === 0}
							{m.raid_hud_post_hold()}
						{:else}
							{m.raid_hud_wave({ wave: defense.wave })}
							<span class="opacity-80"
								>· {defense.breakSeconds > 0
									? m.raid_hud_next_wave({ seconds: defense.breakSeconds })
									: m.raid_hud_wave_left({ count: defense.left })}</span
							>
						{/if}
					</span>
					<div class="mt-1 flex items-center">
						<span
							class="z-10 flex size-7 shrink-0 items-center justify-center rounded-full border-2 border-white bg-[#22c3b0]"
						>
							<IconShield class="size-4" aria-hidden="true" />
						</span>
						<div class="relative -ms-2 h-4 flex-1 overflow-hidden rounded-e-sm bg-black/45">
							<div
								class="h-full transition-[width] duration-300 {defense.post > 0.35
									? 'bg-linear-to-r from-[#22c3b0] to-[#7ff0e0]'
									: 'bg-linear-to-r from-[#e5484d] to-[#ff8a5a]'}"
								style:width="{defense.post * 100}%"
							></div>
							<span
								class="absolute inset-y-0 start-3 flex items-center font-display text-xs font-bold tabular-nums"
								>{Math.round(defense.post * 100)}%</span
							>
						</div>
					</div>
					<div
						class="mt-1 flex items-center gap-2 font-display text-[0.7rem] font-black tabular-nums"
					>
						<span class="uppercase opacity-80">{m.raid_hud_pot()}</span>
						<span class="flex items-center gap-0.5"
							><IconCoins class="size-3.5 text-[#ffd23a]" aria-hidden="true" />{defense.pot
								.gold}</span
						>
						<span class="flex items-center gap-0.5"
							><span class="text-[#7fd3ff]">XP</span>{defense.pot.xp}</span
						>
						{#if defense.pot.crystals > 0}
							<span class="flex items-center gap-0.5"
								><IconGem class="size-3.5 text-[#c79bff]" aria-hidden="true" />{defense.pot
									.crystals}</span
							>
						{/if}
					</div>
				</div>
			{/if}
			{#if !game.defense || game.boss}
				<div
					class="w-full rounded-s-lg bg-linear-to-r from-[#1b1036]/85 via-[#1b1036]/60 to-transparent py-1.5 ps-3 pe-6 text-white"
				>
					<span
						class="block font-display text-[0.7rem] font-bold tracking-wide text-[#b9a4ff] uppercase"
						>{game.boss ? m.raid_hud_boss_now() : m.raid_hud_boss_next()}</span
					>
					<span dir="auto" class="block text-sm leading-tight font-bold">
						{#if game.boss && game.boss.variant !== 'normal'}
							<span class={game.boss.variant === 'mega' ? 'text-[#ff6b6b]' : 'text-[#ffd23a]'}
								>{game.boss.variant === 'mega' ? '★★' : '★'}</span
							>
						{/if}
						{game.boss
							? m.raid_hud_boss_fight({ boss: BOSS_NAMES[game.map]() })
							: m.raid_hud_boss_soon({ boss: BOSS_NAMES[game.map]() })}
					</span>
					<div class="mt-1 flex items-center">
						<span
							class="z-10 flex size-7 shrink-0 items-center justify-center rounded-full border-2 border-white bg-[#ff6b3d]"
						>
							<IconSkull class="size-4" aria-hidden="true" />
						</span>
						<div class="relative -ms-2 h-4 flex-1 overflow-hidden rounded-e-sm bg-black/45">
							<div
								class="h-full transition-[width] duration-300 {game.boss
									? 'bg-linear-to-r from-[#a64dff] to-[#ff5ad1]'
									: 'bg-linear-to-r from-[#ff6b3d] to-[#ff9a3c]'}"
								style:width="{(game.boss ? game.boss.share : (game.nextBoss?.share ?? 0)) * 100}%"
							></div>
							<span
								class="absolute inset-y-0 start-3 flex items-center font-display text-xs font-bold tabular-nums"
							>
								{game.boss
									? `${Math.round(game.boss.share * 100)}%`
									: formatTime((game.nextBoss?.seconds ?? 0) * 1000)}
							</span>
						</div>
					</div>
				</div>
			{/if}

			<div
				class="flex items-center gap-2 rounded-md bg-[#1b1036]/60 px-2 py-0.5 font-display text-xs font-bold text-white"
			>
				<span title={game.revivesLeft > 0 ? m.raid_hud_revive_ready() : m.raid_hud_revive_used()}>
					<LivesBar lives={game.revivesLeft} max={1} class="text-sm" />
					<span class="sr-only"
						>{game.revivesLeft > 0 ? m.raid_hud_revive_ready() : m.raid_hud_revive_used()}</span
					>
				</span>
			</div>

			{#if game.liveEvent}
				<div
					class="live-event flex w-fit origin-left items-center gap-1 rounded-md bg-explosion-yellow px-2 py-0.5 font-display text-xs font-bold text-[#111]"
				>
					<IconZap class="size-3.5" aria-hidden="true" />
					<span>{m.raid_event_live({ event: EVENT_NAMES[game.liveEvent.kind]() })}</span>
					<span class="tabular-nums opacity-80"
						>{m.raid_event_seconds({ seconds: game.liveEventSeconds })}</span
					>
				</div>
			{/if}

			{#if game.found && (game.status === 'playing' || game.status === 'paused')}
				{@const item = game.found.item}
				<div
					class="pop-in pointer-events-auto flex max-w-[15rem] items-center gap-2 rounded-xl border-3 bg-paper p-2 shadow-[3px_3px_0_var(--color-ink)]"
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
		</div>

		<!-- Top right: the minimap opens the map overlay -->
		<button
			type="button"
			class="absolute top-(--hud-top) right-(--hud-right) rounded-xl bg-[#1b1036]/40 p-1 ring-2 ring-white/25 active:scale-95"
			aria-label="{m.raid_hud_minimap()}: Map"
			onclick={() => (mapOpen = true)}
		>
			{#key game.map}
				<RaidMinimap
					raid={() => game.state}
					width={minimap.width}
					height={minimap.height}
					live
					questTargets={() => game.questTargets()}
					label={m.raid_hud_minimap()}
					class="rounded-lg"
				/>
			{/key}
		</button>
	{/if}

	{#if stick}
		<div
			class="pointer-events-none absolute rounded-full border-3 border-white/50 bg-black/15"
			style:left="{stick.baseX - STICK_RADIUS}px"
			style:top="{stick.baseY - STICK_RADIUS}px"
			style:width="{STICK_RADIUS * 2}px"
			style:height="{STICK_RADIUS * 2}px"
		>
			<div
				class="absolute size-14 rounded-full border-3 border-white/80 bg-white/55"
				style:left="{STICK_RADIUS - 28 + stick.dx}px"
				style:top="{STICK_RADIUS - 28 + stick.dy}px"
			></div>
		</div>
	{:else if game.status === 'playing'}
		<!-- The stick at rest; it jumps to wherever the field is dragged -->
		<div
			class="pointer-events-none absolute bottom-[calc(1.25rem+env(safe-area-inset-bottom))] left-[calc(1.75rem+env(safe-area-inset-left))] flex items-center justify-center rounded-full border-3 border-white/30 bg-black/10"
			style:width="{STICK_RADIUS * 2}px"
			style:height="{STICK_RADIUS * 2}px"
		>
			<div class="size-14 rounded-full border-3 border-white/45 bg-white/25"></div>
		</div>
	{/if}

	{#snippet roundButton(
		spot: string,
		label: string,
		share: number,
		seconds: number,
		onpress: () => void,
		icon: Snippet
	)}
		<button
			type="button"
			class="skill absolute flex touch-none items-center justify-center rounded-full bg-[#1b1036]/45 ring-3 ring-white/30"
			style="{spot} {cooldownStyle(share)}"
			title={label}
			aria-label={label}
			onpointerdown={skill(onpress)}
		>
			<span
				class="relative flex size-[78%] items-center justify-center rounded-full bg-paper transition-opacity"
				class:opacity-45={seconds > 0}
				class:grayscale={seconds > 0}
			>
				{@render icon()}
			</span>
			{#if seconds > 0}
				<span
					class="cooldown-number absolute font-display text-2xl font-black text-white tabular-nums"
					aria-hidden="true">{seconds}</span
				>
			{/if}
		</button>
	{/snippet}

	{#snippet sprintIcon()}<IconWind class="size-8 text-flag-blue" aria-hidden="true" />{/snippet}
	{#snippet swapIcon()}
		<RaidItemIcon kind={game.otherKind} class="size-7" />
		<IconRepeat
			class="absolute -top-1 -right-1 size-4 rounded-full bg-[#1b1036] p-0.5 text-white"
			aria-hidden="true"
		/>
	{/snippet}

	{#if game.status === 'playing' || game.status === 'paused'}
		<!-- Attack: tap or hold -->
		<button
			type="button"
			class="attack absolute flex touch-none items-center justify-center rounded-full bg-[#1b1036]/45 ring-4 ring-white/35"
			style="right: {ATTACK_RIGHT}px; bottom: {ATTACK_BOTTOM}px; width: {ATTACK_SIZE}px; height: {ATTACK_SIZE}px; {cooldownStyle(
				game.fireCooldown
			)}"
			aria-label="{m.raid_button_attack()}: {WEAPON_NAMES[game.heldKind]()}"
			onpointerdown={onAttackDown}
			onpointerup={onAttackUp}
			onpointercancel={onAttackUp}
			onlostpointercapture={onAttackUp}
			oncontextmenu={(event) => event.preventDefault()}
		>
			<span
				class="flex size-[76%] items-center justify-center rounded-full bg-linear-to-b from-[#ffe27a] to-[#f5b52a] shadow-[inset_0_-4px_0_rgb(0_0_0/0.18)]"
			>
				<RaidItemIcon kind={game.heldKind} class="size-14" />
			</span>
			<span
				class="absolute -bottom-1 rounded bg-[#1b1036] px-1 font-display text-[0.65rem] font-bold text-white"
				>{m.raid_item_level({ level: game.heldLevel })}</span
			>
		</button>

		{#each game.skills as id, slot (id)}
			{#snippet skillIcon()}<RaidSkillIcon skill={id} class="size-8" />{/snippet}
			{@render roundButton(
				arcSpot(slot === 0 ? 160 : 112),
				SKILL_NAMES[id](),
				game.skillCooldowns[slot],
				game.skillSeconds[slot],
				() => game.skill(slot === 0 ? 0 : 1),
				skillIcon
			)}
		{/each}
		{@render roundButton(
			arcSpot(200),
			m.raid_button_sprint(),
			game.sprintCooldown,
			game.sprintSeconds,
			() => game.sprint(),
			sprintIcon
		)}
		{@render roundButton(
			arcSpot(64, 50),
			`${m.raid_button_swap()}: ${WEAPON_NAMES[game.otherKind]()}`,
			0,
			0,
			() => game.swap(),
			swapIcon
		)}
	{/if}

	{#if game.crystalToast && game.status === 'playing'}
		<div class="pointer-events-none absolute top-(--hud-top) left-1/2 z-10 -translate-x-1/2">
			{#key game.crystalToast.id}
				<RaidCrystalToast crystal={game.crystalToast.crystal} />
			{/key}
		</div>
	{/if}

	{#if game.defense?.vote && game.status === 'playing'}
		<RaidDefenseVote {game} />
	{/if}

	{#if mapOpen}
		<RaidMapOverlay
			{game}
			onResume={() => {
				mapOpen = false;
				if (game.status === 'paused') game.resume();
			}}
		/>
	{/if}

	{#if game.threatAnnouncement}
		<div
			class="pointer-events-none absolute inset-0 z-40 flex items-center justify-center"
			style="animation: threat-banner 2s ease-in-out forwards"
		>
			<span
				class="font-display text-6xl font-black tracking-tight text-white uppercase italic drop-shadow-[0_4px_16px_rgba(0,0,0,0.7)]"
			>
				{m.raid_hud_threat({ level: game.threatAnnouncement.level })}
			</span>
		</div>
	{/if}

	{#if game.status === 'paused'}
		<RaidLeaveScreen {game} onResume={() => game.resume()} onLeave={() => game.leave()} />
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

	.cooldown-number {
		-webkit-text-stroke: 1.5px #1b1036;
		paint-order: stroke fill;
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

	.timer-low {
		animation: live-event 500ms ease-in-out infinite alternate;
	}

	@keyframes live-event {
		to {
			scale: 1.06;
		}
	}

	@keyframes threat-banner {
		0% {
			opacity: 0;
			scale: 0.8;
		}
		15% {
			opacity: 1;
			scale: 1.05;
		}
		85% {
			opacity: 1;
			scale: 0.95;
		}
		100% {
			opacity: 0;
			scale: 0.9;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.hurt {
			animation-duration: 1ms;
		}

		.live-event,
		.timer-low {
			animation: none;
		}
	}
</style>
