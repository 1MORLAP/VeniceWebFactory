import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

// Pure scaffold — Astro 5 + Tailwind v4 via @tailwindcss/vite plugin.
// Static output. Add integrations per-build only if a customer truly needs them
// (image optimization, sitemaps, etc.) and document the choice in
// build-design-decisions.md.
export default defineConfig({
  output: 'static',
  vite: {
    plugins: [tailwindcss()],
  },
});
