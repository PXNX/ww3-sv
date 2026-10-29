/* Multi-step Telegram bot giftcode + admin stats handler */
export type BotStep = 'idle' | 'stats' | 'giftcode_add' | 'giftcode_list';

export interface BotState {
	step: BotStep;
	pending?: { code?: string; reward?: string; value?: number };
}

export const ADMIN_COMMANDS = {
	stats: '/stats',
	giftcode: '/giftcode',
	redeem: '/redeem'
};

export function statsReply(): string {
	return 'Stats: tycoon users=42 plays=312 hs=1.2e15 | dome users=15 plays=89 hs=450 | dronewall users=7 plays=23';
}

export function giftcodeStep(state: BotState, input?: string): { reply: string; state: BotState; webAppUrl?: string } {
	switch (state.step) {
		case 'idle':
			return { reply: 'Send /stats, /giftcode or /redeem CODE.', state: { step: 'idle' } };
		case 'giftcode_add':
			if (!input) return { reply: 'Enter gift code (or LIST):', state };
			if (input === 'LIST') return { reply: 'Codes: WW3GIFT (revive), OILBOOM (barrels).', state: { step: 'idle' } };
			return { reply: `Added ${input.toUpperCase()}.`, state: { step: 'idle' } };
		default:
			if (input && input.toUpperCase() === 'REDEEM') {
				return { reply: 'Open webapp to redeem: https://example.com/redeem?code=', state: { step: 'idle' }, webAppUrl: 'https://example.com/redeem?code=' + (state.pending?.code || '') };
			}
			return { reply: 'Send /redeem <CODE> to get a redeem link.', state: { step: 'idle' } };
	}
}
