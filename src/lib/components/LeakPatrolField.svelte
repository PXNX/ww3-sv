<!--
	Leak Patrol playfield: a cross-section of the West Wing with six rooms, each with a water meter,
	the leaks as droplet buttons (hold a finger on one to plug it, up to three at once), tools
	lying around, the tool tray, the "Add journalist to group chat?" dialog, the fixed-step loop and
	the overlays (start card, pause card, toast, news-cycle note, the red flash for a flooded room).
	The playfield stays left-to-right and never scrolls. Reduced motion: no shake, no wobble.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { MAX_FINGERS } from '#lib/game/leakpatrol/config.js';
	import { createFixedLoop, onAppHidden } from '#lib/game/loop.js';
	import { ROOMS, roomKey, roomOfKey } from '#lib/game/leakpatrol/rooms.js';
	import { fixProgress, pressableLeak, type Leak } from '#lib/game/leakpatrol/state.js';
	import { TOOLS, type ToolKind } from '#lib/game/leakpatrol/tools.js';
	import { m } from '#lib/paraglide/messages.js';
	import type { LeakPatrolGame } from '#lib/stores/leakpatrolGame.svelte.js';
	import PauseOverlay from './PauseOverlay.svelte';
	import { roomName, toolName } from './leakpatrolText.js';
	import IconDroplet from '~icons/lucide/droplet';
	import IconFolder from '~icons/lucide/folder-lock';
	import IconBandage from '~icons/lucide/bandage';
	import IconChat from '~icons/lucide/message-circle';
	import IconPen from '~icons/lucide/pen';
	import IconPlay from '~icons/lucide/play';

	let { game }: { game: LeakPatrolGame } = $props();

	let field: HTMLDivElement | undefined = $state();

	const loop = createFixedLoop({
		update: (dtMs) => game.update(dtMs),
		render: () => {}
	});

	onMount(() => {
		const stopHidden = onAppHidden(() => game.pause());
		return () => {
			loop.pause();
			stopHidden();
		};
	});

	$effect(() => {
		if (game.status === 'playing') loop.start();
		else loop.pause();
	});

	// Screen shake: the building jolts when a room floods
	$effect(() => {
		const count = game.hurtCount;
		if (count === 0 || !field || game.reducedMotion) return;
		field.animate(
			[
				{ transform: 'translate(0, 0)' },
				{ transform: 'translate(-6px, 4px) rotate(-0.4deg)' },
				{ transform: 'translate(6px, -3px) rotate(0.4deg)' },
				{ transform: 'translate(-3px, -2px)' },
				{ transform: 'translate(2px, 2px)' },
				{ transform: 'translate(0, 0)' }
			],
			{ duration: 360, easing: 'ease-out' }
		);
	});

	const TOOL_ICONS = { sharpie: IconPen, tape: IconBandage, folder: IconFolder } as const;
	const TOOL_KEYS: Partial<Record<ToolKind, string>> = { sharpie: 'S', tape: 'T' };

	function leaksOf(room: number): Leak[] {
		return game.leaks.filter((leak) => leak.room === room);
	}

	function percent(level: number): number {
		return Math.round(Math.min(1, level) * 100);
	}

	function meterClass(level: number): string {
		return level > 0.75 ? 'bg-tie-red/70' : level > 0.5 ? 'bg-mustard/80' : 'bg-flag-blue/80';
	}

	// Mouse, touch and pen: every pointer holds the leak it came down on
	function press(event: PointerEvent, leak: Leak) {
		if (event.pointerType === 'mouse' && event.button !== 0) return;
		try {
			(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
		} catch {
			// A pointer that is already gone cannot be captured; the hold ends with it
		}
		game.hold(leak.id);
	}

	/** Leak held by a room key, so the key up lets go of the same leak */
	const keyHolds: Record<string, number> = {};

	function onKeyDown(event: KeyboardEvent) {
		if (game.status === 'over' || event.ctrlKey || event.metaKey || event.altKey) return;
		if (event.code === 'Escape') {
			if (game.status === 'playing') game.pause();
			return;
		}
		const target = event.target;
		if (target instanceof HTMLElement && target.closest('input, select, textarea')) return;
		if (event.code === 'KeyP') {
			if (!event.repeat && !(target instanceof HTMLButtonElement)) game.togglePause();
			return;
		}
		if (event.repeat || game.status !== 'playing') return;
		if (event.code === 'KeyS' || event.code === 'KeyT') {
			event.preventDefault();
			game.arm(event.code === 'KeyS' ? 'sharpie' : 'tape');
			return;
		}
		if (event.code === 'KeyN' || event.code === 'KeyY') {
			if (game.dialog === null) return;
			event.preventDefault();
			game.answer(event.code === 'KeyY');
			return;
		}
		const room = roomOfKey(event.code);
		if (room < 0) return;
		event.preventDefault();
		const pickup = game.pickups.find((entry) => entry.room === room);
		if (pickup) {
			game.collect(pickup.id);
			return;
		}
		const leak = pressableLeak(game.state, room);
		if (!leak) return;
		keyHolds[event.code] = leak.id;
		game.hold(leak.id);
	}

	function onKeyUp(event: KeyboardEvent) {
		const id = keyHolds[event.code];
		if (id === undefined) return;
		delete keyHolds[event.code];
		game.release(id);
	}
</script>

<svelte:window onkeydown={onKeyDown} onkeyup={onKeyUp} />

<div
	bind:this={field}
	data-playfield
	dir="ltr"
	class="relative flex w-full touch-none flex-col gap-2 overflow-hidden rounded-[14px_8px_16px_10px] border-3 border-ink bg-sand p-2 shadow-[4px_4px_0_var(--color-ink)] select-none sm:gap-3 sm:p-3"
	style:touch-action="none"
>
	<!-- The group chat dialog has a reserved slot so the rooms never jump -->
	<div class="min-h-[4.75rem]">
		{#if game.dialog !== null}
			<div
				class="chat flex flex-col gap-1.5 rounded-md border-3 border-ink bg-paper px-3 py-2 shadow-[3px_3px_0_var(--color-ink)]"
				role="alertdialog"
				aria-label={m.leakpatrol_dialog_label()}
			>
				<p class="flex items-center gap-2 font-display text-sm font-bold sm:text-base">
					<IconChat class="size-5 shrink-0 text-flag-blue" aria-hidden="true" />
					<span dir="auto">{m.leakpatrol_dialog_title()}</span>
				</p>
				<div
					class="h-2 overflow-hidden rounded-full border-2 border-ink bg-sand"
					aria-hidden="true"
				>
					<div class="h-full bg-tie-red" style:width="{game.dialog * 100}%"></div>
				</div>
				<div class="grid grid-cols-2 gap-2">
					<button
						type="button"
						class="btn-chunky bg-[#8fd19e] px-2 py-1 text-sm"
						aria-keyshortcuts="N"
						onpointerdown={(event) => {
							if (event.pointerType === 'mouse' && event.button !== 0) return;
							game.answer(false);
						}}
						onclick={(event) => {
							if (event.detail === 0) game.answer(false);
						}}
					>
						{m.leakpatrol_dialog_no()}
					</button>
					<button
						type="button"
						class="btn-chunky bg-sand px-2 py-1 text-sm"
						aria-keyshortcuts="Y"
						onpointerdown={(event) => {
							if (event.pointerType === 'mouse' && event.button !== 0) return;
							game.answer(true);
						}}
						onclick={(event) => {
							if (event.detail === 0) game.answer(true);
						}}
					>
						{m.leakpatrol_dialog_yes()}
					</button>
				</div>
			</div>
		{:else}
			<p
				dir="auto"
				class="flex min-h-[4.75rem] items-center justify-center text-center font-display text-xs font-bold text-ink/60 sm:text-sm"
			>
				{m.leakpatrol_fingers_hint({ count: MAX_FINGERS })}
			</p>
		{/if}
	</div>

	<!-- The West Wing: six rooms in two floors -->
	<div
		role="group"
		aria-label={m.leakpatrol_board_label()}
		class="grid grid-cols-3 gap-1.5 sm:gap-3"
	>
		{#each ROOMS as id, room (id)}
			{@const level = game.rooms[room] ?? 0}
			{@const pickup = game.pickups.find((entry) => entry.room === room)}
			<div
				class="room relative flex h-[8.75rem] flex-col overflow-hidden rounded-md border-3 border-ink bg-paper shadow-[2px_2px_0_var(--color-ink)] sm:h-[10.5rem]"
				class:danger={level > 0.75}
				role="group"
				aria-label={m.leakpatrol_room_aria({
					room: roomName(room),
					key: roomKey(room),
					level: percent(level)
				})}
			>
				<div
					class="absolute inset-x-0 bottom-0 {meterClass(level)}"
					style:height="{percent(level)}%"
					aria-hidden="true"
				></div>
				<!-- The pipe along the ceiling -->
				<div
					class="absolute inset-x-0 top-5 h-2 border-y-2 border-ink bg-khaki sm:top-6"
					aria-hidden="true"
				></div>
				<p
					class="relative z-10 flex items-center justify-between gap-1 px-1.5 pt-0.5 font-display text-[0.6rem] leading-tight font-bold sm:text-xs"
				>
					<span dir="auto" class="truncate">{roomName(room)}</span>
					<kbd
						class="rounded border-2 border-ink bg-sand px-1 text-[0.6rem] leading-none"
						aria-hidden="true">{roomKey(room)}</kbd
					>
				</p>
				<div
					class="relative z-10 flex flex-1 flex-wrap content-center items-center justify-center gap-1 px-1"
				>
					{#each leaksOf(room) as leak (leak.id)}
						{@const open = leak.phase === 'open'}
						{@const taped = open && leak.tapeMs > 0}
						{@const plugging = game.plugging.includes(leak.id) && open && !taped}
						<button
							type="button"
							class="leak relative flex shrink-0 items-center justify-center rounded-full border-3 border-ink {leak.big
								? 'size-14 bg-tie-red text-paper sm:size-16'
								: 'size-11 sm:size-14'} {taped
								? 'bg-sky text-ink'
								: open && !leak.big
									? 'bg-flag-blue text-paper'
									: !open
										? 'bg-paper text-flag-blue'
										: ''}"
							class:drip={!open}
							class:plugging
							class:open={open && !taped}
							aria-label={open
								? m.leakpatrol_leak_label({ room: roomName(room) })
								: m.leakpatrol_drip_label({ room: roomName(room) })}
							aria-pressed={plugging}
							disabled={!open}
							oncontextmenu={(event) => event.preventDefault()}
							onpointerdown={(event) => press(event, leak)}
							onpointerup={() => game.release(leak.id)}
							onpointercancel={() => game.release(leak.id)}
							onlostpointercapture={() => game.release(leak.id)}
							onkeydown={(event) => {
								if ((event.code === 'Enter' || event.code === 'Space') && !event.repeat) {
									event.preventDefault();
									game.hold(leak.id);
								}
							}}
							onkeyup={(event) => {
								if (event.code === 'Enter' || event.code === 'Space') game.release(leak.id);
							}}
						>
							{#if taped}
								<IconBandage class="size-6 sm:size-7" aria-hidden="true" />
							{:else}
								<IconDroplet class="size-6 sm:size-7" aria-hidden="true" />
							{/if}
							{#if open && !taped}
								<span
									class="absolute inset-x-1 -bottom-1.5 h-1.5 overflow-hidden rounded-full border-2 border-ink bg-paper"
									aria-hidden="true"
								>
									<span class="block h-full bg-mustard" style:width="{fixProgress(leak) * 100}%"
									></span>
								</span>
							{/if}
						</button>
					{/each}
				</div>
				{#if pickup}
					{@const Icon = TOOL_ICONS[pickup.tool]}
					<button
						type="button"
						class="pickup btn-chunky absolute right-1 bottom-1 z-20 size-10 bg-mustard p-0"
						style:opacity={pickup.leftMs < 2000 ? 0.6 : 1}
						aria-label={m.leakpatrol_pickup_label({
							tool: toolName(pickup.tool),
							room: roomName(room)
						})}
						onpointerdown={(event) => {
							if (event.pointerType === 'mouse' && event.button !== 0) return;
							game.collect(pickup.id);
						}}
						onclick={(event) => {
							if (event.detail === 0) game.collect(pickup.id);
						}}
					>
						<Icon class="size-5" aria-hidden="true" />
					</button>
				{/if}
			</div>
		{/each}
	</div>

	<!-- The tool tray: the Sharpie and the tape are armed and then applied, the folder works alone -->
	<div role="group" aria-label={m.leakpatrol_tray_label()} class="grid grid-cols-3 gap-2 sm:gap-3">
		{#each TOOLS as tool (tool)}
			{@const Icon = TOOL_ICONS[tool]}
			{@const count = game.tools[tool]}
			{#if tool === 'folder'}
				<div
					class="flex items-center justify-center gap-1.5 rounded-md border-3 border-ink bg-paper px-1 py-2 font-display text-sm font-bold shadow-[2px_2px_0_var(--color-ink)] sm:text-base {count ===
					0
						? 'opacity-55'
						: ''}"
					role="img"
					aria-label={m.leakpatrol_tool_count({ tool: toolName(tool), count })}
				>
					<Icon class="size-5 sm:size-6" aria-hidden="true" />
					<span dir="auto" class="truncate">{toolName(tool)}</span>
					<span class="tabular-nums">x{count}</span>
				</div>
			{:else}
				<button
					type="button"
					class="btn-chunky gap-1.5 bg-sand px-1 py-2 text-sm sm:text-base"
					class:armed={game.armed === tool}
					disabled={count === 0 && game.armed !== tool}
					aria-pressed={game.armed === tool}
					aria-keyshortcuts={TOOL_KEYS[tool]}
					aria-label={m.leakpatrol_tool_count({ tool: toolName(tool), count })}
					onclick={() => game.arm(tool)}
				>
					<Icon class="size-5 sm:size-6" aria-hidden="true" />
					<span dir="auto" class="truncate">{toolName(tool)}</span>
					<span class="tabular-nums">x{count}</span>
				</button>
			{/if}
		{/each}
	</div>

	{#if game.toast && game.status === 'playing'}
		{#key game.toast.id}
			<p
				dir="auto"
				class="notice pointer-events-none absolute inset-x-2 top-[40%] z-30 text-center font-display text-2xl leading-tight font-bold text-paper [-webkit-text-stroke:5px_var(--color-ink)] [paint-order:stroke] sm:text-3xl"
				aria-live="polite"
			>
				{game.toast.text}
			</p>
		{/key}
	{/if}

	{#if game.waveNote && game.status === 'playing'}
		{#key game.waveNote.id}
			<p
				dir="auto"
				class="notice pointer-events-none absolute inset-x-2 top-[22%] z-30 text-center font-display text-xl leading-tight font-bold text-paper [-webkit-text-stroke:4px_var(--color-ink)] [paint-order:stroke] sm:text-2xl"
			>
				{game.waveNote.text}
			</p>
		{/key}
	{/if}

	<!-- A red flash around the field whenever a room floods -->
	{#key game.hurtCount}
		{#if game.hurtCount > 0 && game.status === 'playing'}
			<div class="hurt pointer-events-none absolute inset-0 z-30 border-8 border-tie-red"></div>
		{/if}
	{/key}

	{#if game.status === 'ready'}
		<div
			class="absolute inset-0 z-40 flex flex-col items-center justify-center gap-4 bg-ink/35 p-4"
		>
			<div
				class="sticker pop-in flex w-full max-w-xs flex-col items-center gap-3 p-4 text-center"
				style:--tilt="-1.5deg"
			>
				<p dir="auto" class="text-sm leading-snug font-semibold">{m.leakpatrol_ready_hint()}</p>
				<p dir="auto" class="text-xs leading-snug text-ink/70 italic">{m.leakpatrol_tip_dike()}</p>
				{#if game.best !== null}
					<p class="text-sm font-semibold">{m.leakpatrol_best({ score: game.best })}</p>
				{/if}
				<button type="button" class="btn-chunky bg-tie-red text-xl" onclick={() => game.start()}>
					<IconPlay class="size-5" aria-hidden="true" />
					{m.leakpatrol_start()}
				</button>
			</div>
		</div>
	{:else if game.status === 'paused'}
		<PauseOverlay onResume={() => game.resume()} />
	{/if}
</div>

<style>
	.notice {
		animation: notice 1300ms ease-out forwards;
	}

	.hurt {
		animation: hurt 420ms ease-out forwards;
	}

	.chat {
		animation: pop 220ms ease-out both;
	}

	.leak {
		touch-action: none;
		-webkit-touch-callout: none;
		-webkit-user-select: none;
		user-select: none;
	}

	.leak.drip {
		animation: drip 650ms ease-in-out infinite;
	}

	.leak.open {
		animation: wobble 520ms ease-in-out infinite;
	}

	.leak.plugging {
		animation: none;
		box-shadow:
			0 0 0 3px var(--color-paper),
			0 0 0 6px var(--color-ink);
	}

	.room.danger {
		animation: alarm 700ms ease-in-out infinite;
	}

	.armed {
		box-shadow:
			0 0 0 3px var(--color-paper),
			0 0 0 6px var(--color-ink);
		background: var(--color-mustard);
	}

	@keyframes notice {
		0% {
			opacity: 0;
			transform: scale(0.7);
		}
		12% {
			opacity: 1;
			transform: scale(1.08);
		}
		20% {
			transform: scale(1);
		}
		75% {
			opacity: 1;
		}
		100% {
			opacity: 0;
			transform: translateY(-0.75rem);
		}
	}

	@keyframes hurt {
		from {
			opacity: 0.85;
		}
		to {
			opacity: 0;
		}
	}

	@keyframes pop {
		from {
			opacity: 0;
			transform: scale(0.9);
		}
		to {
			opacity: 1;
			transform: none;
		}
	}

	/* The telegraph: a drip that blinks before the water flows */
	@keyframes drip {
		0%,
		100% {
			opacity: 0.45;
			transform: translateY(-2px);
		}
		50% {
			opacity: 1;
			transform: translateY(2px);
		}
	}

	@keyframes wobble {
		0%,
		100% {
			transform: rotate(-4deg);
		}
		50% {
			transform: rotate(4deg);
		}
	}

	@keyframes alarm {
		0%,
		100% {
			border-color: var(--color-ink);
		}
		50% {
			border-color: var(--color-tie-red);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.notice,
		.chat,
		.leak.drip,
		.leak.open,
		.room.danger {
			animation: none;
		}

		.hurt {
			animation-duration: 1ms;
		}

		.leak.drip {
			opacity: 0.6;
		}

		.room.danger {
			border-color: var(--color-tie-red);
		}
	}
</style>
