# Riffly 🎸

**Learn. Play. Riff.** — a free, offline-first Progressive Web App that teaches
complete beginners to play acoustic guitar. No accounts, no servers, no cost.
All your progress stays on your device.

Built with vanilla JavaScript + [Vite](https://vitejs.dev/). See
[CLAUDE.md](./CLAUDE.md) for the full project memory, architecture rules, and
phase plan.

## What's inside

- **Learn** — 18 lessons across 5 stages, from your first note to playing whole
  songs, with a chord library and left-handed mode.
- **Tuner** — a microphone tuner (with reference tones to tune by ear).
- **Play** — a metronome, a chord-change trainer, and a strum/drum backing-rhythm
  generator, all on one shared Web Audio timing engine.
- **Songs** — a Practice Studio that scrolls chords/lyrics in time, with an App
  Rhythm backing, count-in, and tempo control. Import songs (ChordPro), or add
  your own audio track to play along, loop a section, tap-align the lyrics, and
  slow it down without changing pitch.
- **Ask** — an optional AI tutor you power with your own free API key.
- Works fully **offline** and installs to your home screen.

## Share it with friends 🎁

Riffly is one link. Send someone
**[rifflly.github.io/riffly](https://rifflly.github.io/riffly)** and they can
start learning immediately — no sign-up, no app store, nothing to pay.

Everything each person does stays **on their own device**: their progress,
streak, songs, uploaded audio, and (if they add one) their AI tutor key are all
stored locally in the browser and never sent to any server. Your friend's data
is theirs alone; you never see it and neither does anyone else.

**To install** (so it feels like a real app and works offline):

- **iPhone (Safari):** tap the **Share** button → **Add to Home Screen**.
- **Android (Chrome):** tap the **⋮** menu → **Install app** / **Add to Home
  Screen**.
- **Desktop (Chrome/Edge):** click the **install** icon in the address bar.

To back up or move to a new device, use **Settings → Back up my data** (and
**Restore** on the other device).

## Develop

```bash
npm install
npm run dev
```

## Deploy (GitHub Pages)

Deployment is automatic. **1)** In your GitHub repo, go to **Settings → Pages →
Build and deployment → Source** and choose **GitHub Actions**. **2)** Push to
`main` — the workflow in `.github/workflows/deploy.yml` builds with Vite and
publishes `/dist` to Pages. Your site appears at
`https://<your-username>.github.io/<repo>/`.
