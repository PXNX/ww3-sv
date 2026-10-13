import { describe, expect, it } from 'vitest';
import { VIEW_W } from './config';
import { cameraTarget, followCamera } from './camera';
import { HeldInput, KEY_ACTIONS } from './input';

describe('HeldInput', () => {
	it('reports nothing when nothing is held', () => {
		expect(new HeldInput().read()).toEqual({ move: 0, jumpHeld: false, jumpPressed: false });
	});

	it('moves while a direction is held and stops when it is released', () => {
		const input = new HeldInput();
		input.set('ptr:1', 'right', true);
		expect(input.read().move).toBe(1);
		input.set('ptr:1', 'right', false);
		expect(input.read().move).toBe(0);
	});

	it('cancels out when both directions are held', () => {
		const input = new HeldInput();
		input.set('a', 'left', true);
		input.set('b', 'right', true);
		expect(input.read().move).toBe(0);
		input.set('b', 'right', false);
		expect(input.read().move).toBe(-1);
	});

	it('keeps a button down while any source still holds it', () => {
		const input = new HeldInput();
		input.set('key:ArrowRight', 'right', true);
		input.set('ptr:4', 'right', true);
		input.set('key:ArrowRight', 'right', false);
		expect(input.isDown('right')).toBe(true);
		input.set('ptr:4', 'right', false);
		expect(input.isDown('right')).toBe(false);
	});

	it('lets one finger run while another jumps', () => {
		const input = new HeldInput();
		input.set('ptr:1', 'right', true);
		input.set('ptr:2', 'jump', true);
		expect(input.read()).toMatchObject({ move: 1, jumpHeld: true });
	});

	it('reports a jump press once, then only that it is held', () => {
		const input = new HeldInput();
		input.set('key:Space', 'jump', true);
		expect(input.read()).toMatchObject({ jumpPressed: true, jumpHeld: true });
		expect(input.read()).toMatchObject({ jumpPressed: false, jumpHeld: true });
	});

	it('does not count key repeat or a second finger as a new press', () => {
		const input = new HeldInput();
		input.set('key:Space', 'jump', true);
		input.read();
		input.set('key:Space', 'jump', true);
		input.set('ptr:9', 'jump', true);
		expect(input.read().jumpPressed).toBe(false);
	});

	it('keeps a very short tap: pressed is reported even if released before the next step', () => {
		const input = new HeldInput();
		input.set('ptr:1', 'jump', true);
		input.set('ptr:1', 'jump', false);
		expect(input.read()).toMatchObject({ jumpPressed: true, jumpHeld: false });
	});

	it('clear lets go of everything', () => {
		const input = new HeldInput();
		input.set('a', 'left', true);
		input.set('b', 'jump', true);
		input.clear();
		expect(input.read()).toEqual({ move: 0, jumpHeld: false, jumpPressed: false });
	});

	it('maps arrow keys, WASD and space', () => {
		expect(KEY_ACTIONS.ArrowLeft).toBe('left');
		expect(KEY_ACTIONS.KeyD).toBe('right');
		expect(KEY_ACTIONS.Space).toBe('jump');
		expect(KEY_ACTIONS.KeyW).toBe('jump');
	});
});

describe('camera', () => {
	it('never shows past the ends of the level', () => {
		expect(cameraTarget(2, 1, 100)).toBe(0);
		expect(cameraTarget(99, 1, 100)).toBe(100 - VIEW_W);
	});

	it('looks ahead in the facing direction', () => {
		expect(cameraTarget(50, 1, 100)).toBeGreaterThan(cameraTarget(50, -1, 100));
	});

	it('stays at zero when the level is as narrow as the view', () => {
		expect(cameraTarget(7, 1, VIEW_W)).toBe(0);
	});

	it('eases toward the target and snaps when it is far away', () => {
		const next = followCamera(10, 20, 1 / 60);
		expect(next).toBeGreaterThan(10);
		expect(next).toBeLessThan(20);
		expect(followCamera(10, 60, 1 / 60)).toBe(60);
	});
});
