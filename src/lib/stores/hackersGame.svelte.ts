/*
 * Hermit Hackers game store: wraps the pure rules with the keypad input, the terminal log,
 * sounds and the personal best. The rules live in a plain state object; what the page shows
 * (guesses, keystroke chips, relay panel, trace) is copied into reactive fields after every
 * change. Nothing runs until start(), and the loop is driven by the page, so a run never ticks
 * away unseen (and never on the server).
 */
import { haptic } from '#lib/haptic/haptic.svelte.js';
import { GLYPHS, STARTING_LIVES, TRACE_MAX } from '#lib/game/hackers/config.js';
import type { Chip } from '#lib/game/hackers/keylog.js';
import { emptyHardware, type Hardware, type HardwareId } from '#lib/game/hackers/hardware.js';
import {
	bankRun,
	buyHardware as buyHardwareLevel,
	defaultProfile,
	HACKERS_PROFILE_KEY,
	isProfile,
	toggleFavorite as toggleProfileFavorite,
	type HackersProfile
} from '#lib/game/hackers/profile.js';
import { applyThefts, firewallLevel, randomIp, rivalContractLevel } from '#lib/game/hackers/pvp.js';
import { avatar } from '#lib/game/avatar/store.svelte.js';
import {
	hackerRivals,
	isUnavailable,
	remember,
	rivalErrorCode,
	type FirewallEntry,
	type HackerCard,
	type HackerHack,
	type RivalErrorCode
} from '#lib/services/rivals.js';
import {
	buyUpgrade,
	attemptsLeft,
	createGame,
	flipRelay,
	openingEvent,
	step,
	submitGuess,
	tapChip,
	typeLetter,
	type Guess,
	type HackersEvent,
	type HackersState,
	type Stage
} from '#lib/game/hackers/state.js';
import {
	createDesktop,
	openFolder as openDesktopFolder,
	readMail as readDesktopMail,
	runProgram as runDesktopProgram,
	shiftClock,
	takeLink as takeDesktopLink,
	takeItem as takeDesktopItem,
	tickDesktop,
	tryVault as tryDesktopVault,
	type Desktop
} from '#lib/game/hackers/desktop.js';
import {
	BROOM_TRACE,
	COFFEE_MS,
	NETWORK,
	NOISE_COINS,
	NOISE_MS,
	networkSystem,
	ownerOf,
	type CastId
} from '#lib/game/hackers/lore.js';
import { emptyBotnet, type Botnet } from '#lib/game/hackers/botnet.js';
import { ARCHIVE_COINS, NETWORK_DOGELITE } from '#lib/game/crossover/gifts.js';
import { career } from '#lib/game/career/store.svelte.js';
import { receive } from '#lib/stores/crossover.svelte.js';
import {
	effectiveSpec,
	toolSpec,
	emptyUpgrades,
	minerIncome,
	siphonShare,
	SIPHON_DAY_MS,
	type ToolId,
	type Upgrades
} from '#lib/game/hackers/software.js';
import { createRandom, randomSeed, type Random } from '#lib/game/random.js';
import { m } from '#lib/paraglide/messages.js';
import { highscores, type Highscores } from '#lib/services/highscore.js';
import { localStore, type Store } from '#lib/services/storage.js';
import { soundManager } from '#lib/sound/soundManager.svelte.js';
import type { SoundId } from '#lib/sound/sounds.js';

export type HackersStatus = 'ready' | 'playing' | 'paused' | 'over';

/** How a hack on another player's rig ended, for the terminal to print */
export interface RivalOutcome {
	name: string;
	won: boolean;
	stolen: number;
}

/** Why a hack on a player could not start: one of the server's refusals, or a dropped uplink */
export type RivalProblem = RivalErrorCode | 'failed';

export const HACKERS_BEST_KEY = ['hackers', 'score'] as const;

const LOG_LINES = 7;

/** The trace level at which the screen starts to glitch and warns */
export const TRACE_WARN = 80;

const TOOL_NAMES: Record<ToolId, () => string> = {
	breach: m.hackers_tool_breach,
	keylog: m.hackers_tool_keylog,
	relays: m.hackers_tool_relays,
	miner: m.hackers_tool_miner,
	siphon: m.hackers_tool_siphon
};

/** The display name of a system of the cast's network */
export function networkName(id: string): string {
	switch (id) {
		case 'dome':
			return m.hackers_net_dome();
		case 'maple':
			return m.hackers_net_maple();
		case 'petrobras':
			return m.hackers_net_petrobras();
		case 'whack':
			return m.hackers_net_whack();
		case 'chipfab':
			return m.hackers_net_chipfab();
		case 'tycoon':
			return m.hackers_net_tycoon();
		default:
			return id;
	}
}

