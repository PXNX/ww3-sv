/*
 * Score sharing (requirements Section 11): a score-card image is drawn client-side on a canvas and
 * shared through the Web Share API, with a download plus copy-link fallback. Nothing is sent to
 * any server operated by this app.
 */

export interface ScoreCard {
	appName: string;
	modeName: string;
	scoreLabel: string;
	score: string;
	mascotSrc: string;
	/** Optional: draws the final board into the given rectangle */
	drawBoard?: (context: CanvasRenderingContext2D, x: number, y: number, size: number) => void;
}

export type ShareMethod = 'web-share-files' | 'web-share-text' | 'download';

export type ShareOutcome =
	| { kind: 'shared' }
	| { kind: 'cancelled' }
	| { kind: 'downloaded'; linkCopied: boolean };

type ShareNavigator = Pick<Navigator, 'share' | 'canShare'>;

export function chooseShareMethod(navigator: Partial<ShareNavigator>, file: File): ShareMethod {
	if (typeof navigator.share !== 'function') return 'download';
	try {
		if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
			return 'web-share-files';
		}
	} catch {
		// canShare can throw for unsupported file types; fall through to text sharing
	}
	return 'web-share-text';
}

const INK = '#111111';
const SAND = '#e8e1bc';
const PAPER = '#ffffff';
const SLATE = '#6a7c9b';
const TIE_RED = '#e5484d';
const DISPLAY_FONT = "'Baloo 2', system-ui, sans-serif";

function loadImage(src: string): Promise<HTMLImageElement | null> {
	return new Promise((resolve) => {
		const image = new Image();
		image.onload = () => resolve(image);
		image.onerror = () => resolve(null);
		image.src = src;
	});
}

function box(context: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
	context.fillStyle = INK;
	context.fillRect(x + 10, y + 10, w, h);
	context.fillStyle = PAPER;
	context.fillRect(x, y, w, h);
	context.lineWidth = 8;
	context.strokeStyle = INK;
	context.strokeRect(x, y, w, h);
}

export async function renderScoreCard(card: ScoreCard): Promise<Blob> {
	const size = 1080;
	const canvas = document.createElement('canvas');
	canvas.width = size;
	canvas.height = size;
	const context = canvas.getContext('2d');
	if (!context) throw new Error('Canvas is not available');

	await document.fonts?.load(`700 64px ${DISPLAY_FONT}`).catch(() => undefined);
	const mascot = await loadImage(card.mascotSrc);

	context.fillStyle = SAND;
	context.fillRect(0, 0, size, size);
	context.textAlign = 'center';
	context.textBaseline = 'middle';

	// Title banner
	context.fillStyle = INK;
	context.fillRect(70, 60, size - 140, 130);
	context.fillStyle = SLATE;
	context.fillRect(60, 50, size - 140, 130);
	context.lineWidth = 8;
	context.strokeStyle = INK;
	context.strokeRect(60, 50, size - 140, 130);
	context.fillStyle = PAPER;
	context.font = `700 76px ${DISPLAY_FONT}`;
	context.fillText(card.appName, size / 2 - 5, 120, size - 200);

	context.fillStyle = INK;
	context.font = `700 54px ${DISPLAY_FONT}`;
	context.fillText(card.modeName, size / 2, 250, size - 160);

	// Board
	const boardSize = 520;
	const boardX = 90;
	const boardY = 310;
	box(context, boardX, boardY, boardSize, boardSize);
	if (card.drawBoard) {
		context.save();
		context.beginPath();
		context.rect(boardX + 16, boardY + 16, boardSize - 32, boardSize - 32);
		context.clip();
		card.drawBoard(context, boardX + 16, boardY + 16, boardSize - 32);
		context.restore();
	}

	// Score
	box(context, 660, 330, 340, 250);
	context.fillStyle = INK;
	context.font = `700 44px ${DISPLAY_FONT}`;
	context.fillText(card.scoreLabel, 830, 390, 300);
	context.fillStyle = TIE_RED;
	context.font = `700 110px ${DISPLAY_FONT}`;
	context.fillText(card.score, 830, 500, 300);

	if (mascot) context.drawImage(mascot, 720, 640, 240, 288);

	return new Promise((resolve, reject) =>
		canvas.toBlob(
			(blob) => (blob ? resolve(blob) : reject(new Error('Export failed'))),
			'image/png'
		)
	);
}

async function copyText(text: string): Promise<boolean> {
	try {
		await navigator.clipboard.writeText(text);
		return true;
	} catch {
		return false;
	}
}

function download(blob: Blob, filename: string) {
	const url = URL.createObjectURL(blob);
	const link = document.createElement('a');
	link.href = url;
	link.download = filename;
	document.body.append(link);
	link.click();
	link.remove();
	setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function shareScore(options: {
	blob: Blob;
	filename: string;
	text: string;
	url: string;
}): Promise<ShareOutcome> {
	const file = new File([options.blob], options.filename, { type: 'image/png' });
	const method = chooseShareMethod(navigator, file);
	try {
		if (method === 'web-share-files') {
			await navigator.share({ files: [file], text: options.text, url: options.url });
			return { kind: 'shared' };
		}
		if (method === 'web-share-text') {
			await navigator.share({ text: options.text, url: options.url });
			return { kind: 'shared' };
		}
	} catch (error) {
		if (error instanceof DOMException && error.name === 'AbortError') return { kind: 'cancelled' };
		// Any other failure falls back to downloading
	}
	download(options.blob, options.filename);
	return { kind: 'downloaded', linkCopied: await copyText(`${options.text} ${options.url}`) };
}
