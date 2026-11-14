"""
Human readings from LibriVox (public domain) for Bibles other than the KJV, cut into chapters with verse
timings in the same layout as every other voice:
  .cache-audio/<version>/librivox/<book>/<chapter>.mp3  +  <chapter>.json  {"verses": [{"v","s","e"}], ...}

Sets (LibriVox project title → our version): Spanish Reina-Valera 1909, French Louis Segond 1910, German
Luther 1912, Hebrew (Masoretic text), Greek (Patriarchal / Stephanus New Testament). Skylar OK'd it Nov 12.

  .venv-tts/Scripts/python -u scripts/tts/librivox-sets.py fetch [--set rvr1909]   # MP3s from archive.org
  .venv-tts/Scripts/python -u scripts/tts/librivox-sets.py align [--set rvr1909] [--limit N]

How: the LibriVox catalogue lists the projects; each project's 64 kbps MP3s come from its archive.org item.
A file may hold one chapter, several, or a whole small book, and file titles aren't reliable, so each file is
transcribed with Whisper (large-v3-turbo, GPU; cached), matched against the project's books by shared
three-word runs to find which chapters it holds, then word by word (as scripts/tts/align-librivox.py does for
the KJV) to time each verse. A book read twice keeps the first reading. Safe to stop and re-run.
"""
import argparse
import difflib
import json
import re
import subprocess
import sys
import time
import unicodedata
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CACHE = ROOT / ".cache-audio"
CATALOG = json.loads((ROOT / "data" / "catalog.json").read_text(encoding="utf-8"))
UA = {"User-Agent": "versesacross-audio-import/1.0"}

SETS = {
    "rvr1909": {"title": r"^Bible \(Reina Valera\)", "query": "Bible (Reina Valera)", "lang": "es"},
    "lsg1910": {"title": r"^Bible \(LSG, 1910\)", "query": "Bible (LSG, 1910)", "lang": "fr"},
    "luther1912": {"title": r"^Bibel \(LB 1912\)", "query": "Bibel (LB 1912)", "lang": "de"},
    "hebrew": {"title": r"^Bible \(Hebrew\)", "query": "Bible (Hebrew)", "lang": "he"},
    "greek": {"title": r"^Bible \((?:PE|STE)\)", "query": ["Bible (PE)", "Bible (STE)"], "lang": "el"},
}

# Book order (Old Testament 1–39, New Testament 1–27), as LibriVox numbers its Bible projects.
OT, NT = [], []
for rel in CATALOG["religions"]:
    for col in rel["collections"]:
        if col["id"] == "ot":
            OT = [it["id"] for it in col["items"]]
        if col["id"] == "nt":
            NT = [it["id"] for it in col["items"]]
CHAPTERS = {it["id"]: it["chapters"] for rel in CATALOG["religions"] for col in rel["collections"] if col["id"] in ("ot", "nt") for it in col["items"]}
NUMS = re.compile(r"\)\s*(NT\s*|AT\s*)?(\d+)(?:\s*-\s*(\d+))?\s*:")


def get(url: str) -> bytes:
    for attempt in range(4):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=120) as r:
                return r.read()
        except Exception:
            if attempt == 3:
                raise
            time.sleep(5 * (attempt + 1))


