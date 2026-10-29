import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Telegram's script always puts a Serverless bridge on the WebApp object, and that bridge only posts
// to /api/<name> on the page's own origin. These tests pin down which one the game really uses.
const INIT_DATA = 'user=%7B%22id%22%3A1%7D&hash=abc';

function fakeTelegram() {
	const serverlessCalls: string[] = [];
	vi.stubGlobal('window', {
		location: { hash: '' },
		Telegram: {
			WebApp: {
				initData: INIT_DATA,
				Serverless: {
					call: (
						name: string,
						_input: unknown,
						callback: (error: unknown, result: unknown) => void
					) => {
						serverlessCalls.push(name);
						callback(null, { via: 'serverless' });
					}
				}
			}
		}
	});
	return serverlessCalls;
}

describe('call', () => {
	beforeEach(() => {
		vi.resetModules();
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		vi.unstubAllEnvs();
	});

	it('uses the bot server when one is configured, never the Serverless bridge', async () => {
		vi.stubEnv('VITE_TELEGRAM_API_URL', 'https://bot.example/');
		const serverlessCalls = fakeTelegram();
		const fetchMock = vi.fn(async () =>
			Response.json({ ok: true, result: { via: 'server' } }, { status: 200 })
		);
		vi.stubGlobal('fetch', fetchMock);
		const { call } = await import('./telegram.js');

		await expect(call('me', { a: 1 })).resolves.toEqual({ via: 'server' });
		expect(serverlessCalls).toEqual([]);
		expect(fetchMock).toHaveBeenCalledTimes(1);
		const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
		expect(url).toBe('https://bot.example/api/me');
		expect((init.headers as Record<string, string>)['x-telegram-init-data']).toBe(INIT_DATA);
		expect(init.body).toBe(JSON.stringify({ a: 1 }));
	});

	it('uses the Serverless bridge when no bot server is configured', async () => {
		vi.stubEnv('VITE_TELEGRAM_API_URL', '');
		const serverlessCalls = fakeTelegram();
		vi.stubGlobal('fetch', vi.fn());
		const { call } = await import('./telegram.js');

		await expect(call('me')).resolves.toEqual({ via: 'serverless' });
		expect(serverlessCalls).toEqual(['me']);
	});

	it('reports an unauthorized account as such, not as an unreachable server', async () => {
		vi.stubEnv('VITE_TELEGRAM_API_URL', 'https://bot.example');
		fakeTelegram();
		vi.stubGlobal(
			'fetch',
			vi.fn(async () =>
				Response.json(
					{ ok: false, type: 'UNAUTHORIZED', description: 'Invalid init data' },
					{ status: 401 }
				)
			)
		);
		const { call, TelegramCallError } = await import('./telegram.js');

		const error = await call('me').catch((caught: unknown) => caught);
		expect(error).toBeInstanceOf(TelegramCallError);
		expect((error as InstanceType<typeof TelegramCallError>).type).toBe('UNAUTHORIZED');
	});

	it('cannot be called without initData', async () => {
		vi.stubEnv('VITE_TELEGRAM_API_URL', 'https://bot.example');
		vi.stubGlobal('window', { location: { hash: '' }, Telegram: { WebApp: {} } });
		const { call } = await import('./telegram.js');

		await expect(call('me')).rejects.toMatchObject({ type: 'UNAVAILABLE' });
	});
});
