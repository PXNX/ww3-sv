/*
 * Energiewende Panic game store: wraps the pure grid simulation with the player's commands, the
 * notices and sounds, the cameo reactions and the personal bests. The simulation state is a plain
 * object; only what the page shows is reactive, synced after every step.
 */
import { createRandom, randomSeed, type Random } from '#lib/game/random.js';
import {
	eventModifiers,
	HOURS_PER_DAY,
	type EventKind,
	type GridEvent
} from '#lib/game/energiewende/events.js';
import {
	availableOutput,
	averageIntensity,
	averagePrice,
	averageCleanShare,
	createGrid,
	dayNumber,
	demandForecast,
	frequency,
	imbalanceShare,
	reactionsOf,
	SECONDS_PER_HOUR,
	setTarget,
	START_HOUR,
	STARTING_LIVES,
	stepGrid,
	type GridEventReport,
	type GridState
} from '#lib/game/energiewende/grid.js';
import {
	averageMood,
	gameOverCameo,
	severity,
	type CameoKind,
	type Mood,
	type WomanReason
} from '#lib/game/energiewende/reactions.js';
import { BATTERY_ENERGY, SOURCE_IDS, type SourceId } from '#lib/game/energiewende/sources.js';
import { highscores, type Highscores } from '#lib/services/highscore.js';
import { soundManager } from '#lib/sound/soundManager.svelte.js';
import type { SoundId } from '#lib/sound/sounds.js';

export type EnergiewendeStatus = 'ready' | 'playing' | 'paused' | 'over';

export const SCORE_KEY = ['energiewende', 'score'] as const;
export const DAYS_KEY = ['energiewende', 'days'] as const;

/** Game hours between two points of the supply and demand chart, and how many it keeps (a day) */
const HISTORY_STEP_HOURS = 0.25;
const HISTORY_POINTS = Math.round(HOURS_PER_DAY / HISTORY_STEP_HOURS);
/** How long a notice stays on screen, in real milliseconds */
const NOTICE_MS = 3500;
/** Demand a few hours ahead against now, in GW, from which the trend arrow turns */
const TREND_HOURS = 2;
const TREND_GW = 2;

export interface HistoryPoint {
	hour: number;
	demand: number;
	supply: number;
}

export interface SourceView {
	id: SourceId;
	/** Delivered power in GW, negative while the batteries charge */
	output: number;
	/** What the source could deliver right now in GW */
	available: number;
	/** The slider: 0..1, or -1..1 for the batteries */
	target: number;
	online: boolean;
	/** Hours of warm-up left, or null */
	warmup: number | null;
}

export interface EventView {
	kind: EventKind;
	source?: SourceId;
	/** Whole hours until it starts (upcoming) or until it ends (active) */
	hours: number;
	active: boolean;
}

export type Notice =
	| { kind: 'blackout' }
	| { kind: 'overload' }
	| { kind: 'tripped'; source: SourceId }
	| { kind: 'online'; source: SourceId };

export type Trend = 'up' | 'down' | 'flat';

export interface OverCameo {
	kind: CameoKind;
	mood: Mood;
	/** The Critic is upset about the nuclear flip-flopping rather than the mix */
	nuclear: boolean;
}

export interface EnergiewendeOptions {
	reducedMotion?: boolean;
	/** Injected for tests; defaults to the browser's local high scores */
	scores?: () => Highscores;
	/** Fixed seed for tests; a fresh random seed per run otherwise */
	seed?: () => number;
}

export class EnergiewendeGame {
	status = $state<EnergiewendeStatus>('ready');
	score = $state(0);
	lives = $state(STARTING_LIVES);
	day = $state(1);
	/** Hour of the day, 0..24 */
	clock = $state(START_HOUR);
	demand = $state(0);
	supply = $state(0);
	price = $state(0);
	intensity = $state(0);
	hertz = $state(50);
	/** Grid stress from 0 (steady) to 1 (about to trip) */
	stress = $state(0);
	trend = $state<Trend>('flat');
	/** Energy in the batteries as a share of full */
	charge = $state(0.5);
	flips = $state(0);
	blackouts = $state(0);
	overloads = $state(0);
	sources = $state.raw<SourceView[]>([]);
	history = $state.raw<HistoryPoint[]>([]);
	events = $state.raw<EventView[]>([]);
	notice = $state.raw<Notice | null>(null);
	/** Counts up whenever a heart is lost, so the board can flash */
	hurtCount = $state(0);
	businessman = $state<Mood>('calm');
	woman = $state<Mood>('calm');
	womanReason = $state<WomanReason>('mix');
	speaker = $state<CameoKind | null>(null);
	/** Which of the two quotes per mood the cameos currently say, 1 or 2 */
	businessmanLine = $state<1 | 2>(1);
	womanLine = $state<1 | 2>(1);
	best = $state<number | null>(null);
	bestDays = $state<number | null>(null);
	isNewBest = $state(false);
	/** Whole days survived, final once the game is over */
	daysSurvived = $state(0);
	avgPrice = $state(0);
	avgIntensity = $state(0);
	cleanShare = $state(0);

