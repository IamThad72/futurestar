import assert from "node:assert/strict";
import test from "node:test";
import {
  LEGAL_DRAFT,
  LEGAL_UPDATED,
  legalDocuments,
  legalUpdatedLabel,
  tableOfContents,
} from "../utils/legalText.js";

test("LEGAL_UPDATED is a real calendar date", () => {
  assert.match(LEGAL_UPDATED, /^\d{4}-\d{2}-\d{2}$/);
  const [year, month, day] = LEGAL_UPDATED.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  assert.equal(date.getUTCFullYear(), year);
  assert.equal(date.getUTCMonth(), month - 1);
  assert.equal(date.getUTCDate(), day);
  assert.match(legalUpdatedLabel(LEGAL_UPDATED), /^[A-Z][a-z]+ \d{1,2}, \d{4}$/);
});

test("every table-of-contents id is a section id", () => {
  assert.ok(legalDocuments.length >= 2);
  for (const document of legalDocuments) {
    const contents = tableOfContents(document);
    const ids = document.sections.map((section) => section.id);
    assert.deepEqual(
      contents.map((item) => item.id),
      ids,
      `${document.title} contents`,
    );
    assert.equal(new Set(ids).size, ids.length, `${document.title} has duplicate ids`);
    for (const item of contents) {
      const section = document.sections.find((entry) => entry.id === item.id);
      assert.ok(section, item.id);
      assert.equal(item.heading, section.heading);
      assert.ok(item.heading.length > 0);
    }
  }
});

test("the owner's answers are in the draft and the open items stay placeholders", () => {
  const blob = JSON.stringify(legalDocuments);
  assert.equal(LEGAL_DRAFT, true);
  assert.match(blob, /Marcelli Enterprises LLC/);
  assert.match(blob, /info@me.com/);
  assert.match(blob, /We do not sell personal information/);
  assert.match(blob, /cross-context behavioral advertising/);
  assert.match(blob, /14 or older/);
  assert.match(blob, /children under 14/);
  assert.match(blob, /Wayne County, Ohio/);
  assert.match(blob, /Northern District of Ohio/);
  assert.match(blob, /\$100/);
  assert.match(blob, /Sample text for the owner's review/);
  assert.match(blob, /postal address for Marcelli Enterprises LLC/);
  assert.match(blob, /which ExerciseDB host production uses/);
  assert.match(blob, /estate files on the server disk or in Supabase Storage/);
  assert.match(blob, /The weekly mirror note is written inside the app/);
  assert.match(blob, /Its data is not sent to third parties/);
  assert.equal(blob.includes("weekly mirror should keep sending"), false);
  assert.equal(blob.toLowerCase().includes("end-to-end"), false);
});
