# Store privacy inventory

Draft for the owner. It matches the draft privacy policy in `utils/legalText.js` (last updated 2026-11-27). Fill Apple App Privacy and Google Play Data safety from these tables, then confirm the rows marked for the owner. This file is not legal advice.

Account deletion, when the app includes it, follows the rule the owner confirmed: `keep-shared`, matching pull request 10 at `c440da2`. Shared household money stays with the household. Household tax profiles and deduction overrides stay. A same-name income, investment, or savings source is kept and renamed with ` (former member)`. Private Faith and Body data, the profile, sessions, and sign-in are erased. Private asset inventory, vehicle, and cash or investment account records that are not in a household, including investment holdings and vehicle service history, are kept hidden for 90 days, then a daily job permanently deletes them. They are not visible or accessible in the app during that time. When the last member leaves, the household's data is deleted. Sign-in removal and stored files are queued for deletion, and a daily job retries them if they do not finish immediately. The screens are in pull request 10 and are not on `main` until that change is merged. The policy says to look for You → Privacy and data → Delete account, and for `/delete-account`, only when that copy of the app includes them.

No advertising SDK, analytics SDK, or advertising-identifier request was found in the app code. Third-party calls below are for the named feature. The owner has said personal information is not sold, and that it is not shared for cross-context behavioral advertising. Confirm “no tracking” and “no advertising” on the store forms before submitting.

## Minimum age and proposed store ratings

The privacy policy and terms say a person must be 14 or older. Someone under 18 needs a parent or guardian's consent where the law requires it. The app does not knowingly collect personal information from children under 14, and the policy says that data will be deleted if we learn of it. The app does not ask for a date of birth, so 14+ and under-18 consent are not enforced in code.

**Proposed ratings. The owner has not chosen these. Confirm before answering the store questionnaires.**

| Store | Proposed rating | Why it was proposed | What does not match 14+ |
| --- | --- | --- | --- |
| Apple App Store | 17+ | Apple's published steps are 4+, 9+, 12+, and 17+. 17+ is the step that does not present the app as suitable for children under 14. The app is personal finance, faith practice, and fitness, without sexual content, violence, gambling, or an advertising SDK. | There is no 14+ step. 12+ would include 12- and 13-year-olds the policy excludes. 17+ also excludes 14-, 15-, and 16-year-olds the policy allows. |
| Google Play | Teen | IARC Teen is the usual content rating for this kind of app. | Teen is often treated as 13+, one year under the policy. Mature 17+ would exclude 14-, 15-, and 16-year-olds. |

## Do not promote a preview while this text is a draft

The draft guard runs when Vercel builds with `VERCEL_ENV=production`, and when GitHub Actions builds `main`. Promoting an already-built preview deployment to production does not build again, so it skips that guard. A local prebuilt deploy (`vercel deploy --prebuilt`) with `VERCEL_ENV` unset also skips it. Do not promote a preview, and do not ship a prebuilt bundle, while `LEGAL_DRAFT` is true or an Owner to fill note remains.

## Apple App Privacy

