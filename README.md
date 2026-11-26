# Nuxt Minimal Starter

Look at the [Nuxt documentation](https://nuxt.com/docs/getting-started/introduction) to learn more.

## Setup

Make sure to install dependencies:

```bash
# npm
npm install

# pnpm
pnpm install

# yarn
yarn install

# bun
bun install
```

## Development Server

Start the development server on `http://localhost:3000`:

```bash
# npm
npm run dev

# pnpm
pnpm dev

# yarn
yarn dev

# bun
bun run dev
```

## Production

Build the application for production:

```bash
# npm
npm run build

# pnpm
pnpm build

# yarn
yarn build

# bun
bun run build
```

Locally preview production build:

```bash
# npm
npm run preview

# pnpm
pnpm preview

# yarn
yarn preview

# bun
bun run preview
```

Check out the [deployment documentation](https://nuxt.com/docs/getting-started/deployment) for more information.

## Faith data

Faith settings, reading plans, the prayer list and worship check-ins need tables in Supabase.
`npm run migrate` applies `scripts/create_faith_profiles.sql` and `scripts/create_faith_common.sql`.
Details are in [docs/faith-traditions.md](docs/faith-traditions.md).

Until those tables exist, the app tells people that faith settings (or the reading plans, prayer list
and worship check-in) are not set up yet. The script names above are for operators: they appear in
this documentation and in the server log, not in the app.

## iOS & Android

Native apps use **Ionic + Capacitor** with the [@nuxtjs/ionic](https://ionic.nuxtjs.org/) module.

- **Development (emulator):** [docs/MOBILE.md](docs/MOBILE.md) — `npm run cap:sync:dev`, `NUXT_PUBLIC_API_BASE=http://10.0.2.2:3000`
- **Store release:** [docs/STORE_DEPLOYMENT.md](docs/STORE_DEPLOYMENT.md) — `npm run cap:sync` (HTTPS API required)
