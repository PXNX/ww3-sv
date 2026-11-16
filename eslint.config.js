import prettier from 'eslint-config-prettier';
import { fileURLToPath } from 'node:url';
import { includeIgnoreFile } from '@eslint/compat';
import js from '@eslint/js';
import svelte from 'eslint-plugin-svelte';
import { defineConfig } from 'eslint/config';
import globals from 'globals';
import ts from 'typescript-eslint';

const gitignorePath = fileURLToPath(new URL('./.gitignore', import.meta.url));

export default defineConfig(
	includeIgnoreFile(gitignorePath),
	// The Telegram bot is Python with its own tests (see bot/README.md)
	{ ignores: ['bot/**'] },
	js.configs.recommended,
	...ts.configs.recommended,
	...svelte.configs.recommended,
	prettier,
	...svelte.configs.prettier,
	{
		languageOptions: {
			globals: { ...globals.browser, ...globals.node }
		},
		rules: {
			// typescript-eslint strongly recommend that you do not use the no-undef lint rule on TypeScript projects.
			// see: https://typescript-eslint.io/troubleshooting/faqs/eslint/#i-get-errors-from-the-no-undef-rule-about-global-variables-not-being-defined-even-though-there-are-no-typescript-errors
			'no-undef': 'off',
			// resolve() has one overload per route, so the registry wraps it in a typed cast before
			// handing hrefs to links and goto(). Those calls are already type-checked and resolve()d.
			'svelte/no-navigation-without-resolve': 'off'
		}
	},
	// Svelte needs the TypeScript parser, but not a full type-checked program: no rule in this
	// config needs type information, and building one for the generated message modules made lint
	// take minutes. Keeping it syntax-only lets `bun lint` run in CI and on deploy.
	{
		files: ['**/*.svelte', '**/*.svelte.ts', '**/*.svelte.js'],
		languageOptions: {
			parserOptions: {
				extraFileExtensions: ['.svelte'],
				parser: ts.parser
			}
		}
	}
);