| Data | Apple category | Collected | Purpose | Linked to the person | Shared with | Optional | Deletable |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Email address | Contact Info | Yes | Account and sign-in | Yes | Supabase Auth. The address is also stored in PostgreSQL (Supabase when the database URL points there). | No. An account needs an email. | Erased with the account. |
| Display name | Contact Info | Yes, if the person sets one | Show the name in the app | Yes | Stored with the account (PostgreSQL / Supabase). Not sent to Groq or the lookup APIs. | Yes | Erased with the account. |
| Profile photo | User Content (Photos) | Yes, if the person adds one | Show the photo on the account | Yes | Stored as image data on the account row. Not a separate photo host. | Yes | Erased with the account. |
| Session and user ids | Identifiers (User ID) | Yes | Keep the person signed in | Yes | Supabase Auth for the Supabase user id. Session cookie on the web; access token in the phone app. | No, while signed in | Erased with the account. Sessions stop working. |
| Budgets, transactions, income, debt, savings, investments, tax figures, insurance, real estate, account map | Financial Info | Yes, when the person enters them | The money tools | Yes | Household members, when accounts are linked. Groq receives only the slices named in the policy (a sentence, import rows, repeated merchant names, a month-close summary). Alpha Vantage receives ticker symbols only. | Yes. The feature stores nothing until the person enters it. | Shared rows stay with the household while other members remain, and are deleted when the last member leaves. Private budgets, transactions, income, debt, savings, insurance, real estate, and the account map are erased with the account. Private asset inventory and a private cash or investment account, including holdings, are hidden for 90 days, then a daily job permanently deletes them. |
| Estate documents | User Content (Other) and Photos or files | Yes, when uploaded | Store wills and other files the person chooses | Yes | Household members for household documents. File bytes: server disk, or Supabase Storage when configured. | Yes | A private document is erased with the account, and its stored file is queued for deletion. A document handed to the household stays, including the file, while other members remain. Household files are queued when the last member leaves. |
| Vehicles and service records | Other Data | Yes, when entered | Vehicle records | Yes | Household members. The browser sends make, model, and year lookups to NHTSA. That lookup does not include the VIN. | Yes | A shared vehicle and its service history stay with the household. A private vehicle and its service history are hidden for 90 days and then permanently deleted. They are not shown in the app during that time. Deleted with the household when the last member leaves. |
| VIN | Other Data | Yes, when the person types one | Stored on the vehicle record | Yes | Household members. Not sent to NHTSA. | Yes | Same as the vehicle record. A private VIN is hidden with that vehicle for 90 days, then permanently deleted. |
| Real estate street address (number, street, city, state, ZIP) | Contact Info (Physical Address) | Yes, when a property is saved | Real estate records | Yes | Household members. Not sent to a map or address API. | The street, city, state, and ZIP are required to save a property. The street number can be blank. | Stays with the household while other members remain. A private property is erased with the account. Deleted when the last member leaves. Not part of the 90-day hold. |
| Cash and investment account number and account holder | Financial Info | Yes, when the account is saved | Name the account | Yes | Household members. Not sent to the bank. | Required on the cash and investment form. | A shared account stays with the household. A private cash or investment account, including its number, holder, and holdings, is hidden for 90 days and then permanently deleted. It is not shown in the app during that time. |
| Insurance policy number and policy holder | Financial Info | Yes, when the policy is saved | Insurance records. The policy-number column in the database is `polocy_number`. | Yes | Household members. | The policy holder is required on the add form. The policy number can be blank. | Stays with the household while other members remain. A private policy is erased with the account. Deleted when the last member leaves. Not part of the 90-day hold. |
| Debt loan number and borrower | Financial Info | Yes, when entered | Debt records | Yes | Household members. | Yes. The form allows them to be blank. | Stays with the household while other members remain. A private debt is erased with the account. Deleted when the last member leaves. Not part of the 90-day hold. |
| Tax profile place (state, county, local jurisdiction, school district, ZIP) | Financial Info | Yes, when a tax profile is saved | Tax estimate | Yes | Household members. Not a street address. | Yes | Household tax profiles and deduction overrides stay with the household. Deleted when the last member leaves. |
| Investment holdings copy on the device | Financial Info | Yes, when holdings are edited in the browser | A local copy so edits survive a reload | Yes. The key ends with the account id. | Stays on the device. Not sent to Alpha Vantage. The server job sends ticker symbols from the database. | Yes | Removed when the browser storage is cleared. Account deletion does not reach into the browser. |
| Faith prompt dismissed (`futurestar.faithPromptDismissed`) | Other Data | Yes, if the person closes the prompt | Remember that the prompt was closed. The value is `1`. | No name or prayer text. | Stays on the device. | Yes | Cleared with browser storage. |
| Password-reset flag (`loginForgotPassword` in session storage) | Other Data | Yes, for one visit after a reset | Open the reset step on the sign-in screen, then delete the flag. | No | Stays in that browser tab. | Yes | Removed when the sign-in screen opens, or when the tab closes. |
| Supabase sign-in session in browser local storage | Identifiers | Yes, after sign-in in the browser | Stay signed in. `plugins/supabase-auth.client.ts` uses the client default, which persists the session. The server admin client sets `persistSession: false`. | Yes | Stays on the device. Supabase issued the session. | No, while signed in through Supabase in the browser | Cleared when the browser storage is cleared or the client signs out. |
| Nutrition plan, food logs, saved foods | Health and Fitness | Yes, when entered | Nutrition journal | Yes | Not shared with the household. USDA receives search words. Open Food Facts receives barcode digits. Groq receives a meal sentence, or recent food names with calorie and protein numbers, when that feature runs. | Yes | Erased with the account. Private. |
| Workouts and training journal | Health and Fitness | Yes, when entered | Training log and plans | Yes | Not shared with the household. Groq receives a plan description and catalog exercise names when a plan is drafted, and counts (not the free text) on Today. ExerciseDB receives an exercise search, not the journal. | Yes | Erased with the account. Private. |
| Camera frames for a barcode | Not collected | No. Decoded on the device with `@zxing/browser`. | Read a barcode | No | Only the digits go to our server, then to Open Food Facts. | Yes | Nothing is stored from the camera. |
| Faith tradition, translation, calendar preference | Sensitive Info (religious beliefs) | Yes | Faith settings | Yes | Not shared with the household. Not sent to Groq. | A default is used until the person chooses. | Erased with the account. Private. |
| Prayer requests | Sensitive Info, and User Content | Yes, when written | Prayer list | Yes | Not shared. Not sent to Groq. | Yes | Erased with the account. Private. |
| Worship check-ins | Sensitive Info, and User Content | Yes, when entered | Worship log | Yes | Not shared. Not sent to Groq. | Yes | Erased with the account. Private. |
| Daily reviews | Sensitive Info, and User Content | Yes, when written | Morning and evening review | Yes | Not shared with the household. Groq can receive one answer (grateful, troubled, or shortfall) for a follow-up, and an intention to shorten. The weekly mirror note is written inside the app. Its data is not sent to third parties. The full review and the prayers are not sent. | Yes | Erased with the account. Private. |
| Reading-plan progress | Sensitive Info | Yes, when a plan is started | Reading plans | Yes | Not shared. Not sent to Groq. | Yes | Erased with the account. Private. |
| Personal phone number, contacts, precise location, advertising id | — | No. A support number typed onto a cash account or a debt is stored with that money record. It is not the person's own phone number, and it is not read from the device contacts. | — | — | — | — | — |

