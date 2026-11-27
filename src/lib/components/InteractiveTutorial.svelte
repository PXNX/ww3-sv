<!--
	Interactive "how to play" wizard. Unlike TutorialModal this does not cover the game with text:
	it dims the page, cuts a spotlight around one real control at a time and asks the player to use
	it (`action: 'tap'`) before moving on. Steps without a target are read-and-advance explanation
	steps. Escape or Skip closes the wizard, arrow keys and Back walk it backwards, and every label
	comes from the shared translated strings so the game pages only supply their own step copy.
-->
<script lang="ts">
	import { m } from '#lib/paraglide/messages.js';
	import { soundManager } from '#lib/sound/soundManager.svelte.js';
	import type { TutorialStep } from '#lib/services/tutorial.js';

	let {
		open,
		title,
		steps,
		closeLabel,
		onclose
	}: {
		open: boolean;
		title: string;
		steps: TutorialStep[];
		closeLabel: string;
		onclose: () => void;
	} = $props();

	let index = $state(0);
	const step = $derived(steps[index]);
	let viewport = $state({ w: 0, h: 0 });
	let spot = $state<DOMRect | null>(null);
	let cardHeight = $state(210);
	let card: HTMLElement | undefined = $state();

	// A fresh visit always starts at the first step, whether it came from firstPlay or the help button
	$effect(() => {
		if (open) index = 0;
	});

	function measure() {
		viewport = { w: window.innerWidth, h: window.innerHeight };
		const selector = open ? step?.target : undefined;
		const target = selector ? document.querySelector<HTMLElement>(selector) : null;
		spot = target ? target.getBoundingClientRect() : null;
	}

	$effect(() => {
		if (!open) return;
		measure();
		const frame = requestAnimationFrame(measure);
		window.addEventListener('resize', measure);
		window.addEventListener('scroll', measure, true);
		return () => {
			cancelAnimationFrame(frame);
			window.removeEventListener('resize', measure);
			window.removeEventListener('scroll', measure, true);
		};
	});

	// Keep the callout beside the spotlight, never off-screen and never covering the control if
	// there is room above or below it. The measured height keeps this working for RTL and long text.
	const placement = $derived.by(() => {
		const width = Math.min(360, Math.max(240, viewport.w - 24));
		if (!spot) {
			return { width, left: Math.round((viewport.w - width) / 2), top: Math.max(12, viewport.h - cardHeight - 20) };
		}
		const pad = 6;
		const left = Math.min(
			Math.max(12, spot.left + spot.width / 2 - width / 2),
			Math.max(12, viewport.w - width - 12)
		);
		const below = spot.bottom + pad + 12;
		const above = spot.top - cardHeight - pad - 12;
		const top = below + cardHeight < viewport.h - 12 ? below : above >= 12 ? above : Math.max(12, viewport.h - cardHeight - 12);
		return { width, left, top };
	});

	function finish() {
		soundManager().play('ui-tap');
		onclose();
	}

	function advance() {
		if (index < steps.length - 1) {
			soundManager().play('ui-tap');
			index += 1;
		} else {
			finish();
		}
	}

	function back() {
		if (index === 0) return;
		soundManager().play('ui-tap');
		index -= 1;
	}

	// Any real use of the highlighted control counts as doing the step. Capture phase so a game's
	// own pointer handler still runs afterwards and the tap has its normal effect.
	function onPointerDown(event: PointerEvent) {
		if (!open || step?.action !== 'tap' || !step.target) return;
		const fromCallout = card?.contains(event.target as Node);
		const hit = (event.target as Element | null)?.closest?.(step.target);
		if (!fromCallout && hit) advance();
	}

	function onKeyDown(event: KeyboardEvent) {
		if (!open) return;
		if (event.key === 'Escape') {
			event.preventDefault();
			event.stopPropagation();
			finish();
			return;
		}
		if ((event.target as Element | null)?.closest?.('input, textarea, [contenteditable="true"]')) return;
		let handled = true;
		if (event.key === 'ArrowRight' || event.key === 'Enter' || event.key === ' ') advance();
		else if (event.key === 'ArrowLeft') back();
		else handled = false;
		if (handled) {
			event.preventDefault();
			event.stopPropagation();
		}
	}

	$effect(() => {
		if (!open) return;
		window.addEventListener('pointerdown', onPointerDown, true);
		window.addEventListener('keydown', onKeyDown, true);
		return () => {
			window.removeEventListener('pointerdown', onPointerDown, true);
			window.removeEventListener('keydown', onKeyDown, true);
		};
	});

	// Moving focus with the wizard keeps screen readers on the current tip
	$effect(() => {
		if (open) card?.focus({ preventScroll: true });
	});
</script>

{#if open && step}
	<div class="fixed inset-0 z-[9990]" data-interactive-tutorial>
		{#if spot}
			<div
				class="pointer-events-none fixed z-[9991] rounded-[16px_10px_14px_8px] border-3 border-explosion-yellow transition-[top,left,width,height] duration-200"
				style:left="{spot.left - 6}px"
				style:top="{spot.top - 6}px"
				style:width="{spot.width + 12}px"
				style:height="{spot.height + 12}px"
				style:box-shadow="0 0 0 9999px rgb(17 17 17 / 62%)"
				aria-hidden="true"
			></div>
		{:else}
			<div class="pointer-events-none fixed inset-0 bg-ink/65" aria-hidden="true"></div>
		{/if}

		<div
			bind:this={card}
			bind:clientHeight={cardHeight}
			tabindex="-1"
			role="group"
			aria-label={title}
			class="sticker fixed z-[9992] flex flex-col gap-2 rounded-[18px_10px_16px_8px] border-3 border-ink bg-paper p-4 shadow-(--shadow-hard) outline-none"
			style:left="{placement.left}px"
			style:top="{placement.top}px"
			style:width="{placement.width}px"
		>
			<div class="flex items-center justify-between gap-2 font-display text-xs font-bold tracking-wide opacity-70">
				<span dir="auto">{title}</span>
				<span class="tabular-nums">{m.tutorial_step_counter({ current: index + 1, total: steps.length })}</span>
			</div>
			<div class="h-1.5 overflow-hidden rounded-full bg-ink/15" aria-hidden="true">
				<div
					class="h-full rounded-full bg-explosion-yellow transition-all"
					style:width="{((index + 1) / steps.length) * 100}%"
				></div>
			</div>
			<h2 class="text-xl leading-tight font-bold" dir="auto">{step.title}</h2>
			<p class="text-sm leading-snug" dir="auto">{step.text}</p>
			{#if step.action === 'tap' && step.target}
				<p class="text-xs font-bold text-tie-red" dir="auto">{m.tutorial_tap_target()}</p>
			{/if}
			<div class="mt-1 flex items-center justify-between gap-2">
				<div class="flex items-center gap-1">
					{#if index > 0}
						<button type="button" class="btn-chunky px-2 py-1 text-xs" onclick={back}>
							{m.tutorial_back()}
						</button>
					{/if}
					<button type="button" class="btn-chunky px-2 py-1 text-xs" onclick={finish}>
						{m.tutorial_skip()}
					</button>
				</div>
				<button
					type="button"
					class="btn-chunky bg-explosion-yellow px-3 py-1 text-sm"
					onclick={advance}
				>
					{index === steps.length - 1 ? closeLabel : m.tutorial_next()}
				</button>
			</div>
		</div>
	</div>
{/if}
