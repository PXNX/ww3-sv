/*
 * War Room game store: a turn-based wrapper around the campaign rules. There is no game loop;
 * every order is immediate, and the day only moves on when the player ends it.
 */
import {
	armisticeDays,
	battlePreview,
	buildFactory as buildFactoryRule,
	canBuild as canBuildRule,
	canOrder,
	canTrain as canTrainRule,
	createWarRoom,
	endTurn,
	finalScore,
	orderStack,
	slotsUsed as slotsUsedRule,
	supplyMap,
	train as trainRule
} from '#lib/game/warroom/state.js';
import {
	REGIONS,
	REGION_IDS,
	areNeighbors,
	type FactoryId,
	type Owner,
	type RegionId,
	type TemplateId
} from '#lib/game/warroom/config.js';
import type {
	Building,
	Division,
	Outcome,
	TrainingItem,
	WarRoomEvent,
	WarRoomState
} from '#lib/game/warroom/types.js';
import { regionName, factoryName, templateName } from '#lib/components/warroomText.js';
import { createRandom, randomSeed, type Random } from '#lib/game/random.js';
import { m } from '#lib/paraglide/messages.js';
import { highscores, type Highscores } from '#lib/services/highscore.js';
import { soundManager } from '#lib/sound/soundManager.svelte.js';
import type { SoundId } from '#lib/sound/sounds.js';

export type WarRoomStatus = 'ready' | 'playing' | 'over';

export const SCORE_KEY = ['warroom', 'score'] as const;

const initial = createWarRoom();

export interface WarRoomNote {
	id: number;
	text: string;
}

export interface WarRoomOptions {
	/** Injected for tests; defaults to the browser's local high scores */
	scores?: () => Highscores;
	/** Fixed seed for tests; a fresh random seed per run otherwise */
	seed?: () => number;
}

export class WarRoomGame {
	status = $state<WarRoomStatus>('ready');
	day = $state(1);
	armistice = $state(30);
	owner = $state.raw<Record<RegionId, Owner>>({ ...initial.owner });
	divisions = $state.raw<Record<RegionId, Division[]>>(initial.divisions);
	buildings = $state.raw<Building[]>([]);
	training = $state.raw<TrainingItem[]>([]);
	resources = $state.raw({ ...initial.resources });
	equipment = $state.raw({ ...initial.equipment });
	supply = $state.raw<Record<RegionId, number>>(supplyMap(initial));
	moved = $state.raw<RegionId[]>([]);
	outcome = $state.raw<Outcome | null>(null);
	score = $state(0);
	best = $state<number | null>(null);
	isNewBest = $state(false);
	/** The region whose details are open, and the stack waiting for an order */
	focused = $state<RegionId>('marsh');
	selected = $state<RegionId | null>(null);
	note = $state.raw<WarRoomNote | null>(null);

	/** Rules state, deliberately not reactive */
	state: WarRoomState;

	#scores: () => Highscores;
	#seed: () => number;
	#random: Random = createRandom(1);
	#noteId = 0;

	constructor({ scores = highscores, seed = randomSeed }: WarRoomOptions = {}) {
		this.#scores = scores;
		this.#seed = seed;
		this.state = createWarRoom();
		this.#sync();
	}

	/** Reads the stored best; call in the browser only */
	loadBest() {
		this.best = this.#scores().get(SCORE_KEY);
	}

	start() {
		this.#random = createRandom(this.#seed());
		this.state = createWarRoom();
		this.note = null;
		this.isNewBest = false;
		this.outcome = null;
		this.score = 0;
		this.focused = 'marsh';
		this.status = 'playing';
		this.#sync();
		this.selected = 'marsh';
	}

	/** Tapping the map: an order when a stack is selected and the target is next to it, otherwise a selection */
	clickRegion(id: RegionId) {
		if (this.status !== 'playing') return;
		this.focused = id;
		const from = this.selected;
		if (from && from !== id) {
			if (areNeighbors(from, id) && canOrder(this.state, from, id)) {
				this.#order(from, id);
				return;
			}
			if (this.#canSelect(id)) this.selected = id;
			return;
		}
		if (from === id) {
			this.selected = null;
			return;
		}
		this.selected = this.#canSelect(id) ? id : null;
	}

	/** Selecting from a list: never executes an order, just takes command */
	selectRegion(id: RegionId) {
		this.focused = id;
		this.selected = this.#canSelect(id) ? id : null;
	}

	/** Opens the details of a region without touching the selection */
	focusRegion(id: RegionId) {
		this.focused = id;
	}

	clearSelection() {
		this.selected = null;
	}

	/** Gives the selected stack its order for the day */
	orderSelected(to: RegionId) {
		if (this.status !== 'playing' || !this.selected) return;
		if (!areNeighbors(this.selected, to) || !canOrder(this.state, this.selected, to)) {
			this.#note(m.warroom_toast_blocked());
			this.#play('ui-error', 0.7);
			return;
		}
		this.#order(this.selected, to);
	}

	/** Ends the day: production, training, morale and the Pact's counterattack */
	endTurn() {
		if (this.status !== 'playing') return;
		this.#run(endTurn(this.state, this.#random));
	}

	build(region: RegionId, factory: FactoryId) {
		if (this.status !== 'playing') return;
		if (!buildFactoryRule(this.state, region, factory)) {
			this.#play('ui-error', 0.6);
			return;
		}
		this.#note(m.warroom_toast_built({ factory: factoryName(factory) }));
		this.#play('blocks-place', 0.6);
		this.#sync();
	}

	train(template: TemplateId) {
		if (this.status !== 'playing') return;
		if (!trainRule(this.state, template)) {
			this.#play('ui-error', 0.6);
			return;
		}
		this.#note(m.warroom_toast_training({ template: templateName(template) }));
		this.#play('click', 0.6);
		this.#sync();
	}

	canBuild(region: RegionId, factory: FactoryId): boolean {
		return canBuildRule(this.state, region, factory);
	}

	canTrain(template: TemplateId): boolean {
		return canTrainRule(this.state, template);
	}

	slotsUsed(region: RegionId): number {
		return slotsUsedRule(this.state, region);
	}

	slotsTotal(region: RegionId): number {
		return REGIONS.find((def) => def.id === region)?.slots ?? 0;
	}

	supplyAt(region: RegionId): number {
		return this.supply[region] ?? 0;
	}

	preview(from: RegionId, to: RegionId) {
		return battlePreview(this.state, from, to);
	}

	divisionCount(region: RegionId): number {
		return this.divisions[region]?.length ?? 0;
	}

	get selectedCount(): number {
		return this.selected ? this.divisionCount(this.selected) : 0;
	}

	#canSelect(id: RegionId): boolean {
		return (
			this.state.owner[id] === 'player' &&
			this.state.divisions[id].length > 0 &&
			!this.state.moved.includes(id)
		);
	}

