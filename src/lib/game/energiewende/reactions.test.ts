import { describe, expect, it } from 'vitest';
import {
	averageMood,
	businessmanMood,
	cameoFile,
	gameOverCameo,
	INTENSITY_ANNOYED,
	INTENSITY_OUTRAGED,
	PRICE_ANNOYED,
	PRICE_OUTRAGED,
	reactionsFor,
	severity,
	womanReaction
} from './reactions.js';

describe('the Tycoon', () => {
	it('is calm at a fair price, annoyed when it rises and outraged when it is steep', () => {
		expect(businessmanMood(PRICE_ANNOYED - 1)).toBe('calm');
		expect(businessmanMood(PRICE_ANNOYED)).toBe('annoyed');
		expect(businessmanMood(PRICE_OUTRAGED - 1)).toBe('annoyed');
		expect(businessmanMood(PRICE_OUTRAGED)).toBe('outraged');
	});
});

describe('the Critic', () => {
	it('reacts to a dirty mix', () => {
		expect(womanReaction(INTENSITY_ANNOYED - 1, 0, 0)).toEqual({ mood: 'calm', reason: 'mix' });
		expect(womanReaction(INTENSITY_ANNOYED, 0, 0)).toEqual({ mood: 'annoyed', reason: 'mix' });
		expect(womanReaction(INTENSITY_OUTRAGED, 0, 0)).toEqual({ mood: 'outraged', reason: 'mix' });
	});

	it('is annoyed by a single nuclear switch-over even on a clean grid', () => {
		expect(womanReaction(50, 1, 1)).toEqual({ mood: 'annoyed', reason: 'nuclear' });
	});

	it('is outraged when the nuclear plant flips twice in a day', () => {
		expect(womanReaction(50, 1, 2)).toEqual({ mood: 'outraged', reason: 'nuclear' });
		expect(womanReaction(50, 0, 2)).toEqual({ mood: 'outraged', reason: 'nuclear' });
	});

	it('lets the flipping and the mix only add up to the worse of the two', () => {
		// Annoying flip but an outrageous mix: the mix is the bigger complaint
		expect(womanReaction(INTENSITY_OUTRAGED, 1, 1)).toEqual({ mood: 'outraged', reason: 'mix' });
		// Same level: the flipping is blamed
		expect(womanReaction(INTENSITY_ANNOYED, 1, 1).reason).toBe('nuclear');
	});
});

describe('reactionsFor', () => {
	it('gives nobody a speech bubble when all is calm', () => {
		expect(reactionsFor(50, 100, 0, 0).speaker).toBeNull();
	});

	it('lets the more upset cameo speak', () => {
		expect(reactionsFor(PRICE_OUTRAGED, 100, 0, 0).speaker).toBe('businessman');
		expect(reactionsFor(50, INTENSITY_OUTRAGED, 0, 0).speaker).toBe('woman');
		expect(reactionsFor(PRICE_OUTRAGED, INTENSITY_ANNOYED, 0, 0).speaker).toBe('businessman');
		expect(reactionsFor(PRICE_ANNOYED, INTENSITY_OUTRAGED, 0, 0).speaker).toBe('woman');
	});

	it('knows why the Critic is upset', () => {
		expect(reactionsFor(50, 100, 2, 2)).toMatchObject({
			woman: 'outraged',
			womanReason: 'nuclear'
		});
	});
});

describe('cameo files and game over', () => {
	it('names one image per cameo and mood', () => {
		expect(cameoFile('businessman', 'calm')).toBe('energiewende-businessman-calm.svg');
		expect(cameoFile('woman', 'outraged')).toBe('energiewende-woman-outraged.svg');
	});

	it('shows whoever was unhappier over the run, the Tycoon on a tie', () => {
		expect(gameOverCameo({ businessman: 10, woman: 20 })).toBe('woman');
		expect(gameOverCameo({ businessman: 20, woman: 10 })).toBe('businessman');
		expect(gameOverCameo({ businessman: 5, woman: 5 })).toBe('businessman');
	});

	it('turns a run of grievance into a mood', () => {
		expect(averageMood(0, 100)).toBe('calm');
		expect(averageMood(60, 100)).toBe('annoyed');
		expect(averageMood(160, 100)).toBe('outraged');
		expect(averageMood(10, 0)).toBe('calm');
	});

	it('orders the moods', () => {
		expect(severity('calm')).toBeLessThan(severity('annoyed'));
		expect(severity('annoyed')).toBeLessThan(severity('outraged'));
	});
});
