/*
 * Rare Earth Squeeze game store: wraps the pure rules with input, toasts, shake, sounds and the
 * personal best. The rules live in a plain state object; what the page shows (crates, notices,
 * switches) is copied into reactive fields after every step because it changes continuously.
 */
import { STARTING_LIVES } from '#lib/game/rareearth/config.js';
import { laneTowards } from '#lib/game/rareearth/graph.js';
import { liveRules, type Rule } from '#lib/game/rareearth/rules.js';
import {
	createGame,
	cycleSwitch,
	setSwitch,
	step,
	type Crate,
	type RareEarthEvent,
	type RareEarthState,
	type ViolationKind
} from '#lib/game/rareearth/state.js';
import { createRandom, randomSeed, type Random } from '#lib/game/random.js';
import { m } from '#lib/paraglide/messages.js';
import { highscores, type Highscores } from '#lib/services/highscore.js';
import { soundManager } from '#lib/sound/soundManager.svelte.js';
import type { SoundId } from '#lib/sound/sounds.js';

export type RareEarthStatus = 'ready' | 'playing' | 'paused' | 'over';

export const SCORE_KEY = ['rareearth', 'score'] as const;

const TOAST_MS = 1300;

export interface Toast {
	id: number;
	text: string;
	/** Good news or bad news, for the colour */
	tone: 'good' | 'bad' | 'info';
}

export interface RareEarthOptions {
	reducedMotion?: boolean;
	/** Injected for tests; defaults to the browser's local high scores */
	scores?: () => Highscores;
	/** Fixed seed for tests; a fresh random seed per run otherwise */
	seed?: () => number;
}

export class RareEarthGame {
	status = $state<RareEarthStatus>('ready');
	score = $state(0);
	lives = $state(STARTING_LIVES);
	round = $state(1);
	combo = $state(0);
	multiplier = $state(1);
	delivered = $state(0);
	violations = $state(0);
	bestCombo = $state(0);
	/** Game time in milliseconds, for the notice countdowns */
	nowMs = $state(0);
	crates = $state.raw<Crate[]>([]);
	/** Notices that are announced or in force */
	rules = $state.raw<Rule[]>([]);
	switches = $state.raw<Record<string, number>>({});
	toast = $state.raw<Toast | null>(null);
	/** The banner for a new notice or a new round */
	banner = $state.raw<Toast | null>(null);
	/** Counts up on every lost heart, so the field can shake and flash */
	hurtCount = $state(0);
	best = $state<number | null>(null);
	isNewBest = $state(false);

	/** Rules state, deliberately not reactive */
	state: RareEarthState;

	readonly reducedMotion: boolean;
	#random: Random = createRandom(1);
	#scores: () => Highscores;
	#seed: () => number;
	#toastMs = 0;
	#bannerMs = 0;
	#toastId = 0;

	constructor({
		reducedMotion = false,
		scores = highscores,
		seed = randomSeed
	}: RareEarthOptions = {}) {
		this.reducedMotion = reducedMotion;
		this.#scores = scores;
		this.#seed = seed;
		this.state = createGame();
		this.#sync();
	}

	/** Reads the stored best; call in the browser only */
	loadBest() {
		this.best = this.#scores().get(SCORE_KEY);
	}

	start() {
		this.#random = createRandom(this.#seed());
		this.state = createGame();
		this.toast = null;
		this.banner = null;
		this.isNewBest = false;
		this.hurtCount = 0;
		this.#toastMs = 0;
		this.#bannerMs = 0;
		this.#sync();
		this.status = 'playing';
	}

	pause() {
		if (this.status === 'playing') this.status = 'paused';
	}

	resume() {
		if (this.status === 'paused') this.status = 'playing';
	}

	togglePause() {
		if (this.status === 'playing') this.pause();
		else this.resume();
	}

	/** A tap on a node: the next lane */
	cycle(nodeId: string, stepBy = 1) {
		if (this.status !== 'playing') return;
		this.#apply(cycleSwitch(this.state, nodeId, stepBy));
	}

	/** Points a node at a lane by index */
	select(nodeId: string, lane: number) {
		if (this.status !== 'playing') return;
		this.#apply(setSwitch(this.state, nodeId, lane));
	}

	/** A drag from a node: picks the lane the drag points at, if it points at one */
	dragTowards(nodeId: string, dx: number, dy: number): boolean {
		if (this.status !== 'playing') return false;
		const lane = laneTowards(this.state.graph, nodeId, dx, dy);
		if (lane === null) return false;
		this.#apply(setSwitch(this.state, nodeId, lane));
		return true;
	}

