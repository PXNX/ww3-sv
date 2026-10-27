/*
 * A handful of recorded sound effects (explosions, a rocket launch, a voice line) that are too
 * specific or too textured to synthesize convincingly with oscillators and noise. Each clip is
 * fetched and decoded once per AudioContext and cached, then played through the same destination
 * node every other sound effect uses, so muting and the master gain still apply uniformly.
 */

export type ClipId =
	| 'mine-explosion-1'
	| 'mine-explosion-2'
	| 'patriot-launch-1'
	| 'patriot-launch-2'
	| 'shahed-impact-1'
	| 'shahed-impact-2'
	| 'slava-ukraini'
	| 'fart'
	| 'fake-news'
	| 'welcome-to-ukraine'
	| 'putin-laugh'
	| 'drone-fpv';

const DIRECTORY = '/assets/sounds';

const CLIP_FILES: Record<ClipId, string> = {
	'mine-explosion-1': 'mine-explosion-1.wav',
	'mine-explosion-2': 'mine-explosion-2.wav',
	'patriot-launch-1': 'patriot-launch-1.wav',
	'patriot-launch-2': 'patriot-launch-2.wav',
	'shahed-impact-1': 'shahed-impact-1.wav',
	'shahed-impact-2': 'shahed-impact-2.wav',
	'slava-ukraini': 'slava-ukraini.wav',
	fart: 'fart.wav',
	'fake-news': 'fake-news.wav',
	'welcome-to-ukraine': 'welcome-to-ukraine.mp3',
	'putin-laugh': 'putin-laugh.mp3',
	'drone-fpv': 'drone-fpv.mp3'
};

const buffers = new Map<AudioContext, Map<ClipId, Promise<AudioBuffer>>>();

/** Every recorded clip, in the order the preloader fetches them */
export const CLIP_IDS = Object.keys(CLIP_FILES) as ClipId[];

/**
 * The clips that are a voice line rather than a sound effect. These are the ones worth fetching
 * ahead of time: they land at a scripted moment and a late start ruins the joke, while an
 * explosion can be a few milliseconds late without anyone noticing.
 */
export const VOICE_CLIPS: readonly ClipId[] = [
	'slava-ukraini',
	'fake-news',
	'welcome-to-ukraine',
	'putin-laugh'
];

/** Where a clip is served from; the preloader and the player use the same URLs so the cache hits */
export function clipUrl(id: ClipId): string {
	return `${DIRECTORY}/${CLIP_FILES[id]}`;
}

/**
 * Rough seconds left, given the bytes fetched so far and how long that took. Null while nothing
 * has arrived or everything is in, so the caller can show an honest "about N s" or nothing.
 */
export function estimateSecondsLeft(
	loaded: number,
	total: number,
	elapsedSeconds: number
): number | null {
	if (!(loaded > 0) || !(total > loaded) || !(elapsedSeconds > 0)) return null;
	const rate = loaded / elapsedSeconds;
	if (!(rate > 0)) return null;
	return Math.min(599, Math.ceil((total - loaded) / rate));
}

export interface ClipPreloadProgress {
	loaded: number;
	total: number;
	files: number;
	done: number;
}

/**
 * Fetches every recorded clip into the HTTP cache before a game asks for one, reporting bytes as
 * they arrive so the start screen can show a progress line and an honest ETA. Best-effort: a
 * failed clip is simply fetched again when it is played.
 */
export async function preloadClips(
	onProgress?: (progress: ClipPreloadProgress) => void
): Promise<void> {
	let loaded = 0;
	let total = 0;
	let done = 0;
	const report = () => onProgress?.({ loaded, total, files: VOICE_CLIPS.length, done });

	await Promise.all(
		VOICE_CLIPS.map(async (id) => {
			try {
				const response = await fetch(clipUrl(id));
				const announced = Number(response.headers.get('content-length'));
				const size = Number.isFinite(announced) && announced > 0 ? announced : 0;
				total += size;
				report();
				if (response.body) {
					const reader = response.body.getReader();
					for (;;) {
						const { done: finished, value } = await reader.read();
						if (finished) break;
						loaded += value.byteLength;
						report();
					}
				} else {
					const data = await response.arrayBuffer();
					if (!size) total += data.byteLength;
					loaded += data.byteLength;
				}
			} catch {
				// Best-effort, same as playback: a clip that cannot be preloaded is fetched on demand
			}
			done += 1;
			report();
		})
	);
}

