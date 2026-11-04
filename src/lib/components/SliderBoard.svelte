<!--
	Sondage Slider playfield: a labelled poll chart on top (your approval as a wobbling line with
	the star thresholds and the red resign zone) and the tap arena below, where rallies, scandals
	and fake polls pop up. A press conference button with a cooldown sits underneath. Particles,
	number popups and the screen shake are drawn here; with reduced motion they are left out.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import {
		MAX_APPROVAL,
		PRESS_COOLDOWN,
		RESIGN_LINE,
		STAR_LINES,
		WEEKS_TOTAL,
		WEEK_SECONDS,
		type SliderEvent,
		type TargetKind
	} from '#lib/game/slider/state.js';
	import { onAppHidden } from '#lib/game/loop.js';
	import { m } from '#lib/paraglide/messages.js';
	import type { SliderGame } from '#lib/stores/sliderGame.svelte.js';
	import IconDrama from '~icons/lucide/drama';
	import IconFlame from '~icons/lucide/flame';
	import IconMegaphone from '~icons/lucide/megaphone';
	import IconMic from '~icons/lucide/mic';

	let {
		game,
		reducedMotion = false
	}: {
		game: SliderGame;
		reducedMotion?: boolean;
	} = $props();

	interface Particle {
		x: number;
		y: number;
		vx: number;
		vy: number;
		life: number;
		max: number;
		size: number;
		color: string;
	}
	interface Popup {
		id: number;
		x: number;
		y: number;
		text: string;
		tone: 'good' | 'bad' | 'info';
	}

	const CHART_W = 320;
	const CHART_H = 150;
	const yOf = (value: number) => 140 - (Math.min(MAX_APPROVAL, Math.max(0, value)) / 100) * 128;

	let canvas: HTMLCanvasElement | undefined = $state();
	let time = $state(0);
	let shaking = $state(false);
	let popups = $state<Popup[]>([]);
	let banner = $state<{ week: number; hint: string } | null>(null);
	let nextPopup = 1;
	let particles: Particle[] = [];
	let shakeTimer: ReturnType<typeof setTimeout> | undefined;
	let bannerTimer: ReturnType<typeof setTimeout> | undefined;

	const state = $derived(game.state);
	const approval = $derived(Math.round(state.approval));
	const lineValue = $derived(reducedMotion ? state.approval : state.shown);
	const lineColor = $derived(
		state.approval <= RESIGN_LINE + 12
			? 'var(--color-tie-red)'
			: state.approval >= STAR_LINES[0]
				? 'var(--color-khaki)'
				: 'var(--color-ink)'
	);
	const wobbleAmp = $derived(
		reducedMotion ? 0 : 0.8 + state.week * 0.25 + Math.min(4, Math.abs(state.velocity) * 0.15)
	);
	const linePath = $derived.by(() => {
		const base = yOf(lineValue);
		const points: string[] = [];
		for (let x = 0; x <= CHART_W; x += 8) {
			const y = base + Math.sin(x * 0.07 + time * 5) * wobbleAmp;
			points.push(`${x === 0 ? 'M' : 'L'}${x},${y.toFixed(1)}`);
		}
		return points.join(' ');
	});
	const historyPath = $derived(
		state.history
			.map((value, index) => {
				const x = (index / 69) * CHART_W * 0.97;
				return `${index === 0 ? 'M' : 'L'}${x.toFixed(1)},${yOf(value).toFixed(1)}`;
			})
			.join(' ')
	);
	const weekProgress = $derived(Math.min(1, state.elapsed / (WEEKS_TOTAL * WEEK_SECONDS)));
	const pressReady = $derived(state.pressCooldown <= 0);
	const pressFill = $derived(1 - state.pressCooldown / PRESS_COOLDOWN);
	const thresholds = $derived([
		{ line: STAR_LINES[2], label: m.slider_th_landslide(), stars: 3 },
		{ line: STAR_LINES[1], label: m.slider_th_comfort(), stars: 2 },
		{ line: STAR_LINES[0], label: m.slider_th_squeak(), stars: 1 }
	]);

	const kindLabel = (kind: TargetKind) =>
		kind === 'rally'
			? m.slider_target_rally()
			: kind === 'scandal'
				? m.slider_target_scandal()
				: m.slider_target_decoy();

	function popup(x: number, y: number, text: string, tone: Popup['tone']) {
		const id = nextPopup++;
		popups.push({ id, x, y, text, tone });
		setTimeout(() => (popups = popups.filter((item) => item.id !== id)), 900);
	}

	function burst(x: number, y: number, color: string, count: number, speed: number) {
		if (reducedMotion || !canvas) return;
		const w = canvas.clientWidth;
		const h = canvas.clientHeight;
		for (let i = 0; i < count; i++) {
			const angle = Math.random() * Math.PI * 2;
			const v = speed * (0.4 + Math.random() * 0.8);
			particles.push({
				x: (x / 100) * w,
				y: (y / 100) * h,
				vx: Math.cos(angle) * v,
				vy: Math.sin(angle) * v - 30,
				life: 0,
				max: 0.5 + Math.random() * 0.4,
				size: 2 + Math.random() * 3.5,
				color
			});
		}
	}

	function shake() {
		if (reducedMotion) return;
		shaking = true;
		clearTimeout(shakeTimer);
		shakeTimer = setTimeout(() => (shaking = false), 450);
	}

	/** Shows the effects for a game event; the page hands this to the game's onEvent */
	export function fx(event: SliderEvent) {
		switch (event.type) {
			case 'rally':
				burst(event.x, event.y, '#f4c430', 12, 150);
				popup(event.x, event.y, `+${event.gain.toFixed(1)}%  +${event.points}`, 'good');
				if (event.combo % 5 === 0) {
					popup(50, 30, m.slider_combo_popup({ combo: event.combo }), 'info');
				}
				break;
			case 'counter':
				burst(event.x, event.y, '#4fa8d8', 8, 110);
				popup(event.x, event.y, m.slider_countered_popup({ points: event.points }), 'good');
				break;
			case 'decoy':
				burst(event.x, event.y, '#8b5cf6', 14, 140);
				popup(event.x, event.y, `-${event.loss.toFixed(0)}%`, 'bad');
				shake();
				break;
			case 'scandal':
				burst(event.x, event.y, '#e5484d', 26, 220);
				popup(event.x, event.y, `-${event.loss.toFixed(1)}%`, 'bad');
				shake();
				break;
			case 'missed':
				popup(event.x, event.y, m.slider_missed_popup(), 'info');
				break;
			case 'press':
				if (canvas) {
					for (let i = 0; i < 18; i++) {
						const x = 50 + Math.cos((i / 18) * Math.PI * 2) * 4;
						const y = 50 + Math.sin((i / 18) * Math.PI * 2) * 4;
						burst(x, y, '#f4c430', 1, 260);
					}
				}
				popup(50, 50, m.slider_press_popup({ cleared: event.cleared }), 'good');
				break;
			case 'week': {
				const hint =
					event.week === 2
						? m.slider_new_scandal()
						: event.week === 3
							? m.slider_new_decoy()
							: m.slider_week_harder();
				banner = { week: event.week, hint };
				clearTimeout(bannerTimer);
				bannerTimer = setTimeout(() => (banner = null), 2400);
				break;
			}
		}
	}

	function draw(dt: number) {
		if (!canvas) return;
		const ctx = canvas.getContext('2d');
		if (!ctx) return;
		const dpr = window.devicePixelRatio || 1;
		const w = canvas.clientWidth;
		const h = canvas.clientHeight;
		if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
			canvas.width = Math.round(w * dpr);
			canvas.height = Math.round(h * dpr);
		}
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		ctx.clearRect(0, 0, w, h);
		particles = particles.filter((p) => (p.life += dt) < p.max);
		for (const p of particles) {
			p.x += p.vx * dt;
			p.y += p.vy * dt;
			p.vy += 380 * dt;
			ctx.globalAlpha = 1 - p.life / p.max;
			ctx.fillStyle = p.color;
			ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
		}
		ctx.globalAlpha = 1;
	}

	onMount(() => {
		let frame = 0;
		let last = performance.now();
		const loop = (now: number) => {
			const dt = Math.min(0.1, (now - last) / 1000);
			last = now;
			time += dt;
			game.frame(dt);
			draw(dt);
			frame = requestAnimationFrame(loop);
		};
		frame = requestAnimationFrame(loop);
		const stopHidden = onAppHidden(() => game.pause());
		return () => {
			cancelAnimationFrame(frame);
			stopHidden();
			clearTimeout(shakeTimer);
			clearTimeout(bannerTimer);
		};
	});
