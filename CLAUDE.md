# Riffly — Project Memory

**Product:** Riffly, a beginner guitar coach PWA. Tagline **"Learn. Play. Riff."**
A free, zero-cost Progressive Web App that teaches a complete beginner to play
acoustic guitar. Shared publicly via a link, so it must work for multiple
independent users at zero cost with no backend server. All user data is stored
locally on each user's device (IndexedDB).

**Target platforms (all first-class):** iPhone Safari, Android Chrome, desktop
Chrome/Edge.

## Design language

Warm, encouraging, beginner-friendly. Warm coral/peach primary accent
(`#E8705A` range), soft purple secondary (`#7B6BA8` range), generous rounded
corners, large touch targets (min 44px), plain non-technical language in all UI
copy. Never intimidating. Mobile-first layout that also works on desktop.

## Architecture rules that must never be violated

a. **Zero cost:** no backend, no database server, no paid API. All personal data
   in IndexedDB on-device.

b. **One shared timing engine** drives ALL rhythmic features (metronome,
   chord-change trainer, practice studio scrolling). It uses Web Audio API
   lookahead scheduling (a scheduler that looks ahead ~100ms and schedules
   sounds on `audioContext.currentTime`). Never use `setInterval`/`setTimeout`
   for musical timing.

c. **iOS is first-class:** audio only starts after a user tap (single global
   "Tap to enable sound" unlock that resumes the AudioContext once per session);
   install is via Safari Share → Add to Home Screen (show a one-time instruction
   banner when running in iOS Safari and not installed); request
   `navigator.storage.persist()` on first run.

d. **Service worker:** cache-first for the app shell and data; show a "New
   version ready — tap to refresh" banner when an update is waiting; display the
   app version number on the Settings screen.

e. **Left-handed mode:** a global setting that mirrors all chord diagrams.

f. **All lesson and chord content lives in `/data` as JSON**, never hard-coded in
   components.

## Phase plan

- **Phase 1** = shell, timing engine, metronome, chord library, lessons stage
  1–2, progress.
- **Phase 2** = chord-change trainer, rhythm generator, song sheets + practice
  studio, backup/restore, lessons stage 3–4.
- **Phase 3** = mic tuner (pitchy/YIN), audio upload + looping, time-stretch
  (soundtouchjs), tap-along timing, AI tutor (bring-your-own-key), lessons
  stage 5.

## Testing rule

After implementing, **always run the dev server and check for console errors
before declaring done.**

---

## Working notes (for future sessions)

### Tech stack & constraints

- **Vanilla JS only** — no framework. Plain HTML/CSS/JS with ES modules. Vite is
  used as the dev server and build tool **only** (not a runtime dependency).
- **Allowed runtime libraries:** `pitchy` (pitch detection, Phase 3),
  `soundtouchjs` (time-stretch, Phase 3). **Nothing else without asking first.**
- No paid services. No npm packages that require a server.

### Commands

| Command          | What it does                                    |
| ---------------- | ----------------------------------------------- |
| `npm install`    | Install dev tooling (Vite).                     |
| `npm run dev`    | Start the Vite dev server.                      |
| `npm run build`  | Build the production site into `/dist`.         |
| `npm run preview`| Preview the production build locally.           |
| `npm run icons`  | Regenerate placeholder PWA icons from script.   |

### Project layout

```
index.html            App entry (Vite entry point)
/src                  JS modules
  main.js             Entry: CSS import + service-worker registration
  /styles             CSS (design tokens live in main.css)
/assets               Icon/image source artwork (e.g. icon-source.svg)
/data                 Lessons & chords as JSON (rule f) — loaded, never inlined
/public               Served at site root: manifest.json, sw.js, favicon.svg, /icons
/scripts              Build-time helpers (generate-icons.mjs)
.github/workflows     CI: deploy.yml builds with Vite → GitHub Pages
```

### Deployment

- GitHub Actions builds with Vite and publishes `/dist` to GitHub Pages on every
  push to `main` (`.github/workflows/deploy.yml`).
- `vite.config.js` sets `base: './'` (relative URLs) so the app works under a
  GitHub Pages project subpath (`https://<user>.github.io/<repo>/`) without
  hard-coding the repo name.
- App version is injected at build time via `__APP_VERSION__` (from
  `package.json` `version`) and will be shown on the Settings screen (rule d).

### Conventions

- Content is data-driven: read chords/lessons from `/data/*.json`.
- Use CSS custom properties from `src/styles/main.css` for all colours, radii,
  spacing, and the 44px touch minimum — don't hard-code palette values.
- Musical timing must go through the shared Web Audio lookahead scheduler
  (rule b) — never `setInterval`/`setTimeout`.
- UI is built with the tiny `el()`/`clear()` helpers in `src/ui/dom.js` (no
  framework). Screens are modules under `src/screens/` exporting `render()`.
- Routing is hash-based (`#/learn`, …) so it works on static hosting.

### Build status

**Phase 1 — in progress.**

Done:
- **Storage:** `src/storage/kv.js` (IndexedDB key/value, degrades gracefully) +
  `settings.js` (cached settings) + `persist.js` (`storage.persist()` on first run).
- **Audio:** `src/audio/audio-engine.js` — one global AudioContext + iOS unlock
  (`unlockAudio()` resumes + plays a silent buffer inside a user gesture).
- **Timing engine:** `src/audio/timing-engine.js` — the shared Web Audio
  lookahead scheduler (rule b). NOTE: the `setTimeout` inside `_loop()` only
  *wakes* the scheduler; every musical event is stamped on
  `audioContext.currentTime`. This is the mandated pattern, not a violation.
  Deterministic test: `npm test` (`scripts/test-timing.mjs`, fake clock).
- **Shell:** header + screen router + bottom tab bar (Learn / Chords / Practice /
  Settings) in `src/ui/shell.js`; audio-unlock banner and one-time iOS install
  banner; functional Settings screen (sound status, left-handed toggle, install
  help, app version). Other screens are friendly placeholders.

Next in Phase 1: metronome (first real consumer of the timing engine, lives on
Practice), then chord library, lessons stage 1–2, progress. Rule (d)'s "New
version ready" update banner + real service-worker caching still to come.

### Testing

- `npm test` runs the timing-engine unit test (no browser needed).
- Browser check (testing rule): `npm run dev`, then load in a browser and
  confirm no console errors. During development this was verified with a headless
  Chrome DevTools-Protocol smoke test capturing console output + rendered DOM.
