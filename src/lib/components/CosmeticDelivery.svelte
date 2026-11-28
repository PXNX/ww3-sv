<!--
	A small celebratory scene: the player's own agent walks a wrapped cosmetic over to a friend.
	Used when a cosmetic is gifted. The parcel flies on an arc, the agent tips its hat (or just
	bounces), and the friend's card pops when the gift lands. Reduced motion shows the final frame.
-->
<script lang="ts">
	import { m } from '#lib/paraglide/messages.js';
	import { soundManager } from '#lib/sound/soundManager.svelte.js';
	import { prefersReducedMotion } from '#lib/game/loop.js';
	import Avatar from './Avatar.svelte';
	import IconGift from '~icons/lucide/gift';
	import IconSparkles from '~icons/lucide/sparkles';

	let {
		open,
		lookName,
		friendName = '',
		onDone
	}: {
		open: boolean;
		lookName: string;
		friendName?: string;
		onDone: () => void;
	} = $props();

	const calm = prefersReducedMotion();
	let phase = $state<'ready' | 'flying' | 'landed'>('ready');

	$effect(() => {
		if (!open) {
			phase = 'ready';
			return;
		}
		phase = 'ready';
		const start = setTimeout(() => (phase = 'flying'), calm ? 0 : 450);
		const land = setTimeout(
			() => {
				phase = 'landed';
				soundManager().play('chime-big');
			},
			calm ? 0 : 1700
		);
		const done = setTimeout(onDone, calm ? 900 : 3300);
		return () => {
			clearTimeout(start);
			clearTimeout(land);
			clearTimeout(done);
		};
	});
</script>

{#if open}
	<div class="delivery" role="status" aria-live="polite">
		<div class="scene">
			<div class="courier" class:stepping={phase === 'flying'}>
				<Avatar size={92} expression="happy" label={m.avatar_title()} />
			</div>

			<div class="flight" class:gone={phase === 'landed'}>
				<span class="parcel"><IconGift class="size-7" aria-hidden="true" /></span>
				<span class="trail" aria-hidden="true">✦ ✧ ✦</span>
			</div>

			<div class="recipient" class:pop={phase === 'landed'}>
				<div class="portrait"><IconSparkles class="size-8" aria-hidden="true" /></div>
				<p dir="auto">{friendName || m.gift_friend_generic()}</p>
			</div>
		</div>
		<p class="caption" dir="auto">
			{phase === 'landed' ? m.gift_delivered({ name: lookName }) : m.gift_delivering()}
		</p>
	</div>
{/if}

<style>
	.delivery {
		position: fixed;
		inset: 0;
		z-index: 9995;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 1.25rem;
		padding: 1.5rem;
		background: rgb(20 12 30 / 72%);
		backdrop-filter: blur(4px);
	}
	.scene {
		display: grid;
		grid-template-columns: 1fr 1.4fr 1fr;
		align-items: center;
		width: min(100%, 26rem);
		gap: 0.5rem;
	}
	.courier,
	.recipient {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.35rem;
	}
	.courier.stepping {
		animation: skip 0.55s ease-in-out infinite;
	}
	.recipient .portrait {
		display: grid;
		place-items: center;
		width: 5rem;
		height: 5rem;
		border: 3px solid var(--color-ink);
		border-radius: 40% 60% 55% 45%;
		background: var(--color-explosion-yellow);
		box-shadow: 3px 3px 0 var(--color-ink);
	}
	.recipient.pop .portrait {
		animation: pop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
	}
	.recipient p {
		font-size: 0.75rem;
		font-weight: 800;
		text-align: center;
		color: var(--color-paper);
	}
	.flight {
		position: relative;
		display: grid;
		place-items: center;
		height: 7rem;
	}
	.parcel {
		display: grid;
		place-items: center;
		width: 3.25rem;
		height: 3.25rem;
		border: 3px solid var(--color-ink);
		border-radius: 14px 8px 16px 8px;
		background: var(--color-paper);
		box-shadow: 3px 3px 0 var(--color-ink);
		animation: arc 1.25s cubic-bezier(0.45, 0, 0.55, 1) forwards;
	}
	.flight.gone .parcel {
		animation: land 0.35s ease-out forwards;
	}
	.trail {
		position: absolute;
		top: 55%;
		font-size: 1.1rem;
		letter-spacing: 0.4rem;
		color: var(--color-explosion-yellow);
		opacity: 0.7;
	}
	.caption {
		max-width: 24rem;
		text-align: center;
		font-family: var(--font-display);
		font-size: 1.15rem;
		font-weight: 800;
		color: var(--color-paper);
	}
	@keyframes skip {
		0%,
		100% {
			transform: translateY(0) rotate(-2deg);
		}
		50% {
			transform: translateY(-6px) rotate(3deg);
		}
	}
	@keyframes arc {
		0% {
			transform: translate(-5.5rem, 0) rotate(-15deg) scale(0.8);
		}
		50% {
			transform: translate(0, -2.2rem) rotate(10deg) scale(1.1);
		}
		100% {
			transform: translate(5.5rem, 0) rotate(0) scale(1);
		}
	}
	@keyframes land {
		to {
			transform: translate(5.5rem, 0) scale(0);
			opacity: 0;
		}
	}
	@keyframes pop {
		0% {
			transform: scale(0.5) rotate(-12deg);
		}
		100% {
			transform: scale(1) rotate(0);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.courier.stepping,
		.parcel,
		.flight.gone .parcel,
		.recipient.pop .portrait {
			animation: none;
		}
		.parcel {
			transform: translate(5.5rem, 0);
		}
	}
</style>
