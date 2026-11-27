/**
 * Draft privacy policy and terms. The wording lives here so page markup
 * does not have to change when the owner edits a sentence.
 * LEGAL_DRAFT stays true until the owner approves the text.
 */

export const LEGAL_UPDATED = "2026-11-27";
export const LEGAL_DRAFT = true;
export const PUBLISHER_NAME = "Marcelli Enterprises LLC";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export function legalUpdatedLabel(iso = LEGAL_UPDATED) {
  const [year, month, day] = String(iso).split("-").map(Number);
  const name = MONTHS[month - 1];
  if (!name || !year || !day) return String(iso);
  return `${name} ${day}, ${year}`;
}

export function tableOfContents(document) {
  return (document?.sections || []).map((section) => ({
    id: section.id,
    heading: section.heading,
  }));
}

export const privacyPolicy = {
  id: "privacy",
  title: "Privacy policy",
  path: "/privacy",
  sections: [
    {
      id: "who-we-are",
      heading: "Who we are",
      blocks: [
        {
          type: "p",
          text: "Future Star is published by Marcelli Enterprises LLC. It is a personal app for money, faith practice, and physical training.",
        },
        {
          type: "placeholder",
          text: "Add the postal address for Marcelli Enterprises LLC. This draft does not invent one.",
        },
      ],
    },
    {
      id: "what-we-collect",
      heading: "What we collect",
      blocks: [
        {
          type: "p",
          text: "We store what you enter so the app can show it back to you. We do not ask for your personal phone number, your contacts, or your precise location. A cash account or a debt can include a support number you type, and a web address for the institution.",
        },
        { type: "h3", text: "Account" },
        {
          type: "p",
          text: "We store your email address. You can add a display name and an optional profile photo. The photo is saved with your account as image data. Sign-in goes through Supabase Auth. The app keeps a session so you stay signed in. A password hash is stored only for accounts that use the older password path. An account that signs in only through Supabase can have no local password.",
        },
        { type: "h3", text: "Money" },
        {
          type: "p",
          text: "If you use the money tools, we store what you enter: budgets, transactions, income, debt, savings, investments and holdings, tax figures and a household tax profile, insurance, real estate, and an account map. Linked household members can see these records. See Household sharing.",
        },
        {
          type: "p",
          text: "A real estate record stores a street number, street, city, state, and ZIP code. A vehicle record can store a VIN you type. That VIN stays with the vehicle. The make, model, and year list does not send the VIN to NHTSA.",
        },
        {
          type: "p",
          text: "A cash or investment account stores an account number and the account holder. An insurance record stores a policy number and the policy holder. A debt record can store a loan number and the borrower. A household tax profile can store a state, a county, a local jurisdiction, a school district, and a ZIP code. It does not store a street address.",
        },
        { type: "h3", text: "Estate documents" },
        {
          type: "p",
          text: "You can upload files. We store the file, its original name, its type, its size, and any title or note you add. Files sit on the server disk, or in Supabase Storage when that is configured. Household members can see household documents.",
        },
        {
          type: "placeholder",
          text: "Say whether production stores estate files on the server disk or in Supabase Storage. The code uses Supabase Storage when a service-role key is set, and the server disk otherwise.",
        },
        { type: "h3", text: "Vehicles" },
        {
          type: "p",
          text: "You can save vehicles and service records. Those records are part of the household money data, so linked members can see them. When you look up a make, model, or year, your browser asks the NHTSA vehicle catalog for that list. We do not send a vehicle identification number in that lookup.",
        },
        { type: "h3", text: "Health and fitness" },
        {
          type: "p",
          text: "This is private to you. We store nutrition plans (calorie and macro targets), food logs (food name, meal, amount, and calories and macros), foods you save, workouts, and a training journal (session name, exercises, sets, reps, weight, and duration).",
        },
        {
          type: "p",
          text: "The barcode scanner reads the code on your device. Only the digits go to our server, which asks Open Food Facts for that product. A food search sends the words you type to USDA FoodData Central. Exercise names and instructions come from ExerciseDB. The moving images load in your browser from ExerciseDB’s image host. The camera picture is not uploaded.",
        },
        { type: "h3", text: "Faith practice" },
        {
          type: "p",
          text: "This is private to you. We store the tradition and Bible translation you choose, whether you show the church calendar, prayer requests (title, notes, a person, a category, and an answer if you write one), worship check-ins (attendance, church name, sermon passage, notes, and a takeaway), daily reviews (the morning and evening answers you type), and reading-plan progress (which plan, the start date, and the days you mark done or skipped).",
        },
        {
          type: "p",
          text: "Scripture text and the church calendar are shared catalogs in the app. They are not your private notes.",
        },
        {
          type: "p",
          text: "We also store the ids the app needs to run: an account id, a Supabase user id when you sign in that way, and session records.",
        },
      ],
    },
    {
      id: "how-we-use-it",
      heading: "How we use it",
      blocks: [
        {
          type: "p",
          text: "We use this information to show you your records, to sign you in, to share money records with people you link in a household, and to run the lookups and suggestions described below.",
        },
        {
          type: "p",
          text: "The app code does not include an advertising SDK or an analytics SDK, and it does not ask for an advertising identifier.",
        },
        {
          type: "p",
          text: "We do not sell personal information. We do not share it for cross-context behavioral advertising.",
        },
      ],
    },
    {
      id: "who-we-share-it-with",
      heading: "Who we share it with",
      blocks: [
        {
          type: "p",
          text: "These are the outside services the app already calls. Each one is listed with the purpose we use it for. Household members are people you link, not outside services. They are described under Household sharing.",
        },
        {
          type: "ul",
          items: [
            "Supabase. Sign-in, and file storage for estate documents when Supabase Storage is configured. Account records are stored in PostgreSQL. When the database URL points at Supabase, the connection uses that host.",
            "Vercel. Hosts the web app and runs the scheduled job that refreshes investment prices.",
            "Groq. Optional written suggestions. See AI features. Called only when a server key is set.",
            "USDA FoodData Central. The food words you search, and a food id when a result is opened. Needs a server API key.",
            "Open Food Facts. The barcode digits only.",
            "Alpha Vantage. Ticker symbols from investment holdings, from a server job. Not your name or email.",
            "NHTSA vPIC. Your browser requests vehicle makes, models, and years while you fill in a vehicle. That request does not go through our server, and it does not include a stored VIN.",
            "ExerciseDB. The server asks for exercise names and instructions. By default that host is oss.exercisedb.dev. If a RapidAPI key is configured, the server uses that ExerciseDB host instead. Your browser loads exercise images from static.exercisedb.dev. The search is an exercise name or a body-part filter, not your journal.",
          ],
        },
        {
          type: "p",
          text: "Fonts are bundled with the app. The app does not load fonts from Google.",
        },
        {
          type: "placeholder",
          text: "Say which ExerciseDB host production uses. The code calls oss.exercisedb.dev unless a RapidAPI key is set, and the browser loads images from static.exercisedb.dev.",
        },
      ],
    },
    {
      id: "household-sharing",
      heading: "Household sharing",
      blocks: [
        {
          type: "p",
          text: "If you link accounts, money records are visible to the other people in that household. That includes budgets, transactions, income, debt, savings, investments, tax totals and the household tax profile, estate records, vehicles and service records, insurance, real estate, the account map, and estate documents that belong to the household.",
        },
        {
          type: "p",
          text: "Faith practice and body data stay on your account. They are not part of the household share list.",
        },
        {
          type: "p",
          text: "You can also share one estate record with another account. The kinds are inventory, vehicle, cash or investment, debt, insurance, and real estate. That share does not include faith or body data.",
        },
      ],
    },
    {
      id: "ai-features",
      heading: "AI features",
      blocks: [
        {
          type: "p",
          text: "Some screens ask Groq for a short note or a suggestion. This runs only when a Groq key is set on the server. If the key is missing, or the request fails, the screen shows a sentence written in the app, or it skips the suggestion. There is no separate switch for each note.",
        },
        {
          type: "p",
          text: "You start these yourself: a transaction sentence (the description and amount, plus your category names) to suggest a category; a bank-import file (up to forty descriptions and amounts, plus category names); a meal sentence to split it into foods and estimate nutrition; a workout description, with the goal, schedule, equipment limits, exercises to avoid, recent exercise names, and catalog exercise names, to draft a plan; a verse already on the page (the citation and the text) to write two reflection questions; a virtue name and its published definition to suggest one act; a daily-review answer you wrote in grateful, troubled, or shortfall, to ask a follow-up; and an intention you wrote, to shorten it.",
        },
        {
          type: "p",
          text: "These run when you open the screen, if the key is set. Budget line names: merchant names that already repeat in your expenses, and your category names. Month close: the category furthest over budget, the category furthest under budget, and up to three uncategorized merchant names with amounts. Today: counts for the week (sessions, whether you logged today, mobility sessions) and calorie and protein totals and what remains. Not the free text of a workout.",
        },
        {
          type: "p",
          text: "The weekly mirror does not send your prayer requests, and it does not send the full text of a review. It sends counts: how many days have a review, which virtues you named and how often, how many times tomorrow was filled, and words that appear more than once in the troubled and shortfall answers.",
        },
        {
          type: "placeholder",
          text: "Say whether the weekly mirror should keep sending words that repeat in the troubled and shortfall answers to Groq. The code does that today. It does not send prayer requests or the full review.",
        },
        {
          type: "p",
          text: "Suggestions can be wrong. They are not advice. See the terms of service.",
        },
      ],
    },
    {
      id: "retention-and-deletion",
      heading: "Retention and deletion",
      blocks: [
        {
          type: "p",
          text: "While your account is open, records stay until you delete them in the app.",
        },
        {
          type: "p",
          text: "Account deletion is a separate control. When this copy of the app includes it, you will find it under You, in the section named Privacy and data, labeled Delete account. The same steps are on the public page /delete-account when that page is part of the app. If you do not see that section or that page, account deletion is not available in this copy yet.",
        },
        {
          type: "p",
          text: "When account deletion runs, shared household money stays with the household and is handed to someone who remains. Household tax profiles and deduction overrides stay. If one of your shared income, investment, or savings sources has the same name as one a remaining person already has, your copy is kept and renamed with \" (former member)\". If that name is taken, a number is added, such as \" (former member) 2\". If you are the last person in the household, the household and its shared records are deleted with the account, including records that still name someone who already left. Those records are not turned into private records.",
        },
        {
          type: "p",
          text: "Your private faith practice, nutrition, workouts and the training journal, your profile, your sessions, and your sign-in are erased. Budget lines, transactions, and estate records that belong only to you are erased. Private asset inventory, vehicle, and cash or investment account records that are not in a household are kept hidden for 90 days and then permanently deleted. That hold includes the holdings on a private cash or investment account and the service history on a private vehicle. They are not visible or accessible in the app during those 90 days. A daily job then deletes them. Shared household copies of those records, including shared holdings and service history, stay with the household.",
        },
        {
          type: "p",
          text: "Stored files for estate documents that are erased are queued for deletion. A document handed to the household stays, including the file, while other members remain. If removing a stored file or the sign-in does not finish immediately, a daily job retries until it is gone. The sign-in id is kept only so that sign-in cannot open a new account. Your email is not stored on that marker. Copies kept only on the device, described under On this device, stay until the browser clears them or you remove them there.",
        },
      ],
    },
    {
      id: "security",
      heading: "Security",
      blocks: [
        {
          type: "p",
          text: "Sign-in is handled by Supabase Auth. On the web, a session cookie identifies you. In the phone app, requests send the Supabase access token. Passwords for the older sign-in path are stored as a hash, not as the password you typed. The database is reached from the server. Estate files sit on the server disk or in Supabase Storage.",
        },
        {
          type: "p",
          text: "This is ordinary server storage. People who operate the database and the file storage can read what is stored. The app does not encrypt records so that only your devices can read them.",
        },
      ],
    },
    {
      id: "on-this-device",
      heading: "On this device",
      blocks: [
        {
          type: "p",
          text: "Some information stays in the browser on your device, as well as in the database.",
        },
        {
          type: "ul",
          items: [
            "A copy of investment holdings you edit is saved in local storage. The key starts with myfin.investment-holdings.2026-10-31 and ends with your account id. The copy can include the holding name, ticker, account, shares, price, cost, and value.",
            "A flag that you closed the faith-tradition prompt is saved in local storage as futurestar.faithPromptDismissed. The value is 1. It is not your prayers or your reviews.",
            "After a password reset, session storage keeps a one-time flag named loginForgotPassword so the sign-in screen can show the reset step. The flag is removed when that screen opens.",
            "The Supabase sign-in client in the browser keeps its session in local storage. The app does not turn that off. The server admin client does not keep a session.",
          ],
        },
      ],
    },
    {
      id: "children",
      heading: "Children",
      blocks: [
        {
          type: "p",
          text: "You must be 14 or older to use Future Star. If you are under 18, you need a parent or guardian's consent where the law requires it. We do not knowingly collect personal information from children under 14. If we learn that we have, we will delete it.",
        },
      ],
    },
    {
      id: "changes",
      heading: "Changes",
      blocks: [
        {
          type: "p",
          text: "When this policy changes, the date at the top changes with it. This draft is dated November 27, 2026.",
        },
      ],
    },
    {
      id: "contact",
      heading: "Contact",
      blocks: [
        {
          type: "p",
          parts: [
            "For general questions, write to ",
            { href: "mailto:info@me.com", label: "info@me.com" },
            ".",
          ],
        },
        { type: "supportEmail" },
        {
          type: "placeholder",
          text: "Add the postal address for Marcelli Enterprises LLC.",
        },
      ],
    },
  ],
};

