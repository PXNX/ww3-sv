// The bot's public face: name, description (the empty chat before Start), short description (the
// "info" on the profile and in link previews), the command menu, the menu button that opens the
// game as a Mini App (so it launches with the player's Telegram account) and the profile photo. They rarely
// change, so an admin applies them on demand with /set_cmd, in English and German.

import { api, fetch } from 'sdk';
import { APP_URL } from './generated.js';

export const BOT_NAME = 'World War 3';

// At most 512 characters
const DESCRIPTION = {
  en:
    'World War 3 is a satirical cartoon puzzle and arcade collection about oil, shipping and geopolitics 🌍\n\n' +
    'Over 30 quick games: steer tankers past mines, shoot down drones, keep the oil flowing, free a stuck ship and more. ' +
    'Daily rewards, a career with ranks and your own customisable agent.\n\n' +
    'Press Start and open the game. Free to play; revival tokens and Pro are available for Telegram Stars.',
  de:
    'World War 3 ist eine satirische Cartoon-Sammlung aus Puzzle- und Arcade-Spielen über Öl, Schifffahrt und Geopolitik 🌍\n\n' +
    'Über 30 schnelle Spiele: Tanker an Minen vorbeisteuern, Drohnen abschießen, das Öl am Fließen halten, ein festgefahrenes Schiff befreien und mehr. ' +
    'Tägliche Belohnungen, eine Karriere mit Rängen und dein eigener Agent zum Gestalten.\n\n' +
    'Tippe auf Start und öffne das Spiel. Kostenlos spielbar; Revival-Token und Pro gibt es für Telegram Stars.',
};

// At most 120 characters
const SHORT_DESCRIPTION = {
  en: 'Satirical cartoon puzzle & arcade games about oil, shipping and geopolitics. Play right here in Telegram.',
  de: 'Satirische Cartoon-Puzzle- und Arcade-Spiele über Öl, Schifffahrt und Geopolitik. Direkt in Telegram spielen.',
};

const COMMANDS = {
  en: [
    ['start', 'Open the game'],
    ['shop', 'Revival tokens and Pro'],
    ['wallet', 'What you bought'],
    ['login', 'Open your profile'],
    ['reminders', 'Streak reminders on or off'],
    ['paysupport', 'Help with purchases'],
    ['agb', 'Terms (AGB)'],
    ['widerruf', 'Right of withdrawal'],
    ['datenschutz', 'Privacy policy'],
    ['impressum', 'Legal notice'],
  ],
  de: [
    ['start', 'Spiel öffnen'],
    ['shop', 'Revival-Token und Pro'],
    ['wallet', 'Deine Käufe'],
    ['login', 'Dein Profil öffnen'],
    ['reminders', 'Serien-Erinnerungen an oder aus'],
    ['paysupport', 'Hilfe zu Käufen'],
    ['agb', 'Allgemeine Geschäftsbedingungen'],
    ['widerruf', 'Widerrufsbelehrung'],
    ['datenschutz', 'Datenschutzerklärung'],
    ['impressum', 'Impressum'],
  ],
};

// res/profile.jpg, read next to the project; Telegram only takes the photo as an upload
const PHOTO = new URL('../../res/profile.jpg', import.meta.url);

/** Applies everything; returns one line per step that failed, so the admin sees what is missing */
export async function applyProfile() {
  const errors = [];
  const attempt = async (label, step) => {
    try {
      await step();
    } catch (error) {
      errors.push(`${label}: ${error.description ?? error.message}`);
    }
  };

  await attempt('Profile photo', async () => {
    const photo = await (await fetch(PHOTO)).blob();
    await api.setMyProfilePhoto({ photo: { type: 'static', photo: 'attach://profile' }, profile: new Blob([photo], { type: 'image/jpeg' }) });
  });
  for (const [language, code] of [['en', undefined], ['de', 'de']]) {
    const scope = code ? { language_code: code } : {};
    await attempt(`Texts (${language})`, async () => {
      await api.setMyName({ name: BOT_NAME, ...scope });
      await api.setMyDescription({ description: DESCRIPTION[language], ...scope });
      await api.setMyShortDescription({ short_description: SHORT_DESCRIPTION[language], ...scope });
      await api.setMyCommands({ commands: COMMANDS[language].map(([command, description]) => ({ command, description })), ...scope });
    });
  }
  if (APP_URL) {
    await attempt('Menu button', () => api.setChatMenuButton({ menu_button: { type: 'web_app', text: 'Play', web_app: { url: APP_URL } } }));
  }
  for (const error of errors) console.warn('[profile]', error);
  return errors;
}
