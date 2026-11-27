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

## Tax data

A household tax profile needs `tax_household_profiles`. Fiscal totals still read stored line overrides from `tax_deduction_overrides`.
`npm run migrate` applies `scripts/create_tax_household_profiles.sql`, which creates both tables and does not drop a table or delete rows.
Details are in [data/tax/README.md](data/tax/README.md).

Until the profile table exists, the Tax page tells people "Tax profile storage is not set up yet. Withholding below is unchanged."
The Tax page no longer asks someone to classify a line. Overrides already stored still apply the next time a line is saved.
`GET` and `PUT /api/tax/deduction-overrides` remain for that table. If the table is missing, those routes return "Line classification storage is not set up yet." People using the Tax page do not see that sentence.
The script name above is for operators: it appears in this documentation and in the server log, not in the app.

## Budget data

Budget setup and the budget tracker read the budget tables.
`npm run migrate` applies `scripts/create_budgets.sql`, `scripts/create_budget_transactions.sql`, and the later budget scripts in `scripts/run-migrations.mjs`.

If a page cannot load, people see "The budget could not be loaded. Try again in a moment." on Budget setup, or "The budget tracker could not be loaded. Try again in a moment." on the tracker.
The migrate command is for operators: it appears in this documentation and in the browser console, not in the app.

## Estate documents

New estate files upload only to the private Supabase Storage bucket `estate-docs`.
That needs `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. `ESTATE_DOCS_STORAGE` is not used.
If a file cannot be saved, Estate Management says "Couldn't save the file. Please try again."
Files already stored on disk stay readable and deletable from `ESTATE_DOCS_DIR` (default `uploads/estate-docs`).

## iOS & Android

Native apps use **Ionic + Capacitor** with the [@nuxtjs/ionic](https://ionic.nuxtjs.org/) module.

- **Development (emulator):** [docs/MOBILE.md](docs/MOBILE.md) — `npm run cap:sync:dev`, `NUXT_PUBLIC_API_BASE=http://10.0.2.2:3000`
- **Store release:** [docs/STORE_DEPLOYMENT.md](docs/STORE_DEPLOYMENT.md) — `npm run cap:sync` (HTTPS API required)
