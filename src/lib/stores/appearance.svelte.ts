/*
 * How the app looks: light or dark. There are only these two choices; the first visit starts on
 * whatever the device itself is set to, and a pick in the settings is remembered on this device.
 * The boot script in app.html applies it before the first paint, and the layout keeps
 * <html data-theme> in step while the app runs.
 */
import { localStore } from '#lib/services/storage.js';

export type ThemeChoice = 'light' | 'dark';

export const THEME_CHOICES: readonly ThemeChoice[] = ['light', 'dark'];

const SETTINGS_KEY = 'appearance:theme';

const isChoice = (value: unknown): value is ThemeChoice =>
	THEME_CHOICES.includes(value as ThemeChoice);

/** What the device itself is set to; light when that cannot be asked */
function deviceChoice(): ThemeChoice {
	if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return 'light';
	return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

class Appearance {
	choice = $state<ThemeChoice>('light');

	constructor() {
		this.choice = localStore().read(SETTINGS_KEY, deviceChoice(), isChoice);
	}

	/** True while the dark palette should be used */
	get dark(): boolean {
		return this.choice === 'dark';
	}

	set(choice: ThemeChoice) {
		this.choice = choice;
		localStore().write(SETTINGS_KEY, choice);
	}
}

let shared: Appearance | undefined;

/** The app-wide theme choice (created on first use) */
export function appearance(): Appearance {
	shared ??= new Appearance();
	return shared;
}
