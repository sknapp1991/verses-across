"""
Word timings for the human (LibriVox) voices: when each word of a verse is heard, so the reader can highlight the
word being read instead of guessing it from how far through the verse the time is.

No new listening: the import already transcribed every source recording with word times
(.cache-audio/librivox-<set>/transcripts/*.json). For each chapter this finds its words in those transcripts,
works out where the chapter starts inside the source file (from the verse starts it already has), and gives every
word of the text a time: heard words get theirs, the rest are spread between their neighbours. A verse where too
few words were heard gets none (the player then keeps its estimate).

Adds "w": [start of each word, s] to each verse of .cache-audio/<version>/<voice>/<book>/<chapter>.json. Words are
counted like the player counts them (RAW_WORD in src/lib/search-text.ts: runs of letters, marks and digits).

  .venv-tts/Scripts/python -I scripts/tts/word-times.py                 # every human voice
  .venv-tts/Scripts/python -I scripts/tts/word-times.py rvr1909/librivox web/librivox
"""
import bisect
import difflib
import importlib.util
import json
import statistics
import sys
from collections import Counter, defaultdict
from pathlib import Path

import regex

ROOT = Path(__file__).resolve().parents[1].parent
CACHE = ROOT / ".cache-audio"
spec = importlib.util.spec_from_file_location("lvs", ROOT / "scripts" / "tts" / "librivox-sets.py")
lvs = importlib.util.module_from_spec(spec)
spec.loader.exec_module(lvs)
RAW_WORD = regex.compile(r"[\p{L}\p{M}\p{N}]+")


def sources(version: str, voice: str):
    """The transcript folders a voice was cut from, and its language."""
    if voice == "armenta":
        return [CACHE / "librivox-kjv"], "en"
    if version == "kjv":
        return [CACHE / "librivox-kjv-apoc", CACHE / "librivox-kjv"], "en"
    for name, s in lvs.SETS.items():
        if s.get("version", name) == version:
            return [CACHE / f"librivox-{name}"], s["lang"]
    return [CACHE / f"librivox-{version}"], "en"


def text_of(version: str, book: str, ch: str):
    p = next((ROOT / "data" / "texts").glob(f"*/{version}/{book}/{ch}.json"), None)
    return json.loads(p.read_text(encoding="utf-8"))["verses"] if p else None


