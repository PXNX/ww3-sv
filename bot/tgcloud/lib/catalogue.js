// The server-owned catalogue. Prices are whole Telegram Stars (currency XTR); the Mini App only
// shows what `me` returns, so a price never comes from a request.

export const CURRENCY = 'XTR';

// The only period Telegram Stars subscriptions support: 30 days
export const SUBSCRIPTION_PERIOD = 30 * 24 * 3600;

export const PRODUCTS = [
  {
    sku: 'revive_1',
    title: 'Revival token',
    description: 'Continue one crashed run in World War 3.',
    de: { title: 'Revival-Token', description: 'Setze einen gescheiterten Lauf in World War 3 fort.' },
    stars: 25,
    revives: 1,
    subscription: false,
  },
  {
    sku: 'pro_30d',
    title: 'World War 3 Pro',
    description: '10 revival tokens every 30 days, and no adverts once the game shows them. Renews monthly until cancelled in Telegram.',
    de: {
      title: 'World War 3 Pro',
      description: '10 Revival-Token alle 30 Tage und keine Werbung, sobald das Spiel welche zeigt. Verlängert sich monatlich, bis du es in Telegram kündigst.',
    },
    stars: 250,
    revives: 10,
    subscription: true,
  },
];

export function product(sku) {
  return PRODUCTS.find((item) => item.sku === sku) ?? null;
}

/** Title and description in the buyer's language (German or English) */
export function localized(item, lang) {
  return lang === 'de' && item.de ? { ...item, ...item.de } : item;
}
