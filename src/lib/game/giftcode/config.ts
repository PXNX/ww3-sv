/* Universal giftcode system: admin-managed codes, once-per-user, date/limit caps */
export interface GiftCode {
	code: string;
	reward: 'revive' | 'barrels' | 'item';
	value: number;
	maxUses: number;
	used: number;
	expiresAt?: number; // timestamp ms
}

export const GIFT_CODES: GiftCode[] = [
	{ code: 'WW3GIFT', reward: 'revive', value: 1, maxUses: 100, used: 0 },
	{
		code: 'OILBOOM',
		reward: 'barrels',
		value: 1_000_000,
		maxUses: 50,
		used: 0,
		expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000
	}
];

export function isValid(code: string): boolean {
	const c = GIFT_CODES.find((g) => g.code === code.toUpperCase());
	if (!c) return false;
	if (c.expiresAt && Date.now() > c.expiresAt) return false;
	if (c.used >= c.maxUses) return false;
	return true;
}
