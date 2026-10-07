import { appendFileSync } from 'node:fs';
import { it } from 'vitest';
import { createRandom } from '$lib/game/random';
import { FuryMatch } from '../furyMatch';
import { levelAt } from './index';
import type { LevelData } from './schema';

interface Shot {
	angle: number;
	power: number;
	tap: number | null;
}

function play(match: FuryMatch, shot: Shot) {
	if (!match.launch({ angle: shot.angle, power: shot.power })) return;
	for (let i = 0; i < 1500; i++) {
		if (shot.tap !== null && i === shot.tap) match.useAbility();
		match.step();
		if (match.phase !== 'flying' && match.phase !== 'settling') break;
	}
	// let a won level count immediately
}

function replay(level: LevelData, shots: Shot[]) {
	const match = new FuryMatch(level, createRandom(1));
	for (const shot of shots) play(match, shot);
	return match;
}

const angles = Array.from({ length: 13 }, (_, i) => ((10 + i * 5) * Math.PI) / 180);
const powers = [0.5, 0.65, 0.8, 0.9, 1];
const taps = process.env.NOTAP ? [null] : [null, 15, 30, 50, 75, 100];

function solve(level: LevelData) {
	const shots: Shot[] = [];
	for (let bird = 0; bird < level.birds.length; bird++) {
		let best: { shot: Shot; score: number; won: boolean } | null = null;
		for (const angle of angles)
			for (const power of powers)
				for (const tap of taps) {
					const shot = { angle, power, tap };
					const match = replay(level, [...shots, shot]);
					const score =
						match.world.domesDestroyed * 100000 + match.world.destructionPoints;
					const won = match.phase === 'won';
					if (!best || score > best.score || (won && !best.won)) best = { shot, score, won };
				}
		shots.push(best!.shot);
		if (best!.won) return { won: true, used: bird + 1, shots };
	}
	const final = replay(level, shots);
	return { won: final.phase === 'won', used: shots.length, shots, domes: final.world.domesDestroyed };
}

it('solves the new levels', { timeout: 3_000_000 }, () => {
	for (const n of (process.env.LEVELS ?? '4,6,8,10,12').split(',').map(Number)) {
		const level = levelAt(n - 1);
		const result = solve(level);
		appendFileSync(
			'C:/Users/fhuber/AppData/Local/Temp/solve.out',
			`LEVEL ${n} (${level.birds.join(',')}): ${JSON.stringify(result)}
`
		);
	}
});