export class HackersGame {
	status = $state<HackersStatus>('ready');
	score = $state(0);
	lives = $state(STARTING_LIVES);
	/** 0 to 100 */
	trace = $state(0);
	stage = $state<Stage>('breach');
	contractNumber = $state(1);
	completed = $state(0);
	ip = $state('');
	system = $state('');
	guesses = $state.raw<Guess[]>([]);
	/** The glyphs typed into the current attempt */
	input = $state.raw<number[]>([]);
	codeLength = $state(4);
	symbols = $state(5);
	attemptsLeft = $state(0);
	chips = $state.raw<Chip[]>([]);
	/** The part of the passphrase captured so far, and its full length */
	captured = $state('');
	passphraseLength = $state(4);
	panel = $state.raw<boolean[]>([]);
	panelSize = $state(3);
	moves = $state(0);
	par = $state(3);
	log = $state.raw<string[]>([]);
	/** Counts up on every trace-out, so the page can flash */
	hurtCount = $state(0);
	/** Counts every line written to the log, so the page can type out the newest one */
	logSeq = $state(0);
	/** The last success or failure, for a full-screen flash; `flashSeq` counts up so it replays */
	flashKind = $state<'ok' | 'fail'>('ok');
	flashSeq = $state(0);
	best = $state<number | null>(null);
	isNewBest = $state(false);
	/** Software bought in this run */
	upgrades = $state.raw<Upgrades>(emptyUpgrades());
	/** DogeLite a second the miner on the player's own machine pays */
	incomePerSecond = $state(0);
	/** Share of the target's wallet the siphon takes per day, 0 when it is not installed */
	siphonRate = $state(0);
	/** Time towards the siphon's next day, 0 to 1 */
	siphonProgress = $state(0);
	wallet = $state(0);
	walletStart = $state(0);
	/** DogeLite the siphon has drained in this run */
	siphoned = $state(0);
	/** DogeLite left over from earlier runs, spent on hardware */
	bank = $state(0);
	/** The unit's own machine, kept between runs */
	hardware = $state.raw<Hardware>(emptyHardware());
	/** Addresses marked in the target list */
	favorites = $state.raw<string[]>([]);
	/** The bank's desktop after a finished contract, while its bonus round runs; null otherwise */
	desktop = $state.raw<Desktop | null>(null);
	/** The folder open on the desktop */
	desktopFolder = $state<number | null>(null);
	/** Symbols typed into the vault lock */
	vaultInput = $state.raw<number[]>([]);
	/** The bank whose desktop is open: the contract that was just finished */
	desktopSystem = $state('');
	/** Ids of the cast's emails read so far, kept between runs */
	lore = $state.raw<number[]>([]);
	/** Systems of the cast's wider network found so far, kept between runs */
	network = $state.raw<string[]>([]);

	/** The rig's own address, the trace other players find in their firewall logs */
	ownIp = $state('');
	/** Other players' rigs hacked so far */
	hacks = $state(0);
	/** Whether the bot's server answered: false outside Telegram */
	rivalsOnline = $state(false);
	/** True while the first sync with the server is still running */
	rivalsLoading = $state(false);
	/** Other hermits' rigs offered as targets */
	rivalTargets = $state.raw<HackerCard[]>([]);
	/** Who tried the player's rig lately, newest first */
	firewallLog = $state.raw<FirewallEntry[]>([]);
	/** The dossier open in the terminal */
	dossier = $state.raw<HackerCard | null>(null);
	/** The last refusal, until the next try */
	rivalProblem = $state<RivalProblem | null>(null);
	/** The end of the last hack on a player, until the terminal printed it */
	rivalOutcome = $state.raw<RivalOutcome | null>(null);
	/** Thefts from the bank found at the last sync, until the terminal printed them */
	robbed = $state.raw<{ hits: number; stolen: number } | null>(null);
	/** The other player's rig while a hack on it runs */
	rival = $state.raw<HackerCard | null>(null);

	/** Rules state, deliberately not reactive */
	state: HackersState;
	#desktop: Desktop | null = null;
	#botnet: Botnet | undefined;
	#firewallSeen: string[] = [];
	#hack: HackerHack | null = null;
	/** Set by the events when a hack on a player is decided, handled once they are through */
	#rivalDecided: boolean | null = null;
	#syncing: Promise<void> | null = null;

	/** Set once the trace has crossed the warning line, until it falls well below it again */
	#warned = false;
	#random: Random = createRandom(1);
	#scores: () => Highscores;
	#store: () => Store;
	#seed: () => number;