def projects(name: str):
    """LibriVox projects of a set: [{id, title, ia, books}] (one reading per book)."""
    s = SETS[name]
    queries = s["query"] if isinstance(s["query"], list) else [s["query"]]
    found = {}
    for q in queries:
        off = 0
        while True:
            url = "https://librivox.org/api/feed/audiobooks?" + urllib.parse.urlencode(
                {"title": "^" + q, "format": "json", "limit": 50, "offset": off, "fields": "{id,title,url_zip_file}"}
            )
            d = json.loads(get(url))
            books = d.get("books") or []
            for b in books:
                if re.search(s["title"], b["title"]):
                    found[b["id"]] = b
            if len(books) < 50:
                break
            off += 50
    out, taken = [], set()
    for b in sorted(found.values(), key=lambda x: int(x["id"])):
        if re.search(r"version 2", b["title"], re.I):
            continue
        m = NUMS.search(b["title"])
        ia = re.search(r"archive\.org/(?:compress|download)/([^/]+)", b.get("url_zip_file") or "")
        if not m or not ia:
            print("?? skipped", b["title"])
            continue
        order = NT if (m.group(1) or "").strip() == "NT" else OT
        a, z = int(m.group(2)), int(m.group(3) or m.group(2))
        books = [order[i - 1] for i in range(a, z + 1) if 0 < i <= len(order)]
        books = [x for x in books if x not in taken]  # a book read twice: keep the first reading
        if not books:
            continue
        taken.update(books)
        out.append({"id": b["id"], "title": b["title"], "ia": ia.group(1), "books": books})
    return out


def fetch(name: str):
    dest = CACHE / f"librivox-{name}"
    dest.mkdir(parents=True, exist_ok=True)
    items = projects(name)
    total = 0
    for it in items:
        meta = json.loads(get(f"https://archive.org/metadata/{it['ia']}"))
        files = sorted(f["name"] for f in meta.get("files", []) if f["name"].endswith("_64kb.mp3"))
        it["files"] = files
        for f in files:
            p = dest / it["ia"] / f
            if p.exists() and p.stat().st_size > 0:
                continue
            p.parent.mkdir(parents=True, exist_ok=True)
            data = get(f"https://archive.org/download/{it['ia']}/{urllib.parse.quote(f)}")
            p.write_bytes(data)
            total += len(data)
        print(f"{it['title']}: {len(files)} files", flush=True)
    (dest / "items.json").write_text(json.dumps(items, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"{name}: {len(items)} projects, {sum(len(i['books']) for i in items)} books, {total / 1e6:.0f} MB downloaded")


HE_FINALS = str.maketrans("ךםןףץ", "כמנפצ")
LANG = "en"  # set per set in align_set: Hebrew needs its own matching


def norm(w: str) -> str:
    w = unicodedata.normalize("NFD", w.lower())
    w = "".join(c for c in w if unicodedata.category(c) != "Mn")  # accents, Hebrew points, Greek breathings
    if LANG == "he":
        # Whisper writes modern (full) spelling and the reader says "Adonai" for the divine name, while the
        # Masoretic text is written defectively: compare consonant skeletons without the vowel letters.
        w = w.translate(HE_FINALS).replace("יהוה", "אדני")
        w = re.sub(r"[^א-ת]", "", w)
        return re.sub(r"[ויא]", "", w)
    if LANG == "el":
        # Read with modern pronunciation, so Whisper often picks another spelling of the same sound (ει/οι/η/υ/ι
        # all say "i", ω/ο "o", αι/ε "e"): compare by sound.
        w = re.sub(r"[^\w]", "", w).replace("_", "").replace("ς", "σ")
        for a, b in (("ει", "ι"), ("οι", "ι"), ("υι", "ι"), ("αι", "ε"), ("η", "ι"), ("υ", "ι"), ("ω", "ο")):
            w = w.replace(a, b)
        return re.sub(r"(.)\1", r"\1", w)  # double letters sound single
    return re.sub(r"[^\w]", "", w).replace("_", "")


def ref_words(version: str, chapters):
    """Words of these (book, chapter)s in our text, each tagged (book, chapter, verse)."""
    out = []
    for book, ch in chapters:
        p = ROOT / "data" / "texts" / "bible" / version / book / f"{ch}.json"
        if not p.exists():
            continue
        for x in json.loads(p.read_text(encoding="utf-8"))["verses"]:
            for w in re.split(r"[\s־]+", x.get("t") or ""):  # (the Hebrew maqaf joins words)
                n = norm(w)
                if n:
                    out.append((n, book, ch, x["v"]))
    return out


_model = None


def transcribe(mp3: Path, lang: str):
    cache = mp3.parent.parent / "transcripts" / (mp3.stem + ".json")
    if cache.exists():
        return json.loads(cache.read_text(encoding="utf-8"))
    global _model
    if _model is None:
        import whisper

        _model = whisper.load_model("large-v3-turbo", device="cuda")
    r = _model.transcribe(str(mp3), language=lang, word_timestamps=True, condition_on_previous_text=False, fp16=True)
    words = [(w["word"], round(w["start"], 3), round(w["end"], 3)) for s in r["segments"] for w in s.get("words", [])]
    cache.parent.mkdir(parents=True, exist_ok=True)
    cache.write_text(json.dumps(words, ensure_ascii=False), encoding="utf-8")
    return words


def duration(mp3: Path) -> float:
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(mp3)], capture_output=True, text=True)
    return float(out.stdout.strip())


