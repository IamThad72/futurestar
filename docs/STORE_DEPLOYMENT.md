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
| `SUPABASE_SERVICE_ROLE_KEY` | **Required for password reset** on legacy accounts (creates Auth user + sends email) |
| `CORS_ORIGINS` | Extra allowed origins (comma-separated) |
| `NUXT_PUBLIC_SITE_URL` | Your web app URL (added to CORS allowlist and password-reset redirect) |

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
| Capacitor `appId` | `com.futurestar.app` |
| Android `applicationId` | `com.futurestar.app` |
| iOS bundle identifier | `com.futurestar.app` |

The permanent app identifier is `com.futurestar.app` on Capacitor, Android, and iOS (`capacitor.config.ts`, `android/app/build.gradle` `applicationId` and `namespace`, and `PRODUCT_BUNDLE_IDENTIFIER` in the Xcode project). `MainActivity` lives in that same package. No store upload used `com.futurestar.myfin`. Do not change `com.futurestar.app` after the first App Store or Play Store upload.

## Security (implemented in repo)

- **Release Android:** HTTPS only, no cleartext (`network_security_config` + no `usesCleartextTraffic` in main manifest)
- **Debug Android:** cleartext allowed for `10.0.2.2` / localhost (`src/debug/`)
- **Capacitor:** `androidScheme: https` in production; `http` only when `CAPACITOR_DEV=true`
- **Backups:** `android:allowBackup="false"` (session tokens not backed up)
- **Native login:** Supabase only (JWT); legacy cookie login skipped on Capacitor

## Account deletion

A signed-in person deletes their account from You → Privacy and data → Delete account, or from the public page `/delete-account` (that page explains the steps when nobody is signed in). Use `https://<production-host>/delete-account` as the web deletion link in App Store Connect and Play Console.

The owner decided on Nov 26, 2026: shared household money stays (`keep-shared`). Household tax profiles and deduction overrides stay. A same-name income, investment, or savings source is kept and renamed with ` (former member)`, then ` 2`, ` 3`, and so on if needed. When the last person leaves, household rows are deleted, including rows that still name someone who already left. Private Faith and Body rows, the profile, and sessions are erased. Private asset, vehicle, and cash or investment rows that are not in a household (group_id is null) are detached from the person and kept for 90 days, then deleted by the daily cleanup job. That hold includes the holdings on a private cash or investment account and the service history on a private vehicle. They are not shown in the app during that time. Shared household copies of those records, including shared holdings and service history, stay with the household. The privacy policy (PR #14) still needs this 90-day disclosure. The sign-in id is kept so that sign-in cannot open a new account; if removing it does not finish immediately, a daily job retries it. The Vercel account is on Hobby, which allows only one run per day and starts that run sometime during the scheduled hour. A more frequent retry would need Vercel Pro, which is an owner decision. Deleting the app does not delete the account. Before release, run the foreign-key audit and all four household scenarios on a preview database with throwaway accounts, never production.

## Store console requirements (manual)

- [ ] Apple Developer / Google Play developer accounts
- [ ] App signing (release keystore / App Store Connect certificates)
- [ ] Privacy policy URL: ________ (required for finance apps and for both stores). No privacy page is in the app yet, so publish the URL before the first upload.
- [ ] Account deletion URL: ________ (required by Apple). In the app: You → Privacy and data → Delete account. On the web: `/delete-account`. Publish that URL before the first upload.
- [ ] Build with Xcode 26 or later (App Store Connect requirement since April 28, 2026)
- [ ] Target API 36 (Google Play requirement from August 31, 2026). Already set: `compileSdkVersion` and `targetSdkVersion` are 36 in `android/variables.gradle`.
- [ ] App Store / Play Data safety & privacy questionnaires
- [ ] Screenshots and store listing copy
- [ ] Version `versionCode` / `CFBundleVersion` bump per release (`android/app/build.gradle`, Xcode project). Do not bump those in a feature pull request.

## Pre-submit verification

1. `npm run build:mobile:prod` succeeds with your production `.env`.
2. Open `dist/index.html` — confirm `apiBase` is your **HTTPS** URL.
3. Install release build on a real device; sign in with Supabase credentials.
4. Exercise the Today, Money, Faith, Body, and You tabs (`/today`, `/financial`, `/spiritual`, `/physical`, `/account`).
5. Confirm API calls in server logs (no 401/CORS errors).

## Related docs

- [MOBILE.md](./MOBILE.md) — day-to-day Capacitor development
- [.env.example](../.env.example) — environment template
