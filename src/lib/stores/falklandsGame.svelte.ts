/*
 * Falklands game store: a turn-based wrapper around the pure race rules. There is no game loop;
 * every action is one day, and the map, fuel gauge and notes update from the events.
 */
import {
	canDeal,
	createGame,
	deal,
	enemyLeft,
	move,
	repair,
	starsFor,
	talk,
	weatherNow,
	zonesLeft,
	type FalklandsEvent,
	type FalklandsOutcome,
	type FalklandsState,
	type Speed
} from '#lib/game/falklands/state.js';
import { DIPLOMACY_TARGET, MAX_HULL } from '#lib/game/falklands/config.js';
import { legAt, type Zones } from '#lib/game/falklands/zones.js';
import { haptic } from '#lib/haptic/haptic.svelte.js';
import type { Weather } from '#lib/game/falklands/weather.js';
import { createRandom, randomSeed, type Random } from '#lib/game/random.js';
import { hazardText } from '#lib/components/falklandsText.js';
import { m } from '#lib/paraglide/messages.js';
import { highscores, type Highscores } from '#lib/services/highscore.js';
import { soundManager } from '#lib/sound/soundManager.svelte.js';
import type { SoundId } from '#lib/sound/sounds.js';

export type FalklandsStatus = 'ready' | 'playing' | 'over';

export const SCORE_KEY = ['falklands', 'score'] as const;

function pickupNote(kind: 'tanker' | 'repair' | 'chaff' | 'intel', amount: number): string {
	if (kind === 'tanker') return m.falklands_note_tanker({ fuel: amount });
	if (kind === 'repair') return m.falklands_note_repair_crate({ hull: amount });
	if (kind === 'chaff') return m.falklands_note_chaff_get();
	return m.falklands_note_intel();
}

export interface FalklandsNote {
	id: number;
	text: string;
}

export interface FalklandsOptions {
	/** Injected for tests; defaults to the browser's local high scores */
	scores?: () => Highscores;
	/** Fixed seed for tests; a fresh random seed per run otherwise */
	seed?: () => number;
}

export class FalklandsGame {
	status = $state<FalklandsStatus>('ready');
	day = $state(0);
	playerAt = $state(0);
	enemyAt = $state(0);
	fuel = $state(0);
	talks = $state(0);
	zonesLeft = $state(0);
	enemyLeft = $state(0);
	dealReady = $state(false);
	weather = $state.raw<Weather>('clear');
	outcome = $state.raw<FalklandsOutcome | null>(null);
	score = $state(0);
	hull = $state(MAX_HULL);
	chaff = $state(0);
	streak = $state(0);
	bestStreak = $state(0);
	stars = $state(0);
	leg = $state<1 | 2 | 3>(1);
	zones = $state.raw<Zones>([]);
	/** The playfield listens here to animate impacts, pickups and popups */
	onEvents: ((events: FalklandsEvent[]) => void) | null = null;
	note = $state.raw<FalklandsNote | null>(null);
	best = $state<number | null>(null);
	isNewBest = $state(false);

	/** Rules state, deliberately not reactive */
	state: FalklandsState;

	#scores: () => Highscores;
	#seed: () => number;
	#random: Random = createRandom(1);
	#noteId = 0;

