import { describe, expect, it } from 'vitest';
import { candidateFile, candidatePose, pollMood, resultPose } from './candidate';

describe('La Candidate', () => {
	it('smirks when she leads the poll, sweats when she trails and shrugs on a close race', () => {
		expect(pollMood({ you: 10, rival: 14 })).toBe('smug');
		expect(pollMood({ you: 14, rival: 10 })).toBe('worried');
		expect(pollMood({ you: 12, rival: 13 })).toBe('neutral');
		expect(pollMood({ you: 12, rival: 12 })).toBe('neutral');
	});

	it('uses the neutral portrait while worried', () => {
		expect(candidatePose('worried')).toBe('neutral');
		expect(candidatePose('smug')).toBe('smug');
	});

	it('gloats on a win and sulks on a loss', () => {
		expect(resultPose({ winner: 'rival', reason: 'majority', early: true })).toBe('smug');
		expect(resultPose({ winner: 'you', reason: 'final', early: false })).toBe('defeated');
		expect(candidateFile('defeated')).toBe('sondage-candidate-defeated.svg');
	});
});
