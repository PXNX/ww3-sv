/*
 * Rare Earth Squeeze tuning. Crates of rare earth spawn at the mines and must be switched through
 * hubs and ports to the factory that wants them before their deadline. Every few rounds the
 * ministry of export affairs issues a notice (a lane banned, a quota, a tariff, a licence), and
 * breaking a rule, missing a deadline or delivering to the wrong factory costs a heart.
 */

export const STARTING_LIVES = 3;

/** A round is this long; the pace and the rules are counted in rounds */
export const ROUND_MS = 14_000;

/** A new notice is issued at the start of every this-many rounds, starting with round 2 */
export const RULE_EVERY_ROUNDS = 2;
/** A rule is gone this many rounds after its notice was issued */
export const RULE_LIFE_ROUNDS = 3;
/** Warning time between the notice and the moment it takes effect */
export const NOTICE_LEAD_MS = 3800;
/** Fewest and most crates an export quota lets through per round */
export const QUOTA_MIN = 2;
export const QUOTA_MAX = 3;
/** A tariffed lane makes crates this much slower */
export const TARIFF_SPEED = 0.45;

/** Crates */
/** A fresh crate waits at its mine this long, so the mine switch can still be set */
export const LOAD_MS = 900;
export const FIRST_SPAWN_MS = 1500;
/** Map units per second in round 1, the gain per round, and the cap */
export const BASE_SPEED = 44;
export const SPEED_GAIN = 3;
export const MAX_SPEED = 90;
/** Time between spawns in round 1, how much of it each round keeps, and the floor */
export const BASE_SPAWN_MS = 3300;
export const SPAWN_FACTOR = 0.9;
export const MIN_SPAWN_MS = 1150;
/** Deadline = trip time at the current speed times the slack, plus a fixed allowance */
export const BASE_SLACK = 2.6;
export const MIN_SLACK = 1.7;
export const SLACK_LOSS = 0.1;
export const DEADLINE_ALLOWANCE_MS = 2600;
/** Crates on the map at once: a base plus one per two rounds, up to the cap */
export const BASE_MAX_CRATES = 4;
export const MAX_CRATES_CAP = 12;
/** The third element (and the third factory's orders) arrives in this round */
export const THIRD_ELEMENT_ROUND = 3;
/** From this round on two rules may be in force or announced at once (one before) */
export const SECOND_RULE_ROUND = 4;
/** Rules that need a bit more thought wait for later rounds */
export const QUOTA_ROUND = 4;
export const LICENCE_ROUND = 6;

/** Attempts the scheduler makes to find a notice that leaves every factory reachable */
export const RULE_ATTEMPTS = 24;

/** Scoring */
export const DELIVERY_POINTS = 10;
export const SPEED_BONUS_POINTS = 10;
/** Every this many by-the-book deliveries in a row raise the multiplier by one */
export const COMBO_STEP = 3;
export const MAX_MULTIPLIER = 5;
