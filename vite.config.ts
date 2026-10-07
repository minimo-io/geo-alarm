import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import adapter from '@sveltejs/adapter-static';
import { defineConfig } from 'vite';

// SvelteKit 3: configuration lives here (svelte.config.js is no longer supported).
export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit({
			compilerOptions: { runes: true },
			// Static output: the whole app is a client-side PWA, no server needed.
			adapter: adapter({ fallback: '200.html' })
		})
	]
});
