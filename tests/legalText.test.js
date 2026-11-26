import assert from "node:assert/strict";
import test from "node:test";
import {
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

test("the draft does not invent an email, a sale promise, or end-to-end encryption", () => {
  const blob = JSON.stringify(legalDocuments);
  assert.equal(blob.includes("@"), false);
  assert.equal(blob.toLowerCase().includes("we never sell"), false);
  assert.equal(blob.toLowerCase().includes("end-to-end"), false);
  assert.equal(blob.toLowerCase().includes("do not sell"), false);
});
