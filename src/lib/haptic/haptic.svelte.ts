/*
 * Haptic feedback manager: toggles vibration for in-game events, such as scoring and hitting enemies.
 * Matches the pattern of soundManager.svelte.ts with localStore persistence.
 */
import { localStore } from '#lib/services/storage.js';

const SETTINGS_KEY = 'haptic:settings';

interface HapticSettings {
	enabled: boolean;
}

const isSettings = (value: unknown): value is HapticSettings =>
	typeof value === 'object' &&
	value !== null &&
	typeof (value as HapticSettings).enabled === 'boolean';

class HapticManager {
	enabled = $state(false);

	constructor() {
		this.enabled = localStore().read(SETTINGS_KEY, { enabled: true }, isSettings).enabled;
	}

	/**
	 * Provides vibration feedback with the given intensity (0 to 1).
	 * Maps intensity to different vibration patterns:
	 * - 0: no vibration
	 * - 0-0.3: light tap (short vibration)
	 * - 0.3-0.7: medium feedback (longer vibration)
	 * - 0.7-1.0: strong feedback (longer vibration with pattern)
	 */
	play(intensity: number) {
		if (!this.enabled || typeof window === 'undefined' || typeof navigator.vibrate !== 'function') return;
		const duration = Math.round(intensity * 200); // Max 200ms at full intensity
		// Use patterns for stronger feedback to add variation
		if (intensity < 0.4) {
			navigator.vibrate(duration);
		} else if (intensity < 0.8) {
			navigator.vibrate([duration * 0.6, 100, duration * 0.4]);
		} else {
			navigator.vibrate([duration * 0.5, 150, duration * 0.5]);
		}
	}

	setEnabled(enabled: boolean) {
		this.enabled = enabled;
		localStore().write(SETTINGS_KEY, { enabled } satisfies HapticSettings);
	}

	toggle() {
		this.setEnabled(!this.enabled);
	}
}

let shared: HapticManager | undefined;

/** The app-wide haptic manager (created on first use) */
export function haptic(): HapticManager {
	shared ??= new HapticManager();
	return shared;
}