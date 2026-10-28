/*
 * How the app looks: light, dark, or following the device. The choice is remembered on this device.
 * The boot script in app.html applies it before the first paint, and the layout keeps
 * <html data-theme> in step while the app runs, including a device switch while on "auto".
 */
import { localStore } from '#lib/services/storage.js';

export type ThemeChoice = 'auto' | 'light' | 'dark';

export const THEME_CHOICES: readonly ThemeChoice[] = ['auto', 'light', 'dark'];

const SETTINGS_KEY = 'appearance:theme';

const isChoice = (value: unknown): value is ThemeChoice =>
	THEME_CHOICES.includes(value as ThemeChoice);

class Appearance {
	choice = $state<ThemeChoice>('auto');
	/** The device's own preference, followed while the choice is "auto" */
	deviceDark = $state(false);

	#media: MediaQueryList | null = null;

	constructor() {
		this.choice = localStore().read(SETTINGS_KEY, 'auto', isChoice);
		if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
		this.#media = window.matchMedia('(prefers-color-scheme: dark)');
		this.deviceDark = this.#media.matches;
		this.#media.addEventListener('change', this.#onDeviceChange);
	}

	/** True while the dark palette should be used */
	get dark(): boolean {
		return this.choice === 'dark' || (this.choice === 'auto' && this.deviceDark);
	}

	set(choice: ThemeChoice) {
		this.choice = choice;
		localStore().write(SETTINGS_KEY, choice);
	}

	#onDeviceChange = (event: MediaQueryListEvent) => {
		this.deviceDark = event.matches;
	};
}

let shared: Appearance | undefined;

/** The app-wide theme choice (created on first use) */
export function appearance(): Appearance {
	shared ??= new Appearance();
	return shared;
}
