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

- **Metronome** (Practice screen): first real consumer of the timing engine.
  `src/audio/click.js` (Web Audio tick synth, accented downbeat),
  `src/audio/timing.js` (the single shared engine instance — rule b),
  `src/audio/metronome.js` (controller: click scheduler + rAF visual sync),
  `src/screens/practice.js` (UI: tempo slider/steppers, tap tempo, beats-per-bar,
  pulsing beat dots, Start/Stop). Gated behind audio unlock. Tempo + beats
  persisted to settings. Screens can set `el._dispose` for cleanup; the shell
  calls it on navigation so the metronome stops when you leave the tab.

- **Chord library** (Chords screen): data-driven from `/data/chords.json`
  (rule f). `src/ui/chord-diagram.js` renders SVG diagrams and mirrors them for
  left-handed mode (rule e) by reversing string index mapping (text stays
  upright). `src/ui/modal.js` is a reusable overlay. `src/screens/chords.js`
  shows a tappable grid → detail modal with the big diagram + a beginner tip.
  Nine beginner open chords (Em, Am, D, E, A, Dm, C, G, G7).

- **Lessons + progress** (Learn screen): guided path, stages 1–2, data-driven
  from `/data/lessons.json` (rule f). `src/content.js` centralises lesson/chord
  data + `getChord()`. `src/storage/progress.js` persists completed lessons to
  IndexedDB (loaded at boot). `src/ui/lesson-steps.js` renders step types
  (text, tip, chord, practice checklist, metronome). `src/ui/lesson-metronome.js`
  embeds the shared metronome inside a lesson step. `src/screens/learn.js` has
  two in-screen views (path with progress bar + per-lesson checkmarks, and the
  lesson player with "I did it!"). Chords screen now also reads from content.js.

- **Offline + updates** (rule d): `sw-template.js` is the service-worker source;
  a Vite plugin in `vite.config.js` injects the precache manifest (all hashed
  build assets + static files) and a content-hashed cache name, emitting
  `dist/sw.js`. Strategy: precache the shell on install; navigations are
  network-first (fresh assets online) falling back to the cached shell offline;
  everything else is cache-first (hashed assets are immutable). `src/pwa.js`
  registers the SW (production only) and shows the "New version ready — tap to
  refresh" banner via `updatefound`; Refresh posts `SKIP_WAITING` and reloads on
  `controllerchange`. The old placeholder `public/sw.js` was removed.

**✅ Phase 1 is COMPLETE** — shell, shared timing engine, metronome, chord
library (+ left-handed), lessons 1–2, progress, and offline/update support.

**✅ Phase 2 is COMPLETE (v0.6.0).** Added:

- **Chord-change trainer** (Practice tab → Changes): `src/audio/chord-trainer.js`
  (shared controller), `src/screens/practice/chord-changes.js`. Two diagrams,
  highlight flips on the bar line, preset curriculum pairs + custom pickers,
  steady / speed-up (+4 BPM per 4 bars) modes, and a 1-minute self-scored
  challenge (per-pair best). The Practice tab is now a hub
  (`src/screens/practice.js`) switching Metronome / Changes / Rhythm; metronome
  moved to `src/screens/practice/metronome-tool.js`.
- **Practice streak + scores:** `src/storage/stats.js` (daily streak, trainer
  bests, practised songs), loaded at boot.
- **Backing-rhythm generator:** `src/audio/backing.js` (`BackingRhythm`, with
  `start/stop/setPattern/setChord/setTempo` + `attach/detach/setStartBeat` so the
  studio can drive it on its own engine run). Patterns: down strums, D-DU-UDU,
  folk 3/4, rock beat. Voices: `src/audio/chord-synth.js` (Karplus-Strong strum,
  per-pitch buffer cache) + `src/audio/drums.js` (kick/snare/hats). UI:
  `src/screens/practice/backing-tool.js`.
- **Song sheets (rule f):** `src/songs/song-model.js` (schema + normalize +
  timing helpers), `src/songs/chordpro.js` (ChordPro inline + two-line import,
  ChordPro export, directives; dependency-free for Node tests),
  `src/storage/songs.js` (user songs in IndexedDB, created/modified dates),
  `src/songs/song-library.js` (starters + user). Three public-domain starters in
  `/data/songs`. Editor + import screens under `src/screens/songs/`; shared
  chords-above-lyrics renderer `src/ui/song-view.js`; chord-picker modal
  `src/ui/chord-picker.js`.
- **Practice Studio:** `src/screens/songs/studio.js` — Play/Sing/Both views,
  count-in, tempo override (50–100%), App Rhythm / Silent backing (My Audio shown
  disabled), auto-scroll keeping the current line in the upper third. SYNC:
  current line + scroll integrated from `audioContext.currentTime` deltas (never
  wall-clock), so pause/resume + tempo changes stay locked (rule b). Completing a
  song marks it practised. NOTE: `#app` is now viewport-bounded so `.screen` is
  the scroll container (fixed header + scrolling content + fixed bottom nav).
- **Backup & restore:** `src/storage/backup.js` + Settings → Your data. Downloads
  `riffly-backup-YYYY-MM-DD.json` (settings, progress, stats, user songs — no
  uploaded audio); restore validates → previews a summary → replaces → reloads.
  Store `replace*` helpers added to settings/progress/stats/songs.
- **Lessons stages 3 & 4** (`data/lessons.json`, 15 lessons total): rhythm +
  chord-change + F-chord content. New step types in `src/ui/lesson-steps.js`:
  `trainer` (`src/ui/lesson-trainer.js`), `rhythm` (`src/ui/lesson-rhythm.js`),
  `strum` (notation). Added mini-F (`Fmini`) + full barre `F` to
  `data/chords.json` (11 chords).

Next: Phase 3 (mic tuner, audio upload + looping, time-stretch, tap-along, AI
tutor, lessons stage 5).

### Testing

- `npm test` runs the timing-engine unit test + the song model/parser tests
  (`scripts/test-songs.mjs`: inline/two-line/directive parsing, unknown-chord
  surfacing, starter round-trip + in-bounds positions). No browser needed.
- Browser check (testing rule): `npm run dev`, then load in a browser and
  confirm no console errors. During development this was verified with a headless
  Chrome DevTools-Protocol smoke test capturing console output + rendered DOM.