## Google Play Data safety

| Data | Play category | Collected | Purpose | Linked to the person | Shared with | Optional | Deletable |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Name (display name) | Personal info | Yes, if set | App functionality | Yes | Account database | Yes | Erased with the account |
| Email address | Personal info | Yes | App functionality, account | Yes | Supabase Auth and the account database | No | Erased with the account. Not stored on the sign-in deletion marker. |
| User ids | Personal info | Yes | App functionality, account | Yes | Supabase Auth | No, while signed in | Sessions are erased. Sign-in removal is queued, and a daily job retries it if it does not finish immediately. |
| Religious beliefs and practice (tradition, prayers, worship, reviews, reading progress) | Personal info | Yes, when the person uses Faith | App functionality | Yes | Not sold. Groq only for a review follow-up and a shortened intention, not for the weekly mirror. The weekly mirror note is written inside the app. Its data is not sent to third parties. Household members do not see this. | Yes | Erased with the account |
| Other financial info (budgets, transactions, income, debt, savings, investments, tax, insurance, real estate) | Financial info | Yes, when entered | App functionality | Yes | Household members. Groq and Alpha Vantage only as named above. | Yes | Shared rows stay under keep-shared. Private asset inventory and private cash or investment accounts are hidden for 90 days, then permanently deleted. Other private money rows are erased. The household is deleted when the last member leaves. |
| Real estate address (street, city, state, ZIP) | Personal info (address) | Yes, when a property is saved | App functionality | Yes | Household members | Street, city, state, and ZIP are required to save a property | Stays with the household while others remain. A private property is erased. Not part of the 90-day hold. |
| VIN | Personal info (other) | Yes, when typed | App functionality | Yes | Household members. Not sent to NHTSA. | Yes | Same as the vehicle. A private VIN is hidden for 90 days, then permanently deleted. |
| Account number and account holder | Financial info | Yes, on cash and investment accounts | App functionality | Yes | Household members | Required on that form | A shared account stays. A private account, including holdings, is hidden for 90 days, then permanently deleted. |
| Policy number and policy holder | Financial info | Yes, on insurance records | App functionality | Yes | Household members | Required on the add form | Stays with the household while others remain. A private policy is erased. Not part of the 90-day hold. |
| Loan number and borrower | Financial info | Yes, when entered on a debt | App functionality | Yes | Household members | Yes | Stays with the household while others remain. A private debt is erased. Not part of the 90-day hold. |
| Holdings copy, faith-prompt flag, reset flag, Supabase session | App activity and device storage, plus financial info for the holdings copy | Yes, on the device. See the Apple rows. | App functionality | The holdings key and the Supabase session are tied to the person. The two flags are not. | Not uploaded, except that the Supabase session is the sign-in Supabase already has. | The flags are optional. The session is kept while signed in. | Cleared in the browser. Account deletion does not wipe the device copy by itself. |
| Health info (nutrition plan and food logs) | Health and fitness | Yes, when entered | App functionality | Yes | USDA, Open Food Facts, and Groq only as named above | Yes | Erased with the account |
| Fitness info (workouts and journal) | Health and fitness | Yes, when entered | App functionality | Yes | ExerciseDB for catalog search. Groq for a drafted plan and for Today’s counts. | Yes | Erased with the account |
| Photos (profile photo) | Photos and files | Yes, if added | App functionality | Yes | Stored on the account row | Yes | Erased with the account |
| Files (estate documents) | Photos and files | Yes, when uploaded | App functionality | Yes | Household members. Disk or Supabase Storage. | Yes | A private file is queued for deletion with the account. A household file stays while other members remain, and is queued when the last member leaves. |
| Vehicle records | Personal info (other) | Yes, when entered | App functionality | Yes | Household members. NHTSA for make, model, and year lists. | Yes | A shared vehicle stays. A private vehicle and its service history are hidden for 90 days, then permanently deleted. |
| App interactions, search history as analytics, crash logs, diagnostics | App activity | No analytics SDK. Food and exercise searches are sent to USDA and ExerciseDB for that lookup and are not stored as an analytics history. | — | — | — | — | — |
| Location, contacts, SMS, audio, web browsing, device id for ads | — | No | — | — | — | — | — |

