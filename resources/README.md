# App icon & splash sources

- `icon-only.png` — 1024×1024 app icon
- `splash.png` — 2732×2732 splash screen

Regenerate native assets:

```bash
node scripts/generate-app-assets.mjs
npm run cap:assets
npm run cap:sync
```

Edit the SVG in `scripts/generate-app-assets.mjs` to change branding.
