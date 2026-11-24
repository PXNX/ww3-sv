import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The mock is opt-in (?telegram=mock, remembered for the session like ?squad=dev) and must never
// touch the network: fetch is replaced with something that fails loudly.
const SESSION = 'a'.repeat(32);

function mockWindow(search: string) {
	vi.stubGlobal('window', { location: { hash: '', search } });
	vi.stubGlobal(
		'fetch',
		vi.fn(() => Promise.reject(new Error('mock must not fetch')))
	);
}

describe('useMockTelegram', () => {
	beforeEach(() => {
		vi.resetModules();
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('is off without the flag and on with it', async () => {
		mockWindow('');
		const { useMockTelegram } = await import('./telegramMock.js');
		expect(useMockTelegram()).toBe(false);

		mockWindow('?telegram=mock');
		expect(useMockTelegram()).toBe(true);
	});

	it('stays on for the session after the URL parameter is gone', async () => {
		const sessionStorage = new Map<string, string>();
		vi.stubGlobal('window', { location: { hash: '', search: '?telegram=mock' } });
		vi.stubGlobal('sessionStorage', {
			getItem: (key: string) => sessionStorage.get(key) ?? null,
			setItem: (key: string, value: string) => void sessionStorage.set(key, value),
			removeItem: (key: string) => void sessionStorage.delete(key)
		});
		const { useMockTelegram } = await import('./telegramMock.js');
		expect(useMockTelegram()).toBe(true);

		vi.stubGlobal('window', { location: { hash: '', search: '' } });
		expect(useMockTelegram()).toBe(true);
	});
});

describe('the mock Telegram login', () => {
	beforeEach(() => {
		vi.resetModules();
		mockWindow('?telegram=mock');
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('loads a WebApp that carries the made-up player', async () => {
		const { loadTelegram } = await import('./telegram.js');
		const app = await loadTelegram();
		expect(app?.initData).toContain('user=');
		expect(app?.initDataUnsafe?.user).toMatchObject({ id: 1337, first_name: 'Mock' });
	});

	it('answers me with an account parseMe accepts', async () => {
		const { call, parseMe } = await import('./telegram.js');
		const me = parseMe(await call('me'));
		expect(me?.user.firstName).toBe('Mock');
		expect(me?.revives).toBe(3);
		expect(me?.catalogue).toHaveLength(7);
		expect(me?.invite?.link).toContain('https://t.me/');
	});

	it('books an invoice and shows it in the wallet', async () => {
		const { call, endpointCode, parseMe } = await import('./telegram.js');
		const refused = await call('invoice', { sku: 'revive_1' }).catch((caught: unknown) => caught);
		expect(endpointCode(refused)).toBe('CONSENT_REQUIRED');

		const invoice = await call<{ url: string }>('invoice', { sku: 'revive_1', consent: true });
		expect(invoice.url).toContain('revive_1');
		expect(parseMe(await call('me'))?.revives).toBe(4);
	});

	it('sells a look once and lists it as owned', async () => {
		const { call, endpointCode, parseMe } = await import('./telegram.js');
		await call('invoice', { sku: 'look_tinfoil', consent: true });
		const me = parseMe(await call('me'));
		expect(me?.owned).toEqual(['look_tinfoil']);
		expect(me?.catalogue.find((item) => item.sku === 'look_tinfoil')?.look).toEqual({
			part: 'hat',
			value: 'tinfoil'
		});
		const again = await call('invoice', { sku: 'look_tinfoil' }).catch((caught: unknown) => caught);
		expect(endpointCode(again)).toBe('ALREADY_OWNED');
	});

	it('spends revivals until the wallet is empty, then refuses', async () => {
		const { call, endpointCode } = await import('./telegram.js');
		for (let revives = 3; revives > 0; revives -= 1) {
			const wallet = await call<{ wallet: { revives: number } }>('spend', { mode: 'blocks' });
			expect(wallet.wallet.revives).toBe(revives - 1);
		}
		const refused = await call('spend', { mode: 'blocks' }).catch((caught: unknown) => caught);
		expect(endpointCode(refused)).toBe('NO_REVIVES');
	});

	it('accepts the streak report and the write-access dialog', async () => {
		const { call, requestWriteAccess } = await import('./telegram.js');
		await expect(call('streak', { streak: 4, expires_at: null })).resolves.toEqual({});
		await expect(requestWriteAccess()).resolves.toBe(true);
	});

	it('ranks a group run on the chat board with the rival it overtook', async () => {
		const { postGroupScore } = await import('./telegram.js');
		const result = await postGroupScore({ mode: 'blocks', session: SESSION }, 95);
		expect(result.rows.map((row) => row.name)).toEqual(['Anna', 'Mock', 'Boris', 'Chen']);
		expect(result.rows[1]).toMatchObject({ me: true, score: 95, position: 2 });
		expect(result.overtaken).toEqual({ name: 'Boris', score: 90 });
	});

	it('closes the invoice as paid', async () => {
		const { openInvoice } = await import('./telegram.js');
		await expect(openInvoice('https://mock.example/invoice/revive_1')).resolves.toBe('paid');
	});

	it('verifies the account through the store, wallet and all', async () => {
		const { telegram } = await import('../stores/telegram.svelte.ts');
		const account = telegram();
		await account.start();
		expect(account.status).toBe('verified');
		expect(account.user?.firstName).toBe('Mock');
		expect(account.wallet.revives).toBe(3);

		expect(await account.buy('revive_1')).toBe('consent');
		expect(await account.buy('revive_1', true)).toBe('done');
		expect(account.wallet.revives).toBe(4);
		expect(await account.spendRevive('blocks')).toBe(true);
		expect(account.wallet.revives).toBe(3);
	});
});