Play’s encryption and deletion questions, for the owner to confirm against the deployed app:

- In transit, production API calls are HTTPS. The inventory does not claim encryption that only the person’s devices can read.
- The person can request deletion in the app (You → Privacy and data → Delete account) and at `/delete-account` once pull request 10 is merged. Shared household money stays. Private asset inventory, vehicles, and cash or investment accounts that are not in a household, including holdings and service history, are hidden for 90 days, then a daily job permanently deletes them. Other private data is erased. Sign-in and stored files are queued for deletion.

## Outside hosts the app contacts

Searched with `git grep` for `http://` and `https://` under `server`, `utils`, `components`, `pages`, `composables`, `plugins`, and `stores`. Seed scripts and unused packages are listed separately so they are not mistaken for runtime processors.

| Host | Purpose | Called from |
| --- | --- | --- |
| `*.supabase.co` (from `SUPABASE_URL`) | Sign-in, and estate-file storage when a service-role key is set | `plugins/supabase-auth.client.ts`, `stores/auth.js`, `server/utils/estateDocuments.ts` |
| PostgreSQL host in `DATABASE_URL` | Account and record storage. SSL is turned on when the URL contains `supabase`. | `server/utils/db.ts` |
| Vercel | Hosts the web app and the investment-price cron | `nuxt.config.ts` (`nitro` preset `vercel`, cron `/api/cron/investment-prices`) |
| `api.groq.com` | Written suggestions other than the weekly mirror | `server/utils/groq.ts`. Callers: `server/api/budget/transactions/draft.post.ts`, `server/api/budget/csv-categories.post.ts`, `server/api/budget/line-suggestions.get.ts`, `server/api/budget/month-close.get.ts`, `server/api/physical/nutrition/intake/describe.post.ts`, `server/api/physical/nutrition/intake/suggest.post.ts`, `server/api/physical/today.get.ts`, `server/utils/workoutPlan.ts`, `server/api/spiritual/assist.post.ts` |
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
