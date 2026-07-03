# Riffly 🎸

**Learn. Play. Riff.** — a free, offline-first Progressive Web App that teaches
complete beginners to play acoustic guitar. No accounts, no servers, no cost.
All your progress stays on your device.

Built with vanilla JavaScript + [Vite](https://vitejs.dev/). See
[CLAUDE.md](./CLAUDE.md) for the full project memory, architecture rules, and
phase plan.

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
