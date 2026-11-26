# Store privacy inventory

Draft for the owner. It matches the draft privacy policy in `utils/legalText.js` (last updated 2026-11-26). Fill Apple App Privacy and Google Play Data safety from these tables, then confirm the rows marked for the owner. This file is not legal advice.

Account deletion follows the rule the owner confirmed: `keep-shared`. Shared household money stays with the household. Private data is erased. The screens are in pull request 10 and are not on `main` until that change is merged. Until then, `/delete-account` is not in this branch.

No advertising SDK, analytics SDK, or advertising-identifier request was found in the app code. Third-party calls below are for the named feature. Confirm “no tracking” and “no advertising” on the store forms before submitting. This inventory does not say personal information is sold, and it does not say it is never sold.

## Apple App Privacy

| Data | Apple category | Collected | Purpose | Linked to the person | Shared with | Optional | Deletable |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Email address | Contact Info | Yes | Account and sign-in | Yes | Supabase Auth. The address is also stored in PostgreSQL (Supabase when the database URL points there). | No. An account needs an email. | Erased with the account. |
| Display name | Contact Info | Yes, if the person sets one | Show the name in the app | Yes | Stored with the account (PostgreSQL / Supabase). Not sent to Groq or the lookup APIs. | Yes | Erased with the account. |
| Profile photo | User Content (Photos) | Yes, if the person adds one | Show the photo on the account | Yes | Stored as image data on the account row. Not a separate photo host. | Yes | Erased with the account. |
| Session and user ids | Identifiers (User ID) | Yes | Keep the person signed in | Yes | Supabase Auth for the Supabase user id. Session cookie on the web; access token in the phone app. | No, while signed in | Erased with the account. Sessions stop working. |
| Budgets, transactions, income, debt, savings, investments, tax figures, insurance, real estate, account map | Financial Info | Yes, when the person enters them | The money tools | Yes | Household members, when accounts are linked. Groq receives only the slices named in the policy (a sentence, import rows, repeated merchant names, a month-close summary). Alpha Vantage receives ticker symbols only. | Yes. The feature stores nothing until the person enters it. | Stay with the household when other members remain. Erased if the person is not in a household, or is the last member. |
| Estate documents | User Content (Other) and Photos or files | Yes, when uploaded | Store wills and other files the person chooses | Yes | Household members for household documents. File bytes: server disk, or Supabase Storage when configured. | Yes | Removed when that document is deleted. A document handed to the household stays, including the file. |
| Vehicles and service records | Other Data (no closer Apple type) | Yes, when entered | Vehicle records | Yes | Household members. The browser sends make, model, and year lookups to NHTSA. No VIN is sent in that lookup. | Yes | Same as other household money records. |
| Nutrition plan, food logs, saved foods | Health and Fitness | Yes, when entered | Nutrition journal | Yes | Not shared with the household. USDA receives search words. Open Food Facts receives barcode digits. Groq receives a meal sentence, or recent food names with calorie and protein numbers, when that feature runs. | Yes | Erased with the account. Private. |
| Workouts and training journal | Health and Fitness | Yes, when entered | Training log and plans | Yes | Not shared with the household. Groq receives a plan description and catalog exercise names when a plan is drafted, and counts (not the free text) on Today. ExerciseDB receives an exercise search, not the journal. | Yes | Erased with the account. Private. |
| Camera frames for a barcode | Not collected | No. Decoded on the device with `@zxing/browser`. | Read a barcode | No | Only the digits go to our server, then to Open Food Facts. | Yes | Nothing is stored from the camera. |
| Faith tradition, translation, calendar preference | Sensitive Info (religious beliefs) | Yes | Faith settings | Yes | Not shared with the household. Not sent to Groq. | A default is used until the person chooses. | Erased with the account. Private. |
| Prayer requests | Sensitive Info, and User Content | Yes, when written | Prayer list | Yes | Not shared. Not sent to Groq. | Yes | Erased with the account. Private. |
| Worship check-ins | Sensitive Info, and User Content | Yes, when entered | Worship log | Yes | Not shared. Not sent to Groq. | Yes | Erased with the account. Private. |
| Daily reviews | Sensitive Info, and User Content | Yes, when written | Morning and evening review | Yes | Not shared with the household. Groq can receive one answer (grateful, troubled, or shortfall) for a follow-up, an intention to shorten, and, for the weekly mirror, counts plus words that repeat in troubled and shortfall. The full review and the prayers are not sent. | Yes | Erased with the account. Private. |
| Reading-plan progress | Sensitive Info | Yes, when a plan is started | Reading plans | Yes | Not shared. Not sent to Groq. | Yes | Erased with the account. Private. |
| Precise location, contacts, phone number, advertising id | — | No | — | — | — | — | — |

## Google Play Data safety

