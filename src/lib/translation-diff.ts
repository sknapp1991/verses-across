/**
 * Word-level differences between two renderings of one verse (the hidden Translation lab). Words are compared with
 * case and punctuation ignored ("LORD," = "Lord"), by a longest-common-subsequence alignment; the original text is
 * kept exactly, spaces and punctuation included, for display.
 */

/** One piece of a verse: a word (with its punctuation) or the space between words. */
export type Token = { text: string; key: string; space: boolean };

/** How a word of the compared version stands against the base. */
export type Mark = "same" | "changed" | "added";
export type DiffPart =
  | { kind: "word"; text: string; mark: Mark; key: string }
  | { kind: "space"; text: string }
  /** Base words this version has nothing for at this spot (shown struck through). */
  | { kind: "dropped"; words: string[] };

/** Lower case, letters and digits only (any script); "—" or "¶" alone come out empty and are never counted. */
export const keyOf = (word: string) => word.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");

export function tokenize(text: string): Token[] {
  const out: Token[] = [];
  for (const piece of text.split(/(\s+)/)) {
    if (!piece) continue;
    const space = /^\s+$/.test(piece);
    out.push({ text: piece, key: space ? "" : keyOf(piece), space });
  }
  return out;
}

/** The words that count (not spaces, not bare punctuation), as indexes into the tokens. */
const wordIdx = (t: Token[]) => t.map((x, i) => (!x.space && x.key ? i : -1)).filter((i) => i >= 0);

/** Pairs [baseWordPos, otherWordPos] of a longest common subsequence of the two word lists. */
function lcs(a: string[], b: string[]): [number, number][] {
  const n = a.length;
  const m = b.length;
  const w = m + 1;
  const len = new Uint16Array((n + 1) * w);
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--)
      len[i * w + j] = a[i] === b[j] ? len[(i + 1) * w + j + 1] + 1 : Math.max(len[(i + 1) * w + j], len[i * w + j + 1]);
  const pairs: [number, number][] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      pairs.push([i, j]);
      i++;
      j++;
    } else if (len[(i + 1) * w + j] >= len[i * w + j + 1]) i++;
    else j++;
  }
  return pairs;
}

/**
 * The compared version's text, piece by piece: words it shares with the base, words that stand where the base has
 * other words ("changed"), words with nothing opposite them in the base ("added"), and the base's words it leaves out.
 * Also how much of the two is shared (0–1: shared words over the longer one's words).
 */
export function diffWords(base: string, other: string): { parts: DiffPart[]; shared: number } {
  const bt = tokenize(base);
  const ot = tokenize(other);
  const bw = wordIdx(bt);
  const ow = wordIdx(ot);
  const pairs = lcs(
    bw.map((i) => bt[i].key),
    ow.map((i) => ot[i].key),
  );
  // Each word of the other version: its match in the base (word position), or -1.
  const matchOf = new Array<number>(ow.length).fill(-1);
  for (const [bi, oi] of pairs) matchOf[oi] = bi;

  const parts: DiffPart[] = [];
  let baseAt = 0; // next base word position not yet accounted for
  let oi = 0; // word position in the other version
  // Words between two matches: "changed" if the base also has unmatched words in that gap, else "added".
  const gapMark: Mark[] = new Array<Mark>(ow.length).fill("same");
  {
    let prevB = -1;
    let start = 0;
    for (let k = 0; k <= ow.length; k++) {
      if (k === ow.length || matchOf[k] >= 0) {
        const nextB = k === ow.length ? bw.length : matchOf[k];
        const baseGap = nextB - prevB - 1;
        for (let x = start; x < k; x++) gapMark[x] = baseGap > 0 ? "changed" : "added";
        if (k < ow.length) prevB = matchOf[k];
        start = k + 1;
      }
    }
  }
  const dropTo = (until: number) => {
    // base words baseAt..until-1 have no match: show them as left out (only if no changed word stands for them here)
    if (until > baseAt) parts.push({ kind: "dropped", words: bw.slice(baseAt, until).map((i) => bt[i].text) });
    baseAt = Math.max(baseAt, until);
  };
  for (let ti = 0; ti < ot.length; ti++) {
    const t = ot[ti];
    if (t.space) {
      parts.push({ kind: "space", text: t.text });
      continue;
    }
    if (!t.key) {
      parts.push({ kind: "word", text: t.text, mark: "same", key: "" });
      continue;
    }
    const m = matchOf[oi];
    if (m >= 0) {
      dropTo(m);
      baseAt = m + 1;
      parts.push({ kind: "word", text: t.text, mark: "same", key: t.key });
    } else {
      // a changed word stands in for the base's gap: the base words of that gap aren't "dropped"
      if (gapMark[oi] === "changed") {
        let next = bw.length;
        for (let k = oi + 1; k < ow.length; k++)
          if (matchOf[k] >= 0) {
            next = matchOf[k];
            break;
          }
        baseAt = Math.max(baseAt, next);
      }
      parts.push({ kind: "word", text: t.text, mark: gapMark[oi], key: t.key });
    }
    oi++;
  }
  dropTo(bw.length);
  const longer = Math.max(bw.length, ow.length);
  return { parts: tidy(parts), shared: longer ? pairs.length / longer : 1 };
}

/** A "dropped" run right after a space reads better before it: "word [left out] next". Merge neighbouring runs. */
function tidy(parts: DiffPart[]): DiffPart[] {
  const out: DiffPart[] = [];
  for (const p of parts) {
    const last = out[out.length - 1];
    if (p.kind === "dropped" && last?.kind === "dropped") last.words.push(...p.words);
    else out.push(p.kind === "dropped" ? { kind: "dropped", words: p.words.slice() } : p);
  }
  return out;
}

/** The words (keys) of a text, for "only in this version" marks. */
export const keysOf = (text: string) => new Set(tokenize(text).map((t) => t.key).filter(Boolean));
