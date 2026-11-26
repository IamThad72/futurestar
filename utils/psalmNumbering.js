/**
 * Psalm numbering between the standard (Hebrew/English) system used by most
 * Bibles and the Greek/Latin (Vulgate) system used by the CPDV.
 *
 * Chapters: Psalms 9–10 are one psalm (9) in the Vulgate, 114–115 are 113,
 * 116 is split into 114 and 115, and 147 is split into 146 and 147.
 * Everything between 10 and 147 is otherwise one lower.
 *
 * Verses: Vulgate Bibles number a psalm's title as its own verse (1, or 1–2),
 * so the first verse of the psalm text is 2 (or 3). English Bibles start at 1.
 * The offsets below were checked against the CPDV and KJV texts verse by verse.
 */

/** English psalm → extra leading verses in the Vulgate-numbered (CPDV) text. */
const TITLE_OFFSET_TWO = new Set([51, 52, 54, 60]);
const TITLE_OFFSET_ONE = new Set([
  3, 4, 5, 6, 7, 8, 9, 11, 12, 13, 18, 19, 20, 21, 22, 30, 31, 34, 36, 38, 39, 40, 41, 42, 44, 45, 46, 47, 48,
  49, 53, 55, 56, 57, 58, 59, 61, 62, 63, 64, 65, 67, 68, 69, 70, 75, 76, 77, 80, 81, 83, 84, 85, 88, 89, 92,
  102, 108, 140, 142,
]);

export function psalmTitleOffset(standardChapter) {
  const chapter = Number(standardChapter);
  if (TITLE_OFFSET_TWO.has(chapter)) return 2;
  if (TITLE_OFFSET_ONE.has(chapter)) return 1;
  return 0;
}

/**
 * Standard Psalm chapter:verse → Vulgate chapter:verse.
 * @returns {{ chapter: number, verse: number }}
 */
export function toVulgatePsalm(chapter, verse) {
  const c = Number(chapter);
  const v = Number(verse);
  if (!Number.isInteger(c) || !Number.isInteger(v) || c < 1 || c > 150 || v < 1) {
    throw new RangeError(`Invalid psalm reference ${chapter}:${verse}`);
  }
  if (c <= 8) return { chapter: c, verse: v + psalmTitleOffset(c) };
  if (c === 9) return { chapter: 9, verse: v + 1 };
  // Psalm 9 in the Vulgate is title + 20 verses of Psalm 9, then Psalm 10.
  if (c === 10) return { chapter: 9, verse: v + 21 };
  if (c <= 113) return { chapter: c - 1, verse: v + psalmTitleOffset(c) };
  if (c === 114) return { chapter: 113, verse: v };
  if (c === 115) return { chapter: 113, verse: v + 8 };
  if (c === 116) return v <= 9 ? { chapter: 114, verse: v } : { chapter: 115, verse: v - 9 };
  if (c <= 146) return { chapter: c - 1, verse: v + psalmTitleOffset(c) };
  if (c === 147) return v <= 11 ? { chapter: 146, verse: v } : { chapter: 147, verse: v - 11 };
  return { chapter: c, verse: v };
}

/**
 * Vulgate Psalm chapter:verse → standard chapter:verse.
 * Title verses (which have no standard number) return verse 0.
 */
export function fromVulgatePsalm(chapter, verse) {
  const c = Number(chapter);
  const v = Number(verse);
  if (!Number.isInteger(c) || !Number.isInteger(v) || c < 1 || c > 150 || v < 1) {
    throw new RangeError(`Invalid psalm reference ${chapter}:${verse}`);
  }
  if (c <= 8) return { chapter: c, verse: v - psalmTitleOffset(c) };
  if (c === 9) return v <= 21 ? { chapter: 9, verse: v - 1 } : { chapter: 10, verse: v - 21 };
  if (c <= 112) return { chapter: c + 1, verse: v - psalmTitleOffset(c + 1) };
  if (c === 113) return v <= 8 ? { chapter: 114, verse: v } : { chapter: 115, verse: v - 8 };
  if (c === 114) return { chapter: 116, verse: v };
  if (c === 115) return { chapter: 116, verse: v + 9 };
  if (c <= 145) return { chapter: c + 1, verse: v - psalmTitleOffset(c + 1) };
  if (c === 146) return { chapter: 147, verse: v };
  if (c === 147) return { chapter: 147, verse: v + 11 };
  return { chapter: c, verse: v };
}

