import { defineConfig } from 'vite';
import pkg from './package.json' with { type: 'json' };

// base: './' produces relative asset URLs so the app works both at a domain
// root and under a GitHub Pages project subpath (https://user.github.io/riffly/)
// without knowing the repo name at build time.
export default defineConfig({
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  build: {
    outDir: 'dist',
    target: 'es2020',
    sourcemap: true,
  },
});