def which_chapters(version: str, books, words):
    """The run of (book, chapter)s this file holds: chapters sharing enough three-word runs with the transcript."""
    hyp = [norm(w) for w, _, _ in words]
    grams = {tuple(hyp[i : i + 3]) for i in range(len(hyp) - 2)}
    order, hits = [], {}
    for b in books:
        for c in range(1, CHAPTERS.get(b, 0) + 1):
            ws = [w for w, *_ in ref_words(version, [(b, c)])]
            g = [tuple(ws[i : i + 3]) for i in range(len(ws) - 2)]
            if not g:
                continue
            order.append((b, c))
            hits[(b, c)] = sum(1 for x in g if x in grams) / len(g)
    good = [i for i, k in enumerate(order) if hits[k] >= 0.25]
    if not good:
        return []
    # The main run only: near-identical chapters elsewhere (Psalm 14 and Psalm 53, Kings and Chronicles) must
    # not stretch the range. Runs allow one missed chapter in between; the one with the most matching wins.
    runs, cur = [], [good[0]]
    for i in good[1:]:
        if i - cur[-1] <= 2:
            cur.append(i)
        else:
            runs.append(cur)
            cur = [i]
    runs.append(cur)
    best = max(runs, key=lambda r: sum(hits[order[i]] for i in r))
    return order[best[0] : best[-1] + 1]


def align(version: str, chapters, words):
    """Start time of every verse: [((book, ch, v), seconds)], share of words matched, end of the last word heard."""
    ref = ref_words(version, chapters)
    hyp = [norm(w) for w, _, _ in words]
    sm = difflib.SequenceMatcher(a=[r[0] for r in ref], b=hyp, autojunk=False)
    ref_time = [None] * len(ref)
    last_end = 0.0
    for blk in sm.get_matching_blocks():
        for k in range(blk.size):
            ref_time[blk.a + k] = words[blk.b + k][1]
            last_end = max(last_end, words[blk.b + k][2])
    starts, order, first_of = {}, [], {}
    for i, (_, b, ch, v) in enumerate(ref):
        key = (b, ch, v)
        if key not in starts:
            starts[key] = None
            order.append((key, i))
            first_of[key] = i
        if starts[key] is None and ref_time[i] is not None and i - first_of[key] <= 3:
            starts[key] = ref_time[i] - 0.15 * (i - first_of[key])  # trust only a match near the verse's start
    times = [starts[k] for k, _ in order]
    last = -1.0
    for i, t in enumerate(times):  # times must increase
        if t is not None and t <= last:
            times[i] = None
        elif t is not None:
            last = t
    known = [i for i, t in enumerate(times) if t is not None]
    if not known:
        raise RuntimeError("nothing matched")
    pos = [j for _, j in order]
    for i in range(len(times)):  # fill the gaps by word position
        if times[i] is None:
            prev = max((k for k in known if k < i), default=None)
            nxt = min((k for k in known if k > i), default=None)
            if prev is not None and nxt is not None:
                f = (pos[i] - pos[prev]) / max(1, pos[nxt] - pos[prev])
                times[i] = times[prev] + f * (times[nxt] - times[prev])
            elif prev is not None:
                times[i] = times[prev] + 0.4 * (pos[i] - pos[prev])
            else:
                times[i] = max(0.0, times[nxt] - 0.4 * (pos[nxt] - pos[i]))
    matched = sum(1 for t in ref_time if t is not None) / max(1, len(ref))
    return [(k, t) for (k, _), t in zip(order, times)], matched, last_end