	#order(from: RegionId, to: RegionId) {
		const events = orderStack(this.state, from, to, this.#random);
		if (events.some((event) => event.type === 'blocked')) {
			this.#note(m.warroom_toast_blocked());
			this.#play('ui-error', 0.7);
			return;
		}
		this.#run(events);
		this.selected = null;
	}

	#run(events: WarRoomEvent[]) {
		for (const event of events) this.#handle(event);
		this.#sync();
		if (this.state.outcome) this.#finish();
	}

	#handle(event: WarRoomEvent) {
		switch (event.type) {
			case 'move':
				this.#note(m.warroom_toast_moved({ region: regionName(event.to) }));
				this.#play('whoosh', 0.4);
				break;
			case 'blocked':
				this.#note(m.warroom_toast_blocked());
				this.#play('ui-error', 0.7);
				break;
			case 'battle': {
				const region = regionName(event.region);
				if (event.attacker === 'player') {
					if (event.won) {
						this.#note(m.warroom_toast_captured({ region, losses: event.attackerLosses }));
						this.#play('explosion-small', 0.7);
					} else {
						this.#note(m.warroom_toast_repelled({ region, losses: event.attackerLosses }));
						this.#play('hit', 0.8);
					}
				} else if (event.won) {
					this.#note(m.warroom_toast_pact_captured({ region }));
					this.#play('alarm', 1);
				} else {
					this.#note(m.warroom_toast_held({ region }));
					this.#play('chime', 0.6);
				}
				break;
			}
			case 'trained':
				this.#note(m.warroom_toast_trained({ template: templateName(event.template) }));
				this.#play('chime', 0.8);
				break;
			case 'built':
				this.#note(m.warroom_toast_built({ factory: factoryName(event.factory) }));
				this.#play('blocks-clear', 0.4);
				break;
			case 'starved':
			case 'captured':
			case 'day':
			case 'over':
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
		this.armistice = armisticeDays(state);
		this.owner = { ...state.owner };
		this.divisions = Object.fromEntries(
			REGION_IDS.map((id) => [id, [...state.divisions[id]]])
		) as Record<RegionId, Division[]>;
		this.buildings = [...state.buildings];
		this.training = [...state.training];
		this.resources = { ...state.resources };
		this.equipment = { ...state.equipment };
		this.supply = supplyMap(state);
		this.moved = [...state.moved];
		this.outcome = state.outcome;
		this.score = this.status === 'ready' ? 0 : finalScore(state);
	}

	#finish() {
		if (this.status === 'over') return;
		const result = this.#scores().submit(SCORE_KEY, this.state.score);
		this.isNewBest = result.isNewBest;
		this.best = result.best;
		this.score = this.state.score;
		this.outcome = this.state.outcome;
		this.status = 'over';
		this.selected = null;
		this.#play(this.state.outcome === 'won' ? 'chime-big' : 'game-over', 1);
	}

	/** Draws the campaign map onto the shared score card: zones, capitals and a front line */
	drawBoard = (context: CanvasRenderingContext2D, x: number, y: number, size: number) => {
		const ink = '#111111';
		context.fillStyle = '#e8e1bc';
		context.fillRect(x, y, size, size);
		context.strokeStyle = ink;
		context.lineWidth = Math.max(2, size * 0.012);
		context.strokeRect(x, y, size, size);

		const width = size * 0.86;
		const height = size * 0.64;
		const left = x + size * 0.07;
		const top = y + size * 0.17;
		const point = (id: RegionId) => {
			const def = REGIONS.find((region) => region.id === id)!;
			return { px: left + (def.x / 100) * width, py: top + (def.y / 100) * height };
		};

		context.strokeStyle = '#6a7c9b';
		context.lineWidth = Math.max(1, size * 0.008);
		for (const def of REGIONS) {
			for (const neighbor of def.neighbors) {
				if (REGION_IDS.indexOf(neighbor) <= REGION_IDS.indexOf(def.id)) continue;
				const a = point(def.id);
				const b = point(neighbor);
				context.beginPath();
				context.moveTo(a.px, a.py);
				context.lineTo(b.px, b.py);
				context.stroke();
			}
		}

		for (const id of REGION_IDS) {
			const { px, py } = point(id);
			context.fillStyle = this.owner[id] === 'player' ? '#4fa8d8' : '#e5484d';
			context.strokeStyle = ink;
			context.lineWidth = Math.max(1.5, size * 0.01);
			context.beginPath();
			context.arc(px, py, size * 0.035, 0, Math.PI * 2);
			context.fill();
			context.stroke();
		}
	};
}
