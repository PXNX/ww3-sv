import { describe, expect, it } from 'vitest';
import {
	TelegramCallError,
	endpointCode,
	fromApiReply,
	inviteShareUrl,
	isTelegramLaunch,
	parseMe,
	startRoute,
	telegramAppLink,
	toCallError,
	toLaunchUser
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

	it('carry the code an endpoint refused with', () => {
		const refused = toCallError({
			type: 'ENDPOINT_ERROR',
			message: 'Consent to immediate delivery is required',
			parameters: { code: 'CONSENT_REQUIRED' }
		});
		expect(endpointCode(refused)).toBe('CONSENT_REQUIRED');
		expect(endpointCode(toCallError({ type: 'ENDPOINT_ERROR' }))).toBeNull();
		expect(endpointCode(toCallError({ type: 'UNAUTHORIZED', parameters: { code: 'X' } }))).toBe(
			null
		);
		expect(endpointCode(new Error('network'))).toBeNull();
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
			user: { id: USER.id, username: 'vlad', firstName: 'Vlad', photoUrl: null },
			revives: 3,
			pro: false,
			proUntil: null,
			consented: true,
			consent: null,
			catalogue: [REVIVE],
			invite: null
		});
		expect(
			parseMe({ ...body, user: { id: 1, first_name: 'A', username: null } })?.user.username
		).toBeNull();
		expect(parseMe({ ...body, pro: true, pro_until: '2026-11-27T00:00:00Z' })?.proUntil).toBe(
			'2026-11-27T00:00:00Z'
		);
	});

	it('reads the consent wording and keeps only https links', () => {
		const consent = {
			version: '2026-10-27',
			text: 'Ich stimme ausdrücklich zu …',
			terms: 'https://app1.tgcloud.ai/legal/agb.html',
			withdrawal: 'javascript:alert(1)'
		};
		expect(parseMe({ ...body, consented: false, consent })?.consent).toEqual({
			...consent,
			withdrawal: ''
		});
		expect(parseMe({ ...body, consent: { version: '1', text: '' } })?.consent).toBeNull();
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

describe('a startapp link', () => {
	it('opens the profile or the shop and nothing else', () => {
		expect(startRoute('profile')).toBe('/profile');
		expect(startRoute('shop')).toBe('/shop');
		expect(startRoute('toString')).toBeNull();
		expect(startRoute('../admin')).toBeNull();
		expect(startRoute(null)).toBeNull();
	});
});

describe('opening the game in Telegram', () => {
	it('links to the bot with a start parameter', () => {
		expect(telegramAppLink()).toBe('https://t.me/game_ww3_bot');
		expect(telegramAppLink('profile')).toBe('https://t.me/game_ww3_bot?startapp=profile');
	});
});

describe('the account the Mini App was opened with', () => {
	it('takes name, username and photo from the launch', () => {
		expect(toLaunchUser({ ...USER, photo_url: 'https://t.me/i/userpic/320/vlad.jpg' })).toEqual({
			id: USER.id,
			username: 'vlad',
			firstName: 'Vlad',
			photoUrl: 'https://t.me/i/userpic/320/vlad.jpg'
		});
	});

	it('drops a photo that is not https and refuses a launch without an id', () => {
		expect(
			toLaunchUser({ id: 1, first_name: 'A', photo_url: 'javascript:alert(1)' })?.photoUrl
		).toBeNull();
		expect(toLaunchUser({ first_name: 'A' })).toBeNull();
		expect(toLaunchUser(null)).toBeNull();
	});
});

describe("the bot's own server", () => {
	it('unwraps a successful answer', () => {
		expect(fromApiReply(200, { ok: true, result: { a: 1 } })).toEqual({ a: 1 });
	});

	it('reports refusals like the Serverless bridge', () => {
		const refused = () =>
			fromApiReply(400, { ok: false, description: 'No', parameters: { code: 'NO_REVIVES' } });
		expect(refused).toThrow(TelegramCallError);
		try {
			refused();
		} catch (error) {
			expect(endpointCode(error)).toBe('NO_REVIVES');
		}
		expect(() => fromApiReply(401, { ok: false })).toThrow(
			expect.objectContaining({ type: 'UNAUTHORIZED' })
		);
		expect(() => fromApiReply(502, null)).toThrow(expect.objectContaining({ type: 'UNKNOWN' }));
	});
});

describe('the invite link', () => {
	const ME = {
		user: USER,
		wallet: { revives: 0 },
		pro: false,
		pro_until: null,
		invite: {
			link: 'https://t.me/game_ww3_bot?start=r5',
			friends: 2,
			cap: 10,
			revives_per_friend: 1
		}
	};

	it('comes with me', () => {
		expect(parseMe(ME)?.invite).toEqual({
			link: 'https://t.me/game_ww3_bot?start=r5',
			friends: 2,
			cap: 10,
			revivesPerFriend: 1
		});
	});

	it('is dropped when it does not lead to Telegram', () => {
		const elsewhere = { ...ME, invite: { ...ME.invite, link: 'https://evil.test/?start=r5' } };
		expect(parseMe(elsewhere)?.invite).toBeNull();
		expect(parseMe({ ...ME, invite: undefined })?.invite).toBeNull();
	});

	it('is shared through the Telegram share sheet', () => {
		const invite = parseMe(ME)!.invite!;
		expect(inviteShareUrl(invite, 'Play with me')).toBe(
			'https://t.me/share/url?url=https%3A%2F%2Ft.me%2Fgame_ww3_bot%3Fstart%3Dr5&text=Play%20with%20me'
		);
	});
});
