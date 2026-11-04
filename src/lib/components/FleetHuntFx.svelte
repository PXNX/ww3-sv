<!--
	Effects layer of the Black Sea Fleet Hunt board: a canvas laid over the grid that draws the
	particle world from $lib/game/fleethunt/fx: water ripples, shell arcs and trails, splashes, fire,
	smoke, sonar rings and the sinking ships. It also shakes the board it sits on. The parent owns
	the world and fills it; this component only steps and draws it while something moves, and not
	at all when the player prefers reduced motion. Cells still burning are passed in as `burning`.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { FxWorld, type Particle } from '#lib/game/fleethunt/fx.js';
	import { COLUMNS, ROWS } from '#lib/game/fleethunt/fleet.js';

	let {
		world,
		burning,
		shakeTarget
	}: {
		world: FxWorld;
		burning: readonly number[];
		shakeTarget?: HTMLElement;
	} = $props();

	let canvas: HTMLCanvasElement | undefined = $state();
	let burningNow: readonly number[] = [];
	$effect(() => {
		burningNow = burning;
	});

	const PARTICLE_COLORS: Record<Particle['kind'], string> = {
		drop: '255,255,255',
		fire: '255,150,40',
		smoke: '60,60,66',
		bubble: '210,240,255',
		spark: '255,230,120',
		debris: '30,30,30',
		trail: '230,230,230'
	};

	onMount(() => {
		const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
		if (reduced || !canvas) return;
		const context = canvas.getContext('2d');
		if (!context) return;
		const target = canvas;
		let frame = 0;
		let last = 0;
		let visible = true;

		function resize() {
			const ratio = Math.min(window.devicePixelRatio || 1, 2);
			target.width = Math.max(1, Math.round(target.clientWidth * ratio));
			target.height = Math.max(1, Math.round(target.clientHeight * ratio));
		}
		resize();
		const observer = new ResizeObserver(resize);
		observer.observe(target);
		const intersect = new IntersectionObserver((entries) => {
			visible = entries.some((entry) => entry.isIntersecting);
		});
		intersect.observe(target);

		function draw(ctx: CanvasRenderingContext2D) {
			const unit = target.width / COLUMNS;
			ctx.clearRect(0, 0, target.width, target.height);
			ctx.save();
			ctx.scale(unit, target.height / ROWS);
			for (const ring of world.rings) {
				const fade = ring.life / ring.max;
				ctx.lineWidth = ring.kind === 'shock' ? 0.12 : 0.05;
				ctx.strokeStyle =
					ring.kind === 'sonar'
						? `rgba(120,255,200,${fade * 0.9})`
						: ring.kind === 'shock'
							? `rgba(255,220,120,${fade})`
							: `rgba(255,255,255,${fade * 0.55})`;
				ctx.beginPath();
				ctx.ellipse(ring.x, ring.y, ring.radius, ring.radius * 0.8, 0, 0, Math.PI * 2);
				ctx.stroke();
			}
			for (const sinker of world.sinkers) {
				const fade = Math.max(0, sinker.life / sinker.max);
				ctx.save();
				ctx.translate(sinker.x, sinker.y);
				ctx.rotate(sinker.angle);
				ctx.globalAlpha = Math.min(1, fade * 1.6);
				ctx.fillStyle = '#2b3a46';
				ctx.strokeStyle = '#111111';
				ctx.lineWidth = 0.06;
				ctx.beginPath();
				ctx.roundRect(
					-sinker.width / 2,
					-sinker.height / 2,
					sinker.width,
					sinker.height,
					Math.min(sinker.width, sinker.height) / 2.4
				);
				ctx.fill();
				ctx.stroke();
				ctx.restore();
			}
			for (const particle of world.particles) {
				const fade = Math.max(0, particle.life / particle.max);
				const alpha =
					particle.kind === 'smoke' ? fade * 0.5 : particle.kind === 'bubble' ? fade * 0.8 : fade;
				ctx.fillStyle = `rgba(${PARTICLE_COLORS[particle.kind]},${alpha})`;
				ctx.beginPath();
				ctx.arc(
					particle.x,
					particle.y,
					particle.size * (particle.kind === 'fire' ? fade + 0.4 : 1),
					0,
					Math.PI * 2
				);
				ctx.fill();
			}
			for (const shell of world.shells) {
				if (shell.wait > 0) continue;
				const { x, y } = FxWorld.shellPosition(shell, shell.elapsed / shell.flight);
				ctx.fillStyle =
					shell.kind === 'charge' ? '#111111' : shell.kind === 'drone' ? '#f4f0e6' : '#c0392b';
				ctx.strokeStyle = '#111111';
				ctx.lineWidth = 0.04;
				ctx.beginPath();
				ctx.arc(x, y, shell.kind === 'charge' ? 0.16 : 0.11, 0, Math.PI * 2);
				ctx.fill();
				ctx.stroke();
			}
			ctx.restore();
		}

		function loop(time: number) {
			frame = requestAnimationFrame(loop);
			const dt = Math.min(0.05, last ? (time - last) / 1000 : 0.016);
			last = time;
			if (!visible || document.visibilityState === 'hidden') return;
			world.ambient(dt);
			for (const cell of burningNow) world.burn(cell, dt);
			world.step(dt);
			if (shakeTarget) {
				const offset = world.shakeOffset();
				const size = target.clientWidth / COLUMNS;
				shakeTarget.style.transform =
					world.shake > 0 ? `translate(${offset.x * size}px, ${offset.y * size}px)` : '';
			}
			draw(context!);
		}
		frame = requestAnimationFrame(loop);

		return () => {
			cancelAnimationFrame(frame);
			observer.disconnect();
			intersect.disconnect();
			if (shakeTarget) shakeTarget.style.transform = '';
		};
	});
</script>

<canvas bind:this={canvas} class="pointer-events-none absolute inset-0 size-full" aria-hidden="true"
></canvas>
