import { describe, expect, it } from 'vitest';
import { chooseShareMethod } from './share';

const file = new File(['x'], 'score.png', { type: 'image/png' });
const share = async () => {};

describe('chooseShareMethod', () => {
	it('shares the image file when the browser supports it', () => {
		expect(chooseShareMethod({ share, canShare: () => true }, file)).toBe('web-share-files');
	});

	it('shares text only when files are not supported', () => {
		expect(chooseShareMethod({ share, canShare: () => false }, file)).toBe('web-share-text');
		expect(chooseShareMethod({ share }, file)).toBe('web-share-text');
	});

	it('treats a throwing canShare as no file support', () => {
		const canShare = () => {
			throw new TypeError('unsupported');
		};
		expect(chooseShareMethod({ share, canShare }, file)).toBe('web-share-text');
	});

	it('falls back to downloading without the Web Share API', () => {
		expect(chooseShareMethod({}, file)).toBe('download');
	});
});
