/**
 * Whether the version history sheet is open. Settings and the About page open it from a link; the
 * global "what's new" sheet opens itself once for returning players when a newer release exists.
 */
class ChangelogSheetStore {
	open = $state(false);

	show() {
		this.open = true;
	}
}

export const changelogSheet = new ChangelogSheetStore();
