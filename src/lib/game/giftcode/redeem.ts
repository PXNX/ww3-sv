/* Redeeming a gift code against a career profile: pure, so the rules can be tested. */
import type { CareerProfile } from '#lib/game/career/profile.js';
import { findGift, normalizeCode, type GiftCode } from './config.js';

export type RedeemResult =
	| { status: 'ok'; gift: GiftCode; profile: CareerProfile }
	| { status: 'unknown' | 'used' | 'expired' | 'telegram-only' };

/**
 * Checks a typed code and pays its reward. `redeemed` lists the codes this device used before; the
 * caller stores the new one when the status is `ok`.
 */
export function redeemGift(
	profile: CareerProfile,
	redeemed: readonly string[],
	input: string,
	now: number = Date.now()
): RedeemResult {
	const gift = findGift(input);
	if (!gift) return { status: 'unknown' };
	if (redeemed.map(normalizeCode).includes(gift.code)) return { status: 'used' };
	if (gift.expiresAt !== undefined && now > gift.expiresAt) return { status: 'expired' };
	// Pro lives in the bot's account ledger, so a browser has nothing to credit locally
	if (gift.reward === 'pro') return { status: 'telegram-only' };
	const paid: CareerProfile =
		gift.reward === 'revive'
			? { ...profile, revives: profile.revives + gift.value }
			: { ...profile, coins: profile.coins + gift.value };
	return { status: 'ok', gift, profile: paid };
}
