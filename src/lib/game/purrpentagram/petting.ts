/*
 * Petting is as simple as it sounds: a cat that has a hand on it purrs, and the longer the hand
 * stays, the louder the purr gets. Moving the finger or holding it still makes no difference.
 */
import { PURR_RAMP_MS } from './config';

/** The purr volume (0 to 1) of a cat that has been petted for `petMs`: it rises towards full volume */
export function purrVolume(petMs: number): number {
	return 1 - Math.exp(-Math.max(0, petMs) / PURR_RAMP_MS);
}
