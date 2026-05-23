# Store deployment checklist

Use this guide when preparing **production** iOS/Android builds for the App Store and Google Play.

## Architecture

| Layer | Technology | Notes |
|--------|------------|--------|
| Mobile UI | Nuxt static shell in Capacitor | No `/api/*` in the APK/IPA |
| API | Deployed Nuxt/Nitro server | Must be **HTTPS** for store builds |
| Auth (mobile) | Supabase → JWT on `/api/*` | Legacy cookie login is **web only** |

## Environment variables

### Baked into the mobile app (set before `npm run cap:sync`)

| Variable | Required | Example |
|----------|----------|---------|
| `NUXT_PUBLIC_API_BASE` | Yes | `https://api.yourdomain.com` |
| `SUPABASE_URL` | Yes | `https://xxx.supabase.co` |
| `SUPABASE_PUBLISHABLE_KEY` | Yes | Supabase publishable key |

Validation runs automatically:

```bash
npm run build:mobile:prod   # fails if API base is not HTTPS
```

### Server only (deploy platform secrets)

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL |
| `CORS_ORIGINS` | Extra allowed origins (comma-separated) |
| `NUXT_PUBLIC_SITE_URL` | Your web app URL (added to CORS allowlist) |

Capacitor WebView origins (`https://localhost`, etc.) are allowed by default in `server/middleware/cors.ts`.

## Build commands

| Command | Use case |
|---------|----------|
| `npm run cap:sync` | **Store / production** — HTTPS API, strict Android networking |
| `npm run cap:sync:dev` | **Emulator + local dev** — HTTP `10.0.2.2`, cleartext (debug only) |
| `npm run cap:run:android` | Run on device/emulator (after sync) |

### Production workflow (clean deploy)

Use this when you want a **fresh** store build (wipes `dist/`, `.nuxt/`, and native `build/` folders, then rebuilds and syncs both platforms).

```bash
# 1. Set production .env (HTTPS API + Supabase)
# NUXT_PUBLIC_API_BASE=https://your-deployed-api.example.com

# Or one-off without editing .env (PowerShell):
#   $env:NUXT_PUBLIC_API_BASE="https://your-deployed-api.example.com"

# 2. Deploy the Nitro API (Vercel, Railway, etc.) with same env as web

# 3. Clean build + sync Android and iOS web bundles
npm run cap:deploy:prod

# 4. Release build in Android Studio / Xcode
npm run cap:android   # or cap:ios on macOS
```

| Command | Use case |
|---------|----------|
| `npm run cap:clean` | Remove artifacts only (no rebuild) |
| `npm run cap:deploy:prod` | **Clean + production build + `cap sync`** (recommended for store) |
| `npm run cap:sync` | Production build + sync (no clean) |

### Local emulator workflow

```bash
# .env: NUXT_PUBLIC_API_BASE=http://10.0.2.2:3000
npm run dev          # terminal 1
npm run cap:sync:dev # terminal 2
npm run cap:run:android
```

## App identity

| Platform | ID |
|----------|-----|
| Capacitor `appId` | `com.futurestar.myfin` |
| Android `applicationId` | `com.futurestar.myfin` |
| iOS bundle identifier | `com.futurestar.myfin` |

Change these only before first store submission if you need a different namespace.

## Security (implemented in repo)

- **Release Android:** HTTPS only, no cleartext (`network_security_config` + no `usesCleartextTraffic` in main manifest)
- **Debug Android:** cleartext allowed for `10.0.2.2` / localhost (`src/debug/`)
- **Capacitor:** `androidScheme: https` in production; `http` only when `CAPACITOR_DEV=true`
- **Backups:** `android:allowBackup="false"` (session tokens not backed up)
- **Native login:** Supabase only (JWT); legacy cookie login skipped on Capacitor

## Store console requirements (manual)

- [ ] Apple Developer / Google Play developer accounts
- [ ] App signing (release keystore / App Store Connect certificates)
- [ ] Privacy policy URL (required for finance apps)
- [ ] App Store / Play Data safety & privacy questionnaires
- [ ] Screenshots and store listing copy
- [ ] Version `versionCode` / `CFBundleVersion` bump per release (`android/app/build.gradle`, Xcode project)

## Pre-submit verification

1. `npm run build:mobile:prod` succeeds with your production `.env`.
2. Open `dist/index.html` — confirm `apiBase` is your **HTTPS** URL.
3. Install release build on a real device; sign in with Supabase credentials.
4. Exercise Estate, Budget, Tracker, Account tabs.
5. Confirm API calls in server logs (no 401/CORS errors).

## Related docs

- [MOBILE.md](./MOBILE.md) — day-to-day Capacitor development
- [.env.example](../.env.example) — environment template
