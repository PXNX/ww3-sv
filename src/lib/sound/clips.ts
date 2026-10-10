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
	| 'welcome-to-ukraine';

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
	'welcome-to-ukraine': 'welcome-to-ukraine.mp3'
};

const buffers = new Map<AudioContext, Map<ClipId, Promise<AudioBuffer>>>();

function loadClip(ctx: AudioContext, id: ClipId): Promise<AudioBuffer> {
	let perContext = buffers.get(ctx);
	if (!perContext) {
		perContext = new Map();
		buffers.set(ctx, perContext);
	}
	let promise = perContext.get(id);
	if (!promise) {
		promise = fetch(`${DIRECTORY}/${CLIP_FILES[id]}`)
			.then((response) => response.arrayBuffer())
			.then((data) => ctx.decodeAudioData(data));
		perContext.set(id, promise);
	}
	return promise;
}

/**
 * Plays a recorded clip; a fetch/decode failure is swallowed, same as a synthesized glitch. With
 * fadeOut (seconds) the clip's last stretch fades to silence instead of ending abruptly.
 */
export function playClip(
	ctx: AudioContext,
	dest: AudioNode,
	id: ClipId,
	gain = 0.8,
	fadeOut = 0
): void {
	loadClip(ctx, id)
		.then((buffer) => {
			const source = ctx.createBufferSource();
			source.buffer = buffer;
			const envelope = ctx.createGain();
			envelope.gain.value = gain;
			if (fadeOut > 0) {
				const end = ctx.currentTime + buffer.duration;
				const fade = Math.min(fadeOut, buffer.duration);
				envelope.gain.setValueAtTime(gain, end - fade);
				envelope.gain.linearRampToValueAtTime(0, end);
			}
			source.connect(envelope).connect(dest);
			source.start();
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