export const termsOfService = {
  id: "terms",
  title: "Terms of service",
  path: "/terms",
  sections: [
    {
      id: "the-agreement",
      heading: "The agreement",
      blocks: [
        {
          type: "p",
          parts: [
            "These terms are between you and Marcelli Enterprises LLC, the publisher named in the app footer, for your use of Future Star. The ",
            { href: "/privacy", label: "privacy policy" },
            " describes what the app does with data. Both pages are drafts until the owner approves them.",
          ],
        },
      ],
    },
    {
      id: "acceptable-use",
      heading: "Acceptable use",
      blocks: [
        {
          type: "p",
          text: "Use the app for your own records. Do not break into someone else’s account, do not upload files you have no right to store, and do not try to disrupt the service. Do not use the app to break the law.",
        },
      ],
    },
    {
      id: "accounts",
      heading: "Accounts",
      blocks: [
        {
          type: "p",
          text: "You need an account to use the tools. You must be 14 or older. If you are under 18, you need a parent or guardian's consent where the law requires it. You are responsible for your sign-in. If you link a household, money records are visible to the other members, as the privacy policy describes. Faith practice and body data stay on your account.",
        },
      ],
    },
    {
      id: "your-content",
      heading: "Your content and documents",
      blocks: [
        {
          type: "p",
          text: "You keep what you enter. You let the publisher store it and show it so the app can run. That includes showing household money records, and household documents, to people you have linked. Estate files are stored on the server disk or in Supabase Storage, as the privacy policy describes.",
        },
      ],
    },
    {
      id: "not-advice",
      heading: "Not advice",
      blocks: [
        {
          type: "p",
          text: "Future Star is a place to keep records. It is not financial advice, tax advice, medical advice, or spiritual direction. Tax figures in the app are estimates. Nutrition numbers are estimates from the description you type, from a food database, or from a barcode lookup. A workout plan is a draft from a catalog. Scripture tools and review prompts are not spiritual direction. You decide what to do with any of it.",
        },
      ],
    },
    {
      id: "ai-output",
      heading: "AI output",
      blocks: [
        {
          type: "p",
          text: "Suggestions and short notes can be wrong. They can misread a sentence, pick the wrong category, or estimate nutrition that does not match the food. Check them before you rely on them. If the model is unavailable, the app may show a sentence written on the server instead, or no suggestion.",
        },
      ],
    },
    {
      id: "availability",
      heading: "Availability",
      blocks: [
        {
          type: "p",
          text: "The app can be interrupted. Food search, barcode lookup, vehicle lists, exercise images, investment prices, and written suggestions depend on other services. We do not promise that a feature will be available every time you open it.",
        },
      ],
    },
    {
      id: "ending-use",
      heading: "Ending use",
      blocks: [
        {
          type: "p",
          parts: [
            "You can stop using the app. Deleting the account is described in the ",
            { href: "/privacy", label: "privacy policy" },
            ", under Retention and deletion. When the app includes that control, it is under You, in Privacy and data. Shared household money stays with the household. Private asset inventory, vehicle, and cash or investment account records that are not in a household, including investment holdings and vehicle service history, are kept hidden for 90 days and then permanently deleted. They are not visible or accessible in the app during that time. The publisher can stop offering the app.",
          ],
        },
      ],
    },
    {
      id: "liability",
      heading: "Limitation of liability",
      blocks: [
        {
          type: "p",
          text: "Sample text for the owner's review. This is not approved legal language. It is written for Marcelli Enterprises LLC as a small company in Wooster, Ohio.",
        },
        {
          type: "p",
          text: "The app is provided as is and as available. Marcelli Enterprises LLC disclaims warranties of merchantability, fitness for a particular purpose, and non-infringement, to the extent the law allows.",
        },
        {
          type: "p",
          text: "To the extent the law allows, Marcelli Enterprises LLC is not liable for indirect, incidental, special, consequential, or punitive damages, or for lost profits or data. Its total liability for a claim arising out of the app is limited to the greater of the fees you paid for the app in the 12 months before the claim, or $100.",
        },
      ],
    },
    {
      id: "governing-law",
      heading: "Governing law",
      blocks: [
        {
          type: "p",
          text: "Sample text for the owner's review. This is not approved legal language. It is written for Marcelli Enterprises LLC as a small company in Wooster, Ohio.",
        },
        {
          type: "p",
          text: "These terms are governed by the laws of the State of Ohio, without regard to conflict-of-law rules. You and Marcelli Enterprises LLC agree that the state courts in Wayne County, Ohio, and the United States District Court for the Northern District of Ohio, are the venues for disputes arising out of these terms or the app.",
        },
      ],
    },
    {
      id: "changes",
      heading: "Changes",
      blocks: [
        {
          type: "p",
          text: "When these terms change, the date at the top changes with it. This draft is dated November 27, 2026.",
        },
      ],
    },
    {
      id: "contact",
      heading: "Contact",
      blocks: [
        {
          type: "p",
          parts: [
            "For general questions, write to ",
            { href: "mailto:info@me.com", label: "info@me.com" },
            ".",
          ],
        },
        { type: "supportEmail" },
        {
          type: "placeholder",
          text: "Add the postal address for Marcelli Enterprises LLC.",
        },
      ],
    },
  ],
};

export const legalDocuments = [privacyPolicy, termsOfService];
