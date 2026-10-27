/*
 * Progress of the one-off prefetch of the recorded voice clips. The files are fetched as soon as
 * sound is on, so a first line is not lost while its file downloads; the store keeps enough
 * numbers for a small progress line with an honest ETA on the start screen.
 */
import { estimateSecondsLeft, preloadClips } from './clips.js';

type PreloadState = 'idle' | 'loading' | 'ready';

class ClipPreload {
	state = $state<PreloadState>('idle');
	loaded = $state(0);
	total = $state(0);
	/** Seconds left, or null while there is nothing to estimate from */
	eta = $state<number | null>(null);

	#started = false;
	#startedAt = 0;

	get percent(): number {
		return this.total > 0 ? Math.min(100, Math.round((this.loaded / this.total) * 100)) : 0;
	}

	/** Starts once per page load; muted users start it when they turn sound on instead */
	start(): void {
		if (this.#started || typeof window === 'undefined') return;
		this.#started = true;
		this.state = 'loading';
		this.#startedAt = performance.now();
		void preloadClips(({ loaded, total }) => {
			this.loaded = loaded;
			this.total = total;
			this.eta = estimateSecondsLeft(loaded, total, (performance.now() - this.#startedAt) / 1000);
		}).finally(() => {
			this.state = 'ready';
			this.eta = null;
		});
	}
}

let shared: ClipPreload | undefined;

/** The app-wide voice-clip preloader (created on first use) */
export function clipPreload(): ClipPreload {
	shared ??= new ClipPreload();
	return shared;
}
