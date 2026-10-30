<!--
	Gig Saboteur thumb controls: a joystick on the left (pushing it gently sneaks, pushing it
	out walks) and three buttons on the right: hold SABOTAGE next to a target, hold RUN to sprint
	(loud), and PHONE to arm the distraction. Everything works with pointer events and captures the
	pointer, so a finger that slides off a button still lets go of it. The pad never mirrors in
	right-to-left languages.
-->
<script lang="ts">
	import { SNEAK_STICK } from '#lib/game/sabotage/config.js';
	import { SABOTAGE_TEXT } from '#lib/game/sabotage/text.js';
	import type { SabotageGame } from '#lib/stores/sabotageGame.svelte.js';
	import IconBomb from '~icons/lucide/bomb';
	import IconFootprints from '~icons/lucide/footprints';
	import IconSmartphone from '~icons/lucide/smartphone';

	let { game }: { game: SabotageGame } = $props();

	/** How far the thumb can travel from the centre, in pixels */
	const REACH = 46;
	const DEAD_ZONE = 0.14;

	let base: HTMLDivElement | undefined = $state();
	let thumb = $state({ x: 0, y: 0 });
	let stickPointer: number | null = null;

	function aim(event: PointerEvent) {
		if (!base) return;
		const rect = base.getBoundingClientRect();
		const dx = event.clientX - (rect.left + rect.width / 2);
		const dy = event.clientY - (rect.top + rect.height / 2);
		const length = Math.hypot(dx, dy);
		const push = Math.min(1, length / REACH);
		if (length === 0 || push < DEAD_ZONE) {
			thumb = { x: 0, y: 0 };
			game.setStick(0, 0);
			return;
		}
		const nx = dx / length;
		const ny = dy / length;
		thumb = { x: nx * push * REACH, y: ny * push * REACH };
		game.setStick(nx * push, ny * push);
	}

	function stickDown(event: PointerEvent) {
		if (stickPointer !== null) return;
		stickPointer = event.pointerId;
		(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
		aim(event);
		event.preventDefault();
	}

	function stickMove(event: PointerEvent) {
		if (event.pointerId === stickPointer) aim(event);
	}

	function stickUp(event: PointerEvent) {
		if (event.pointerId !== stickPointer) return;
		stickPointer = null;
		thumb = { x: 0, y: 0 };
		game.setStick(0, 0);
	}

	/** A button that is held down: reports true on press and false on release */
	function holdButton(node: HTMLElement, set: (down: boolean) => void) {
		let pointer: number | null = null;
		const down = (event: PointerEvent) => {
			if (pointer !== null) return;
			pointer = event.pointerId;
			node.setPointerCapture(event.pointerId);
			set(true);
			event.preventDefault();
		};
		const up = (event: PointerEvent) => {
			if (event.pointerId !== pointer) return;
			pointer = null;
			set(false);
		};
		node.addEventListener('pointerdown', down);
		node.addEventListener('pointerup', up);
		node.addEventListener('pointercancel', up);
		node.addEventListener('lostpointercapture', up);
		return {
			destroy() {
				node.removeEventListener('pointerdown', down);
				node.removeEventListener('pointerup', up);
				node.removeEventListener('pointercancel', up);
				node.removeEventListener('lostpointercapture', up);
				if (pointer !== null) set(false);
			}
		};
	}

	const playing = $derived(game.screen === 'playing');
</script>

<div
	data-playfield
	dir="ltr"
	class="flex w-full shrink-0 items-center justify-between gap-2 px-3 py-2 select-none"
	style:touch-action="none"
>
	<!-- Joystick: the faint inner ring is where sneaking turns into walking -->
	<div
		bind:this={base}
		class="relative size-[8.5rem] shrink-0 touch-none rounded-full border-3 border-ink bg-paper/70 shadow-[3px_3px_0_var(--color-ink)]"
		role="group"
		aria-label={SABOTAGE_TEXT.stick}
		onpointerdown={stickDown}
		onpointermove={stickMove}
		onpointerup={stickUp}
		onpointercancel={stickUp}
		onlostpointercapture={stickUp}
	>
		<div
			class="pointer-events-none absolute top-1/2 left-1/2 rounded-full border-2 border-dashed border-ink/30"
			style:width="{REACH * SNEAK_STICK * 2}px"
			style:height="{REACH * SNEAK_STICK * 2}px"
			style:transform="translate(-50%, -50%)"
		></div>
		<div
			class="pointer-events-none absolute top-1/2 left-1/2 size-14 rounded-full border-3 border-ink bg-tie-red shadow-[2px_2px_0_var(--color-ink)]"
			style:transform="translate(calc(-50% + {thumb.x}px), calc(-50% + {thumb.y}px))"
		></div>
	</div>

	<div class="flex min-w-0 flex-1 items-end justify-end gap-3">
		<div class="flex flex-col items-center gap-2">
			<button
				type="button"
				tabindex="-1"
				class="btn-chunky size-16 touch-none flex-col justify-center gap-0 rounded-full p-0 text-[0.7rem] leading-none {game.phoneArmed
					? 'bg-explosion-yellow'
					: 'bg-flag-blue'}"
				disabled={!playing || game.phoneLeft <= 0}
				aria-pressed={game.phoneArmed}
				onpointerdown={(event) => {
					event.preventDefault();
					game.armPhone();
				}}
			>
				<IconSmartphone class="size-6" aria-hidden="true" />
				<span>{game.phoneArmed ? SABOTAGE_TEXT.phoneAim : SABOTAGE_TEXT.phone}</span>
			</button>
			<button
				type="button"
				tabindex="-1"
				class="btn-chunky size-16 touch-none flex-col justify-center gap-0 rounded-full bg-paper p-0 text-[0.7rem] leading-none"
				disabled={!playing}
				use:holdButton={(down) => game.setSprint(down)}
			>
				<IconFootprints class="size-6" aria-hidden="true" />
				<span>{SABOTAGE_TEXT.run}</span>
			</button>
		</div>

		<button
			type="button"
			tabindex="-1"
			class="btn-chunky relative size-28 touch-none flex-col justify-center gap-0.5 overflow-hidden rounded-full p-0 text-sm leading-none {game.canWork
				? 'bg-explosion-yellow'
				: 'bg-paper'}"
			disabled={!playing}
			use:holdButton={(down) => game.setHold(down)}
		>
			<IconBomb class="size-9" aria-hidden="true" />
			<span class="font-bold">{SABOTAGE_TEXT.sabotage}</span>
			<span class="text-[0.7rem] opacity-70">{SABOTAGE_TEXT.sabotageHold}</span>
			{#if game.working > 0}
				<span
					class="pointer-events-none absolute inset-x-0 bottom-0 bg-flag-blue/60"
					style:height="{game.working * 100}%"
				></span>
			{/if}
		</button>
	</div>
</div>
