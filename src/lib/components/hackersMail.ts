/*
 * The texts of the cast's emails in Hermit Hackers, by email id (see game/hackers/lore.ts), shared
 * by the desktop's inbox and the terminal's mail archive.
 */
import { m } from '#lib/paraglide/messages.js';

const SUBJECTS: (() => string)[] = [
	m.hackers_mail_0_subject,
	m.hackers_mail_1_subject,
	m.hackers_mail_2_subject,
	m.hackers_mail_3_subject,
	m.hackers_mail_4_subject,
	m.hackers_mail_5_subject,
	m.hackers_mail_6_subject,
	m.hackers_mail_7_subject,
	m.hackers_mail_8_subject,
	m.hackers_mail_9_subject,
	m.hackers_mail_10_subject,
	m.hackers_mail_11_subject,
	m.hackers_mail_12_subject,
	m.hackers_mail_13_subject,
	m.hackers_mail_14_subject,
	m.hackers_mail_15_subject
];

const BODIES: (() => string)[] = [
	m.hackers_mail_0_body,
	m.hackers_mail_1_body,
	m.hackers_mail_2_body,
	m.hackers_mail_3_body,
	m.hackers_mail_4_body,
	m.hackers_mail_5_body,
	m.hackers_mail_6_body,
	m.hackers_mail_7_body,
	m.hackers_mail_8_body,
	m.hackers_mail_9_body,
	m.hackers_mail_10_body,
	m.hackers_mail_11_body,
	m.hackers_mail_12_body,
	m.hackers_mail_13_body,
	m.hackers_mail_14_body,
	m.hackers_mail_15_body
];

export const mailSubject = (id: number): string => SUBJECTS[id]?.() ?? '';
export const mailBody = (id: number): string => BODIES[id]?.() ?? '';