def align_set(name: str, limit: int):
    global LANG
    LANG = SETS[name]["lang"]
    src = CACHE / f"librivox-{name}"
    out = CACHE / name / "librivox"
    items = json.loads((src / "items.json").read_text(encoding="utf-8"))
    log = []
    done = 0
    for it in items:
        # One file per chapter (the file count is the book's chapter count): file N is chapter N. Matching by
        # words can't tell near-identical chapters apart (Numbers 1-3's census, Numbers 28-29's offerings).
        one_each = len(it["books"]) == 1 and len(it["files"]) == CHAPTERS.get(it["books"][0], -1)
        for n_file, f in enumerate(it["files"]):
            mp3 = src / it["ia"] / f
            if not mp3.exists():
                print("missing", f)
                continue
            mark = out / ".done" / (mp3.stem + ".txt")
            if mark.exists():
                continue
            words = transcribe(mp3, SETS[name]["lang"])
            chs = [(it["books"][0], n_file + 1)] if one_each else which_chapters(name, it["books"], words)
            if not chs:
                print(f"{f}: no chapter found (intro or other), skipped", flush=True)
                mark.parent.mkdir(parents=True, exist_ok=True)
                mark.write_text("none", encoding="utf-8")
                continue
            verses, matched, last_end = align(name, chs, words)
            total = min(duration(mp3), last_end + 1.2)
            ch_start = {}
            for (b, ch, v), t in verses:
                ch_start.setdefault((b, ch), max(0.0, t - 2.5))  # "Capítulo 3" is heard just before verse 1
            for i, key in enumerate(chs):
                if key not in ch_start:
                    continue
                b, c = key
                s = ch_start[key]
                e = ch_start.get(chs[i + 1], total) if i + 1 < len(chs) else total
                if e - s < 5:  # out of order or too short to be a chapter: leave it for another reading
                    print(f"  skipped {b} {c}: {s:.1f}–{e:.1f} s", flush=True)
                    continue
                vs = [(v, t) for (bb, ch, v), t in verses if (bb, ch) == key]
                timing = [{"v": v, "s": round(max(0.0, t - s), 3), "e": round(max(0.0, (vs[j + 1][1] if j + 1 < len(vs) else e) - s - 0.1), 3)} for j, (v, t) in enumerate(vs)]
                (out / b).mkdir(parents=True, exist_ok=True)
                subprocess.run(
                    ["ffmpeg", "-loglevel", "error", "-y", "-ss", f"{s:.3f}", "-to", f"{e:.3f}", "-i", str(mp3), "-c:a", "libmp3lame", "-b:a", "64k", "-ac", "1", str(out / b / f"{c}.mp3")],
                    check=True,
                )
                (out / b / f"{c}.json").write_text(
                    json.dumps({"version": name, "voice": "librivox", "book": b, "chapter": c, "duration": round(e - s, 3), "verses": timing}), encoding="utf-8"
                )
            line = f"{f}: {chs[0][0]} {chs[0][1]}–{chs[-1][0]} {chs[-1][1]}, {matched:.0%} of words matched"
            print(line, flush=True)
            log.append(line)
            mark.parent.mkdir(parents=True, exist_ok=True)
            mark.write_text(line, encoding="utf-8")
            done += 1
            if limit and done >= limit:
                return


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("cmd", choices=["fetch", "align"])
    ap.add_argument("--set", default="")
    ap.add_argument("--limit", type=int, default=0)
    args = ap.parse_args()
    for name in [args.set] if args.set else list(SETS):
        if args.cmd == "fetch":
            fetch(name)
        else:
            align_set(name, args.limit)


if __name__ == "__main__":
    sys.exit(main())
