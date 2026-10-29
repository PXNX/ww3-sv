<!--
	The celebration after the player nationalizes: their own agent rises into view with a flag, a
	"Nationalized!" stamp slams in with a little shake, oil drops and coins rain down and the points
	earned count up. It is a modal dialog, so focus stays on its button; tapping that (or Escape)
	ends it. With reduced motion everything simply appears, and the points show at once.
-->
<script lang="ts">
	import { m } from '#lib/paraglide/messages.js';
	import { formatCount } from '#lib/game/tycoon/format.js';
	import { getLocale } from '#lib/paraglide/runtime.js';
	import Avatar from './Avatar.svelte';

	let {
		open,
		points,
		onclose
	}: {
		open: boolean;
		/** Prestige points this nationalization paid */
		points: number;
		onclose: () => void;
	} = $props();

	const locale = getLocale();
	const COUNT_MS = 1400;
	/** Falling things: oil drops and gold coins, spread out without a random source */
	const RAIN = Array.from({ length: 26 }, (_, index) => ({
		left: (index * 37 + 11) % 100,
		delay: (index * 173) % 1500,
		duration: 1600 + ((index * 91) % 900),
		size: 10 + ((index * 7) % 3) * 5,
		coin: index % 3 === 0
	}));

	let dialog: HTMLDialogElement | undefined = $state();
	let shown = $state(0);

	const reducedMotion = () =>
		typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

	$effect(() => {
		if (open && dialog && !dialog.open) dialog.showModal();
		if (!open && dialog?.open) dialog.close();
	});

	// The points count up after the stamp has landed
	$effect(() => {
		if (!open) return;
		if (reducedMotion()) {
			shown = points;
			return;
		}
		shown = 0;
		let frame = 0;
		const started = performance.now() + 700;
		const tick = (now: number) => {
			const share = Math.min(1, Math.max(0, (now - started) / COUNT_MS));
			// Fast at first, then easing into the final number
			shown = Math.round(points * (1 - (1 - share) ** 3));
			if (share < 1) frame = requestAnimationFrame(tick);
		};
		frame = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(frame);
	});
</script>

