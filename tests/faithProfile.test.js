import assert from "node:assert/strict";
import test from "node:test";
import { bookAllowedForReading, bookNameForCode, classifyBook, displayBookName } from "../utils/bibleBooks.js";
import { normalizeTranslationCode, translationName, translationVersification } from "../utils/bibleTranslations.js";
import {
  calendarKindForProfile,
  defaultFaithProfile,
  eveningLabel,
  includesDeuterocanon,
  legacyFaithProfile,
  normalizeFaithProfile,
} from "../utils/faithProfile.js";
import { spiritualSectionBySlug, spiritualTabsForPath, SPIRITUAL_HOME_LINKS } from "../utils/spiritualNav.js";
import {
  findVirtueDefinition,
  VIRTUE_GROUPS,
  virtueGroupsForTradition,
  virtueNamesForTradition,
} from "../utils/spiritualReview.js";

test("new accounts default to Christian, BSB and the church-year calendar", () => {
  assert.deepEqual(defaultFaithProfile(), { tradition: "christian", translation: "BSB", show_calendar: true });
  assert.equal(calendarKindForProfile(defaultFaithProfile()), "church_year");
});

test("before the migration runs, the original Catholic setup applies", () => {
  const legacy = legacyFaithProfile();
  assert.deepEqual(legacy, { tradition: "catholic", translation: "CPDV", show_calendar: true });
  assert.equal(calendarKindForProfile(legacy), "roman");
  assert.equal(eveningLabel(legacy.tradition), "Evening Examen");
});

test("profiles validate and pick each tradition's default translation", () => {
  assert.equal(normalizeFaithProfile({ tradition: "catholic" }).translation, "CPDV");
  assert.equal(normalizeFaithProfile({ tradition: "orthodox" }).translation, "WEB");
  assert.equal(normalizeFaithProfile({ tradition: "protestant", translation: "kjv" }).translation, "KJV");
  assert.deepEqual(normalizeFaithProfile({ show_calendar: "false" }).show_calendar, false);
  const base = { tradition: "catholic", translation: "CPDV", show_calendar: true };
  assert.deepEqual(normalizeFaithProfile({ show_calendar: false }, { base }), { ...base, show_calendar: false });
  assert.throws(() => normalizeFaithProfile({ tradition: "pagan" }, { strict: true }));
  assert.throws(() => normalizeFaithProfile({ translation: "ESV" }, { strict: true }));
  assert.equal(normalizeFaithProfile({ tradition: "pagan" }).tradition, "christian");
});

test("calendar, evening label and canon follow the tradition", () => {
  assert.equal(calendarKindForProfile({ tradition: "catholic", show_calendar: true }), "roman");
  assert.equal(calendarKindForProfile({ tradition: "orthodox", show_calendar: true }), "church_year");
  assert.equal(calendarKindForProfile({ tradition: "catholic", show_calendar: false }), "off");
  assert.equal(eveningLabel("christian"), "Evening Reflection");
  assert.equal(eveningLabel("protestant"), "Evening Reflection");
  assert.equal(includesDeuterocanon("catholic"), true);
  assert.equal(includesDeuterocanon("christian"), false);
  assert.equal(includesDeuterocanon("orthodox"), false);
});

test("translations", () => {
  assert.equal(normalizeTranslationCode("bsb"), "BSB");
  assert.equal(normalizeTranslationCode("NIV"), "");
  assert.equal(translationName("CPDV"), "Catholic Public Domain Version");
  assert.equal(translationVersification("CPDV"), "vulgate");
  assert.equal(translationVersification("WEB"), "standard");
});

test("books: the 66 shared books, the deuterocanon and extras", () => {
  assert.deepEqual(classifyBook("I Samuel"), { key: "1samuel", testament: "old", canon: "protestant" });
  assert.equal(classifyBook("Revelation of John").testament, "new");
  assert.equal(classifyBook("Sirach").canon, "deuterocanon");
  assert.equal(classifyBook("II Maccabees").canon, "deuterocanon");
  assert.equal(classifyBook("Prayer of Manasses").canon, "extra");
  assert.equal(classifyBook("Esther (Greek)").canon, "extra");
  assert.equal(classifyBook("Laodiceans").canon, "extra");
  assert.equal(bookAllowedForReading("Tobit"), false);
  assert.equal(bookAllowedForReading("Tobit", { includeDeuterocanon: true }), true);
  assert.equal(bookAllowedForReading("II Esdras", { includeDeuterocanon: true }), false);
  assert.equal(bookAllowedForReading("Romans"), true);
  assert.equal(bookNameForCode("JOH"), "John");
  assert.equal(bookNameForCode("4MA"), "IV Maccabees");
  assert.equal(displayBookName("III John"), "3 John");
  assert.equal(displayBookName("Psalms"), "Psalm");
});

test("virtue wording: Catechism for Catholic, Scripture otherwise", () => {
  assert.equal(virtueGroupsForTradition("catholic"), VIRTUE_GROUPS);
  assert.ok(virtueNamesForTradition("catholic").includes("Charity"));
  assert.ok(!virtueNamesForTradition("christian").includes("Charity"));
  assert.ok(virtueNamesForTradition("christian").includes("Love"));
  assert.ok(virtueGroupsForTradition("protestant").some((group) => group.name === "Fruit of the Spirit"));
  assert.equal(findVirtueDefinition("Charity", "christian"), "Love of God above all, and of neighbor for His sake");
  assert.match(findVirtueDefinition("Self-control", "christian"), /Titus 2/);
  assert.equal(findVirtueDefinition("Self-control", "catholic"), "Ordering desires toward what is good");
  assert.equal(findVirtueDefinition("Nonsense"), "");
});

test("evening section is named for the tradition; the slug does not change", () => {
  assert.equal(spiritualSectionBySlug("examen").name, "Evening Examen");
  assert.equal(spiritualSectionBySlug("examen", "catholic").name, "Evening Examen");
  assert.equal(spiritualSectionBySlug("examen", "christian").name, "Evening Reflection");
  const tab = spiritualTabsForPath("/spiritual/examen", "protestant").find((item) => item.current);
  assert.equal(tab.name, "Evening Reflection");
  assert.equal(SPIRITUAL_HOME_LINKS.length, 7);
});
