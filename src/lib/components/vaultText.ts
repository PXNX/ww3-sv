/* Translated names of the vault treasures, for card labels */
import type { SymbolId } from '#lib/game/vault/symbols.js';
import { m } from '#lib/paraglide/messages.js';

const NAMES: Record<SymbolId, () => string> = {
	'gold-bar': m.vault_symbol_gold_bar,
	'gold-coin': m.vault_symbol_gold_coin,
	'gold-nuggets': m.vault_symbol_gold_nuggets,
	'cheese-wheel': m.vault_symbol_cheese_wheel,
	'cheese-wedge': m.vault_symbol_cheese_wedge,
	'cheese-block': m.vault_symbol_cheese_block,
	'watch-pocket': m.vault_symbol_watch_pocket,
	'watch-wrist': m.vault_symbol_watch_wrist,
	'watch-alarm': m.vault_symbol_watch_alarm,
	'choc-bar': m.vault_symbol_choc_bar,
	'choc-truffle': m.vault_symbol_choc_truffle,
	'choc-bonbon': m.vault_symbol_choc_bonbon
};

export function symbolName(symbol: SymbolId): string {
	return NAMES[symbol]();
}
