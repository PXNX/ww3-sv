/*
 * Gift codes, redeemed in the supply depot. A code gives revival tokens or Fake News, the two things
 * the depot deals in, and can be redeemed once per device. There is no server behind the list, so
 * it keeps honest players honest and nothing more: the codes are in the app, and the redeemed ones
 * are remembered in local storage.
 */

export type GiftReward = 'revive' | 'coins';

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
	{ code: 'OILBOOM', reward: 'coins', value: 100 }
];

/** A code as typed: spaces and dashes do not matter, nor does the case */
export function normalizeCode(input: string): string {
	return input.replace(/[\s-]+/g, '').toUpperCase();
}

export function findGift(input: string): GiftCode | undefined {
	const code = normalizeCode(input);
	return code === '' ? undefined : GIFT_CODES.find((gift) => gift.code === code);
}
