<!--
	Falklands sea: the animated chart. Two ships ride sprung waves towards the islands (momentum,
	overshoot, buoyancy, pitch), the zones ahead hold mines, submarines, air raids and pickups, and
	every hit, pickup and streak throws particles, a shake and a readable popup. Layers scroll with
	parallax and the weather fades in and out. prefers-reduced-motion switches off the shake,
	flashes and overshoot and keeps the picture readable.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { DISTANCE } from '#lib/game/falklands/config.js';
	import { drawIslands, drawShip, drawUnknown, drawZoneItem } from '#lib/game/falklands/draw.js';
	import {
		approach,
		criticalDamping,
		easeOutCubic,
		Particles,
		Popups,
		springStep
	} from '#lib/game/falklands/fx.js';
	import type { FalklandsEvent } from '#lib/game/falklands/state.js';
	import { m } from '#lib/paraglide/messages.js';
	import type { FalklandsGame } from '#lib/stores/falklandsGame.svelte.js';
	import { hazardText, legText } from './falklandsText.js';

	let { game }: { game: FalklandsGame } = $props();

	interface Ship {
		x: number;
		vx: number;
		y: number;
		vy: number;
		a: number;
		va: number;
		flash: number;
		sink: number;
		sinkV: number;
	}

	const newShip = (): Ship => ({
		x: 0,
		vx: 0,
		y: 0,
		vy: 0,
		a: 0,
		va: 0,
		flash: 0,
		sink: 0,
		sinkV: 0
	});

	let canvas: HTMLCanvasElement | undefined = $state();
	let w = 0;
	let h = 0;
	let dpr = 1;
	let reduced = false;
	let raf = 0;
	let last = 0;
	let time = 0;
	let scroll = 0;
	let fogAmt = 0;
	let stormAmt = 0;
	let lightning = 0;
	let lightningIn = 3;
	let shake = 0;
	let hitFlash = 0;
	let wakeIn = 0;
	let smokeIn = 0;
	let rainCarry = 0;
	let banner: { text: string; age: number } | null = null;
	let flag: 'player' | 'enemy' | null = null;
	let placed = false;
	const player = newShip();
	const enemy = newShip();
	const sparks = new Particles(360);
	const rain = new Particles(160);
	const popups = new Popups();
	let later: Array<{ at: number; run: () => void }> = [];

	const lane = (kind: 'player' | 'enemy') => (kind === 'player' ? h * 0.64 : h * 0.86);
	const horizon = () => h * 0.3;
	const zoneX = (zone: number) => 26 + (zone / DISTANCE) * (w - 26 - 52);
	const unit = () => Math.min(1.4, Math.max(0.75, w / 400));
	const waveAmp = () => (reduced ? 0.8 : 2 + 3 * stormAmt);
	const waveAt = (x: number) =>
		waveAmp() * (Math.sin(x / 45 + time * 1.6) + 0.5 * Math.sin(x / 23 - time * 1.1));

	function place() {
		if (w === 0) return;
		for (const [ship, kind, zone] of [
			[player, 'player', game.playerAt],
			[enemy, 'enemy', game.enemyAt]
		] as const) {
			ship.x = zoneX(zone);
			ship.y = lane(kind);
			Object.assign(ship, { vx: 0, vy: 0, a: 0, va: 0, flash: 0, sink: 0, sinkV: 0 });
		}
		sparks.list = [];
		popups.list = [];
		later = [];
		banner = null;
		flag = null;
		placed = true;
	}

	// A new run puts both ships back on the start line
	let seenStatus = '';
	$effect(() => {
		const status = game.status;
		if (status !== seenStatus) {
			if (status === 'playing') place();
			seenStatus = status;
		}
	});

	onMount(() => {
		const media = window.matchMedia('(prefers-reduced-motion: reduce)');
		reduced = media.matches;
		const onMedia = () => (reduced = media.matches);
		media.addEventListener('change', onMedia);
		game.onEvents = onEvents;

		const observer = new ResizeObserver(() => resize());
		if (canvas) observer.observe(canvas);
		resize();
		raf = requestAnimationFrame(frame);
		return () => {
			cancelAnimationFrame(raf);
			observer.disconnect();
			media.removeEventListener('change', onMedia);
			if (game.onEvents === onEvents) game.onEvents = null;
		};
	});

	function resize() {
		if (!canvas) return;
		dpr = Math.min(2, window.devicePixelRatio || 1);
		w = canvas.clientWidth;
		h = canvas.clientHeight;
		canvas.width = Math.round(w * dpr);
		canvas.height = Math.round(h * dpr);
		place();
	}

	function frame(now: number) {
		raf = requestAnimationFrame(frame);
		const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
		last = now;
		if (w === 0 || !canvas) return;
		if (!placed) place();
		step(dt);
		render();
	}

	function stepShip(ship: Ship, kind: 'player' | 'enemy', target: number, dt: number) {
		const k = kind === 'player' ? 40 : 22;
		const c = reduced ? criticalDamping(k) : kind === 'player' ? 9 : 8;
		[ship.x, ship.vx] = springStep(ship.x, ship.vx, target, k, c, dt);
		// Buoyancy: the hull rides the wave and a hit or sinking pushes it under
		const ty = lane(kind) + waveAt(ship.x) + ship.sink;
		[ship.y, ship.vy] = springStep(ship.y, ship.vy, ty, 90, reduced ? criticalDamping(90) : 9, dt);
		const slope = (waveAt(ship.x + 4) - waveAt(ship.x - 4)) / 8;
		const ta =
			Math.atan(slope) * 0.9 - (reduced ? 0 : ship.vx * 0.0007) + (ship.sink > 20 ? 0.5 : 0);
		[ship.a, ship.va] = springStep(ship.a, ship.va, ta, 60, reduced ? criticalDamping(60) : 7, dt);
		ship.flash = Math.max(0, ship.flash - dt * 2.5);
		const sinking = kind === 'player' && game.outcome === 'sunk';
		[ship.sink, ship.sinkV] = springStep(ship.sink, ship.sinkV, sinking ? 46 : 0, 6, 3.4, dt);
	}

	function step(dt: number) {
		time += dt;
		fogAmt = approach(fogAmt, game.weather === 'fog' ? 1 : 0, 2, dt);
		stormAmt = approach(stormAmt, game.weather === 'storm' ? 1 : 0, 2, dt);
		stepShip(player, 'player', zoneX(game.playerAt), dt);
		stepShip(enemy, 'enemy', zoneX(game.enemyAt), dt);
		scroll += (reduced ? 0 : 5 + Math.abs(player.vx) * 0.6) * dt;

		// Timed effects, such as a blast that waits until the ship reaches its zone
		const due = later.filter((entry) => (entry.at -= dt) <= 0);
		later = later.filter((entry) => entry.at > 0);
		for (const entry of due) entry.run();

		// Wake behind a moving ship, smoke from a hurt one
		wakeIn -= dt;
		if (wakeIn <= 0) {
			wakeIn = 0.04;
			for (const ship of [player, enemy]) {
				if (Math.abs(ship.vx) > 25 && !reduced) {
					sparks.spawn({
						x: ship.x - 15 * unit(),
						y: ship.y + 5 * unit(),
						vx: -Math.abs(ship.vx) * 0.15 - 6,
						vy: -4,
						life: 0.7,
						size: 2.4 * unit(),
						grow: -2,
						drag: 1.5,
						color: '#f4f1de',
						kind: 'foam'
					});
				}
			}
		}
		smokeIn -= dt;
		if (smokeIn <= 0 && game.status === 'playing' && game.hull < 45 && !reduced) {
			smokeIn = 0.09 + game.hull / 400;
			sparks.spawn({
				x: player.x - 2 * unit(),
				y: player.y - 16 * unit(),
				vx: -8,
				vy: -22,
				life: 1.2,
				size: 3 * unit(),
				grow: 5,
				drag: 0.6,
				color: '#444444',
				kind: 'smoke'
			});
		}
		// Rain and lightning in a storm
		if (!reduced && stormAmt > 0.1) {
			rainCarry += dt * 70 * stormAmt;
			while (rainCarry >= 1) {
				rainCarry -= 1;
				rain.spawn({
					x: Math.random() * (w + 60),
					y: -4,
					vx: -70,
					vy: 280 + Math.random() * 80,
					life: (h * 0.9) / 300,
					size: 0.9,
					color: '#cfe3ee'
				});
			}
			lightningIn -= dt;
			if (lightningIn <= 0 && stormAmt > 0.6) {
				lightning = 1;
				lightningIn = 2.5 + Math.random() * 5;
			}
		}
		lightning = Math.max(0, lightning - dt * 3.5);
		sparks.update(dt);
		rain.update(dt);
		popups.update(dt);
		shake *= Math.exp(-7 * dt);
		hitFlash = Math.max(0, hitFlash - dt * 2.2);
		if (banner) {
			banner.age += dt;
			if (banner.age > 2) banner = null;
		}
	}

	// ----- Rendering -----

	function render() {
		const ctx = canvas?.getContext('2d');
		if (!ctx) return;
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		ctx.clearRect(0, 0, w, h);
		ctx.save();
		if (shake > 0.3 && !reduced) {
			ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
		}
		drawSky(ctx);
		const u = unit();
		drawIslands(
			ctx,
			zoneX(DISTANCE) + 6,
			horizon() + 10,
			u,
			flag === 'player' ? '#2f5d8a' : flag === 'enemy' ? '#a34a3a' : null
		);
		drawSea(ctx);
		drawLaneMarks(ctx, 'player');
		drawLaneMarks(ctx, 'enemy');
		drawZoneItems(ctx);
		for (const ship of [enemy, player]) {
			const color = ship === player ? '#2f5d8a' : '#a34a3a';
			drawShip(ctx, ship.x, ship.y, ship.a, u, color, ship.flash);
		}
		sparks.draw(ctx);
		rain.draw(ctx);
		drawWeather(ctx);
		popups.draw(ctx, reduced);
		drawBanner(ctx);
		ctx.restore();
		if (hitFlash > 0 && !reduced) {
			ctx.fillStyle = `rgba(229,72,77,${hitFlash * 0.28})`;
			ctx.fillRect(0, 0, w, h);
		}
		if (lightning > 0 && !reduced) {
			ctx.fillStyle = `rgba(255,255,255,${lightning * 0.5})`;
			ctx.fillRect(0, 0, w, h);
		}
	}

	function drawSky(ctx: CanvasRenderingContext2D) {
		const top = mix([191, 227, 242], [88, 98, 108], stormAmt, [196, 202, 205], fogAmt);
		const bottom = mix([232, 244, 248], [138, 147, 154], stormAmt, [214, 218, 220], fogAmt);
		const gradient = ctx.createLinearGradient(0, 0, 0, horizon() + 12);
		gradient.addColorStop(0, top);
		gradient.addColorStop(1, bottom);
		ctx.fillStyle = gradient;
		ctx.fillRect(0, 0, w, horizon() + 12);
		const clear = 1 - Math.max(fogAmt, stormAmt);
		if (clear > 0.05) {
			ctx.globalAlpha = clear;
			ctx.fillStyle = '#ffe9a3';
			ctx.beginPath();
			ctx.arc(w * 0.18, horizon() * 0.5, 11 * unit(), 0, Math.PI * 2);
			ctx.fill();
			ctx.globalAlpha = 1;
		}
		// Far clouds drift slowly and shift a little with the ship
		ctx.fillStyle = `rgba(255,255,255,${0.75 - stormAmt * 0.35})`;
		for (let i = 0; i < 5; i++) {
			const span = w + 140;
			const cx = (((((i * span) / 5 + time * 5 + scroll * 0.06) % span) + span) % span) - 70;
			const cy = horizon() * (0.25 + ((i * 37) % 50) / 100);
			ctx.beginPath();
			ctx.ellipse(cx, cy, 26 * unit(), 7 * unit(), 0, 0, Math.PI * 2);
			ctx.ellipse(cx + 14, cy - 4, 16 * unit(), 6 * unit(), 0, 0, Math.PI * 2);
			ctx.fill();
		}
	}

	function mix(
		base: number[],
		storm: number[],
		stormK: number,
		fog: number[],
		fogK: number
	): string {
		const rgb = base.map((channel, i) => {
			let value = channel + (storm[i] - channel) * stormK;
			value += (fog[i] - value) * fogK;
			return Math.round(value);
		});
		return `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
	}

	const SEA = ['#a9cfe0', '#8fb4c9', '#7aa2b9', '#6590a8'];

	function drawSea(ctx: CanvasRenderingContext2D) {
		const top = horizon() + 10;
		for (let layer = 0; layer < 4; layer++) {
			const y0 = top + ((h - top) * (0.02 + layer * 0.24)) / 1;
			const amp = (reduced ? 1 : 1.5 + layer * 0.9) * (1 + stormAmt * 0.8);
			const length = 38 + layer * 22;
			const parallax = 0.25 + layer * 0.3;
			ctx.beginPath();
			ctx.moveTo(0, h);
			for (let x = 0; x <= w + 8; x += 8) {
				const phase = (x + scroll * parallax * 20) / length + time * (0.6 + layer * 0.25);
				ctx.lineTo(x, y0 + amp * Math.sin(phase) + amp * 0.4 * Math.sin(phase * 2.3));
			}
			ctx.lineTo(w, h);
			ctx.closePath();
			ctx.fillStyle = SEA[layer];
			ctx.fill();
			// A foam highlight along the crest of the nearer layers
			if (layer > 0) {
				ctx.strokeStyle = 'rgba(255,255,255,0.35)';
				ctx.lineWidth = 1;
				ctx.stroke();
			}
		}
	}

	function drawLaneMarks(ctx: CanvasRenderingContext2D, kind: 'player' | 'enemy') {
		const y = lane(kind);
		const at = kind === 'player' ? game.playerAt : game.enemyAt;
		const color = kind === 'player' ? '#2f5d8a' : '#a34a3a';
		for (let zone = 0; zone <= DISTANCE; zone++) {
			const x = zoneX(zone);
			ctx.beginPath();
			ctx.arc(x, y + 9 * unit() + waveAt(x) * 0.5, zone <= at ? 2 : 1.4, 0, Math.PI * 2);
			ctx.fillStyle = zone <= at ? color : 'rgba(244,241,222,0.8)';
			ctx.fill();
		}
	}

	function drawZoneItems(ctx: CanvasRenderingContext2D) {
		const u = unit();
		const y = lane('player');
		for (let zone = 1; zone < DISTANCE; zone++) {
			const kind = game.zones[zone];
			if (!kind || zone <= game.playerAt) continue;
			const x = zoneX(zone);
			const bob = waveAt(x);
			if (game.weather === 'fog' && zone - game.playerAt > 2) {
				drawUnknown(ctx, x, y + bob - 8 * u, u);
			} else {
				drawZoneItem(ctx, kind, x, y + bob, u, time + zone);
			}
		}
	}

	function drawWeather(ctx: CanvasRenderingContext2D) {
		if (fogAmt > 0.02) {
			ctx.fillStyle = `rgba(226,230,232,${fogAmt * 0.3})`;
			ctx.fillRect(0, 0, w, h);
			for (let i = 0; i < 4; i++) {
				const span = w + 240;
				const cx = (((((i * span) / 4 + time * 9 + scroll * 0.4) % span) + span) % span) - 120;
				const cy = horizon() + 6 + i * (h * 0.17);
				const gradient = ctx.createRadialGradient(cx, cy, 4, cx, cy, 120);
				gradient.addColorStop(0, `rgba(236,239,240,${fogAmt * 0.55})`);
				gradient.addColorStop(1, 'rgba(236,239,240,0)');
				ctx.fillStyle = gradient;
				ctx.fillRect(cx - 120, cy - 60, 240, 120);
			}
		}
		if (stormAmt > 0.02) {
			ctx.fillStyle = `rgba(18,28,38,${stormAmt * 0.32})`;
			ctx.fillRect(0, 0, w, h);
		}
	}

	function drawBanner(ctx: CanvasRenderingContext2D) {
		if (!banner) return;
		const slide = easeOutCubic(banner.age / 0.35);
		const fade = banner.age > 1.6 ? Math.max(0, (2 - banner.age) / 0.4) : 1;
		const bw = Math.min(w - 24, 250);
		const x = reduced ? (w - bw) / 2 : -bw + slide * ((w + bw) / 2);
		ctx.save();
		ctx.globalAlpha = fade;
		ctx.fillStyle = '#f4f1de';
		ctx.strokeStyle = '#111111';
		ctx.lineWidth = 3;
		ctx.beginPath();
		ctx.rect(x, h * 0.08, bw, 28);
		ctx.fill();
		ctx.stroke();
		ctx.fillStyle = '#111111';
		ctx.font = '800 13px system-ui, sans-serif';
		ctx.textAlign = 'center';
		ctx.fillText(banner.text, x + bw / 2, h * 0.08 + 18, bw - 12);
		ctx.restore();
	}

	// ----- Events from the rules -----

	function burst(x: number, y: number, count: number, colors: string[], speed: number) {
		const n = reduced ? Math.ceil(count / 3) : count;
		for (let i = 0; i < n; i++) {
			const angle = Math.random() * Math.PI * 2;
			const v = speed * (0.3 + Math.random());
			sparks.spawn({
				x,
				y,
				vx: Math.cos(angle) * v,
				vy: Math.sin(angle) * v - speed * 0.4,
				life: 0.5 + Math.random() * 0.5,
				size: 1.5 + Math.random() * 2.2,
				grow: -1.5,
				gravity: 260,
				drag: 1.2,
				color: colors[i % colors.length]
			});
		}
	}

	function splash(x: number, y: number, count: number) {
		const n = reduced ? Math.ceil(count / 3) : count;
		for (let i = 0; i < n; i++) {
			sparks.spawn({
				x: x + (Math.random() - 0.5) * 8,
				y,
				vx: (Math.random() - 0.5) * 50,
				vy: -90 - Math.random() * 90,
				life: 0.8,
				size: 2 + Math.random() * 1.6,
				grow: -1.2,
				gravity: 300,
				drag: 0.4,
				color: '#e8f4f8',
				kind: 'spray'
			});
		}
	}

	function ring(x: number, y: number, color: string) {
		sparks.spawn({ x, y, life: 0.7, size: 3, grow: 40, color, kind: 'ring' });
	}

	/** How long the ship needs to get to a zone, so a blast lands as it passes */
	function delayTo(zone: number): number {
		return reduced ? 0 : Math.min(0.9, Math.max(0, (zoneX(zone) - player.x) / 170));
	}

	function onEvents(events: FalklandsEvent[]) {
		const u = unit();
		for (const event of events) {
			switch (event.type) {
				case 'move':
					if (event.speed === 'flank') player.vx += 40;
					break;
				case 'hit': {
					const x = zoneX(event.zone);
					const y = lane('player');
					later.push({
						at: delayTo(event.zone),
						run: () => {
							if (event.hazard === 'raid') {
								for (let i = 0; i < 6; i++) {
									sparks.spawn({
										x,
										y: y - 60 + i * 9,
										vy: 120,
										life: 0.25,
										size: 2,
										color: '#ffd06b'
									});
								}
							}
							burst(x, y, 22, ['#ffb347', '#ff6b3d', '#ffe9a3'], 150);
							splash(x, y, 10);
							for (let i = 0; i < 6; i++) {
								sparks.spawn({
									x,
									y,
									vx: (Math.random() - 0.5) * 40,
									vy: -30 - Math.random() * 20,
									life: 1,
									size: 3,
									grow: 6,
									drag: 0.8,
									color: '#333333',
									kind: 'smoke'
								});
							}
							shake = Math.max(shake, 7 + event.damage * 0.25);
							hitFlash = 1;
							player.flash = 1;
							player.vy += 90;
							player.va += (Math.random() - 0.5) * 5;
							popups.add(
								player.x,
								y - 26 * u,
								m.falklands_pop_hit({ damage: event.damage }),
								'#ff8a7e',
								16
							);
							popups.add(x, y - 44 * u, hazardText(event.hazard), '#f4f1de', 11);
						}
					});
					break;
				}
				case 'chaff': {
					const x = zoneX(event.zone);
					later.push({
						at: delayTo(event.zone),
						run: () => {
							for (let i = 0; i < 16; i++) {
								sparks.spawn({
									x,
									y: lane('player') - 20 * u,
									vx: (Math.random() - 0.5) * 120,
									vy: (Math.random() - 0.6) * 60,
									life: 1,
									size: 1.5,
									drag: 2.2,
									gravity: 40,
									color: '#ffffff'
								});
							}
							popups.add(x, lane('player') - 34 * u, m.falklands_pop_chaff(), '#e8f4f8', 15);
						}
					});
					break;
				}
				case 'swept': {
					const x = zoneX(event.zone);
					later.push({
						at: delayTo(event.zone),
						run: () => {
							ring(x, lane('player') + 6, '#e8f4f8');
							splash(x, lane('player'), 5);
							popups.add(x, lane('player') - 28 * u, m.falklands_pop_swept(), '#9fe3f2', 13);
						}
					});
					break;
				}
				case 'pickup': {
					const x = zoneX(event.zone);
					later.push({
						at: delayTo(event.zone),
						run: () => {
							const y = lane('player');
							burst(x, y - 8, 14, ['#ffe27a', '#ffffff', '#8fd19e'], 90);
							ring(x, y + 4, '#ffe27a');
							const text =
								event.kind === 'tanker'
									? m.falklands_pop_fuel({ fuel: event.amount })
									: event.kind === 'repair'
										? m.falklands_pop_repair({ hull: event.amount })
										: event.kind === 'chaff'
											? m.falklands_pop_chaff_get()
											: m.falklands_pop_intel();
							popups.add(x, y - 30 * u, text, '#8fd19e', 14);
						}
					});
					break;
				}
				case 'combo':
					later.push({
						at: reduced ? 0 : 0.5,
						run: () => {
							popups.add(
								player.x,
								lane('player') - 46 * u,
								m.falklands_pop_streak({ points: event.points }),
								'#ffd06b',
								13 + Math.min(5, event.streak)
							);
							for (let i = 0; i < 6; i++) {
								sparks.spawn({
									x: player.x,
									y: lane('player') - 34 * u,
									vx: (Math.random() - 0.5) * 80,
									vy: -40 - Math.random() * 40,
									life: 0.6,
									size: 2,
									gravity: 200,
									color: '#ffd06b'
								});
							}
						}
					});
					break;
				case 'leg':
					banner = { text: m.falklands_leg_banner({ name: legText(event.leg) }), age: 0 };
					break;
				case 'repair':
					for (let i = 0; i < 12; i++) {
						sparks.spawn({
							x: player.x + (Math.random() - 0.5) * 14,
							y: player.y - 8 * u,
							vx: (Math.random() - 0.5) * 90,
							vy: -60 - Math.random() * 60,
							life: 0.5,
							size: 1.6,
							gravity: 300,
							color: '#ffe9a3'
						});
					}
					popups.add(
						player.x,
						player.y - 28 * u,
						m.falklands_pop_repair({ hull: event.gain }),
						'#8fd19e',
						14
					);
					break;
				case 'talk':
					popups.add(player.x, player.y - 26 * u, '...', '#f4f1de', 18);
					break;
				case 'win':
					flag = 'player';
					burst(
						zoneX(DISTANCE),
						horizon() + 4,
						40,
						['#f0c040', '#2f5d8a', '#ffffff', '#e5484d'],
						190
					);
					shake = Math.max(shake, 4);
					break;
				case 'peace':
					flag = null;
					burst(player.x, player.y - 20, 30, ['#ffffff', '#e8f4f8', '#8fd19e'], 120);
					break;
				case 'lose':
					if (event.outcome === 'enemy') flag = 'enemy';
					if (event.outcome === 'sunk') {
						burst(player.x, player.y, 34, ['#ffb347', '#ff6b3d', '#444444'], 190);
						splash(player.x, player.y, 14);
						shake = Math.max(shake, 14);
					}
					break;
			}
		}
	}
</script>

<canvas
	bind:this={canvas}
	class="block h-56 w-full touch-none rounded-md border-3 border-ink sm:h-64"
	aria-hidden="true"
></canvas>
