/*
 * Tilt steering for Convoy Runner. Phones report how far they are rolled left or right as a gamma
 * angle (beta once the screen is turned sideways); this module turns that into the same sideways
 * position a held finger would produce, measured against the pose the phone was in when the run
 * started, so the player can hold the phone however is comfortable.
 *
 * Inside Telegram the Mini App's own motion API is used (Bot API 8.0, the "device motion tracking"
 * in the Mini Apps 2.0 update): it needs no permission dialog and works in the webviews where the
 * browser's orientation events are unavailable. A normal browser visit falls back to those events
 * instead. Either way a device only counts as tiltable once a real reading has arrived, so on a
 * desktop (which merely knows the API) the touch and mouse controls stay in charge.
 */
import {
	isTelegramLaunch,
	startMotion,
	stopMotion,
	type TelegramMotion
} from '#lib/services/telegram.js';

export interface LaneRange {
	min: number;
	max: number;
}

/** Degrees of tilt ignored around the neutral pose: hand tremor holds the tanker where it is */
export const TILT_DEAD_ZONE_DEG = 2;
/** Tilt past the dead zone that steers the tanker all the way to the edge of the open water */
export const TILT_FULL_SCALE_DEG = 16;

/** The screen's rotation, in degrees, that an orientation reading has to be corrected for */
export function screenAngle(): number {
	if (typeof window === 'undefined') return 0;
	const orientation = window.screen?.orientation as ScreenOrientation | undefined;
	if (typeof orientation?.angle === 'number') return orientation.angle;
	// Older iOS: the deprecated window.orientation (-90, 0, 90 or 180)
	return (window as Window & { orientation?: number }).orientation ?? 0;
}

/** Telegram reports radians; the tilt helpers work in degrees */
export function radiansToDegrees(radians: number): number {
	return (radians * 180) / Math.PI;
}

/**
 * The sideways tilt of an orientation reading, in degrees: positive when the right side of the
 * screen is lower. A phone held upright in portrait reports this as gamma; once the screen turns
 * sideways the same movement shows up as beta instead, hence the screen angle.
 */
export function sidewaysTilt(beta: number, gamma: number, angle = 0): number {
	const quadrant = (((Math.round(angle / 90) * 90) % 360) + 360) % 360;
	switch (quadrant) {
		case 90:
			return -beta;
		case 180:
			return -gamma;
		case 270:
			return beta;
		default:
			return gamma;
	}
}

/**
 * The -1 (hard left) to 1 (hard right) deflection for a tilt, relative to the neutral angle. This is
 * absolute rather than a joystick: level means the middle of the open water, and the angle maps
 * straight to where the tanker should be, so a lane the player holds stays held.
 */
export function tiltDeflection(degrees: number, neutral: number): number {
	const offset = degrees - neutral;
	const magnitude = Math.abs(offset);
	if (magnitude <= TILT_DEAD_ZONE_DEG) return 0;
	const span = TILT_FULL_SCALE_DEG - TILT_DEAD_ZONE_DEG;
	const scaled = Math.min(1, (magnitude - TILT_DEAD_ZONE_DEG) / span);
	return offset < 0 ? -scaled : scaled;
}

/** Where a deflection points the tanker, in lanes, across the water the banks leave open */
export function tiltLane(deflection: number, range: LaneRange): number {
	const mid = (range.min + range.max) / 2;
	const half = Math.max(0, range.max - range.min) / 2;
	return mid + Math.min(1, Math.max(-1, deflection)) * half;
}

/** iOS asks for motion access from a tap; the other browsers fire orientation events straight away */
type MotionPermission = 'granted' | 'denied' | 'default';

interface PermissionRequestingConstructor {
	requestPermission?: () => Promise<MotionPermission>;
}

/**
 * Follows the device's orientation and keeps the current deflection. Telegram's sensor is polled by
 * the game loop; the browser's events are pushed. `onActive` is only there so the interface can
 * learn when a real sensor has answered, which is when the touch controls stand down.
 */
export class TiltSteering {
	/** True once a real sensor value has arrived: only then is the device actually tiltable */
	active = false;

