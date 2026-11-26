# Faith traditions, translations and the church calendar

Each account picks a Faith tradition (You → Faith settings, or the one-time prompt on the Faith home):

| Tradition | Default translation | Calendar | Evening review | Virtue wording |
| --- | --- | --- | --- | --- |
| Christian (default) | BSB | Church year (computed) | Evening Reflection | Scripture-based |
| Protestant | BSB | Church year (computed) | Evening Reflection | Scripture-based |
| Catholic | CPDV | General Roman Calendar (seeded, saints and ranks) | Evening Examen | Catechism (original) |
| Orthodox | WEB | Church year from Orthodox Pascha | Evening Reflection | Scripture-based |

Anyone can pick any translation and turn the calendar off. Only Catholic mode draws daily readings
from the deuterocanon; every other mode reads from the 66 shared books.

## Setup (Supabase)

1. Run `scripts/create_bible.sql` (new `bible_books` / `bible_verses` tables; copies the CPDV rows already loaded).
2. Run `scripts/create_faith_profiles.sql` (`user_faith_profiles`; the first run sets every existing account except the demo account to Catholic + CPDV).
3. Load translations: `npm run seed:bsb`, `npm run seed:web`, `npm run seed:kjv` (or `npm run seed:bible:all`).
   The seed downloads public-domain files into `data/bible/<code>/` (git-ignored, 5–10 MB each).

Both SQL scripts are also in `npm run migrate`. Until they run, the app behaves as before (Catholic, CPDV,
Roman calendar). If a translation is not seeded yet, Scripture falls back to the CPDV with a short notice.

People using the app never see these script paths. Faith settings says "Faith settings are not set up yet."
Reading plans, the prayer list and worship check-in say they are not set up yet. The server log names
`scripts/create_faith_profiles.sql` or `scripts/create_faith_common.sql` (or `npm run migrate`).

## Code

- `utils/faithProfile.js`: traditions, defaults, labels; `composables/useFaithProfile.js` on the client.
- `server/utils/faithProfile.ts`, `server/api/spiritual/profile.get.ts` / `profile.put.ts`.
- `utils/bibleTranslations.js`, `utils/bibleBooks.js`, `scripts/seed-bible.mjs`, `server/utils/bible.ts`.
- `utils/psalmNumbering.js`: references are written in standard psalm numbering and mapped to Vulgate numbering for the CPDV.
- `utils/christianYear.js`: Easter (Gregorian and Julian Computus), seasons and major days, no API.

## Faith practices: reading plans, prayer list, worship check-in

Run `scripts/create_faith_common.sql` (also in `npm run migrate`) after the
faith-core scripts. All rows are private and keyed by `user_id` only.

- **Reading plans** (`/spiritual/plans`): the library lives in
  `utils/readingPlans.js` (Bible in a Year, Gospels in 30 days, Psalms and
  Proverbs in a month, Advent, Lent, and in Catholic mode the Deuterocanon in
  30 days). References use standard numbering; the CPDV psalm mapping is
  applied when the text is read. Whether a plan includes the deuterocanon is
  fixed when it starts (Catholic mode = yes), so its days never change mid-way.
  Books missing from the chosen translation (for example Tobit in the BSB) are
  read from the CPDV. Catch-up options: read the missed days, mark them skipped
  ("Skip to today"), or move the start date ("Shift my dates").
- **Prayer list** (`/spiritual/prayers`): Active, Answered and Archived views.
  Up to three open requests (rotating daily) show in Morning Prayer and the
  evening reflection.
- **Worship check-in** (`/spiritual/worship`): one row per Sunday-to-Saturday
  week. Wording is "Mass" (Catholic), "Divine Liturgy" (Orthodox) or "worship
  service". The streak counts consecutive weeks attended in person or online
  and never counts the current week against you.
