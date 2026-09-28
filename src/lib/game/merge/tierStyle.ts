/*
 * Colors for the ship tiers and a canvas drawing of the final board for the share card. Colors
 * only support the tier; the silhouette, size and level number carry it on their own.
 */
import { MAX_TIER, type Board } from './mergeBoard';

/** Design token names from tokens.css with their values, for drawing on a canvas */
const TOKENS = {
	ink: '#111111',
	paper: '#ffffff',
	sand: '#e8e1bc',
	khaki: '#7c8c5c',
	'flag-blue': '#4fa8d8',
	'tie-red': '#e5484d',
	skin: '#f6c9a0',
	sky: '#aeb4be',
	mustard: '#ddb93c',
	'banner-slate': '#6a7c9b',
	'explosion-yellow': '#f5c83a'
} as const;

export type ColorToken = keyof typeof TOKENS;

interface TierStyle {
	/** Tile background */
	tile: ColorToken;
	/** Ship hull */
	hull: ColorToken;
}

/** Indexed by tier; index 0 is unused */
const TIER_STYLES: readonly TierStyle[] = [
	{ tile: 'paper', hull: 'paper' },
	{ tile: 'paper', hull: 'mustard' },
	{ tile: 'sand', hull: 'flag-blue' },
	{ tile: 'skin', hull: 'khaki' },
	{ tile: 'sky', hull: 'paper' },
	{ tile: 'flag-blue', hull: 'banner-slate' },
	{ tile: 'mustard', hull: 'khaki' },
	{ tile: 'khaki', hull: 'banner-slate' },
	{ tile: 'explosion-yellow', hull: 'paper' }
];

export function tierStyle(tier: number): TierStyle {
	return TIER_STYLES[Math.min(Math.max(tier, 1), MAX_TIER)];
}

/** CSS color for a design token, for inline styles */
export function tokenColor(token: ColorToken): string {
	return `var(--color-${token})`;
}

/** Relative hull length per tier on the share card, so size still reads without color */
function hullLength(tier: number): number {
	return 0.4 + (0.55 * (tier - 1)) / (MAX_TIER - 1);
}

/** Draws the board into a square for the share score card */
export function drawMergeBoard(board: Board) {
	return (context: CanvasRenderingContext2D, x: number, y: number, size: number) => {
		const count = board.length;
		const cell = size / count;
		const gap = cell * 0.08;
		context.fillStyle = TOKENS.khaki;
		context.fillRect(x, y, size, size);
		context.lineJoin = 'round';
		context.textAlign = 'center';
		context.textBaseline = 'middle';

		board.forEach((row, rowIndex) =>
			row.forEach((tile, col) => {
				const left = x + col * cell + gap;
				const top = y + rowIndex * cell + gap;
				const inner = cell - gap * 2;
				context.lineWidth = Math.max(3, cell * 0.05);
				context.strokeStyle = TOKENS.ink;

				if (tile === null) {
					context.fillStyle = TOKENS['flag-blue'];
					context.fillRect(left, top, inner, inner);
					context.strokeRect(left, top, inner, inner);
					return;
				}

				if (tile.kind === 'mine') {
					context.fillStyle = TOKENS['flag-blue'];
					context.fillRect(left, top, inner, inner);
					context.strokeRect(left, top, inner, inner);
					const cx = left + inner / 2;
					const cy = top + inner / 2;
					const radius = inner * 0.26;
					context.beginPath();
					for (let spike = 0; spike < 8; spike++) {
						const angle = (spike * Math.PI) / 4;
						context.moveTo(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius);
						context.lineTo(
							cx + Math.cos(angle) * radius * 1.6,
							cy + Math.sin(angle) * radius * 1.6
						);
					}
					context.stroke();
					context.beginPath();
					context.arc(cx, cy, radius, 0, Math.PI * 2);
					context.fillStyle = TOKENS['tie-red'];
					context.fill();
					context.stroke();
					return;
				}

				const style = tierStyle(tile.tier);
				context.fillStyle = TOKENS[style.tile];
				context.fillRect(left, top, inner, inner);
				context.strokeRect(left, top, inner, inner);

				// A simple hull whose length grows with the tier
				const length = inner * hullLength(tile.tier);
				const hullTop = top + inner * 0.62;
				const hullBottom = top + inner * 0.82;
				const start = left + (inner - length) / 2;
				context.beginPath();
				context.moveTo(start, hullTop);
				context.lineTo(start + length, hullTop);
				context.lineTo(start + length - inner * 0.08, hullBottom);
				context.lineTo(start + inner * 0.06, hullBottom);
				context.closePath();
				context.fillStyle = TOKENS[style.hull];
				context.fill();
				context.stroke();

				context.fillStyle = TOKENS.ink;
				context.font = `700 ${Math.round(inner * 0.4)}px 'Baloo 2', system-ui, sans-serif`;
				context.fillText(String(tile.tier), left + inner / 2, top + inner * 0.36);
			})
		);
	};
}
