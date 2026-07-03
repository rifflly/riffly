import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import pkg from './package.json' with { type: 'json' };

// Static files from /public that the service worker should precache (rule d).
const STATIC_PRECACHE = [
  './',
  './index.html',
  './manifest.json',
  './favicon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-192-maskable.png',
  './icons/icon-512-maskable.png',
  './icons/apple-touch-icon.png',
];

// Builds /sw.js from sw-template.js, injecting the exact list of hashed build
// assets to precache (so the app shell works fully offline). A content hash in
// the cache name guarantees every release is treated as an update.
function serviceWorkerPlugin() {
  return {
    name: 'riffly-service-worker',
    generateBundle(_options, bundle) {
      const built = Object.keys(bundle)
        .filter((name) => !name.endsWith('.map'))
        .map((name) => './' + name);
      const precache = [...new Set([...STATIC_PRECACHE, ...built])];

      const hash = createHash('sha256').update(JSON.stringify(precache)).digest('hex').slice(0, 8);
      const cacheName = `riffly-${pkg.version}-${hash}`;

      const template = readFileSync(fileURLToPath(new URL('./sw-template.js', import.meta.url)), 'utf8');
      const source = template
        .replaceAll('__CACHE_NAME__', cacheName)
        .replaceAll('__PRECACHE__', JSON.stringify(precache));

      this.emitFile({ type: 'asset', fileName: 'sw.js', source });
    },
  };
}

// base: './' produces relative asset URLs so the app works both at a domain
// root and under a GitHub Pages project subpath (https://user.github.io/riffly/)
// without knowing the repo name at build time.
export default defineConfig({
  base: './',
  plugins: [serviceWorkerPlugin()],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  build: {
    outDir: 'dist',
    target: 'es2020',
    sourcemap: true,
  },
});
