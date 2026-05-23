# iOS & Android (Ionic + Capacitor)

This project uses [@nuxtjs/ionic](https://ionic.nuxtjs.org/) and [Capacitor](https://capacitorjs.com/) to ship the same Nuxt UI as native apps.

For **App Store / Play Store** submission, see [STORE_DEPLOYMENT.md](./STORE_DEPLOYMENT.md).

## Prerequisites

- Node.js (see Nuxt docs)
- **Android:** [Android Studio](https://developer.android.com/studio) + SDK
- **iOS (macOS only):** [Xcode](https://developer.apple.com/xcode/)
- [Capacitor environment setup](https://capacitorjs.com/docs/getting-started/environment-setup)

## How it works

1. `npm run build:mobile:prod` (or `build:mobile:dev` for emulator) runs `nuxt generate` with **`NUXT_CAPACITOR=true`** (hash routing) → `dist/`.
2. A post-build check writes `dist/.capacitor-hash-build.json` and verifies the bundle.
3. `npx cap sync` copies `dist/` into `android/` and `ios/`.
4. You build/run from Android Studio or Xcode (or via `cap run`).

The mobile app is a **static shell**. API routes (`/api/*`) are **not** bundled. Set `NUXT_PUBLIC_API_BASE` to your deployed **HTTPS** backend (store builds) or `http://10.0.2.2:3000` for Android emulator + local `npm run dev`.

## Hash routing (required for navigation)

Capacitor has no server to handle `/estate_mgmt` as a real path. Mobile builds use **hash mode** (`#/estate_mgmt`) so the WebView always loads `index.html` and Vue Router swaps pages.

| Do | Don't |
|----|--------|
| `npm run cap:sync:dev` after web changes | `nuxt generate` or `npm run generate` alone for native |
| `npm run cap:run:android` (syncs first) | `cap:run:android:live` after routing/UI changes (stale bundle) |
| Check URLs in Chrome inspect: `https://localhost/#/estate_mgmt` | Paths without `#` on native (`/estate_mgmt` → 404) |

If tabs still fail after a correct sync, use Chrome **Remote debugging** (`chrome://inspect`) and confirm the URL includes `#` when you tap a tab.

## Mobile tab bar

When signed in on a phone or native app, a bottom tab bar appears with:

- **Estate** → `/estate_mgmt`
- **Budget** → `/cash_flow_mgmt`
- **Tracker** → `/cash_flow_tracker`
- **Account** → `/account`

The hamburger nav and footer are hidden in this mode; the top bar keeps the logo and user menu.

## Icons & splash screen

Branding is generated from `resources/icon-only.png` and `resources/splash.png` (built by `scripts/generate-app-assets.mjs`).

```bash
npm run cap:assets    # regenerate PNG sources + Android/iOS/PWA assets
npm run cap:sync      # production build + sync
```

## Commands

| Command | Description |
|--------|-------------|
| `npm run build:mobile:prod` | Production static build (HTTPS API required) |
| `npm run build:mobile:dev` | Dev static build (HTTP API OK) |
| `npm run cap:clean` | Remove `dist/`, `.nuxt/`, native `build/` outputs |
| `npm run cap:deploy:prod` | Clean + production build + sync (store releases) |
| `npm run cap:sync` | Production build + sync to native projects |
| `npm run cap:sync:dev` | Dev build + sync (`CAPACITOR_DEV=true`, HTTP emulator) |
| `npm run cap:android` | Open Android Studio |
| `npm run cap:ios` | Open Xcode |
| `npm run cap:run:android` | Dev sync + run on device/emulator (**preferred**) |
| `npm run cap:refresh:android` | Uninstall app + full rebuild + sync + run (use when UI/nav is stale) |
| `npm run cap:run:android:live` | Run without sync (warns; only if you already synced) |
| `npm run cap:run:ios` | Build, sync, run on simulator/device |

## First-time workflow (production API)

```bash
# 1. Point native app at your HTTPS API (see .env.example)
# NUXT_PUBLIC_API_BASE=https://your-deployed-app.example.com

# 2. Build and sync
npm run cap:sync

# 3. Open native IDE and run
npm run cap:android   # or cap:ios on macOS
```

After every web change, run `npm run cap:sync` (or `cap:sync:dev` for emulator) before re-running the app. **`cap:run:android:live` does not copy a new `dist/`** — use it only when the web bundle is already up to date.

### Navigation does nothing

Usually:

- **Stale native bundle** — run `npm run cap:sync:dev`, then `npm run cap:run:android` (not `:live`).
- **Wrong build** — plain `nuxt generate` omits hash mode; use `build:mobile:dev` / `cap:sync:dev`.
- **History URL in WebView** — address bar shows `/login` not `#/login`; resync with `cap:sync:dev`.

## Android emulator + local API

The emulator cannot reach your PC at `localhost`. Use the host loopback alias:

1. In `.env`:

   ```env
   NUXT_PUBLIC_API_BASE=http://10.0.2.2:3000
   ```

2. Start the API:

   ```bash
   npm run dev
   ```

3. Build and sync with **dev** flags (HTTP + cleartext):

   ```bash
   npm run cap:sync:dev
   ```

4. Run:

   ```bash
   npm run cap:run:android
   ```

Do **not** use `npm run cap:sync` for emulator testing if your API is HTTP — production sync requires `https://` API base.

### “500” screen on launch

Usually one of:

- **`NUXT_PUBLIC_API_BASE` was empty** when you synced — API calls hit the WebView origin instead of your server.
- **Wrong sync command** — HTTP API needs `cap:sync:dev`, not `cap:sync`.
- **Mixed content** — production WebView (`https://localhost`) cannot call `http://10.0.2.2`; use `cap:sync:dev`.
- **No API running** — `npm run dev` must be running for emulator testing.

Chrome **Remote debugging** (`chrome://inspect`) shows failed `/api/` URLs in the Network tab.

## App identifiers

- **Capacitor app id:** `com.futurestar.myfin` (`capacitor.config.ts`)
- **Android / iOS bundle:** `com.futurestar.myfin`

## Store submission

See [STORE_DEPLOYMENT.md](./STORE_DEPLOYMENT.md) and [Capacitor deployment docs](https://capacitorjs.com/docs/deployment).