	constructor({
		scores = highscores,
		store = localStore,
		seed = randomSeed
	}: { scores?: () => Highscores; store?: () => Store; seed?: () => number } = {}) {
		this.#scores = scores;
		this.#store = store;
		this.#seed = seed;
		this.state = createGame(this.#random);
		this.#sync();
	}

	/** Reads the stored best; call in the browser only */
	loadBest() {
		this.best = this.#scores().get(HACKERS_BEST_KEY);
	}

	/** Reads bank, hardware and favourites from local storage; call in the browser only */
	loadProfile() {
		this.#applyProfile(
			this.#store().read<HackersProfile>(HACKERS_PROFILE_KEY, defaultProfile(), isProfile)
		);
		// Every rig gets its own address once and keeps it
		if (!this.ownIp) {
			this.#saveProfile({ ...this.#profile(), ip: randomIp(createRandom(this.#seed())) });
		}
		// Half the network found: free DogeLite from the Supreme Leader
		receive(
			'hackers',
			(ids) => {
				if (!ids.includes('hackers-network')) return [];
				this.#saveProfile({ ...this.#profile(), bank: this.bank + NETWORK_DOGELITE });
				return ['hackers-network'];
			},
			this.#store()
		);
	}

	start(targetIndex = 0) {
		this.#random = createRandom(this.#seed());
		this.state = createGame(this.#random, { hardware: this.hardware, targetIndex });
		this.leaveDesktop();
		this.log = [];
		this.input = [];
		this.isNewBest = false;
		this.hurtCount = 0;
		this.flashSeq = 0;
		this.#warned = false;
		this.#sync();
		this.status = 'playing';
		this.#apply([openingEvent(this.state)]);
	}

	/** Starts a run on a system of the cast's network that was found on a desktop */
	startNetwork(id: string) {
		const system = networkSystem(id);
		if (!system || !this.network.includes(id)) return;
		this.#random = createRandom(this.#seed());
		this.state = createGame(this.#random, {
			hardware: this.hardware,
			extra: { ip: system.ip, system: networkName(id), reward: system.reward }
		});
		this.leaveDesktop();
		this.log = [];
		this.input = [];
		this.isNewBest = false;
		this.hurtCount = 0;
		this.flashSeq = 0;
		this.#warned = false;
		this.#sync();
		this.status = 'playing';
		this.#apply([openingEvent(this.state)]);
	}

	/**
	 * Talks to the bot's server: publishes the rig, takes what other hermits stole from the bank,
	 * and fetches the firewall log and a few rigs to hack. Does nothing outside Telegram.
	 */
	syncRivals(): Promise<void> {
		this.#syncing ??= this.#syncRivals().finally(() => (this.#syncing = null));
		return this.#syncing;
	}