def build(version: str, voice: str):
    dirs, lang = sources(version, voice)
    lvs.LANG = lang
    files = []  # [(name, [(norm, start)])]
    for d in dirs:
        for t in sorted((d / "transcripts").glob("*.json")):
            ws = json.loads(t.read_text(encoding="utf-8"))
            files.append((t.stem, [(lvs.norm(w), s) for w, s, _ in ws]))
    if not files:
        print(f"{version}/{voice}: no transcripts in {', '.join(map(str, dirs))}")
        return
    grams = defaultdict(list)  # three heard words in a row -> [(file, index)]
    for fi, (_, ws) in enumerate(files):
        for j in range(len(ws) - 2):
            if ws[j][0] and ws[j + 1][0] and ws[j + 2][0]:
                grams[(ws[j][0], ws[j + 1][0], ws[j + 2][0])].append((fi, j))
    out = CACHE / version / voice
    n_ch = n_v = n_w = 0
    for js in sorted(out.glob("*/*.json")):
        d = json.loads(js.read_text(encoding="utf-8"))
        if any("w" in v for v in d["verses"]):  # an older run's times go, whatever this run finds
            for v in d["verses"]:
                v.pop("w", None)
            js.write_text(json.dumps(d, ensure_ascii=False), encoding="utf-8")
        text = text_of(version, js.parent.name, js.stem)
        if not text:
            continue
        tv = {str(x["v"]): x.get("t") or "" for x in text}
        # The chapter's words, as the player counts them: (verse index, word index in verse, normalised)
        ref = []
        for vi, v in enumerate(d["verses"]):
            for wi, m in enumerate(RAW_WORD.finditer(tv.get(str(v["v"]), ""))):
                ref.append((vi, wi, lvs.norm(m.group())))
        rn = [r[2] for r in ref]
        hits = Counter()
        where = defaultdict(list)
        for i in range(len(rn) - 2):
            for fi, j in grams.get((rn[i], rn[i + 1], rn[i + 2]), ()):
                hits[fi] += 1
                where[fi].append(j)
        if not hits:
            continue
        top = hits.most_common(1)[0][1]
        heard = {}  # ref index -> chapter time
        for fi, c in hits.most_common(4):
            if c < max(4, top * 0.2):
                break
            ws = files[fi][1]
            pos = sorted(where[fi])
            a, z = max(0, pos[len(pos) // 20] - 60), min(len(ws), pos[-1 - len(pos) // 20] + 60)
            hyp = [w for w, _ in ws[a:z]]
            pairs = [
                (blk.a + k, a + blk.b + k)
                for blk in difflib.SequenceMatcher(a=rn, b=hyp, autojunk=False).get_matching_blocks()
                if blk.size >= 2
                for k in range(blk.size)
                if rn[blk.a + k]  # (a Hebrew word of vowel letters only normalises to "": matches anything)
            ]
            # Where the chapter starts in this file: from the verses whose first word was heard here.
            first = {}
            for ri, (vi, wi, _) in enumerate(ref):
                first.setdefault(vi, ri)
            src = dict(pairs)
            offs = [ws[src[ri]][1] - d["verses"][vi]["s"] for vi, ri in first.items() if ri in src]
            if not offs:
                continue
            off = statistics.median(offs)
            if sum(abs(o - off) < 1.5 for o in offs) < max(1, len(offs) // 2):
                continue  # verse starts don't agree on one place in this file: not where the chapter came from
            for ri, j in pairs:
                if ri in heard:
                    continue
                t = ws[j][1] - off
                v = d["verses"][ref[ri][0]]
                if v["s"] - 1.0 <= t <= v["e"] + 1.0:
                    heard[ri] = t
        if not heard:
            continue
        n_ch += 1
        for vi, v in enumerate(d["verses"]):
            idx = [ri for ri, r in enumerate(ref) if r[0] == vi]
            v.pop("w", None)
            if not idx:
                continue
            known = [(ref[ri][1], min(max(heard[ri], v["s"]), v["e"])) for ri in idx if ri in heard]
            # keep them in order (a word heard out of place is dropped)
            known.sort()
            ordered = []
            for wi, t in known:
                if not ordered or t >= ordered[-1][1]:
                    ordered.append((wi, t))
            n = len(idx)
            if len(ordered) < max(1, 0.4 * n):
                continue
            pts = [(-1, v["s"])] + ordered + [(n, v["e"])]
            xs = [p[0] for p in pts]
            times = []
            for wi in range(n):
                k = bisect.bisect_left(xs, wi)
                if xs[k] == wi:
                    times.append(pts[k][1])
                else:
                    (x0, t0), (x1, t1) = pts[k - 1], pts[k]
                    times.append(t0 + (t1 - t0) * (wi - x0) / (x1 - x0))
            v["w"] = [round(t, 2) for t in times]
            n_v += 1
            n_w += len(ordered)
        js.write_text(json.dumps(d, ensure_ascii=False), encoding="utf-8")
    total_v = sum(len(json.loads(p.read_text(encoding="utf-8"))["verses"]) for p in out.glob("*/*.json"))
    print(f"{version}/{voice}: {n_ch} chapters, {n_v}/{total_v} verses timed word by word ({n_v / max(1, total_v):.0%}), {n_w} words heard", flush=True)


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    if sys.argv[1:]:
        todo = [a.split("/") for a in sys.argv[1:]]
    else:
        todo = [(p.parent.name, p.name) for p in sorted(CACHE.glob("*/*")) if p.name in ("librivox", "armenta") and p.is_dir()]
    for version, voice in todo:
        build(version, voice)


if __name__ == "__main__":
    main()
