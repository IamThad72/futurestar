import assert from "node:assert/strict";
import test from "node:test";
import { fromVulgatePsalm, mapRangeForVersification, toVulgatePsalm } from "../utils/psalmNumbering.js";

test("the morning prayer psalms map to the CPDV verses the app used before", () => {
  // Previously hard-coded in server/utils/bibleCpdv.ts as Vulgate numbers.
  assert.deepEqual(toVulgatePsalm(46, 10), { chapter: 45, verse: 11 });
  assert.deepEqual(toVulgatePsalm(143, 8), { chapter: 142, verse: 8 });
  assert.deepEqual(toVulgatePsalm(90, 14), { chapter: 89, verse: 14 });
  assert.deepEqual(toVulgatePsalm(51, 10), { chapter: 50, verse: 12 });
  assert.deepEqual(toVulgatePsalm(51, 12), { chapter: 50, verse: 14 });
  assert.deepEqual(toVulgatePsalm(19, 14), { chapter: 18, verse: 15 });
  assert.deepEqual(toVulgatePsalm(63, 1), { chapter: 62, verse: 2 });
  assert.deepEqual(toVulgatePsalm(118, 24), { chapter: 117, verse: 24 });
});

test("Psalm 5:3 is the morning verse, which the Vulgate numbers 5:4", () => {
  assert.deepEqual(toVulgatePsalm(5, 3), { chapter: 5, verse: 4 });
});

test("joined and split psalms", () => {
  assert.deepEqual(toVulgatePsalm(9, 1), { chapter: 9, verse: 2 });
  assert.deepEqual(toVulgatePsalm(10, 1), { chapter: 9, verse: 22 });
  assert.deepEqual(toVulgatePsalm(10, 18), { chapter: 9, verse: 39 });
  assert.deepEqual(toVulgatePsalm(114, 8), { chapter: 113, verse: 8 });
  assert.deepEqual(toVulgatePsalm(115, 1), { chapter: 113, verse: 9 });
  assert.deepEqual(toVulgatePsalm(116, 9), { chapter: 114, verse: 9 });
  assert.deepEqual(toVulgatePsalm(116, 10), { chapter: 115, verse: 1 });
  assert.deepEqual(toVulgatePsalm(147, 11), { chapter: 146, verse: 11 });
  assert.deepEqual(toVulgatePsalm(147, 12), { chapter: 147, verse: 1 });
  assert.deepEqual(toVulgatePsalm(23, 1), { chapter: 22, verse: 1 });
  assert.deepEqual(toVulgatePsalm(150, 6), { chapter: 150, verse: 6 });
  assert.deepEqual(toVulgatePsalm(1, 1), { chapter: 1, verse: 1 });
});

test("standard → Vulgate → standard round-trips for every psalm", () => {
  for (let chapter = 1; chapter <= 150; chapter += 1) {
    for (const verse of [1, 2, 5, 9, 10, 11, 12, 18]) {
      if (chapter === 114 && verse > 8) continue; // Psalm 114 has 8 verses; 113:9 in the Vulgate is Psalm 115:1.
      const vulgate = toVulgatePsalm(chapter, verse);
      assert.deepEqual(fromVulgatePsalm(vulgate.chapter, vulgate.verse), { chapter, verse }, `Psalm ${chapter}:${verse}`);
    }
  }
});

test("Vulgate title verses have no standard verse", () => {
  assert.deepEqual(fromVulgatePsalm(45, 1), { chapter: 46, verse: 0 });
  assert.deepEqual(fromVulgatePsalm(50, 2), { chapter: 51, verse: 0 });
});

test("ranges map per versification and split across Vulgate chapters", () => {
  const ref = { book: "Psalms", chapter: 51, start: 10, end: 12 };
  assert.deepEqual(mapRangeForVersification(ref, "standard"), [{ book: "Psalms", chapter: 51, start: 10, end: 12 }]);
  assert.deepEqual(mapRangeForVersification(ref, "vulgate"), [{ book: "Psalms", chapter: 50, start: 12, end: 14 }]);
  assert.deepEqual(mapRangeForVersification({ book: "Psalms", chapter: 116, start: 8, end: 11 }, "vulgate"), [
    { book: "Psalms", chapter: 114, start: 8, end: 9 },
    { book: "Psalms", chapter: 115, start: 1, end: 2 },
  ]);
  const gospel = { book: "Matthew", chapter: 6, start: 9, end: 13 };
  assert.deepEqual(mapRangeForVersification(gospel, "vulgate"), [{ book: "Matthew", chapter: 6, start: 9, end: 13 }]);
});

test("invalid references throw", () => {
  assert.throws(() => toVulgatePsalm(151, 1), RangeError);
  assert.throws(() => toVulgatePsalm(3, 0), RangeError);
});

import { mapSegmentForVersification, vulgatePsalmChapter } from "../utils/psalmNumbering.js";

test("whole psalms map to Vulgate chapters, including the split and joined ones", () => {
  assert.deepEqual(vulgatePsalmChapter(1), [{ chapter: 1, start: 1, end: null }]);
  assert.deepEqual(vulgatePsalmChapter(9), [{ chapter: 9, start: 1, end: 21 }]);
  assert.deepEqual(vulgatePsalmChapter(10), [{ chapter: 9, start: 22, end: null }]);
  assert.deepEqual(vulgatePsalmChapter(23), [{ chapter: 22, start: 1, end: null }]);
  assert.deepEqual(vulgatePsalmChapter(114), [{ chapter: 113, start: 1, end: 8 }]);
  assert.deepEqual(vulgatePsalmChapter(115), [{ chapter: 113, start: 9, end: null }]);
  assert.equal(vulgatePsalmChapter(116).length, 2);
  assert.deepEqual(vulgatePsalmChapter(147).map((s) => s.chapter), [146, 147]);
  assert.deepEqual(vulgatePsalmChapter(148), [{ chapter: 148, start: 1, end: null }]);
  assert.throws(() => vulgatePsalmChapter(151));
});

test("reading segments map only for Psalms in Vulgate texts", () => {
  assert.deepEqual(mapSegmentForVersification({ book: "John", chapter: 3, start: null, end: null }, "vulgate"), [
    { book: "John", chapter: 3, start: 1, end: null },
  ]);
  assert.deepEqual(mapSegmentForVersification({ book: "Psalms", chapter: 51, start: null, end: null }, "standard"), [
    { book: "Psalms", chapter: 51, start: 1, end: null },
  ]);
  assert.deepEqual(mapSegmentForVersification({ book: "Psalms", chapter: 51, start: null, end: null }, "vulgate"), [
    { book: "Psalms", chapter: 50, start: 1, end: null },
  ]);
  // Partial psalm: Psalm 89:1-4 is Vulgate 88:2-5 (title is verse 1 there).
  assert.deepEqual(
    mapSegmentForVersification({ book: "Psalms", chapter: 89, start: 1, end: 4 }, "vulgate").map((s) => [s.chapter, s.start, s.end]),
    [[88, 2, 5]],
  );
});
