import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// A downward swipe in a game must not close the Mini App on Android, so the launch turns the
// swipe-to-close gesture off and opens the app to full height.
function fakeApp(version = '9.0', overrides: Record<string, unknown> = {}) {
	const calls: string[] = [];
	const app = {
		initData: 'user=1&hash=abc',
		ready: () => calls.push('ready'),
		expand: () => calls.push('expand'),
		disableVerticalSwipes: () => calls.push('disableVerticalSwipes'),
		isVersionAtLeast: (wanted: string) => Number(wanted) <= Number(version),
		...overrides
	};
	vi.stubGlobal('window', { location: { hash: '' }, Telegram: { WebApp: app } });
	return calls;
}

describe('Mini App launch', () => {
	beforeEach(() => {
		vi.resetModules();
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('opens to full height and turns off the swipe that closes the app', async () => {
		const calls = fakeApp();
		const { loadTelegram } = await import('./telegram.js');
		await loadTelegram();
		await loadTelegram();
		expect(calls).toEqual(['ready', 'expand', 'disableVerticalSwipes']);
	});

	it('leaves the swipe setting alone on a client that does not know it', async () => {
		const calls = fakeApp('6.9');
		const { loadTelegram } = await import('./telegram.js');
		await loadTelegram();
		expect(calls).toEqual(['ready', 'expand']);
	});

	it('still starts when the client refuses a call', async () => {
		fakeApp('9.0', {
			expand: () => {
				throw new Error('unsupported');
			}
		});
		const { loadTelegram } = await import('./telegram.js');
		await expect(loadTelegram()).resolves.toMatchObject({ initData: 'user=1&hash=abc' });
	});
});
