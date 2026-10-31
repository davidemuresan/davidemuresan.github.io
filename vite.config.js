import { defineConfig } from 'vite';

// `base` matters only for GitHub Pages project sites (https://user.github.io/<repo>/).
// For a user site (davideboss2003.github.io) or Vercel, keep it as './' (relative paths work everywhere).
export default defineConfig({
  base: './',
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 900,
  },
});