| Data | Play category | Collected | Purpose | Linked to the person | Shared with | Optional | Deletable |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Name (display name) | Personal info | Yes, if set | App functionality | Yes | Account database | Yes | Erased with the account |
| Email address | Personal info | Yes | App functionality, account | Yes | Supabase Auth and the account database | No | Erased with the account |
| User ids | Personal info | Yes | App functionality, account | Yes | Supabase Auth | No, while signed in | Erased with the account |
| Religious beliefs and practice (tradition, prayers, worship, reviews, reading progress) | Personal info | Yes, when the person uses Faith | App functionality | Yes | Not sold. Groq only for the review slices named above. Household members do not see this. | Yes | Erased with the account |
| Other financial info (budgets, transactions, income, debt, savings, investments, tax, insurance, real estate) | Financial info | Yes, when entered | App functionality | Yes | Household members. Groq and Alpha Vantage only as named above. | Yes | Stays with the household under keep-shared, except a solo account or the last member |
| Health info (nutrition plan and food logs) | Health and fitness | Yes, when entered | App functionality | Yes | USDA, Open Food Facts, and Groq only as named above | Yes | Erased with the account |
| Fitness info (workouts and journal) | Health and fitness | Yes, when entered | App functionality | Yes | ExerciseDB for catalog search. Groq for a drafted plan and for Today’s counts. | Yes | Erased with the account |
| Photos (profile photo) | Photos and files | Yes, if added | App functionality | Yes | Stored on the account row | Yes | Erased with the account |
| Files (estate documents) | Photos and files | Yes, when uploaded | App functionality | Yes | Household members. Disk or Supabase Storage. | Yes | Removed with the document. Household copies stay when handed off. |
| Vehicle records | Personal info (other) | Yes, when entered | App functionality | Yes | Household members. NHTSA for make, model, and year lists. | Yes | Same as household money |
| App interactions, search history as analytics, crash logs, diagnostics | App activity | No analytics SDK. Food and exercise searches are sent to USDA and ExerciseDB for that lookup and are not stored as an analytics history. | — | — | — | — | — |
| Location, contacts, SMS, audio, web browsing, device id for ads | — | No | — | — | — | — | — |

Play’s encryption and deletion questions, for the owner to confirm against the deployed app:

- In transit, production API calls are HTTPS. The inventory does not claim encryption that only the person’s devices can read.
- The person can request deletion in the app (You → Privacy and data → Delete account) and at `/delete-account` once pull request 10 is merged. Private data is erased. Shared household money stays with the household.

## Outside hosts the app contacts

Searched with `git grep` for `http://` and `https://` under `server`, `utils`, `components`, `pages`, `composables`, `plugins`, and `stores`. Seed scripts and unused packages are listed separately so they are not mistaken for runtime processors.

| Host | Purpose | Called from |
| --- | --- | --- |
| `*.supabase.co` (from `SUPABASE_URL`) | Sign-in, and estate-file storage when a service-role key is set | `plugins/supabase-auth.client.ts`, `stores/auth.js`, `server/utils/estateDocuments.ts` |
| PostgreSQL host in `DATABASE_URL` | Account and record storage. SSL is turned on when the URL contains `supabase`. | `server/utils/db.ts` |
| Vercel | Hosts the web app and the investment-price cron | `nuxt.config.ts` (`nitro` preset `vercel`, cron `/api/cron/investment-prices`) |
| `api.groq.com` | Written suggestions | `server/utils/groq.ts`. Callers: `server/api/budget/transactions/draft.post.ts`, `server/api/budget/csv-categories.post.ts`, `server/api/budget/line-suggestions.get.ts`, `server/api/budget/month-close.get.ts`, `server/api/physical/nutrition/intake/describe.post.ts`, `server/api/physical/nutrition/intake/suggest.post.ts`, `server/api/physical/today.get.ts`, `server/utils/workoutPlan.ts`, `server/api/spiritual/assist.post.ts`, `server/api/spiritual/mirror.get.ts` |
| `api.nal.usda.gov` | Food search | `server/utils/fdcApi.ts` |
| `world.openfoodfacts.org` | Barcode product lookup | `server/api/physical/nutrition/barcode.get.ts` |
| `www.alphavantage.co` | Daily close for ticker symbols | `utils/refreshInvestmentPrices.js`, `server/api/cron/investment-prices.get.ts` |
| `vpic.nhtsa.dot.gov` | Vehicle makes, models, and years. The browser calls this directly. | `components/AddEstateRecordModal.vue`, `components/EstateAssetCategoriesPanel.vue` |
| `oss.exercisedb.dev` | Exercise catalog, unless a RapidAPI key is set | `server/utils/exerciseDb.ts` |
| `edb-with-gifs-and-images-by-ascendapi.p.rapidapi.com` | Exercise catalog only when `exerciseDbApiKey` is set | `server/utils/exerciseDb.ts` |
| `static.exercisedb.dev` | Exercise images in the browser | `utils/strengthExercises.js`, `utils/enduranceExercises.js`, `utils/flexibilityExercises.js`, and the exercise list components |

### Checked, and not a runtime processor

| Host or package | Why it is not listed above |
| --- | --- |
| `fonts.googleapis.com`, `fonts.gstatic.com` | Not used. Fonts are bundled (`assets/css/fonts.css`). `tests/bundled-fonts.test.js` locks this. |
| `calapi.inadiutorium.cz` | Seed script only: `scripts/seed-liturgical-calendar.mjs` |
| `raw.githubusercontent.com`, `ebible.org` | Bible seed only: `utils/bibleTranslations.js`, `scripts/seed-bible.mjs` |
| `ascendapi.com` | Attribution link on exercise screens. The app does not send account data there. |
| Honda, MINI, Toyota, and Mazda manual PDFs | Static links on a vehicle page. Opened only if the person taps them. |
| `@azure/cosmos`, `mongodb` | In `package.json`. No import in the app. |
| `mcpBaseUrl` / `mcpToken` | Keys in `nuxt.config.ts`. No caller. |
| `server/api/tax/explain.post.ts` | Not on `main` at `8fd6cc5`. |
