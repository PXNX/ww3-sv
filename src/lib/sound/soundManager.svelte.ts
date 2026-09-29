/*
 * Global sound effects switch: lazily creates a single AudioContext (browsers require a user
 * gesture before audio can start, and every call to play() is itself triggered by one), routes
 * every sound through one master gain so muting is instant and click-free, and remembers the
 * player's mute preference the same way shootdown/pipeline remember their settings.
 */
import { localStore } from '$lib/services/storage';
import { SOUNDS, type SoundId } from './sounds';

const SETTINGS_KEY = 'sound:settings';

interface SoundSettings {
	muted: boolean;
}

const isSettings = (value: unknown): value is SoundSettings =>
	typeof value === 'object' &&
	value !== null &&
	typeof (value as SoundSettings).muted === 'boolean';

class SoundManager {
	muted = $state(false);

	#ctx: AudioContext | null = null;
	#master: GainNode | null = null;

	constructor() {
		this.muted = localStore().read(SETTINGS_KEY, { muted: false }, isSettings).muted;
	}

	/**
	 * Plays a sound effect; silently does nothing when muted or when audio is unavailable. The
	 * optional intensity (0 to 1) lets sounds such as impacts scale with how hard something was.
	 */
	play(id: SoundId, intensity = 1) {
		if (this.muted) return;
		const context = this.#ensureContext();
		if (!context) return;
		try {
			SOUNDS[id](context, this.#master!, Math.min(1, Math.max(0, intensity)));
		} catch {
			// Best-effort: a sound glitch should never break gameplay
		}
	}

	setMuted(muted: boolean) {
		this.muted = muted;
		localStore().write(SETTINGS_KEY, { muted } satisfies SoundSettings);
	}

	toggleMuted() {
		this.setMuted(!this.muted);
	}

	#ensureContext(): AudioContext | null {
		if (typeof window === 'undefined') return null;
		const AudioContextClass =
			window.AudioContext ??
			(window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
		if (!AudioContextClass) return null;
		if (!this.#ctx) {
			this.#ctx = new AudioContextClass();
			this.#master = this.#ctx.createGain();
			this.#master.gain.value = 0.5;
			this.#master.connect(this.#ctx.destination);
		}
		if (this.#ctx.state === 'suspended') void this.#ctx.resume();
		return this.#ctx;
	}
}

let shared: SoundManager | undefined;

/** The app-wide sound manager (created on first use) */
export function soundManager(): SoundManager {
	shared ??= new SoundManager();
	return shared;
}
