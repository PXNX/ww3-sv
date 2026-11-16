<!--
	One overlay for the whole app, mounted in the root layout. It draws the little particles, score
	numbers and combo banners that any mode can ask for through the shared juice store, and writes the
	screen-shake offset to two CSS variables the shared game frame uses. A reduced-motion preference
	turns the effects off completely.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { juice } from '#lib/game/juice.svelte.js';

	let frame = 0;
	let last = 0;

	function active() {
		return (
			juice.particles.length > 0 ||
			juice.floats.length > 0 ||
			juice.comboText !== '' ||
			juice.shakeX !== 0 ||
			juice.shakeY !== 0
		);
	}

	function loop(time: number) {
		const dt = last ? (time - last) / 1000 : 0;
		last = time;
		juice.step(dt, time, {
			width: window.innerWidth,
			height: window.innerHeight,
			floor: window.innerHeight - 6
		});
		document.documentElement.style.setProperty('--juice-shake-x', `${juice.shakeX.toFixed(2)}px`);
		document.documentElement.style.setProperty('--juice-shake-y', `${juice.shakeY.toFixed(2)}px`);
		if (active()) {
			frame = requestAnimationFrame(loop);
		} else {
			frame = 0;
			last = 0;
			document.documentElement.style.removeProperty('--juice-shake-x');
			document.documentElement.style.removeProperty('--juice-shake-y');
		}
	}

	function kick() {
		if (!frame) frame = requestAnimationFrame(loop);
	}

	$effect(() => {
		// Reading the reactive fields keeps the loop alive exactly as long as there is something to do
		if (active()) kick();
	});

	onMount(() => {
		const query = window.matchMedia('(prefers-reduced-motion: reduce)');
		const sync = () => {
			juice.reduced = query.matches;
			if (query.matches) juice.clear();
		};
		sync();
		query.addEventListener('change', sync);
		return () => {
			query.removeEventListener('change', sync);
			cancelAnimationFrame(frame);
			juice.clear();
		};
	});
</script>

<div class="pointer-events-none fixed inset-0 z-[100] overflow-hidden" aria-hidden="true">
	{#each juice.particles as particle (particle.id)}
		<span
			class="juice-particle absolute"
			style:left="{particle.x}px"
			style:top="{particle.y}px"
			style:width="{particle.size}px"
			style:height="{particle.shape === 'confetti' ? particle.size * 0.6 : particle.size}px"
			style:background={particle.color}
			style:border-radius={particle.shape === 'confetti' ? '2px' : '50%'}
			style:opacity={Math.min(1, particle.life / (particle.maxLife * 0.5))}
			style:transform="translate(-50%, -50%) rotate({particle.angle}rad)"
		></span>
	{/each}

	{#each juice.floats as float (float.id)}
		<span
			class="juice-float absolute font-display font-extrabold whitespace-nowrap"
			style:left="{float.x}px"
			style:top="{float.y}px"
			style:color={float.color}
			style:opacity={Math.min(1, float.life / (float.maxLife * 0.6))}>{float.text}</span
		>
	{/each}

	{#key juice.comboText}
		{#if juice.comboText}
			<div class="juice-combo absolute inset-x-0 top-1/3 flex justify-center">
				<span
					class="pop-in rounded-full border-3 border-ink bg-explosion-yellow px-5 py-2 font-display text-2xl font-extrabold text-ink shadow-[4px_4px_0_var(--color-ink)]"
				>
					{juice.comboText}
				</span>
			</div>
		{/if}
	{/key}
</div>