/** Decodes the voice lines into this context ahead of time; call it after the first user gesture */
export function warmClips(ctx: AudioContext): void {
	for (const id of VOICE_CLIPS) void loadClip(ctx, id).catch(() => {});
}

function loadClip(ctx: AudioContext, id: ClipId): Promise<AudioBuffer> {
	let perContext = buffers.get(ctx);
	if (!perContext) {
		perContext = new Map();
		buffers.set(ctx, perContext);
	}
	let promise = perContext.get(id);
	if (!promise) {
		promise = fetch(clipUrl(id))
			.then((response) => response.arrayBuffer())
			.then((data) => ctx.decodeAudioData(data));
		perContext.set(id, promise);
	}
	return promise;
}

/**
 * Plays a recorded clip; a fetch/decode failure is swallowed, same as a synthesized glitch. With
 * fadeOut (seconds) the clip's last stretch fades to silence instead of ending abruptly. With
 * maxSeconds a longer recording is cut short there (the fade-out then applies to the cut).
 */
export function playClip(
	ctx: AudioContext,
	dest: AudioNode,
	id: ClipId,
	gain = 0.8,
	fadeOut = 0,
	maxSeconds = Infinity
): void {
	loadClip(ctx, id)
		.then((buffer) => {
			const source = ctx.createBufferSource();
			source.buffer = buffer;
			const envelope = ctx.createGain();
			envelope.gain.value = gain;
			const length = Math.min(buffer.duration, maxSeconds);
			if (fadeOut > 0) {
				const end = ctx.currentTime + length;
				const fade = Math.min(fadeOut, length);
				envelope.gain.setValueAtTime(gain, end - fade);
				envelope.gain.linearRampToValueAtTime(0, end);
			}
			source.connect(envelope).connect(dest);
			source.start(0, 0, length);
		})
		.catch(() => {
			// Best-effort: a missing or undecodable clip should never break gameplay
		});
}

/**
 * Plays just a stretch of a longer recording, fading in and out so the cut points don't click. The
 * start is picked at random within `startRange` (seconds into the clip), so repeats differ.
 */
export function playClipSlice(
	ctx: AudioContext,
	dest: AudioNode,
	id: ClipId,
	startRange: readonly [number, number],
	length: number,
	gain: number
): void {
	loadClip(ctx, id)
		.then((buffer) => {
			const [from, to] = startRange;
			const offset = Math.min(
				from + Math.random() * (to - from),
				Math.max(0, buffer.duration - length)
			);
			const fade = Math.min(0.08, length / 3);
			const now = ctx.currentTime;
			const source = ctx.createBufferSource();
			source.buffer = buffer;
			const envelope = ctx.createGain();
			envelope.gain.setValueAtTime(0, now);
			envelope.gain.linearRampToValueAtTime(gain, now + fade);
			envelope.gain.setValueAtTime(gain, now + length - fade);
			envelope.gain.linearRampToValueAtTime(0, now + length);
			source.connect(envelope).connect(dest);
			source.start(0, offset, length);
		})
		.catch(() => {
			// Best-effort: a missing or undecodable clip should never break gameplay
		});
}

/** Plays one of several variants of the same clip at random, so repeats don't sound identical */
export function playRandomClip(
	ctx: AudioContext,
	dest: AudioNode,
	ids: readonly ClipId[],
	gain = 0.8
): void {
	playClip(ctx, dest, ids[Math.floor(Math.random() * ids.length)], gain);
}
