import { describe, expect, it } from 'vitest';
import {
	TelegramCallError,
	isTelegramLaunch,
	parseMe,
	telegramAppLink,
	toCallError
} from './telegram';

const USER = { id: 279058397, first_name: 'Vlad', username: 'vlad' };
const INIT_DATA = new URLSearchParams({
	user: JSON.stringify(USER),
	auth_date: '1662771648',
	hash: 'c501b71e775f74ce10e377dea85a7ea24ecd640b223ea86dfe453e0eaed2e2b2'
}).toString();

describe('a Telegram Mini App launch', () => {
	it('is recognised by the launch parameters in the hash', () => {
		const hash = `#tgWebAppData=${encodeURIComponent(INIT_DATA)}&tgWebAppVersion=8.0`;
		expect(isTelegramLaunch(hash)).toBe(true);
		expect(isTelegramLaunch(hash.slice(1))).toBe(true);
	});

	it('is not a normal browser visit', () => {
		expect(isTelegramLaunch('')).toBe(false);
		expect(isTelegramLaunch('#top')).toBe(false);
		expect(isTelegramLaunch('#tgWebAppData=')).toBe(false);
	});
});

describe('endpoint errors', () => {
	it('keep the platform error types and fold the rest into UNKNOWN', () => {
		expect(toCallError({ type: 'UNAUTHORIZED' }).type).toBe('UNAUTHORIZED');
		expect(toCallError({ type: 'ENDPOINT_ERROR', message: 'no such sku' })).toMatchObject({
			type: 'ENDPOINT_ERROR',
			message: 'no such sku'
		});
		expect(toCallError(new Error('network')).type).toBe('UNKNOWN');
		expect(toCallError('weird').type).toBe('UNKNOWN');
		const own = new TelegramCallError('UNAVAILABLE');
		expect(toCallError(own)).toBe(own);
	});
});

describe('the me endpoint', () => {
	const REVIVE = { sku: 'revive_1', title: 'Revival', stars: 25, revives: 1, subscription: false };
	const body = {
		user: USER,
		wallet: { revives: 3 },
		pro_until: null,
		pro: false,
		consented: true,
		catalogue: [REVIVE]
	};

	it('accepts the documented shape', () => {
		expect(parseMe(body)).toEqual({
			user: { id: USER.id, username: 'vlad', firstName: 'Vlad' },
			revives: 3,
			pro: false,
			proUntil: null,
			consented: true,
			catalogue: [REVIVE]
		});
		expect(
			parseMe({ ...body, user: { id: 1, first_name: 'A', username: null } })?.user.username
		).toBeNull();
		expect(parseMe({ ...body, pro: true, pro_until: '2026-11-27T00:00:00Z' })?.proUntil).toBe(
			'2026-11-27T00:00:00Z'
		);
	});

	it('treats a missing consent or catalogue as none', () => {
		const bare = { user: USER, wallet: { revives: 0 }, pro_until: null, pro: false };
		expect(parseMe(bare)).toMatchObject({ consented: false, catalogue: [] });
	});

	it('rejects anything else', () => {
		expect(parseMe({ ...body, catalogue: [{ ...REVIVE, stars: 0 }] })).toBeNull();
		expect(parseMe({ ...body, catalogue: [{ ...REVIVE, sku: '' }] })).toBeNull();
		expect(parseMe({ ...body, catalogue: 'all' })).toBeNull();
		expect(parseMe({ ...body, consented: 'yes' })).toBeNull();
		expect(parseMe(null)).toBeNull();
		expect(parseMe({ ...body, wallet: { revives: -1 } })).toBeNull();
		expect(parseMe({ ...body, wallet: { revives: 1.5 } })).toBeNull();
		expect(parseMe({ ...body, user: { id: 1 } })).toBeNull();
		expect(parseMe({ ...body, user: { id: '1', first_name: 'A' } })).toBeNull();
		expect(parseMe({ ...body, pro: 'yes' })).toBeNull();
		expect(parseMe({ ...body, pro_until: 5 })).toBeNull();
	});
});

describe('opening the game in Telegram', () => {
	it('links to the bot with a start parameter', () => {
		expect(telegramAppLink()).toBe('https://t.me/game_ww3_bot');
		expect(telegramAppLink('profile')).toBe('https://t.me/game_ww3_bot?startapp=profile');
	});
});
