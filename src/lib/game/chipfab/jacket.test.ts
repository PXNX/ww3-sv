import { describe, expect, it } from 'vitest';
import { JACKET_POSES, SULK_SHORTAGE, jacketFile, jacketPose } from './jacket';

describe('Jensen Huang', () => {
	it('has one file per pose, all in the chipfab family', () => {
		expect(JACKET_POSES.map(jacketFile)).toEqual([
			'chipfab-jacket-cheers.svg',
			'chipfab-jacket-neutral.svg',
			'chipfab-jacket-sulks.svg'
		]);
	});

	it('is neutral while the shortage is low and nothing happened', () => {
		expect(jacketPose(0, null)).toBe('neutral');
		expect(jacketPose(SULK_SHORTAGE - 1, null)).toBe('neutral');
	});

	it('sulks on a high shortage', () => {
		expect(jacketPose(SULK_SHORTAGE, null)).toBe('sulks');
		expect(jacketPose(100, null)).toBe('sulks');
	});

	it('shows a fresh reaction over everything else', () => {
		expect(jacketPose(95, 'cheers')).toBe('cheers');
		expect(jacketPose(0, 'sulks')).toBe('sulks');
	});
});
