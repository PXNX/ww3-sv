/*
 * The operator details every legal page needs. They are deliberately TODO placeholders: a German
 * imprint requires a real postal address and a reachable email, and inventing either would be
 * worse than shipping a visible reminder. Replace the values here, then delete the template
 * notice in `LegalPage.svelte`; `legal.test.ts` fails while any value still starts with "TODO".
 */
export const LEGAL_OPERATOR = {
	name: 'TODO: name of the person or company running the game',
	street: 'TODO: street and house number',
	postalCode: 'TODO: postal code',
	city: 'TODO: city',
	country: 'TODO: country',
	email: 'TODO: contact email address',
	responsible: 'TODO: name of the person responsible for the content',
	vatId: 'TODO: VAT ID, or "not applicable" if there is none',
	hosting: 'TODO: hosting provider and server location'
} as const;

/** Last substantive change to the legal texts, ISO date; shown on every legal page */
export const LEGAL_UPDATED = '2026-10-28';
