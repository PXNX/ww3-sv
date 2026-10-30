/*
 * Every user-facing string of Gig Saboteur in one place, plain English for now, so that moving the
 * mode to paraglide later is a mechanical change. The job cards themselves live with their levels.
 */
import { PAYOUT, SABOTAGE_SECONDS, STRIKES } from './config.js';
import type { Theme } from './levels.js';
import type { Stars } from './scoring.js';

export const THEME_NAMES: Record<Theme, string> = {
	power: 'Power line',
	depot: 'Ammo depot',
	factory: 'Shell factory'
};

export const STAR_NAMES: Record<keyof Stars, { name: string; hint: string }> = {
	unseen: { name: 'Unseen', hint: 'Nobody got properly suspicious' },
	quick: { name: 'Quick', hint: 'Done within the par time' },
	quiet: { name: 'Quiet', hint: 'No one came running at the sound of you' }
};

export const SABOTAGE_TEXT = {
	title: 'Gig Saboteur',
	help: 'How to play',
	helpClose: 'Got it',
	playfieldLabel: 'The site, seen from above',

	// Job list
	selectTitle: 'Pick a gig',
	selectIntro: 'Fifty euros, no questions, no training. Finish a gig to open the next one.',
	starsTotal: (stars: number, max: number) => `${stars} of ${max} stars`,
	locked: 'Locked',
	lockedHint: 'Finish the gig before it',
	gigNumber: (n: number) => `Gig ${n}`,
	runHint: `A run is over after ${STRIKES} busts. Your pay for the whole run is your score.`,

	// Job card
	cardChannel: (channel: string) => `#${channel}`,
	cardPay: `Pay: EUR ${PAYOUT.base}, plus EUR ${PAYOUT.perStar} for every star`,
	cardTake: 'Take the gig',
	cardStarsTitle: 'Bonus for',

	// HUD
	suspicion: 'Suspicion',
	targets: (done: number, total: number) => `${done}/${total}`,
	targetsLabel: 'Targets',
	strikes: 'Strikes',
	parTime: (seconds: number, par: number) => `${Math.floor(seconds)}s / ${par}s`,
	pay: (total: number) => `EUR ${total}`,

	// Controls
	sabotage: 'Sabotage',
	sabotageHold: 'Hold',
	run: 'Run',
	phone: 'Phone',
	phoneAim: 'Tap the map',
	pause: 'Pause',
	stick: 'Move',

	// Pause
	paused: 'Paused',
	resume: 'Resume',
	restartJob: 'Restart gig',
	quitRun: 'Quit run',

	// After a job
	clearedTitle: 'Gig done',
	clearedBody: (payout: number) => `EUR ${payout} on its way. Payment may arrive.`,
	nextGig: 'Next gig',
	finishRun: 'Collect the pay',
	bustedTitle: 'Busted',
	bustedBody: (left: number) =>
		left === 1 ? 'One strike left. Do not get caught again.' : `${left} strikes left.`,
	tryAgain: 'Try again',

	// Run over
	overWonTitle: 'All nine gigs done',
	overLostTitle: 'Run over',
	overJobs: 'Gigs done',
	overStars: 'Stars',
	overPay: 'Pay',
	retry: 'New run',

	// Tutorial
	tutorialTitle: 'How to play',
	tutorialGoal:
		'Sneak in, sabotage every target, then walk out through the exit. Nobody here is paid enough to chase you, but they will if they see you.',
	tutorialMove:
		'Move with the stick (or WASD and the arrow keys). Push gently, or hold Ctrl, to sneak: slower, but much harder to spot.',
	tutorialWatch:
		'Guards, dogs, cameras and floodlights fill your suspicion meter while you are inside their cone. Walls and crates block their view. Bushes hide you; shadows help. A full meter is a bust.',
	tutorialNoise: `Running (Run button or Shift) is loud: guards and dogs nearby come to look, and dogs hear you from further away.`,
	tutorialSabotage: `Stand next to a target and hold Sabotage (or Space) for ${SABOTAGE_SECONDS} seconds. Step away and you start over. Once every target is done the exit opens.`,
	tutorialPhone:
		'Once per job you can throw your phone: tap Phone, then tap the map. It rings and nearby guards go to check.',
	tutorialStars: `You get EUR ${PAYOUT.base} per gig and EUR ${PAYOUT.perStar} for each star: unseen, quick and quiet. ${STRIKES} busts end the run, and your total pay is your score.`
} as const;
