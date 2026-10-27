/*
 * Petrobras tuning. Two fronts run at once: the boardroom (shares, proxies, a takeover) and the
 * society feed (rumours, moderation, an algorithm). The score is the lower of the two tracks, so
 * a player who only tends one front runs the other into the ground.
 */

/** Both tracks start level, so neither front is a head start */
export const START_TRACK = 30;

/** A right call lifts its own front and, a little, the mood on the other */
export const CORRECT_GAIN = 12;
export const CORRECT_SPILL = 3;

/** A wrong call hurts its own front and leaks into the other */
export const WRONG_LOSS = 15;
export const WRONG_SPILL = 5;

/** Ignoring a front until the clock runs out costs a little more than a wrong call */
export const TIMEOUT_LOSS = 12;
export const TIMEOUT_SPILL = 4;

/** The Zuckerberg boss round lifts or sinks both fronts at once */
export const BOSS_GAIN = 14;
export const BOSS_LOSS = 16;

/** How often the untended front loses a point, and how much */
export const NEGLECT_MS = 1500;
export const NEGLECT_DECAY = 1;

/** The prompt clock starts at six seconds and tightens with every round */
export const PROMPT_BASE_MS = 6000;
export const PROMPT_MIN_MS = 3200;
export const PROMPT_STEP_MS = 120;

/** How long the verdict stays on screen before the next prompt */
export const FEEDBACK_MS = 700;
export const GAME_OVER_FEEDBACK_MS = 1000;

/** Every fifth round is the feed algorithm */
export const BOSS_EVERY = 5;

/** How many jokes each front has (petrobras_board_0 ... petrobras_boss_2) */
export const BOARD_SCENARIOS = 5;
export const SOCIETY_SCENARIOS = 5;
export const BOSS_SCENARIOS = 3;
