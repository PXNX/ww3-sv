<!-- Small one-shot celebration for a new personal best; hidden when reduced motion is requested -->
<script lang="ts">
	const COLORS = ['#e5484d', '#4fa8d8', '#f5c83a', '#7c8c5c', '#f6c9a0'];
	const pieces = Array.from({ length: 28 }, (_, index) => ({
		left: (index * 37) % 100,
		delay: (index % 7) * 60,
		color: COLORS[index % COLORS.length],
		turn: index % 2 === 0 ? 1 : -1,
		wide: index % 3 === 0
	}));
</script>

<div class="confetti pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
	{#each pieces as piece, index (index)}
		<span
			style:left="{piece.left}%"
			style:animation-delay="{piece.delay}ms"
			style:background={piece.color}
			style:--turn={piece.turn}
			class:wide={piece.wide}
		></span>
	{/each}
</div>

<style>
	span {
		position: absolute;
		top: -24px;
		width: 10px;
		height: 16px;
		border: 2px solid var(--color-ink);
		animation: fall 1400ms var(--ease-spring) both;
	}

	.wide {
		width: 16px;
		height: 10px;
	}

	@keyframes fall {
		to {
			translate: calc(var(--turn) * 30px) 110cqh;
			rotate: calc(var(--turn) * 540deg);
			opacity: 0;
		}
	}

	.confetti {
		container-type: size;
	}

	@media (prefers-reduced-motion: reduce) {
		.confetti {
			display: none;
		}
	}
</style>