	constructor({ scores = highscores, seed = randomSeed }: FalklandsOptions = {}) {
		this.#scores = scores;
		this.#seed = seed;
		this.state = createGame(this.#random);
		this.#sync();
	}

	/** Reads the stored best; call in the browser only */
	loadBest() {
		this.best = this.#scores().get(SCORE_KEY);
	}

	start() {
		this.#random = createRandom(this.#seed());
		this.state = createGame(this.#random);
		this.note = null;
		this.isNewBest = false;
		this.#sync();
		this.status = 'playing';
	}

	/** Sail one, two or three zones */
	move(speed: Speed) {
		if (this.status !== 'playing') return;
		this.#run(move(this.state, speed));
	}

	/** Spend the day in talks */
	talk() {
		if (this.status !== 'playing') return;
		this.#run(talk(this.state));
	}

	/** Spend a day patching the hull */
	repair() {
		if (this.status !== 'playing') return;
		this.#run(repair(this.state));
	}

	/** Sign the peace deal once the talks have gone on long enough */
	deal() {
		if (this.status !== 'playing') return;
		this.#run(deal(this.state));
	}

	#run(events: FalklandsEvent[]) {
		for (const event of events) this.#handle(event);
		if (events.length > 0) {
			this.onEvents?.(events);
			this.#sync();
			if (this.state.phase === 'over') this.#finish();
		}
	}

	#handle(event: FalklandsEvent) {
		switch (event.type) {
			case 'move':
				this.#note(m.falklands_note_move({ zones: event.zones }));
				this.#play('whoosh', event.speed === 'flank' ? 0.8 : event.speed === 'cruise' ? 0.5 : 0.3);
				haptic().play(event.speed === 'flank' ? 0.25 : 0.1);
				if (event.weather === 'storm') this.#play('thunder', 0.4);
				break;
			case 'hit':
				this.#note(
					m.falklands_note_hit({ hazard: hazardText(event.hazard), damage: event.damage })
				);
				this.#play(
					event.hazard === 'mine' ? 'mine-explosion' : 'explosion-small',
					0.6 + event.damage / 100
				);
				haptic().play(Math.min(1, 0.5 + event.damage / 60));
				break;
			case 'chaff':
				this.#note(m.falklands_note_chaff({ hazard: hazardText(event.hazard) }));
				this.#play('dome-pop', 0.7);
				haptic().play(0.3);
				break;
			case 'swept':
				this.#note(m.falklands_note_swept());
				this.#play('sonar-ping', 0.6);
				haptic().play(0.15);
				break;
			case 'pickup':
				this.#note(pickupNote(event.kind, event.amount));
				this.#play('pickup', 0.7);
				haptic().play(0.2);
				break;
			case 'combo':
				this.#note(m.falklands_note_streak({ count: event.streak, points: event.points }));
				this.#play('ding', Math.min(1, 0.4 + event.streak * 0.1));
				haptic().play(0.15);
				break;
			case 'leg':
				this.#play('wave-horn', 0.7);
				haptic().play(0.35);
				break;
			case 'repair':
				this.#note(m.falklands_note_repair({ hull: event.gain }));
				this.#play('hammer', 0.6);
				haptic().play(0.2);
				break;
			case 'repair-none':
				this.#note(m.falklands_note_repair_none());
				this.#play('ui-error', 0.6);
				haptic().play(0.15);
				break;
			case 'blocked':
				this.#note(event.weather === 'storm' ? m.falklands_note_storm() : m.falklands_note_fog());
				this.#play('ui-error', 0.8);
				haptic().play(0.3);
				break;
			case 'shortfuel':
				this.#note(m.falklands_note_shortfuel({ need: event.need }));
				this.#play('ui-error', 0.8);
				haptic().play(0.3);
				break;
			case 'talk':
				this.#note(
					event.talks >= DIPLOMACY_TARGET
						? m.falklands_note_deal_ready()
						: m.falklands_note_talk({ talks: event.talks, target: DIPLOMACY_TARGET })
				);
				this.#play('ui-tap', 0.6);
				haptic().play(0.1);
				break;
			case 'no-deal':
				this.#note(m.falklands_note_nodeal({ talks: event.talks, target: DIPLOMACY_TARGET }));
				this.#play('ui-error', 0.8);
				haptic().play(0.3);
				break;
			case 'win':
				this.#play('chime-big', 1);
				haptic().play(0.8);
				break;
			case 'peace':
				this.#play('chime', 0.9);
				haptic().play(0.5);
				break;
			case 'lose':
				this.#play(event.outcome === 'sunk' ? 'explosion-big' : 'ui-error', 1);
				haptic().play(1);
				break;
		}
	}

	#note(text: string) {
		this.note = { id: ++this.#noteId, text };
	}

	#play(id: SoundId, intensity: number) {
		soundManager().play(id, intensity);
	}

	#sync() {
		const state = this.state;
		this.day = state.day;
		this.playerAt = state.playerAt;
		this.enemyAt = state.enemyAt;
		this.fuel = state.fuel;
		this.talks = state.talks;
		this.zonesLeft = zonesLeft(state);
		this.enemyLeft = enemyLeft(state);
		this.dealReady = canDeal(state);
		this.weather = weatherNow(state);
		this.outcome = state.outcome;
		this.score = state.score;
		this.hull = state.hull;
		this.chaff = state.chaff;
		this.streak = state.streak;
		this.bestStreak = state.bestStreak;
		this.leg = legAt(Math.min(state.playerAt + 1, state.zones.length - 1));
		this.zones = [...state.zones];
		this.stars = starsFor(state);
	}

	#finish() {
		const result = this.#scores().submit(SCORE_KEY, this.state.score);
		this.isNewBest = result.isNewBest;
		this.best = result.best;
		this.status = 'over';
	}

	/** Draws the South Atlantic onto the shared score card: route, island and two fleets */
	drawBoard = (context: CanvasRenderingContext2D, x: number, y: number, size: number) => {
		const ink = '#111111';
		// Sea
		context.fillStyle = '#8fb4c9';
		context.fillRect(x, y, size, size);
		context.strokeStyle = ink;
		context.lineWidth = Math.max(2, size * 0.012);
		context.strokeRect(x, y, size, size);
		// Waves
		context.strokeStyle = '#6d97ad';
		context.lineWidth = Math.max(1, size * 0.008);
		for (let row = 0; row < 4; row++) {
			context.beginPath();
			context.moveTo(x + size * 0.08, y + size * (0.2 + row * 0.18));
			context.quadraticCurveTo(
				x + size * 0.2,
				y + size * (0.16 + row * 0.18),
				x + size * 0.32,
				y + size * (0.2 + row * 0.18)
			);
			context.stroke();
		}
		// The dotted route to the islands
		context.strokeStyle = ink;
		context.lineWidth = Math.max(2, size * 0.01);
		for (let dot = 0; dot < 6; dot++) {
			const progress = dot / 5;
			context.beginPath();
			context.arc(
				x + size * (0.14 + progress * 0.58),
				y + size * (0.74 - progress * 0.36),
				size * 0.014,
				0,
				Math.PI * 2
			);
			context.fillStyle = ink;
			context.fill();
		}
		// The islands
		context.fillStyle = '#7f9a5e';
		context.beginPath();
		context.ellipse(
			x + size * 0.82,
			y + size * 0.3,
			size * 0.12,
			size * 0.08,
			-0.4,
			0,
			Math.PI * 2
		);
		context.fill();
		context.stroke();
		// The task force
		context.fillStyle = '#2f5d8a';
		context.beginPath();
		context.moveTo(x + size * 0.2, y + size * 0.7);
		context.lineTo(x + size * 0.29, y + size * 0.76);
		context.lineTo(x + size * 0.2, y + size * 0.82);
		context.closePath();
		context.fill();
		context.stroke();
		// The other fleet, further along
		context.fillStyle = '#a34a3a';
		context.beginPath();
		context.moveTo(x + size * 0.6, y + size * 0.34);
		context.lineTo(x + size * 0.68, y + size * 0.4);
		context.lineTo(x + size * 0.6, y + size * 0.46);
		context.closePath();
		context.fill();
		context.stroke();
	};
}