/**
 * Map a standard-numbered verse range in one book to the lookups needed for a
 * translation's versification. Returns one segment, or two when a Psalm range
 * crosses a Vulgate chapter boundary (for example Psalm 116:8–11).
 *
 * @param {{ book: string, chapter: number, start: number, end: number }} ref
 * @param {"standard" | "vulgate"} versification
 * @returns {{ book: string, chapter: number, start: number, end: number }[]}
 */
export function mapRangeForVersification(ref, versification = "standard") {
  const book = String(ref?.book || "");
  const chapter = Number(ref?.chapter);
  const start = Number(ref?.start);
  const end = Number(ref?.end ?? ref?.start);
  if (versification !== "vulgate" || book !== "Psalms") {
    return [{ book, chapter, start, end }];
  }
  const segments = [];
  for (let verse = start; verse <= end; verse += 1) {
    const mapped = toVulgatePsalm(chapter, verse);
    const last = segments[segments.length - 1];
    if (last && last.chapter === mapped.chapter && last.end + 1 === mapped.verse) {
      last.end = mapped.verse;
    } else {
      segments.push({ book, chapter: mapped.chapter, start: mapped.verse, end: mapped.verse });
    }
  }
  return segments;
}

/**
 * Map a whole standard-numbered Psalm chapter to Vulgate lookups. `end: null`
 * means "to the end of the chapter". Psalms 9–10, 114–115, 116 and 147 cross
 * Vulgate chapter boundaries, so they return verse ranges or two chapters.
 *
 * @returns {{ chapter: number, start: number, end: number | null }[]}
 */
export function vulgatePsalmChapter(standardChapter) {
  const c = Number(standardChapter);
  if (!Number.isInteger(c) || c < 1 || c > 150) throw new RangeError(`Invalid psalm ${standardChapter}`);
  if (c === 9) return [{ chapter: 9, start: 1, end: 21 }];
  if (c === 10) return [{ chapter: 9, start: 22, end: null }];
  if (c === 114) return [{ chapter: 113, start: 1, end: 8 }];
  if (c === 115) return [{ chapter: 113, start: 9, end: null }];
  if (c === 116) return [{ chapter: 114, start: 1, end: null }, { chapter: 115, start: 1, end: null }];
  if (c === 147) return [{ chapter: 146, start: 1, end: null }, { chapter: 147, start: 1, end: null }];
  if ((c >= 11 && c <= 113) || (c >= 117 && c <= 146)) return [{ chapter: c - 1, start: 1, end: null }];
  return [{ chapter: c, start: 1, end: null }];
}

/**
 * Lookups for one reading segment ({ book, chapter, start?, end? }) in a
 * translation's versification. A segment with no start is a whole chapter.
 */
export function mapSegmentForVersification(segment, versification = "standard") {
  const book = String(segment?.book || "");
  const chapter = Number(segment?.chapter);
  const start = segment?.start == null ? null : Number(segment.start);
  const end = segment?.end == null ? null : Number(segment.end);
  if (versification !== "vulgate" || book !== "Psalms") {
    return [{ book, chapter, start: start ?? 1, end: start == null ? null : end }];
  }
  if (start == null) {
    return vulgatePsalmChapter(chapter).map((item) => ({ book, ...item }));
  }
  return mapRangeForVersification({ book, chapter, start, end: end ?? start }, versification);
}
