/*
 * Full screen and a landscape lock for the games played sideways. Only phones and tablets ask:
 * on a desktop the window is already wide, and full screen there would only get in the way.
 * Browsers that refuse (iOS Safari, or without a recent tap) keep the page as it is, and the
 * games show a turn-your-phone card instead.
 */

type LockableOrientation = ScreenOrientation & { lock?: (orientation: string) => Promise<void> };

/** Set when full screen was entered here, so leaving only undoes what this module did */
let entered = false;

/** Goes full screen and locks the screen sideways; needs a recent tap */
export async function enterLandscape(): Promise<void> {
	if (!matchMedia('(pointer: coarse)').matches) return;
	try {
		if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
			await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
			entered = true;
		}
		await (screen.orientation as LockableOrientation | undefined)?.lock?.('landscape');
	} catch {
		// Not allowed here: the rotate hint covers it
	}
}

/** Releases the lock and leaves full screen again */
export function leaveLandscape(): void {
	try {
		screen.orientation?.unlock();
	} catch {
		// Never locked
	}
	if (entered && document.fullscreenElement) void document.exitFullscreen().catch(() => {});
	entered = false;
}