	/** One fixed step: called by the game loop */
	update(dtMs: number) {
		if (this.status !== 'playing') return;
		if (this.toast && (this.#toastMs -= dtMs) <= 0) this.toast = null;
		if (this.banner && (this.#bannerMs -= dtMs) <= 0) this.banner = null;
		this.#apply(step(this.state, dtMs, this.#random));
	}

	/** Draws the trade map onto the shared score card: lanes, nodes and the crates in transit */
	drawBoard = (context: CanvasRenderingContext2D, x: number, y: number, size: number) => {
		const graph = this.state.graph;
		const scale = size / 320;
		const top = y + (size - 240 * scale) / 2;
		const at = (nodeX: number, nodeY: number): [number, number] => [
			x + nodeX * scale,
			top + nodeY * scale
		];
		context.lineCap = 'round';
		for (const edge of Object.values(graph.edges)) {
			const from = graph.nodes[edge.from];
			const to = graph.nodes[edge.to];
			const selected =
				this.state.switches[edge.from] === graph.nodes[edge.from].out.indexOf(edge.id);
			context.strokeStyle = selected ? '#111111' : '#aeb4be';
			context.lineWidth = Math.max(1.5, scale * (selected ? 3 : 1.5));
			context.beginPath();
			context.moveTo(...at(from.x, from.y));
			context.lineTo(...at(to.x, to.y));
			context.stroke();
		}
		const fills = { mine: '#7c8c5c', hub: '#ffffff', port: '#4fa8d8', factory: '#ddb93c' } as const;
		context.strokeStyle = '#111111';
		context.lineWidth = Math.max(1.5, scale * 2);
		for (const id of graph.order) {
			const node = graph.nodes[id];
			context.fillStyle = fills[node.kind];
			context.beginPath();
			context.arc(
				...at(node.x, node.y),
				scale * (node.kind === 'factory' ? 13 : 9),
				0,
				Math.PI * 2
			);
			context.fill();
			context.stroke();
		}
		context.fillStyle = '#e5484d';
		for (const crate of this.crates) {
			const node = graph.nodes[crate.node];
			const edge = crate.edge ? graph.edges[crate.edge] : null;
			const t = edge ? crate.progress / edge.length : 0;
			const target = edge ? graph.nodes[edge.to] : node;
			context.beginPath();
			context.arc(
				...at(node.x + (target.x - node.x) * t, node.y + (target.y - node.y) * t),
				scale * 4,
				0,
				Math.PI * 2
			);
			context.fill();
			context.stroke();
		}
	};

	#apply(events: RareEarthEvent[]) {
		for (const event of events) this.#handle(event);
		this.#sync();
		if (this.state.phase === 'over' && this.status === 'playing') this.#finish();
	}

	#handle(event: RareEarthEvent) {
		switch (event.type) {
			case 'round':
				this.#showBanner(m.rareearth_toast_round({ round: event.round }), 'info');
				this.#play('whoosh', 0.5);
				break;
			case 'notice':
				this.#showBanner(m.rareearth_toast_notice(), 'info');
				this.#play('alarm', 0.5);
				break;
			case 'rule-start':
				this.#showToast(m.rareearth_toast_rule_start(), 'info');
				this.#play('ding', 0.7);
				break;
			case 'rule-end':
				break;
			case 'spawn':
				this.#play('click', 0.3);
				break;
			case 'switch':
				if (event.auto) this.#showToast(m.rareearth_toast_clerk(), 'info');
				this.#play('ui-toggle', 0.5);
				break;
			case 'deliver':
				this.#showToast(
					event.byTheBook
						? event.multiplier > 1
							? m.rareearth_toast_deliver_combo({
									points: event.points,
									multiplier: event.multiplier
								})
							: m.rareearth_toast_deliver({ points: event.points })
						: m.rareearth_toast_deliver_taxed({ points: event.points }),
					'good'
				);
				this.#play(event.multiplier > 1 ? 'chime' : 'pickup', 0.8);
				break;
			case 'wrong':
				this.#hurt(m.rareearth_toast_wrong());
				break;
			case 'late':
				this.#hurt(m.rareearth_toast_late());
				break;
			case 'violation':
				this.#hurt(VIOLATION_TOASTS[event.kind]());
				break;
			case 'game-over':
				break;
		}
	}

	#hurt(text: string) {
		this.hurtCount += 1;
		this.#showToast(text, 'bad');
		this.#play('thud', 0.9);
		this.#play('ui-error', 0.7);
	}

	#showToast(text: string, tone: Toast['tone']) {
		this.toast = { id: ++this.#toastId, text, tone };
		this.#toastMs = TOAST_MS * (this.reducedMotion ? 1.4 : 1);
	}

	#showBanner(text: string, tone: Toast['tone']) {
		this.banner = { id: ++this.#toastId, text, tone };
		this.#bannerMs = TOAST_MS * 1.6 * (this.reducedMotion ? 1.4 : 1);
	}

	#play(id: SoundId, intensity: number) {
		soundManager().play(id, intensity);
	}

	#sync() {
		const state = this.state;
		this.score = state.score;
		this.lives = state.lives;
		this.round = state.round;
		this.combo = state.combo;
		this.multiplier = state.multiplier;
		this.delivered = state.delivered;
		this.violations = state.violations;
		this.bestCombo = state.bestCombo;
		this.nowMs = state.elapsedMs;
		this.crates = state.crates.map((crate) => ({ ...crate }));
		this.rules = liveRules(state.rules, state.elapsedMs).map((rule) => ({ ...rule }));
		this.switches = { ...state.switches };
	}

	#finish() {
		const result = this.#scores().submit(SCORE_KEY, this.state.score);
		this.isNewBest = result.isNewBest;
		this.best = result.best;
		this.status = 'over';
	}
}

const VIOLATION_TOASTS: Record<ViolationKind, () => string> = {
	ban: m.rareearth_toast_ban,
	quota: m.rareearth_toast_quota,
	licence: m.rareearth_toast_licence
};