</script>

<div class="flex w-full flex-col gap-3" class:board-shake={shaking}>
	<p class="text-center font-display text-sm leading-tight font-bold text-ink" dir="auto">
		{m.slider_goal()}
	</p>

	<!-- HUD: week, approval, streak -->
	<div class="flex items-stretch gap-2 font-display">
		<div class="flex-1 rounded-md border-2 border-ink bg-paper px-2 py-1">
			<div class="flex items-baseline justify-between text-xs font-bold">
				<span>{m.slider_week({ week: state.week, total: WEEKS_TOTAL })}</span>
			</div>
			<div class="mt-1 h-2 overflow-hidden rounded-full border border-ink bg-sand">
				<div class="h-full bg-khaki" style:width="{weekProgress * 100}%"></div>
			</div>
		</div>
		<div
			class="min-w-20 rounded-md border-2 border-ink bg-paper px-2 py-1 text-center"
			role="status"
			aria-label={m.slider_approval_aria({ approval })}
		>
			<div class="text-[10px] leading-none font-bold uppercase">{m.slider_approval()}</div>
			<div class="text-2xl leading-tight font-bold tabular-nums" style:color={lineColor}>
				{approval}%
			</div>
		</div>
		<div
			class="min-w-20 rounded-md border-2 border-ink px-2 py-1 text-center transition-colors"
			class:bg-explosion-yellow={game.multiplier > 1}
			class:bg-paper={game.multiplier <= 1}
		>
			<div class="text-[10px] leading-none font-bold uppercase">{m.slider_streak()}</div>
			<div class="text-2xl leading-tight font-bold tabular-nums">
				{state.combo}<span class="text-xs">&nbsp;x{game.multiplier}</span>
			</div>
		</div>
	</div>

	<!-- The poll chart -->
	<svg
		viewBox="0 0 {CHART_W} {CHART_H}"
		class="w-full rounded-md border-3 border-ink bg-paper"
		role="img"
		aria-label={m.slider_chart_aria({ approval })}
	>
		<rect
			x="0"
			y={yOf(RESIGN_LINE)}
			width={CHART_W}
			height={CHART_H - yOf(RESIGN_LINE)}
			fill="var(--color-tie-red)"
			opacity="0.28"
		/>
		<text x="4" y={yOf(RESIGN_LINE) + 11} font-size="8" font-weight="700" fill="var(--color-ink)">
			{m.slider_th_resign()}
			{RESIGN_LINE}%
		</text>
		<line
			x1="0"
			x2={CHART_W}
			y1={yOf(RESIGN_LINE)}
			y2={yOf(RESIGN_LINE)}
			stroke="var(--color-tie-red)"
			stroke-width="1.5"
		/>
		{#each thresholds as threshold (threshold.line)}
			<line
				x1="0"
				x2={CHART_W}
				y1={yOf(threshold.line)}
				y2={yOf(threshold.line)}
				stroke="var(--color-ink)"
				stroke-opacity="0.5"
				stroke-dasharray="4 4"
			/>
			<text
				x={CHART_W - 3}
				y={yOf(threshold.line) - 3}
				font-size="8"
				text-anchor="end"
				fill="var(--color-ink)"
			>
				{threshold.line}% {threshold.label}
				{'★'.repeat(threshold.stars)}
			</text>
		{/each}
		<path
			d={historyPath}
			fill="none"
			stroke="var(--color-ink)"
			stroke-opacity="0.35"
			stroke-width="2"
		/>
		<path d={linePath} fill="none" stroke={lineColor} stroke-width="3.5" stroke-linecap="round" />
		<circle
			cx={CHART_W - 10}
			cy={yOf(lineValue)}
			r="6"
			fill={lineColor}
			stroke="var(--color-ink)"
			stroke-width="2"
		/>
	</svg>

	<!-- The tap arena -->
	<div
		class="relative h-72 w-full touch-manipulation overflow-hidden rounded-md border-3 border-ink bg-sand select-none sm:h-80"
		style="background-image: radial-gradient(var(--color-ink) 1px, transparent 1px); background-size: 18px 18px; background-position: 0 0;"
	>
		{#each state.targets as target (target.id)}
			{@const left = 1 - target.age / target.ttl}
			<button
				type="button"
				class="target target-{target.kind}"
				class:target-in={!reducedMotion}
				style:left="{target.x}%"
				style:top="{target.y}%"
				aria-label={kindLabel(target.kind)}
				onpointerdown={(event) => {
					event.preventDefault();
					game.tapTarget(target.id);
				}}
				onkeydown={(event) => {
					if (event.key === 'Enter' || event.key === ' ') {
						event.preventDefault();
						game.tapTarget(target.id);
					}
				}}
			>
				<svg viewBox="0 0 40 40" class="ring" aria-hidden="true">
					<circle
						cx="20"
						cy="20"
						r="18"
						fill="none"
						stroke="currentColor"
						stroke-width="3"
						pathLength="100"
						stroke-dasharray="{left * 100} 100"
						transform="rotate(-90 20 20)"
					/>
				</svg>
				{#if target.kind === 'rally'}
					<IconMegaphone class="size-7" aria-hidden="true" />
				{:else if target.kind === 'scandal'}
					<IconFlame class="size-7" aria-hidden="true" />
				{:else}
					<IconDrama class="size-7" aria-hidden="true" />
				{/if}
				<span class="tag">{kindLabel(target.kind)}</span>
			</button>
		{/each}

		<canvas bind:this={canvas} class="pointer-events-none absolute inset-0 h-full w-full"></canvas>

		{#each popups as item (item.id)}
			<span
				class="popup popup-{item.tone}"
				class:popup-static={reducedMotion}
				style:left="{item.x}%"
				style:top="{item.y}%"
			>
				{item.text}
			</span>
		{/each}

		{#if banner}
			<div class="banner" class:banner-static={reducedMotion} role="status">
				<div class="text-2xl font-bold">
					{m.slider_week({ week: banner.week, total: WEEKS_TOTAL })}
				</div>
				<div class="text-sm">{banner.hint}</div>
			</div>
		{/if}

		{#if state.targets.length === 0 && state.elapsed < 1.2}
			<p class="absolute inset-0 grid place-items-center font-display text-lg font-bold">
				{m.slider_ready()}
			</p>
		{/if}
	</div>

	<!-- Press conference -->
	<button
		type="button"
		class="btn-chunky relative flex items-center justify-center gap-2 overflow-hidden py-2 text-sm"
		class:opacity-70={!pressReady}
		aria-label={m.slider_press_aria()}
		onpointerdown={(event) => {
			event.preventDefault();
			game.press();
		}}
		onkeydown={(event) => {
			if (event.key === 'Enter' || event.key === ' ') {
				event.preventDefault();
				game.press();
			}
		}}
	>
		<span
			class="absolute inset-y-0 left-0 bg-explosion-yellow/60"
			style:width="{pressFill * 100}%"
			aria-hidden="true"
		></span>
		<IconMic class="relative size-5" aria-hidden="true" />
		<span class="relative font-display font-bold">
			{pressReady
				? m.slider_press_ready()
				: m.slider_press_cooldown({ seconds: Math.ceil(state.pressCooldown) })}
		</span>
		<span class="relative hidden text-xs sm:inline">{m.slider_press_hint()}</span>
	</button>

	<!-- Legend -->
	<ul class="grid grid-cols-3 gap-2 font-display text-[11px] leading-tight sm:text-xs">
		<li
			class="flex flex-col items-center gap-1 rounded-md border-2 border-ink bg-paper p-1 text-center"
		>
			<span class="legend legend-rally"><IconMegaphone class="size-4" aria-hidden="true" /></span>
			{m.slider_legend_rally()}
		</li>
		<li
			class="flex flex-col items-center gap-1 rounded-md border-2 border-ink bg-paper p-1 text-center"
		>
			<span class="legend legend-scandal"><IconFlame class="size-4" aria-hidden="true" /></span>
			{m.slider_legend_scandal()}
		</li>
		<li
			class="flex flex-col items-center gap-1 rounded-md border-2 border-ink bg-paper p-1 text-center"
		>
			<span class="legend legend-decoy"><IconDrama class="size-4" aria-hidden="true" /></span>
			{m.slider_legend_decoy()}
		</li>
	</ul>
</div>

<style>
	.target {
		position: absolute;
		display: flex;
		width: 4.5rem;
		height: 4.5rem;
		transform: translate(-50%, -50%);
		flex-direction: column;
		align-items: center;
		justify-content: center;
		border: 3px solid var(--color-ink);
		border-radius: 9999px;
		color: var(--color-ink);
		cursor: pointer;
		box-shadow: 3px 3px 0 var(--color-ink);
		touch-action: manipulation;
	}
	.target:active {
		box-shadow: 1px 1px 0 var(--color-ink);
	}
	.target-in {
		animation: target-in 220ms cubic-bezier(0.2, 1.6, 0.4, 1) both;
	}
	.target-rally {
		background: #f4c430;
	}
	.target-scandal {
		background: #ee6a70;
	}
	.target-decoy {
		background: #b8a4e8;
		border-style: dashed;
	}
	.ring {
		position: absolute;
		inset: -9px;
		width: calc(100% + 18px);
		height: calc(100% + 18px);
		pointer-events: none;
	}
	.tag {
		font-family: var(--font-display, inherit);
		font-size: 9px;
		font-weight: 700;
		line-height: 1;
		margin-top: 1px;
		max-width: 4rem;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.legend {
		display: inline-grid;
		place-items: center;
		width: 1.75rem;
		height: 1.75rem;
		border: 2px solid var(--color-ink);
		border-radius: 9999px;
		color: var(--color-ink);
	}
	.legend-rally {
		background: #f4c430;
	}
	.legend-scandal {
		background: #ee6a70;
	}
	.legend-decoy {
		background: #b8a4e8;
		border-style: dashed;
	}
	.popup {
		position: absolute;
		transform: translate(-50%, -50%);
		font-family: var(--font-display, inherit);
		font-size: 1.05rem;
		font-weight: 800;
		white-space: nowrap;
		pointer-events: none;
		text-shadow:
			1px 1px 0 var(--color-paper),
			-1px -1px 0 var(--color-paper),
			1px -1px 0 var(--color-paper),
			-1px 1px 0 var(--color-paper);
		animation: popup 900ms ease-out forwards;
	}
	.popup-good {
		color: #2f6f2f;
	}
	.popup-bad {
		color: #c0262d;
	}
	.popup-info {
		color: var(--color-ink);
	}
	.popup-static {
		animation: fade 900ms linear forwards;
	}
	.banner {
		position: absolute;
		inset: 38% 8% auto;
		padding: 0.5rem;
		border: 3px solid var(--color-ink);
		border-radius: 0.5rem;
		background: var(--color-paper);
		box-shadow: 3px 3px 0 var(--color-ink);
		text-align: center;
		font-family: var(--font-display, inherit);
		pointer-events: none;
		animation: banner 2400ms ease-in-out forwards;
	}
	.banner-static {
		animation: fade 2400ms linear forwards;
	}
	.board-shake {
		animation: shake 450ms linear;
	}
	@keyframes target-in {
		from {
			transform: translate(-50%, -50%) scale(0.2);
			opacity: 0;
		}
	}
	@keyframes popup {
		from {
			transform: translate(-50%, -50%) scale(0.7);
			opacity: 1;
		}
		20% {
			transform: translate(-50%, -80%) scale(1.15);
		}
		to {
			transform: translate(-50%, -230%) scale(1);
			opacity: 0;
		}
	}
	@keyframes fade {
		from {
			opacity: 1;
		}
		to {
			opacity: 0;
		}
	}
	@keyframes banner {
		0% {
			transform: translateY(-14px) scale(0.9);
			opacity: 0;
		}
		12%,
		80% {
			transform: none;
			opacity: 1;
		}
		100% {
			transform: translateY(8px);
			opacity: 0;
		}
	}
	@keyframes shake {
		0%,
		100% {
			transform: translate(0, 0);
		}
		15% {
			transform: translate(-7px, 3px);
		}
		30% {
			transform: translate(6px, -4px);
		}
		45% {
			transform: translate(-5px, -2px);
		}
		60% {
			transform: translate(4px, 3px);
		}
		80% {
			transform: translate(-2px, 1px);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.target-in,
		.board-shake {
			animation: none;
		}
	}
</style>
