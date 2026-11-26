/**
 * Classic commentary (hidden study page /commentary): Matthew Henry's Concise Commentary, built by
 * scripts/build-commentary-mhc.mts into public/commentary/mhc/<book>.json.
 */

/** One note: the verses it covers ("4-7", "12", or "" for the chapter's overview) and its paragraphs ("\n\n"). */
export type CommentaryNote = { verses: string; text: string };
export type CommentaryBook = { intro?: string; chapters: Record<string, CommentaryNote[]> };

export const COMMENTARY_SOURCE = {
  id: "mhc",
  title: "Concise Commentary on the Whole Bible",
  author: "Matthew Henry",
  from: "the CrossWire Bible Society's public-domain SWORD module (MHCC)",
  url: "https://www.crosswire.org/sword/modules/ModInfo.jsp?modName=MHCC",
};

export async function loadCommentary(book: string): Promise<CommentaryBook> {
  const res = await fetch(`/commentary/${COMMENTARY_SOURCE.id}/${book}.json`);
  if (!res.ok) throw new Error(`commentary ${book}: ${res.status}`);
  return (await res.json()) as CommentaryBook;
}

/** "4-7" → [[4, 7]]; "12" → [[12, 12]]; "1-3,5" → [[1, 3], [5, 5]]. Undefined when it names no verse. */
export function noteSpan(verses: string): [number, number][] | undefined {
  const spans: [number, number][] = [];
  for (const part of verses.split(",")) {
    const nums = (part.match(/\d+/g) ?? []).map(Number);
    if (nums.length) spans.push([Math.min(...nums), Math.max(...nums)]);
  }
  return spans.length ? spans : undefined;
}

/** A run of verses shown together, with the note that covers them (shown once, beside its first run). */
export type CommentaryRow<V> = { verses: V[]; note?: CommentaryNote; span?: string };

/**
 * Lines the verses up with the notes: each verse goes with the first note whose range covers it, and consecutive
 * verses with the same note form one row. Verses no note covers get a row of their own, without a note.
 */
export function commentaryRows<V extends { v: string }>(verses: V[], notes: CommentaryNote[]): CommentaryRow<V>[] {
  const spans = notes.map((n) => noteSpan(n.verses));
  const rows: CommentaryRow<V>[] = [];
  const shown = new Set<number>();
  let last = -2;
  for (const verse of verses) {
    const num = parseInt(verse.v, 10);
    const i = spans.findIndex((s) => !!s && s.some(([a, b]) => num >= a && num <= b));
    if (rows.length && i === last) rows[rows.length - 1].verses.push(verse);
    else {
      const first = i >= 0 && !shown.has(i);
      if (first) shown.add(i);
      rows.push({ verses: [verse], note: first ? notes[i] : undefined, span: i >= 0 ? notes[i].verses : undefined });
    }
    last = i;
  }
  return rows;
}
