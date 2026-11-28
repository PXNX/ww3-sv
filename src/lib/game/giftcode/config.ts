/*
 * Gift codes, redeemed in the supply depot. A code gives revival tokens or Fake News, the two things
 * the depot deals in, and can be redeemed once per device. There is no server behind the list, so
 * it keeps honest players honest and nothing more: the codes are in the app, and the redeemed ones
 * are remembered in local storage.
 */

export type GiftReward = 'revive' | 'coins' | 'pro';

export interface GiftCode {
	/** Upper case, no spaces */
	code: string;
	reward: GiftReward;
	/** Revival tokens or Fake News */
	value: number;
	/** Timestamp in milliseconds after which the code no longer works */
	expiresAt?: number;
}

export const GIFT_CODES: readonly GiftCode[] = [
	{ code: 'WW3GIFT', reward: 'revive', value: 1 },
	{ code: 'OILBOOM', reward: 'coins', value: 100 },
	// Also an account code: inside Telegram the bot credits it once per account (ACCOUNT_GIFT_CODES)
	{ code: 'MN5', reward: 'revive', value: 5 },
	// Telegram-only: the bot grants Pro for six calendar months once per account
	{ code: 'PRO6M', reward: 'pro', value: 6 }
];

/**
 * Codes the bot redeems once per Telegram account, as `t.me/<bot>?start=MN5`, as a Mini App link
 * `?startapp=MN5` or typed in the depot. Outside Telegram they work like the codes above.
 */
export const ACCOUNT_GIFT_CODES: readonly string[] = ['MN5', 'PRO6M'];

/** The account code in a start parameter or typed text (`MN5`, `gift_MN5`, `mn-5`), else null */
export function accountGiftCode(input: string | null | undefined): string | null {
	if (!input) return null;
	const code = normalizeCode(input).replace(/^GIFT_/, '');
	return ACCOUNT_GIFT_CODES.includes(code) ? code : null;
}

/** A code as typed: spaces and dashes do not matter, nor does the case */
export function normalizeCode(input: string): string {
	return input.replace(/[\s-]+/g, '').toUpperCase();
}

export function findGift(input: string): GiftCode | undefined {
	const code = normalizeCode(input);
	return code === '' ? undefined : GIFT_CODES.find((gift) => gift.code === code);
}