	/** Simulation state, deliberately not reactive */
	state: GridState;

	readonly reducedMotion: boolean;
	#random: Random = createRandom(1);
	#scores: () => Highscores;
	#seed: () => number;
	#noticeTimer: ReturnType<typeof setTimeout> | undefined;
	#lastHistoryHour = 0;
	#changes = { businessman: 0, woman: 0 };

	constructor({
		reducedMotion = false,
		scores = highscores,
		seed = randomSeed
	}: EnergiewendeOptions = {}) {
		this.reducedMotion = reducedMotion;
		this.#scores = scores;
		this.#seed = seed;
		this.state = createGrid(createRandom(1));
		this.#syncChrome();
	}

	/** Reads the stored bests; call in the browser only */
	loadBest() {
		this.best = this.#scores().get(SCORE_KEY);
		this.bestDays = this.#scores().get(DAYS_KEY);
	}

	start() {
		const seed = this.#seed();
		this.#random = createRandom(seed);
		this.state = createGrid(createRandom(seed ^ 0x9e3779b9));
		this.isNewBest = false;
		this.notice = null;
		clearTimeout(this.#noticeTimer);
		this.hurtCount = 0;
		this.#changes = { businessman: 0, woman: 0 };
		this.businessmanLine = 1;
		this.womanLine = 1;
		this.history = [this.#point()];
		this.#lastHistoryHour = this.state.hour;
		this.#syncChrome();
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

	/** The player moves a slider; the value is a share (batteries: -1 charging to 1 discharging) */
	setTarget(id: SourceId, value: number) {
		if (this.status !== 'playing') return;
		const flips = this.state.nuclearFlips.length;
		setTarget(this.state, id, value);
		if (this.state.nuclearFlips.length !== flips) this.#play('ui-error');
		this.#syncChrome();
	}

	/** One fixed step of real time: called by the page's game loop */
	update(dtMs: number) {
		if (this.status !== 'playing') return;
		const dtHours = dtMs / 1000 / SECONDS_PER_HOUR;
		const reports = stepGrid(this.state, dtHours, this.#random);
		if (this.state.hour - this.#lastHistoryHour >= HISTORY_STEP_HOURS) {
			this.#lastHistoryHour = this.state.hour;
			this.history = [...this.history, this.#point()].slice(-HISTORY_POINTS);
		}
		for (const report of reports) this.#handle(report);
		this.#syncChrome();
		if (this.state.over) this.#finish();
	}

	/** The cameo for the game-over screen: whoever was unhappier over the run */
	overCameo(): OverCameo {
		const { grievance } = this.state;
		const hours = Math.max(0, this.state.hour - START_HOUR);
		const kind = gameOverCameo(grievance);
		const average = averageMood(grievance[kind], hours);
		// A game over is never a calm moment
		const mood: Mood = average === 'calm' ? 'annoyed' : average;
		return { kind, mood, nuclear: kind === 'woman' && this.state.nuclearFlips.length >= 2 };
	}

	/** Draws the day's supply and demand lines onto the shared score card */
	drawBoard = (context: CanvasRenderingContext2D, x: number, y: number, size: number) => {
		const points = this.history;
		context.fillStyle = '#ffffff';
		context.fillRect(x, y, size, size);
		if (points.length < 2) return;
		const low = 20;
		const high = 100;
		const first = points[0].hour;
		const span = Math.max(1, points[points.length - 1].hour - first);
		const draw = (pick: (point: HistoryPoint) => number, color: string, width: number) => {
			context.beginPath();
			points.forEach((point, index) => {
				const px = x + ((point.hour - first) / span) * size;
				const py =
					y + size - ((Math.min(high, Math.max(low, pick(point))) - low) / (high - low)) * size;
				if (index === 0) context.moveTo(px, py);
				else context.lineTo(px, py);
			});
			context.strokeStyle = color;
			context.lineWidth = width;
			context.lineJoin = 'round';
			context.stroke();
		};
		draw((point) => point.demand, '#111111', size / 40);
		draw((point) => point.supply, '#e5484d', size / 50);
	};

	#point(): HistoryPoint {
		return { hour: this.state.hour, demand: this.state.demand, supply: this.state.supply };
	}

	#handle(report: GridEventReport) {
		switch (report.type) {
			case 'blackout':
				this.hurtCount += 1;
				this.#notify({ kind: 'blackout' });
				this.#play('alarm');
				break;
			case 'overload':
				this.hurtCount += 1;
				this.#notify({ kind: 'overload' });
				this.#play('alarm');
				break;
			case 'tripped':
				this.#notify({ kind: 'tripped', source: report.source });
				this.#play('thud');
				break;
			case 'online':
				this.#notify({ kind: 'online', source: report.source });
				this.#play('chime');
				break;
			case 'announced':
				this.#play('ding');
				break;
			case 'started':
			case 'ended':
			case 'game-over':
				break;
		}
	}

	#notify(notice: Notice) {
		this.notice = notice;
		clearTimeout(this.#noticeTimer);
		this.#noticeTimer = setTimeout(() => (this.notice = null), NOTICE_MS);
	}

	#play(id: SoundId) {
		soundManager().play(id);
	}

	#syncChrome() {
		const state = this.state;
		const modifiers = eventModifiers(state.scheduler.active, state.hour);
		this.score = Math.floor(state.score);
		this.lives = state.lives;
		this.day = dayNumber(state);
		this.clock = state.hour % HOURS_PER_DAY;
		this.demand = state.demand;
		this.supply = state.supply;
		this.price = state.price;
		this.intensity = state.intensity;
		this.hertz = frequency(imbalanceShare(state.supply, state.demand));
		this.stress = Math.min(1, state.stress);
		this.charge = state.soc / BATTERY_ENERGY;
		this.flips = state.nuclearFlips.length;
		this.blackouts = state.blackouts;
		this.overloads = state.overloads;
		this.sources = SOURCE_IDS.map((id) => ({
			id,
			output: state.outputs[id],
			available: availableOutput(id, state.hour, state.weather, modifiers),
			target: state.targets[id],
			online: state.online[id],
			warmup: state.warmup[id]
		}));

		const ahead = demandForecast(state, TREND_HOURS) - state.demand;
		this.trend = ahead > TREND_GW ? 'up' : ahead < -TREND_GW ? 'down' : 'flat';

		this.events = [
			...state.scheduler.active.map((event) => this.#view(event, true)),
			...state.scheduler.upcoming.map((event) => this.#view(event, false))
		];

		const reactions = reactionsOf(state);
		this.#setMood('businessman', reactions.businessman);
		this.#setMood('woman', reactions.woman);
		this.womanReason = reactions.womanReason;
		this.speaker = reactions.speaker;

		this.avgPrice = averagePrice(state);
		this.avgIntensity = averageIntensity(state);
		this.cleanShare = averageCleanShare(state);
		this.daysSurvived = Math.max(0, Math.floor((state.hour - START_HOUR) / HOURS_PER_DAY));
	}

	#view(event: GridEvent, active: boolean): EventView {
		const target = active ? event.endHour : event.startHour;
		return {
			kind: event.kind,
			source: event.source,
			hours: Math.max(1, Math.ceil(target - this.state.hour)),
			active
		};
	}

	/** Sets a cameo's mood; a change of mood picks the other of its two quotes */
	#setMood(kind: CameoKind, mood: Mood) {
		const current = kind === 'businessman' ? this.businessman : this.woman;
		if (current === mood) return;
		if (kind === 'businessman') this.businessman = mood;
		else this.woman = mood;
		this.#changes[kind] += severity(mood) > severity(current) ? 1 : 0;
		const line: 1 | 2 = this.#changes[kind] % 2 === 0 ? 1 : 2;
		if (kind === 'businessman') this.businessmanLine = line;
		else this.womanLine = line;
	}

	#finish() {
		const scores = this.#scores();
		const result = scores.submit(SCORE_KEY, this.score);
		this.isNewBest = result.isNewBest;
		this.best = result.best;
		this.bestDays = scores.submit(DAYS_KEY, this.daysSurvived).best;
		clearTimeout(this.#noticeTimer);
		this.status = 'over';
	}
}
