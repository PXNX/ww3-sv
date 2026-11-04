<!--
	The Shadow Fleet Shuffle playfield: one canvas draws the night sea, the ships bobbing under their
	cargo covers, the eased swap arcs with wakes, the cover lift, confetti, sanction stamps, number
	pops and the shake and red flash of a wrong pick. A row of invisible buttons over the canvas
	(one per slot) takes the taps, so keyboard and screen readers work too. Reduced motion drops
	the bobbing, wakes, confetti, shake and flash and flattens the swap arcs; the ships still move.
	The playfield never mirrors in right-to-left languages.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import {
		BOARD_H,
		BOARD_W,
		WATER_Y,
		drawCover,
		drawParticles,
		drawSea,
		drawShip,
		drawStamp,
		drawTankerMark,
		shipScale,
		slotX,
		stepParticles,
		type Particle
	} from '#lib/game/shuffle/draw.js';
	import { NAMES } from '#lib/game/shuffle/fleet.js';
	import { arcOffset, destinationSlot, easeInOut } from '#lib/game/shuffle/moves.js';
	import type { ShuffleGame } from '#lib/stores/shuffleGame.svelte.js';

	let {
		game,
		reducedMotion = false,
		sanctioned,
		escaped,
		combo,
		aisOff,
		slotLabel
	}: {
		game: ShuffleGame;
		reducedMotion?: boolean;
		sanctioned: string;
		escaped: string;
		combo: (streak: number) => string;
		aisOff: string;
		slotLabel: (slot: number, total: number) => string;
	} = $props();

	let canvas: HTMLCanvasElement | undefined = $state();
	let hover = $state(-1);

	interface Spring {
		lift: number;
		vel: number;
	}
	// Indexed by ship id (0 to 5)
	const springs: Spring[] = [];
	const flashes: number[] = [];
	const trails: number[] = [];
	let particles: Particle[] = [];
	let stamp: { text: string; color: string; x: number; y: number; at: number } | null = null;
	let shakeAt = -Infinity;
	let redAt = -Infinity;
	let seenFeedback = 0;
	let rings: { at: number; x: number; y: number }[] = [];

	const STAMP_MS = 1600;
	const CONFETTI = ['#ef4444', '#38bdf8', '#facc15', '#4ade80', '#f472b6'];

	function rand(low: number, high: number) {
		return low + Math.random() * (high - low);
	}

	function shipPos(id: number, now: number) {
		const ship = game.ships.find((s) => s.id === id);
		if (!ship) return { x: 0, y: WATER_Y, rot: 0, moving: false };
		const n = game.ships.length;
		const move = game.move;
		const index = move ? move.slots.indexOf(ship.slot) : -1;
		if (!move || index < 0) return { x: slotX(ship.slot, n), y: WATER_Y, rot: 0, moving: false };
		const t = Math.min(1, Math.max(0, (now - move.startedAt) / move.duration));
		const e = easeInOut(t);
		const from = slotX(ship.slot, n);
		const to = slotX(destinationSlot(move.slots, ship.slot), n);
		const arc = arcOffset(move.kind, index, t) * (reducedMotion ? 14 : 52) * shipScale(n);
		return {
			x: from + (to - from) * e,
			y: WATER_Y + arc,
			rot: reducedMotion ? 0 : Math.cos(Math.PI * t) * 0.08 * (to > from ? 1 : -1),
			moving: true
		};
	}

	function liftTarget(id: number, slot: number, now: number): number {
		if (!game.covered || game.lifted.includes(id)) return 1;
		if (id === game.pingShip && now - game.pingAt < 950) return 0.22;
		if (game.phase === 'guessing' && slot === hover) return 0.06;
		return 0;
	}

	function burst(x: number, y: number, count: number) {
		for (let i = 0; i < count; i++) {
			const angle = rand(-Math.PI * 0.95, -Math.PI * 0.05);
			const speed = rand(180, 480);
			particles.push({
				x,
				y,
				vx: Math.cos(angle) * speed,
				vy: Math.sin(angle) * speed,
				life: rand(1, 1.7),
				max: 1.7,
				size: rand(8, 15),
				color: CONFETTI[i % CONFETTI.length],
				rot: rand(0, 6),
				vr: rand(-9, 9),
				kind: 'confetti'
			});
		}
	}

	function pop(x: number, y: number, text: string, color: string, size = 34) {
		particles.push({
			x,
			y,
			vx: 0,
			vy: -46,
			life: 1.3,
			max: 1.3,
			size,
			color,
			rot: 0,
			vr: 0,
			text,
			kind: 'pop'
		});
	}

	function react(now: number) {
		const f = game.feedback;
		if (f.id === seenFeedback) return;
		seenFeedback = f.id;
		const ship = game.ships.find((s) => s.id === f.shipId);
		const x = ship ? slotX(ship.slot, game.ships.length) : BOARD_W / 2;
		if (f.kind === 'correct') {
			stamp = { text: sanctioned, color: '#dc2626', x, y: WATER_Y - 150, at: now };
			pop(x, WATER_Y - 100, `+${f.gain}`, '#fde047');
			if (f.streak >= 2) pop(x, WATER_Y - 190, combo(f.streak), '#fb923c', 24);
			if (!reducedMotion) burst(x, WATER_Y - 40, f.streak >= 3 ? 70 : 40);
		} else if (f.kind === 'wrong') {
			stamp = { text: escaped, color: '#94a3b8', x, y: WATER_Y - 150, at: now };
			if (f.gain < 0) pop(x, WATER_Y - 100, `${f.gain}`, '#f87171');
			if (!reducedMotion) {
				shakeAt = now;
				redAt = now;
			}
		} else if (f.kind === 'ping') {
			rings = [0, 1, 2].map((i) => ({ at: now + i * 260, x, y: WATER_Y - 30 }));
		} else {
			flashes[f.shipId] = now;
		}
	}

	function frame(now: number, dt: number, ctx: CanvasRenderingContext2D) {
		react(now);
		const n = game.ships.length;
		const scale = shipScale(n);

		ctx.save();
		if (!reducedMotion && now - shakeAt < 450) {
			const k = 1 - (now - shakeAt) / 450;
			ctx.translate(Math.sin(now / 22) * 11 * k, Math.cos(now / 17) * 5 * k);
		}
		drawSea(ctx, now, reducedMotion);

		// Update the springs, then draw back to front (arcs below the row come last)
		const items = game.ships.map((ship) => {
			const pos = shipPos(ship.id, now);
			const spring = (springs[ship.id] ??= { lift: 0, vel: 0 });
			const target = liftTarget(ship.id, ship.slot, now);
			if (reducedMotion) {
				spring.lift += (target - spring.lift) * Math.min(1, dt * 14);
			} else {
				spring.vel += (target - spring.lift) * 260 * dt;
				spring.vel *= Math.exp(-13 * dt);
				spring.lift += spring.vel * dt;
			}
			return { ship, pos, lift: spring.lift };
		});
		items.sort((a, b) => a.pos.y - b.pos.y);

		for (const { ship, pos, lift } of items) {
			const bob = reducedMotion ? 0 : Math.sin(now / 560 + ship.id * 1.9) * 3;
			const tilt = reducedMotion ? 0 : Math.sin(now / 700 + ship.id * 1.3) * 0.035;

			// Wake: a faded ripple dropped behind a moving, non-dark ship
			if (pos.moving && !ship.dark && !reducedMotion && now - (trails[ship.id] ?? 0) > 70) {
				trails[ship.id] = now;
				particles.push({
					x: pos.x,
					y: WATER_Y + 12 * scale + (pos.y - WATER_Y) * 0.4,
					vx: 0,
					vy: 0,
					life: 0.7,
					max: 0.7,
					size: 34 * scale,
					color: '',
					rot: 0,
					vr: 0,
					kind: 'wake'
				});
			}

			// Shadow on the water
			ctx.fillStyle = 'rgba(0,0,0,0.25)';
			ctx.beginPath();
			ctx.ellipse(pos.x, WATER_Y + 14 * scale, 46 * scale, 6 * scale, 0, 0, Math.PI * 2);
			ctx.fill();

			ctx.save();
			ctx.translate(pos.x, pos.y + bob);
			ctx.rotate(tilt + pos.rot);
			ctx.scale(scale, scale);
			if (lift > 0.02) {
				drawShip(ctx, ship.kind);
				if (game.phase === 'reveal' && ship.id === game.tankerId)
					drawTankerMark(ctx, now, reducedMotion);
			}
			if (lift < 0.98) {
				// The cover: rises, tilts and fades as it lifts, squashes slightly when it lands
				const up = Math.max(0, lift);
				const squash = lift < 0 ? 1 + lift * 0.25 : 1;
				ctx.save();
				ctx.translate(0, -up * 240 + (lift < 0 ? -lift * 6 : 0));
				ctx.rotate(-up * 0.35);
				ctx.scale(1 + (squash < 1 ? 0.04 : 0), squash);
				ctx.globalAlpha = Math.max(0, 1 - Math.max(0, (up - 0.5) / 0.5));
				const flashAt = flashes[ship.id];
				const flash = flashAt === undefined ? 0 : Math.max(0, 1 - (now - flashAt) / 380);
				const glow = ship.id === game.pingShip ? Math.max(0, 1 - (now - game.pingAt) / 1200) : 0;
				drawCover(
					ctx,
					{ flag: ship.flag, name: ship.name, dark: ship.dark, flash, glow },
					now,
					ship.dark ? aisOff : NAMES[ship.name]
				);
				ctx.restore();
			}
			ctx.restore();
		}

		// Sonar rings from the pinged tanker
		for (const ring of rings) {
			const age = now - ring.at;
			if (age < 0 || age > 900) continue;
			const t = age / 900;
			ctx.globalAlpha = (1 - t) * 0.9;
			ctx.strokeStyle = '#22d3ee';
			ctx.lineWidth = 4;
			ctx.beginPath();
			ctx.ellipse(ring.x, ring.y, 30 + t * 120, (30 + t * 120) * 0.45, 0, 0, Math.PI * 2);
			ctx.stroke();
			ctx.globalAlpha = 1;
		}

		stepParticles(particles, dt);
		drawParticles(ctx, particles);

		if (stamp) {
			const age = now - stamp.at;
			if (age > STAMP_MS) stamp = null;
			else {
				ctx.save();
				ctx.translate(stamp.x, stamp.y);
				drawStamp(ctx, stamp.text, stamp.color, age, STAMP_MS, reducedMotion);
				ctx.restore();
			}
		}
		ctx.restore();

		if (!reducedMotion && now - redAt < 380) {
			ctx.fillStyle = `rgba(220,38,38,${0.38 * (1 - (now - redAt) / 380)})`;
			ctx.fillRect(0, 0, BOARD_W, BOARD_H);
		}
	}

	onMount(() => {
		if (!canvas) return;
		const ctx = canvas.getContext('2d');
		if (!ctx) return;
		const el = canvas;
		let raf = 0;
		let last = performance.now();
		const loop = (now: number) => {
			const dt = Math.min(0.05, (now - last) / 1000);
			last = now;
			const ratio = window.devicePixelRatio || 1;
			const width = Math.max(1, Math.round(el.clientWidth * ratio));
			const height = Math.round((width * BOARD_H) / BOARD_W);
			if (el.width !== width || el.height !== height) {
				el.width = width;
				el.height = height;
			}
			ctx.setTransform(width / BOARD_W, 0, 0, width / BOARD_W, 0, 0);
			frame(performance.now(), dt, ctx);
			raf = requestAnimationFrame(loop);
		};
		raf = requestAnimationFrame(loop);
		return () => cancelAnimationFrame(raf);
	});

	const slots = $derived(Array.from({ length: game.ships.length }, (_, i) => i));
	const slotWidth = $derived(100 / Math.max(1, game.ships.length));
</script>

<div
	class="relative w-full overflow-hidden rounded-xl border-3 border-ink shadow-[4px_4px_0_var(--color-ink)]"
	style:aspect-ratio="{BOARD_W} / {BOARD_H}"
	data-playfield
	dir="ltr"
>
	<canvas
		bind:this={canvas}
		class="absolute inset-0 h-full w-full touch-manipulation"
		aria-hidden="true"
	></canvas>
	<div class="absolute inset-0 flex">
		{#each slots as slot (slot)}
			<button
				type="button"
				class="h-full cursor-pointer focus-visible:outline-4 focus-visible:-outline-offset-4 focus-visible:outline-explosion-yellow disabled:cursor-default"
				style:width="{slotWidth}%"
				disabled={game.phase !== 'guessing'}
				aria-label={slotLabel(slot + 1, game.ships.length)}
				onclick={() => game.pickSlot(slot)}
				onpointerenter={() => (hover = slot)}
				onpointerleave={() => (hover = -1)}
				onfocus={() => (hover = slot)}
				onblur={() => (hover = -1)}
			></button>
		{/each}
	</div>
</div>
