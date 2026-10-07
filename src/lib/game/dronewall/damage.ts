/* Damage to an enemy (a soldier or an aerial enemy): lowers its health and flashes it */
import type { Soldier } from './state';

export function damageSoldier(target: Pick<Soldier, 'hp' | 'hitMs'>, amount: number) {
	if (amount <= 0 || target.hp <= 0) return;
	target.hp -= amount;
	target.hitMs = 140;
}