<dialog bind:this={dialog} class="nationalize" aria-labelledby="nationalize-title" {onclose}>
	<div class="stage">
		<div class="rays" aria-hidden="true"></div>

		<div class="rain" aria-hidden="true">
			{#each RAIN as drop, index (index)}
				<span
					class="drop"
					class:coin={drop.coin}
					style:left="{drop.left}%"
					style:width="{drop.size}px"
					style:height="{drop.coin ? drop.size : drop.size * 1.4}px"
					style:animation-delay="{drop.delay}ms"
					style:animation-duration="{drop.duration}ms"
				></span>
			{/each}
		</div>

		<div class="agent" aria-hidden="true">
			<Avatar size={170} expression="happy" />
			<svg class="flag" viewBox="0 0 70 110" width="70" height="110" aria-hidden="true">
				<path d="M8 6 L8 108" stroke="#111" stroke-width="5" stroke-linecap="round" />
				<g class="cloth">
					<path
						d="M10 8 C28 2 40 14 62 8 L62 50 C40 56 28 44 10 50 Z"
						fill="#e5484d"
						stroke="#111"
						stroke-width="3.5"
						stroke-linejoin="round"
					/>
					<path
						d="M36 18 L39 26 L47 26 L41 31 L43 39 L36 34 L29 39 L31 31 L25 26 L33 26 Z"
						fill="#f5c83a"
						stroke="#111"
						stroke-width="2"
						stroke-linejoin="round"
					/>
				</g>
			</svg>
		</div>

		<h2 id="nationalize-title" class="stamp" dir="auto">{m.tycoon_nationalized_stamp()}</h2>
		<p class="points" dir="auto">
			{m.tycoon_nationalized_points({ points: formatCount(shown, locale) })}
		</p>
		<p class="text" dir="auto">{m.tycoon_nationalized_text()}</p>

		<button type="button" class="btn-chunky continue bg-explosion-yellow" onclick={onclose}>
			{m.tycoon_nationalized_continue()}
		</button>
	</div>
</dialog>

<style>
	.nationalize {
		position: fixed;
		inset: 0;
		width: 100dvw;
		max-width: none;
		height: 100dvh;
		max-height: none;
		margin: 0;
		padding: 0;
		border: 0;
		background: transparent;
		color: #fff;
		overflow: hidden;
	}

	.nationalize::backdrop {
		background: rgb(14 22 40 / 0.9);
	}

	.stage {
		position: relative;
		display: flex;
		height: 100%;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.75rem;
		padding: 1rem;
		text-align: center;
		animation: shake 420ms 560ms ease-out;
	}

	/* Slowly turning light rays behind everything */
	.rays {
		position: absolute;
		left: 50%;
		top: 42%;
		width: 140vmax;
		height: 140vmax;
		translate: -50% -50%;
		background: repeating-conic-gradient(
			from 0deg,
			rgb(245 200 58 / 0.22) 0deg 10deg,
			transparent 10deg 20deg
		);
		mask-image: radial-gradient(circle, #000 0%, transparent 60%);
		animation: spin 24s linear infinite;
		pointer-events: none;
	}

	.rain {
		position: absolute;
		inset: 0;
		overflow: hidden;
		pointer-events: none;
	}

	.drop {
		position: absolute;
		top: -8%;
		border: 2px solid #111;
		border-radius: 50% 50% 50% 50% / 62% 62% 38% 38%;
		background: #1d1d1d;
		opacity: 0;
		animation: fall linear infinite;
	}

	.drop.coin {
		border-radius: 50%;
		background: #f5c83a;
	}

	.agent {
		position: relative;
		z-index: 1;
		display: flex;
		align-items: flex-end;
		animation: rise 700ms cubic-bezier(0.34, 1.56, 0.64, 1) both;
	}

	.flag {
		margin-inline-start: -0.5rem;
		transform-origin: 8% 100%;
		animation: plant 600ms 500ms ease-out both;
	}

	.cloth {
		transform-origin: 10px 28px;
		animation: wave 1.6s ease-in-out infinite;
	}

	.stamp {
		z-index: 1;
		rotate: -6deg;
		border: 5px solid #e5484d;
		border-radius: 0.75rem;
		padding: 0.15em 0.5em;
		font-family: var(--font-display);
		font-size: clamp(2rem, 9vw, 3.6rem);
		font-weight: 900;
		letter-spacing: 0.04em;
		line-height: 1.05;
		text-transform: uppercase;
		color: #e5484d;
		background: rgb(255 255 255 / 0.92);
		box-shadow: 0 0 0 4px #111;
		animation: slam 360ms 520ms cubic-bezier(0.2, 0.9, 0.3, 1.2) both;
	}

	.points {
		z-index: 1;
		font-family: var(--font-display);
		font-size: clamp(1.5rem, 6vw, 2.4rem);
		font-weight: 800;
		font-variant-numeric: tabular-nums;
		color: #f5c83a;
		text-shadow: 0 3px 0 #111;
		animation: fade-up 400ms 700ms ease-out both;
	}

	.text {
		z-index: 1;
		max-width: 22rem;
		font-size: 0.95rem;
		line-height: 1.35;
		animation: fade-up 400ms 1000ms ease-out both;
	}

	.continue {
		z-index: 1;
		margin-top: 0.5rem;
		animation: fade-up 400ms 1500ms ease-out both;
	}

	@keyframes spin {
		to {
			rotate: 360deg;
		}
	}

	@keyframes fall {
		0% {
			opacity: 0;
			transform: translateY(0) rotate(0deg);
		}
		10% {
			opacity: 1;
		}
		100% {
			opacity: 1;
			transform: translateY(112dvh) rotate(300deg);
		}
	}

	@keyframes rise {
		from {
			opacity: 0;
			transform: translateY(40vh) scale(0.6);
		}
		to {
			opacity: 1;
			transform: none;
		}
	}

	@keyframes plant {
		from {
			opacity: 0;
			transform: translateY(-30px) rotate(-25deg);
		}
		to {
			opacity: 1;
			transform: none;
		}
	}

	@keyframes wave {
		0%,
		100% {
			transform: skewY(0deg) scaleX(1);
		}
		50% {
			transform: skewY(-5deg) scaleX(0.94);
		}
	}

	@keyframes slam {
		from {
			opacity: 0;
			transform: scale(3.2) rotate(8deg);
		}
		to {
			opacity: 1;
			transform: none;
		}
	}

	@keyframes shake {
		0%,
		100% {
			translate: 0 0;
		}
		20% {
			translate: -7px 4px;
		}
		45% {
			translate: 6px -5px;
		}
		70% {
			translate: -3px 2px;
		}
	}

	@keyframes fade-up {
		from {
			opacity: 0;
			transform: translateY(14px);
		}
		to {
			opacity: 1;
			transform: none;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.stage,
		.rays,
		.agent,
		.flag,
		.cloth,
		.stamp,
		.points,
		.text,
		.continue {
			animation: none;
		}

		.rain {
			display: none;
		}
	}
</style>