	async #syncRivals(): Promise<void> {
		this.rivalsLoading = true;
		try {
			await this.#publishRig();
			const [entries, targets] = await Promise.all([hackerRivals.firewall(), hackerRivals.list()]);
			const thefts = applyThefts(this.bank, entries, this.#firewallSeen);
			if (thefts.ids.length > 0) {
				this.#saveProfile({
					...this.#profile(),
					bank: thefts.bank,
					firewallSeen: remember(this.#firewallSeen, thefts.ids)
				});
				if (thefts.hits > 0) {
					this.robbed = { hits: thefts.hits, stolen: thefts.stolen };
					this.#play('alarm', 0.6);
				}
			}
			this.firewallLog = entries;
			this.rivalTargets = targets;
			this.rivalsOnline = true;
		} catch (error) {
			if (!isUnavailable(error)) console.warn('hackers rivals', error);
			this.rivalsOnline = false;
		} finally {
			this.rivalsLoading = false;
		}
	}

	/** Publishes the rig; an address someone else already owns is swapped for a fresh one */
	async #publishRig() {
		for (let attempt = 0; attempt < 3; attempt++) {
			try {
				const look = avatar().anonymous ? undefined : avatar().look;
				await hackerRivals.publish({
					ip: this.ownIp,
					bank: this.bank,
					firewall: firewallLevel(this.hardware),
					hacks: this.hacks,
					...(look ? { look } : {})
				});
				return;
			} catch (error) {
				if (rivalErrorCode(error) !== 'IP_TAKEN') throw error;
				this.#saveProfile({ ...this.#profile(), ip: randomIp(createRandom(this.#seed())) });
			}
		}
	}

	/** Opens the dossier of a rig from the list */
	openDossier(card: HackerCard | null) {
		this.rivalProblem = null;
		this.dossier = card;
	}

	/** Finds the player behind an address, as a hack-back from the firewall log does; false if none */
	async whois(ip: string): Promise<boolean> {
		this.rivalProblem = null;
		try {
			this.dossier = await hackerRivals.lookup(ip);
			return true;
		} catch (error) {
			this.rivalProblem = isUnavailable(error) ? 'failed' : (rivalErrorCode(error) ?? 'failed');
			this.#play('ui-error', 0.4);
			return false;
		}
	}

	/** Opens a hack on another player's rig: one contract at the difficulty of their firewall */
	async hackRival(targetId: string): Promise<boolean> {
		if (this.status !== 'ready') return false;
		this.rivalProblem = null;
		let hack: HackerHack;
		try {
			hack = await hackerRivals.hack(targetId);
		} catch (error) {
			this.rivalProblem = rivalErrorCode(error) ?? 'failed';
			this.#play('ui-error', 0.4);
			if (this.rivalProblem !== 'failed') {
				this.rivalTargets = this.rivalTargets.filter((target) => target.id !== targetId);
			}
			return false;
		}
		this.#hack = hack;
		this.rival = hack.target;
		this.dossier = null;
		this.#rivalDecided = null;
		this.#random = createRandom(this.#seed());
		this.state = createGame(this.#random, {
			hardware: this.hardware,
			level: rivalContractLevel(hack.target.firewall),
			// The DogeLite comes from their wallet through the server, not from the contract
			extra: {
				ip: hack.target.ip,
				system: m.hackers_rival_system({ name: hack.target.name }),
				reward: 0
			}
		});
		this.leaveDesktop();
		this.log = [];
		this.input = [];
		this.isNewBest = false;
		this.hurtCount = 0;
		this.flashSeq = 0;
		this.#warned = false;
		this.#sync();
		this.status = 'playing';
		this.#apply([openingEvent(this.state)]);
		return true;
	}

	/** Leaves a hack on a player before it is decided: it counts as traced */
	abandonRival() {
		if (!this.#hack) return;
		void this.#settleRival(false);
		this.status = 'ready';
	}

	/** Tells the server how a hack on a player ended, banks the loot and goes back to the shell */
	async #settleRival(won: boolean) {
		const hack = this.#hack;
		this.#hack = null;
		this.rival = null;
		if (!hack) return;
		let stolen = 0;
		try {
			stolen = await hackerRivals.result(hack.id, won);
		} catch (error) {
			console.warn('hackers rival result', error);
		}
		if (won) {
			this.#saveProfile({
				...this.#profile(),
				bank: this.bank + stolen,
				hacks: this.hacks + 1
			});
		}
		this.rivalOutcome = { name: hack.target.name, won, stolen };
		this.rivalTargets = this.rivalTargets.filter((target) => target.id !== hack.target.id);
		// The bank changed: the next publish carries it
		void this.syncRivals();
	}

	/** Ends a decided hack on a player: back to the shell, where the outcome is printed */
	#endRival(won: boolean) {
		this.#rivalDecided = null;
		this.#random = createRandom(this.#seed());
		this.state = createGame(this.#random, { hardware: this.hardware });
		this.leaveDesktop();
		this.log = [];
		this.input = [];
		this.#sync();
		this.status = 'ready';
		void this.#settleRival(won);
	}

	/** Closes the game-over sheet and goes back to the boot terminal */
	quit() {
		if (this.status !== 'over') return;
		this.#random = createRandom(this.#seed());
		this.state = createGame(this.#random, { hardware: this.hardware });
		this.leaveDesktop();
		this.log = [];
		this.input = [];
		this.isNewBest = false;
		this.hurtCount = 0;
		this.flashSeq = 0;
		this.#warned = false;
		this.#sync();
		this.status = 'ready';
	}

	pause() {
		if (this.status === 'playing') this.status = 'paused';
	}

	resume() {
		if (this.status === 'paused') this.status = 'playing';
	}

	togglePause() {
		if (this.status === 'playing') this.pause();
		else this.resume();
	}

	/** A glyph on the keypad goes into the current attempt */
	pushSymbol(symbol: number) {
		if (this.status !== 'playing' || this.state.contract.stage !== 'breach') return;
		const spec = this.state.contract.spec;
		if (this.input.length >= spec.codeLength || symbol < 0 || symbol >= spec.symbols) return;
		this.input = [...this.input, symbol];
		this.#play('ui-tap', 0.5);
		haptic().play(0.1);
	}

	popSymbol() {
		if (this.status !== 'playing' || this.input.length === 0) return;
		this.input = this.input.slice(0, -1);
		this.#play('ui-tap', 0.4);
		haptic().play(0.08);
	}

	/** Tries the typed code; it needs every slot filled */
	submit() {
		if (this.status !== 'playing') return;
		if (this.input.length !== this.state.contract.spec.codeLength) return;
		const events = submitGuess(this.state, this.input, this.#random);
		this.input = [];
		this.#apply(events);
	}

	tapChip(chipId: number) {
		if (this.status !== 'playing') return;
		this.#apply(tapChip(this.state, chipId, this.#random));
	}

	typeLetter(letter: string) {
		if (this.status !== 'playing') return;
		this.#apply(typeLetter(this.state, letter, this.#random));
	}

	flipRelay(index: number) {
		if (this.status !== 'playing') return;
		this.#apply(flipRelay(this.state, index, this.#random));
	}

	/** Buys the next level of a tool with the DogeLite in the bank */
	buy(tool: ToolId) {
		if (this.status !== 'playing' && this.status !== 'paused') return;
		const events = buyUpgrade(this.state, tool);
		if (events.length === 0) {
			this.#play('ui-error', 0.4);
			return;
		}
		this.#apply(events);
	}

	/** Buys hardware for the unit's own machine from the bank, before a run */
	buyHardware(id: HardwareId) {
		if (this.status !== 'ready') return;
		const next = buyHardwareLevel(this.#profile(), id);
		if (!next) {
			this.#play('ui-error', 0.4);
			return;
		}
		this.#saveProfile(next);
		this.#play('click', 0.7);
		haptic().play(0.2);
	}

	/** Stars or unstars an address in the target list */
	toggleFavorite(ip: string) {
		this.#saveProfile(toggleProfileFavorite(this.#profile(), ip));
		this.#play('ui-tap', 0.4);
	}

	isFavorite(ip: string): boolean {
		return this.favorites.includes(ip);
	}

	/** One fixed step: called by the page's game loop */
	update(dtMs: number) {
		if (this.status !== 'playing') return;
		// The bonus round stops the clock of the contract waiting behind it
		if (this.#desktop) {
			if (!tickDesktop(this.#desktop, dtMs)) {
				this.#say(m.hackers_desk_admin_back());
				this.#play('alarm', 0.5);
				this.leaveDesktop();
			} else this.#showDesktop();
			return;
		}
		this.#apply(step(this.state, dtMs, this.#random));
	}

	openFolder(index: number) {
		const desktop = this.#desktop;
		if (!desktop || this.status !== 'playing') return;
		if (desktop.folders[index]?.opened) {
			this.desktopFolder = index;
			return;
		}
		if (!openDesktopFolder(desktop, index)) return;
		this.desktopFolder = index;
		this.#play('ui-toggle', 0.6);
		haptic().play(0.1);
		this.#showDesktop();
	}

	closeFolder() {
		this.desktopFolder = null;
	}

	/** Picks up a note, downloads an app or pockets a pile of DogeLite */
	takeItem(folderIndex: number, itemIndex: number) {
		const desktop = this.#desktop;
		if (!desktop || this.status !== 'playing') return;
		const item = takeDesktopItem(desktop, folderIndex, itemIndex);
		if (!item) return;
		switch (item.kind) {
			case 'note':
				this.#say(m.hackers_desk_log_note({ slot: item.slot + 1, glyph: GLYPHS[item.symbol] }));
				this.#play('pickup', 0.6);
				break;
			case 'app':
				this.#grantTool(item.app);
				break;
			case 'coins':
				this.state.score += item.amount;
				this.#say(m.hackers_desk_log_coins({ amount: item.amount }));
				this.#play('pickup', 0.8);
				break;
		}
		haptic().play(0.2);
		this.#sync();
		this.#showDesktop();
	}

	pushVault(symbol: number) {
		const desktop = this.#desktop;
		if (!desktop || desktop.cracked !== null || !desktop.vaultFound) return;
		if (this.vaultInput.length >= desktop.code.length || symbol < 0 || symbol >= desktop.symbols)
			return;
		this.vaultInput = [...this.vaultInput, symbol];
		this.#play('ui-tap', 0.5);
	}

	popVault() {
		if (this.vaultInput.length === 0) return;
		this.vaultInput = this.vaultInput.slice(0, -1);
		this.#play('ui-tap', 0.4);
	}

	/** Tries the typed combination on the vault */
	tryVault() {
		const desktop = this.#desktop;
		if (!desktop || this.vaultInput.length !== desktop.code.length) return;
		const reward = tryDesktopVault(desktop, this.vaultInput);
		this.vaultInput = [];
		if (reward > 0) {
			this.state.score += reward;
			this.#say(m.hackers_desk_log_vault({ amount: reward }));
			this.#play('chime-big', 1);
			haptic().play(0.5);
			this.#flash('ok');
		} else if (desktop.cracked === false) {
			this.#say(m.hackers_desk_log_vault_locked());
			this.#play('alarm', 0.6);
			this.#flash('fail');
		} else {
			this.#play('ui-error', 0.5);
		}
		this.#sync();
		this.#showDesktop();
	}

	/** Opens a mail in the inbox; read mail goes into the lore archive */
	readMail(index: number) {
		const desktop = this.#desktop;
		if (!desktop || this.status !== 'playing') return;
		const mail = readDesktopMail(desktop, index);
		if (!mail) return;
		if (mail.clue) {
			this.#say(
				m.hackers_desk_log_note({ slot: mail.clue.slot + 1, glyph: GLYPHS[mail.clue.symbol] })
			);
		}
		if (!this.lore.includes(mail.id)) {
			this.#saveProfile({ ...this.#profile(), lore: [...this.lore, mail.id] });
			// The whole archive read: the Supreme Leader pays in Fake News
			receive(
				'career',
				(ids) =>
					ids.includes('hackers-archive') && career().grantCoins(ARCHIVE_COINS) > 0
						? ['hackers-archive']
						: [],
				this.#store()
			);
		}
		this.#play('ui-toggle', 0.5);
		this.#showDesktop();
	}

	/** Runs one of the bank's installed programs */
	runProgram(index: number) {
		const desktop = this.#desktop;
		if (!desktop || this.status !== 'playing') return;
		const program = runDesktopProgram(desktop, index);
		if (!program) return;
		switch (program.kind) {
			case 'coffee':
				shiftClock(desktop, COFFEE_MS);
				this.#say(m.hackers_prog_log_coffee({ seconds: COFFEE_MS / 1000 }));
				this.#play('pickup', 0.6);
				break;
			case 'broom':
				this.state.trace = Math.max(0, this.state.trace - BROOM_TRACE);
				this.#say(m.hackers_prog_log_broom({ amount: BROOM_TRACE }));
				this.#play('sparkle', 0.6);
				break;
			case 'tool':
				this.#grantTool(program.app);
				break;
			case 'miner': {
				const level = this.state.upgrades.miner;
				if (level < toolSpec('miner').maxLevel) {
					this.state.upgrades = { ...this.state.upgrades, miner: level + 1 };
					this.#say(m.hackers_desk_log_app({ tool: TOOL_NAMES.miner(), level: level + 1 }));
				} else {
					this.state.score += 50;
					this.#say(m.hackers_desk_log_coins({ amount: 50 }));
				}
				this.#play('sparkle', 0.7);
				break;
			}
			case 'karaoke':
			case 'selfie':
				shiftClock(desktop, -NOISE_MS);
				this.state.score += NOISE_COINS;
				this.#say(
					program.kind === 'karaoke'
						? m.hackers_prog_log_karaoke({ amount: NOISE_COINS })
						: m.hackers_prog_log_selfie({ amount: NOISE_COINS })
				);
				this.#play('alarm', 0.4);
				this.#flash('fail');
				break;
		}
		haptic().play(0.2);
		this.#sync();
		this.#showDesktop();
	}

	/** Follows the desktop's network link: that system joins the target list for good */
	takeLink() {
		const desktop = this.#desktop;
		if (!desktop || this.status !== 'playing') return;
		const id = takeDesktopLink(desktop);
		if (!id) return;
		this.#saveProfile({ ...this.#profile(), network: [...this.network, id] });
		this.#say(m.hackers_net_log_found({ system: networkName(id) }));
		receive(
			'hackers',
			(ids) => {
				if (!ids.includes('hackers-network')) return [];
				this.#saveProfile({ ...this.#profile(), bank: this.bank + NETWORK_DOGELITE });
				return ['hackers-network'];
			},
			this.#store()
		);
		this.#play('chime-big', 0.8);
		this.#flash('ok');
		this.#showDesktop();
	}

	#ownerAt(ip: string): CastId {
		return NETWORK.find((system) => system.ip === ip)?.owner ?? ownerOf(ip);
	}

	#grantTool(app: 'breach' | 'keylog' | 'relays') {
		const level = this.state.upgrades[app];
		if (level < toolSpec(app).maxLevel) {
			this.state.upgrades = { ...this.state.upgrades, [app]: level + 1 };
			this.state.contract.spec = effectiveSpec(
				this.state.contract.n,
				this.state.upgrades,
				this.state.hardware
			);
			this.#say(m.hackers_desk_log_app({ tool: TOOL_NAMES[app](), level: level + 1 }));
		} else {
			// A tool already at the top is sold on for a little DogeLite
			this.state.score += 50;
			this.#say(m.hackers_desk_log_coins({ amount: 50 }));
		}
		this.#play('sparkle', 0.7);
	}

	/** Logs off the desktop; the next contract starts */
	leaveDesktop() {
		this.#desktop = null;
		this.desktop = null;
		this.desktopFolder = null;
		this.vaultInput = [];
	}

	#showDesktop() {
		this.desktop = this.#desktop ? { ...this.#desktop } : null;
	}

	/** Draws a little terminal onto the shared score card */
	drawBoard = (context: CanvasRenderingContext2D, x: number, y: number, size: number) => {
		context.fillStyle = '#021208';
		context.fillRect(x, y, size, size);
		context.strokeStyle = '#111111';
		context.lineWidth = Math.max(2, size * 0.012);
		context.strokeRect(x, y, size, size);
		context.fillStyle = '#39ff6a';
		context.font = `${Math.round(size * 0.07)}px monospace`;
		const lines = [
			`> ${this.state.contract.ip}`,
			`> ${this.state.contract.system}`,
			`> contracts: ${this.state.completed}`,
			`> dogelite: ${this.state.score}`,
			'> TRACED_'
		];
		lines.forEach((line, i) =>
			context.fillText(line, x + size * 0.06, y + size * (0.16 + i * 0.14))
		);
		const barWidth = size * 0.88;
		context.strokeRect(x + size * 0.06, y + size * 0.88, barWidth, size * 0.05);
		context.fillStyle = '#e5484d';
		context.fillRect(
			x + size * 0.06,
			y + size * 0.88,
			barWidth * (this.state.trace / TRACE_MAX),
			size * 0.05
		);
	};

	#apply(events: HackersEvent[]) {
		for (const event of events) this.#handle(event);
		this.#sync();
		if (this.#rivalDecided !== null) {
			this.#endRival(this.#rivalDecided);
			return;
		}
		if (this.state.over && this.status === 'playing') this.#finish();
	}

	#handle(event: HackersEvent) {
		switch (event.type) {
			case 'contract':
				this.input = [];
				this.#say(m.hackers_log_connect({ ip: event.ip, system: event.system }));
				break;
			case 'guess': {
				const hits = event.marks.filter((mark) => mark === 'hit').length;
				this.#say(m.hackers_log_guess({ hits, total: event.marks.length }));
				this.#play(hits > 0 ? 'click' : 'ui-error', 0.6);
				haptic().play(hits > 0 ? 0.2 : 0.35);
				if (hits === 0) this.#flash('fail');
				break;
			}
			case 'cracked':
				this.#say(m.hackers_log_cracked());
				this.#play('term-granted', 0.9);
				haptic().play(0.3);
				this.#flash('ok');
				break;
			case 'rotated':
				this.#say(m.hackers_log_rotated());
				this.#play('alarm', 0.6);
				haptic().play(0.4);
				this.#flash('fail');
				break;
			case 'key':
				this.#say(m.hackers_log_key({ letter: event.letter.toUpperCase() }));
				this.#play('pickup', 0.8);
				haptic().play(0.15);
				break;
			case 'honeypot':
				this.#say(m.hackers_log_wrong());
				this.#play('ui-error', 0.9);
				haptic().play(0.4);
				this.#flash('fail');
				break;
			case 'missed':
				this.#say(m.hackers_log_missed());
				this.#play('thud', 0.5);
				haptic().play(0.25);
				break;
			case 'keys-done':
				this.#say(m.hackers_log_keys());
				this.#play('chime-big', 0.8);
				haptic().play(0.3);
				this.#flash('ok');
				break;
			case 'relay':
				this.#play('ui-toggle', 0.6);
				haptic().play(0.1);
				break;
			case 'contract-done':
				if (this.#hack) {
					// Another player's rig: through its firewall, the server settles the loot
					this.#play('sparkle', 0.9);
					haptic().play(0.4);
					this.#flash('ok');
					this.#rivalDecided ??= true;
					break;
				}
				this.#say(m.hackers_log_done({ coins: event.points }));
				this.#play('sparkle', 0.9);
				haptic().play(0.4);
				this.#flash('ok');
				// The bank's desktop is open for a little while before the next contract; the
				// reactive fields still show the finished contract until the sync after the events
				this.desktopSystem = this.system;
				this.#desktop = createDesktop(
					this.#random,
					event.n,
					this.#ownerAt(this.ip),
					this.lore,
					this.network
				);
				this.desktopFolder = null;
				this.vaultInput = [];
				this.#showDesktop();
				break;
			case 'upgrade':
				this.#say(
					m.hackers_log_upgrade({
						tool: TOOL_NAMES[event.tool](),
						level: event.level,
						cost: event.cost
					})
				);
				this.#play('click', 0.7);
				haptic().play(0.2);
				break;
			case 'siphon':
				this.#say(m.hackers_log_siphon({ amount: event.amount, left: event.left }));
				this.#play('pickup', 0.5);
				break;
			case 'traced':
				// Traced on another player's rig: the hack fails, the trace stays in their log
				if (this.#hack) this.#rivalDecided ??= false;
				this.hurtCount += 1;
				this.#say(m.hackers_log_traced());
				this.#play('alarm', 1);
				haptic().play(0.7);
				this.#flash('fail');
				break;
			case 'game-over':
				break;
		}
	}

	#say(line: string) {
		this.log = [...this.log, line].slice(-LOG_LINES);
		this.logSeq += 1;
	}

	#flash(kind: 'ok' | 'fail') {
		this.flashKind = kind;
		this.flashSeq += 1;
	}

	#play(id: SoundId, intensity: number) {
		soundManager().play(id, intensity);
	}

	#sync() {
		const state = this.state;
		const contract = state.contract;
		this.score = state.score;
		this.lives = state.lives;
		this.trace = Math.min(TRACE_MAX, state.trace);
		// One warning each time the trace climbs into the danger zone
		if (this.status === 'playing') {
			if (this.trace >= TRACE_WARN && !this.#warned) {
				this.#warned = true;
				this.#play('term-warn', 0.8);
				haptic().play(0.5);
			} else if (this.trace < TRACE_WARN - 15) {
				this.#warned = false;
			}
		}
		this.stage = contract.stage;
		this.contractNumber = contract.n;
		this.completed = state.completed;
		this.ip = contract.ip;
		this.system = contract.system;
		this.guesses = [...contract.guesses];
		this.codeLength = contract.spec.codeLength;
		this.symbols = contract.spec.symbols;
		this.attemptsLeft = attemptsLeft(contract);
		this.captured = contract.keylog.passphrase.slice(0, contract.keylog.captured);
		this.passphraseLength = contract.keylog.passphrase.length;
		this.chips =
			contract.stage === 'keylog' ? contract.keylog.chips.map((chip) => ({ ...chip })) : [];
		this.panel = contract.panel;
		this.panelSize = contract.spec.panel;
		this.moves = contract.moves;
		this.par = contract.spec.presses;
		this.upgrades = { ...state.upgrades };
		this.incomePerSecond = minerIncome(state.upgrades, state.hardware);
		this.siphonRate = siphonShare(state.upgrades, state.hardware);
		this.siphonProgress = Math.min(1, state.siphonMs / SIPHON_DAY_MS);
		this.wallet = contract.wallet;
		this.walletStart = contract.walletStart;
		this.siphoned = state.siphoned;
		if (contract.stage !== 'breach' && this.input.length > 0) this.input = [];
	}

	#finish() {
		const result = this.#scores().submit(HACKERS_BEST_KEY, this.state.score);
		this.isNewBest = result.isNewBest;
		this.best = result.best;
		this.input = [];
		this.status = 'over';
		// What the run earned stays in the bank, even after a trace-out
		this.#saveProfile(bankRun(this.#profile(), this.state.score));
	}

	#profile(): HackersProfile {
		return {
			bank: this.bank,
			hardware: this.hardware,
			botnet: this.#botnet ?? emptyBotnet(),
			favorites: this.favorites,
			lore: this.lore,
			network: this.network,
			ip: this.ownIp,
			hacks: this.hacks,
			firewallSeen: this.#firewallSeen
		};
	}

	#applyProfile(profile: HackersProfile) {
		this.bank = profile.bank;
		this.hardware = { ...profile.hardware };
		this.favorites = [...profile.favorites];
		this.#botnet = profile.botnet;
		this.lore = [...(profile.lore ?? [])];
		this.network = [...(profile.network ?? [])];
		this.hacks = profile.hacks ?? 0;
		this.#firewallSeen = [...(profile.firewallSeen ?? [])];
		this.ownIp = profile.ip ?? '';
	}

	#saveProfile(profile: HackersProfile) {
		this.#applyProfile(profile);
		this.#store().write(HACKERS_PROFILE_KEY, profile);
	}
}
