/* Parsing of cosmetic-gift start parameters, shared by the bot link handling and the app. */

const PREFIX = 'gift_';

/** The claim code in a `startapp=gift_<code>` param, or null for anything else */
export function lookGiftCode(param: string | null | undefined): string | null {
	if (!param?.startsWith(PREFIX)) return null;
	const code = param.slice(PREFIX.length);
	return /^[A-Za-z0-9]{4,24}$/.test(code) ? code : null;
}

/** The start parameter that opens a wrapped look */
export function lookGiftParam(code: string): string {
	return `${PREFIX}${code}`;
}
