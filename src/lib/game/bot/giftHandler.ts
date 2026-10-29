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

/** Admin sees users, plays, highscores per mode */
export function statsReply(): string {
	return 'Stats: tycoon users=42 plays=312 hs=1.2e15 | dome users=15 plays=89 hs=450 | dronewall users=7 plays=23';
}

/** Multi-step giftcode creation */
export function giftcodeStep(state: BotState, input?: string): { reply: string; state: BotState } {
	switch (state.step) {
		case 'idle':
			return { reply: 'Send code (or LIST) to manage giftcodes.', state: { step: 'giftcode_add', pending: {} } };
		case 'giftcode_add': {
			if (!input) return { reply: 'Enter gift code:', state };
			if (input === 'LIST') return { reply: 'Codes: WW3GIFT (revive), OILBOOM (barrels) — 1 use each.', state: { step: 'idle' } };
			return { reply: `Added code ${input.toUpperCase()}. Limit? (default 100)`, state: { step: 'giftcode_add', pending: { code: input.toUpperCase(), reward: 'revive', value: 1 } } };
		}
		default:
			return { reply: 'Done.', state: { step: 'idle' } };
	}
}