	#neutral: number | null = null;
	#degrees: number | null = null;
	#started = false;
	#starting: Promise<boolean> | null = null;
	#motion: TelegramMotion | null = null;
	#onActive: () => void;

	constructor(onActive: () => void = () => {}) {
		this.#onActive = onActive;
	}

	/** The current sideways deflection, -1 (hard left) to 1 (hard right); 0 while level */
	get deflection(): number {
		if (this.#degrees === null || this.#neutral === null) return 0;
		return tiltDeflection(this.#degrees, this.#neutral);
	}

	/** Whether the page is on a touch device at all; the sensor check itself happens in start() */
	static supported(): boolean {
		if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
		return window.matchMedia('(pointer: coarse)').matches;
	}

	/**
	 * Starts reading the sensor. Call it from a tap: iOS only shows its motion prompt for the
	 * browser's orientation events then. Returns whether a sensor answered; even then touch stays in
	 * charge until the first reading has arrived.
	 */
	start(): Promise<boolean> {
		if (!TiltSteering.supported()) return Promise.resolve(false);
		if (this.#started) {
			this.recalibrate();
			return Promise.resolve(true);
		}
		// Two taps in quick succession (start, retry) must not start two sensors
		this.#starting ??= this.#enable().finally(() => (this.#starting = null));
		return this.#starting;
	}

	/** Reads Telegram's sensor; the browser's listener pushes its readings instead */
	poll() {
		const motion = this.#motion;
		if (!motion) return;
		const { beta, gamma } = motion;
		// Before the first change event the values are undefined (or null)
		if (typeof beta === 'number' && typeof gamma === 'number') {
			this.#accept(radiansToDegrees(beta), radiansToDegrees(gamma));
		}
	}

	/** Treats the pose the phone is held in now as level, the middle of the open water */
	recalibrate() {
		this.#neutral = null;
	}

	/** Stops reading the sensor; call it when the playfield goes away */
	stop() {
		if (!this.#started) return;
		if (this.#motion) {
			stopMotion(this.#motion);
			this.#motion = null;
		} else if (typeof window !== 'undefined') {
			window.removeEventListener('deviceorientation', this.#onOrientation);
		}
		this.#started = false;
		this.active = false;
		this.#degrees = null;
		this.#neutral = null;
	}

	async #enable(): Promise<boolean> {
		// A Mini App launch uses Telegram's own sensor: no prompt, and an old client or a device
		// without one simply reports nothing, which leaves the touch controls in charge
		if (isTelegramLaunch(window.location.hash)) {
			const motion = await startMotion();
			if (!motion) return false;
			this.#motion = motion;
			this.#started = true;
			this.recalibrate();
			return true;
		}
		return this.#startWeb();
	}

	/** The browser's DeviceOrientationEvent, for visits outside Telegram */
	async #startWeb(): Promise<boolean> {
		if (!('DeviceOrientationEvent' in window)) return false;
		const sensor = (globalThis as { DeviceOrientationEvent?: PermissionRequestingConstructor })
			.DeviceOrientationEvent;
		if (typeof sensor?.requestPermission === 'function') {
			try {
				// Called straight from the tap that started the run, as iOS insists
				if ((await sensor.requestPermission()) !== 'granted') return false;
			} catch {
				// Refused, or not asked from a tap: keep the touch controls
				return false;
			}
		}
		window.addEventListener('deviceorientation', this.#onOrientation, { passive: true });
		this.#started = true;
		this.recalibrate();
		return true;
	}

	#onOrientation = (event: DeviceOrientationEvent) => {
		const { beta, gamma } = event;
		// Some browsers send the rotation but not the lean: no use for steering
		if (beta === null || gamma === null) return;
		this.#accept(beta, gamma);
	};

	/** A reading in degrees; the first one after a recalibration sets the neutral pose */
	#accept(beta: number, gamma: number) {
		const degrees = sidewaysTilt(beta, gamma, screenAngle());
		this.#degrees = degrees;
		if (this.#neutral === null) this.#neutral = degrees;
		if (!this.active) {
			this.active = true;
			this.#onActive();
		}
	}
}
