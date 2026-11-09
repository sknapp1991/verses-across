"""
Cross references: for every verse, the most similar verses in its own religion and in each other one.

Similarity = cosine of sentence embeddings (BAAI/bge-base-en-v1.5) of one English version per work,
computed here once (GPU if there is one) and shipped as static files; the site does no AI work.

  .venv-tts/Scripts/python.exe scripts/xref/build.py        (after `npm run pack`; ~10 min on a GPU)
  .venv-tts/Scripts/python.exe scripts/xref/build.py --literature-only   (books only; scripture files kept; less memory)
      → .cache-xref/<work>/<book>.json   {"<chapter>:<verse>": [["work/book/chapter:verse", score], ...]}
  npx tsx scripts/xref/upload.ts   → R2 (xref/…), served by /api/xref (too big to keep in git)

Literature ("lit-*" works, see literature() below) is matched one way: novel → scripture only.

Rules: the verse's own chapter is skipped; so is the "same" verse in a parallel text (Bible OT ↔
Tanakh, same book and chapter), which would otherwise top every list. Scores are 0–100.
"""
import json
import os
import sys
from collections import defaultdict

import torch
from sentence_transformers import SentenceTransformer

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
TEXTS = os.path.join(ROOT, "public", "texts")
OUT = os.path.join(ROOT, ".cache-xref")
CACHE = os.path.join(ROOT, "data", "raw", "xref-embeddings.pt")
MODEL = "BAAI/bge-base-en-v1.5"

# The English version embedded for each work (modern English where there is one: matches better).
EMBED = {
    "bible": "web", "tanakh": "jps1917", "enoch": "charles", "thomas": "mattison",
    "mishnah": "kulp", "talmud": "davidson", "quran": "pickthall",
    "dhammapada": "sujato", "tipitaka": "sc-en", "gita": "besant", "upanishads": "muller",
    "ramayana": "griffith-ry", "vedas": "griffith", "mahabharata": "ganguli",
    "hyp": "sinh", "yoga-sutras": "johnston",
    "tao-te-ching": "legge-ttc", "analects": "legge-an", "australian": "parker",
    "hidden-words": "bahai-hw", "aqdas": "bahai-aqdas",
    "ggs": "khalsa", "lucretius": "leonard", "meditations": "long", "enchiridion": "higginson",
    "hume-dialogues": "hume", "age-of-reason": "paine",
    "kojiki": "chamberlain", "jaina": "jacobi", "chinese-myths": "werner", "yoruba": "ogumefu",
    "zhuangzi": "giles", "navaho": "matthews", "sioux": "mclaughlin",
    "gathas": "mills", "popol-vuh": "spence", "popol-vuh-full": "ai-popol",
    "iliad": "butler-il", "odyssey": "butler-od", "hesiod": "evelyn-white", "aeneid": "dryden", "metamorphoses": "riley", "republic": "jowett-rep", "nicomachean": "chase", "seneca-morals": "lestrange", "montaigne": "cotton", "pensees": "trotter", "discourse-method": "veitch", "spinoza-ethics": "elwes", "emerson-essays": "emerson", "on-liberty": "mill", "wisdom-of-life": "saunders", "zarathustra": "common", "beyond-good-evil": "zimmern", "russell-problems": "russell", "varieties": "james", "freud-intro": "hall", "jung-unconscious": "hinkle", "the-crowd": "le-bon",
    "mencius": "ai-men", "great-learning": "legge-gl", "i-ching": "legge-ic", "mean": "legge-mean", "vendidad": "darmesteter", "nihongi": "aston", "kant-groundwork": "abbott-gw", "kant-practical": "abbott-cpr", "kant-pure": "meiklejohn", "perpetual-peace": "campbell-smith", "yashts": "darmesteter-yt", "yasna": "mills-yasna",
    "plato-dialogues": "jowett-dial", "confessions": "pusey", "imitation": "benham", "leviathan": "hobbes", "second-treatise": "locke", "social-contract": "cole",
}
SAME_K = 6  # results kept from the verse's own religion
OTHER_K = 3  # … and from each other religion
MIN_SCORE = 0.55
PARALLEL = {"bible", "tanakh"}


def religions():
    cat = json.load(open(os.path.join(ROOT, "data", "catalog.json"), encoding="utf8"))
    out = {}
    for r in cat["religions"]:
        for col in r["collections"]:
            for it in col["items"]:
                if "work" in it:  # "coming soon" items have no text yet
                    out.setdefault(it["work"], r["id"])
    return out


def load():
    rel = religions()
    refs, texts, rels = [], [], []
    for work, ver in EMBED.items():
        if work not in rel:
            continue
        d = os.path.join(TEXTS, work, ver)
        if not os.path.isdir(d):
            print("missing", d, file=sys.stderr)
            continue
        for f in sorted(os.listdir(d)):
            book = json.load(open(os.path.join(d, f), encoding="utf8"))
            bid = f[:-5]
            for ch, c in book["chapters"].items():
                for x in c["verses"]:
                    t = (x.get("t") or "").strip()
                    if not t or x.get("cont"):
                        continue
                    refs.append((work, bid, int(ch), x["v"]))
                    texts.append(t[:1200])
                    rels.append(rel[work])
    return refs, texts, rels


def main():
    refs, texts, rels = load()
    print(f"{len(refs)} verses")
    dev = "cuda" if torch.cuda.is_available() else "cpu"
    if os.path.exists(CACHE) and torch.load(CACHE)["n"] == len(refs):
        emb = torch.load(CACHE)["emb"].to(dev)
    else:
        model = SentenceTransformer(MODEL, device=dev)
        if dev == "cuda":
            model.half()
        model.max_seq_length = 256
        # Embed shortest-first (less padding per batch), then put back in order.
        order = sorted(range(len(texts)), key=lambda i: len(texts[i]))
        e = model.encode([texts[i] for i in order], batch_size=256, normalize_embeddings=True, convert_to_tensor=True, show_progress_bar=True)
        emb = torch.empty_like(e)
        emb[torch.tensor(order, device=e.device)] = e
        torch.save({"n": len(refs), "emb": emb.float().cpu()}, CACHE)
        emb = emb.to(dev)
    emb = emb.half() if dev == "cuda" else emb.float()

    # --literature-only: scripture's own files in .cache-xref are left as they are (much less memory).
    if "--literature-only" in sys.argv:
        literature(emb, refs, dev)
        return

    groups = defaultdict(list)
    for i, r in enumerate(rels):
        groups[r].append(i)
    gidx = {r: torch.tensor(ix, device=dev) for r, ix in groups.items()}

    result = [[] for _ in refs]
    chunk = 2048
    for r, ix in gidx.items():
        target = emb[ix]
        for s in range(0, len(refs), chunk):
            q = emb[s : s + chunk]
            sims = q @ target.T
            k = min(SAME_K + 40, target.shape[0])
            val, pos = sims.topk(k, dim=1)
            val, pos = val.float().cpu().tolist(), ix[pos].cpu().tolist()
            for row in range(len(val)):
                i = s + row
                w, b, c, _ = refs[i]
                want = SAME_K if rels[i] == r else OTHER_K
                got = 0
                for sc, j in zip(val[row], pos[row]):
                    if sc < MIN_SCORE or got >= want:
                        break
                    w2, b2, c2, _ = refs[j]
                    if b2 == b and c2 == c and (w2 == w or (w in PARALLEL and w2 in PARALLEL)):
                        continue  # same chapter, or its parallel in the Bible / Tanakh
                    result[i].append((j, round(sc * 100)))
                    got += 1
        print("done", r)

    files = defaultdict(dict)
    for i, lst in enumerate(result):
        if not lst:
            continue
        w, b, c, v = refs[i]
        lst.sort(key=lambda x: -x[1])
        files[(w, b)][f"{c}:{v}"] = [[f"{refs[j][0]}/{refs[j][1]}/{refs[j][2]}:{refs[j][3]}", sc] for j, sc in lst]
    import shutil

    shutil.rmtree(OUT, ignore_errors=True)
    total = 0
    for (w, b), data in files.items():
        os.makedirs(os.path.join(OUT, w), exist_ok=True)
        p = os.path.join(OUT, w, f"{b}.json")
        with open(p, "w", encoding="utf8") as fh:
            json.dump(data, fh, separators=(",", ":"), ensure_ascii=False)
        total += os.path.getsize(p)
    print(f"{len(files)} files, {total / 1e6:.1f} MB")
    literature(emb, refs, dev)


# Books (works "lit-*": the Library's Literature, and Freethought's books): a paragraph shows the scripture
# passages closest to it, and (since the Scriptures | Library split, Nov 9) the closest paragraphs in other books;
# a scripture verse shows the closest book paragraphs too. The reader shows its own side first and the other side
# when asked ("Include the Library / the Scriptures"). Short paragraphs (dialogue lines) are skipped.
LIT_K = 8
LIT_MIN_LEN = 200
LIT_MIN_SCORE = 0.58
LITLIT_K = 6  # a paragraph's closest paragraphs in other books
LITLIT_MIN_SCORE = 0.62
SCRIP_LIT_K = 4  # a verse's closest book paragraphs
SCRIP_LIT_MIN_SCORE = 0.58
LIT_CACHE = os.path.join(ROOT, "data", "raw", "xref-lit-embeddings.pt")


def literature(emb, refs, dev):
    lit = json.load(open(os.path.join(ROOT, "data", "literature-catalog.json"), encoding="utf8"))
    main_version = {}
    for work, _book, _title, _chapters, editions in lit["books"]:
        en = [e for e in editions if e[1] == "en"]
        if en:
            main_version[work] = f"pg{en[0][0]}"
    # Works shelved here by reference (Paine's Age of Reason on the Freethought shelf): matched one way too,
    # like the books (they are no longer on a scripture shelf, so the scripture pass skips them).
    for it in lit.get("refs", {}).values():
        if it["work"] in EMBED:
            main_version.setdefault(it["work"], EMBED[it["work"]])
    lrefs, ltexts = [], []
    for work, ver in sorted(main_version.items()):
        d = os.path.join(TEXTS, work, ver)
        if not os.path.isdir(d):
            continue
        for f in sorted(os.listdir(d)):
            book = json.load(open(os.path.join(d, f), encoding="utf8"))
            for ch, c in book["chapters"].items():
                for x in c["verses"]:
                    t = (x.get("t") or "").strip()
                    if len(t) >= LIT_MIN_LEN:
                        lrefs.append((work, f[:-5], int(ch), x["v"]))
                        ltexts.append(t[:1200])
    print(f"literature: {len(lrefs)} paragraphs")
    if not lrefs:
        return
    import hashlib

    sig = hashlib.sha1("|".join(f"{w}/{b}/{c}:{v}:{len(t)}" for (w, b, c, v), t in zip(lrefs, ltexts)).encode()).hexdigest()
    if os.path.exists(LIT_CACHE):
        cached = torch.load(LIT_CACHE)
        if cached.get("sig") == sig:
            print("literature: embeddings from cache")
            lemb = cached["emb"]
            del cached
            return literature_match(emb, refs, dev, lrefs, lemb)
        del cached
    model = SentenceTransformer(MODEL, device=dev)
    if dev == "cuda":
        model.half()
    model.max_seq_length = 256
    order = sorted(range(len(ltexts)), key=lambda i: len(ltexts[i]))
    e = model.encode([ltexts[i] for i in order], batch_size=256, normalize_embeddings=True, convert_to_tensor=True, show_progress_bar=True).cpu()
    del model
    lemb = torch.empty_like(e)
    lemb[torch.tensor(order)] = e  # back in reading order (on the CPU: the GPU has 8 GB)
    del e
    torch.save({"sig": sig, "emb": lemb.half()}, LIT_CACHE)
    return literature_match(emb, refs, dev, lrefs, lemb)


def literature_match(emb, refs, dev, lrefs, lemb):
    if dev == "cuda":
        torch.cuda.empty_cache()
    lemb = lemb.half().to(dev) if dev == "cuda" else lemb.float()
    lname = lambda j: f"{lrefs[j][0]}/{lrefs[j][1]}/{lrefs[j][2]}:{lrefs[j][3]}"
    lwork = [r[0] for r in lrefs]
    book_works = set(lwork)
    files = defaultdict(dict)
    chunk = 1024
    for s in range(0, len(lrefs), chunk):
        sims = lemb[s : s + chunk] @ emb.T
        val, pos = sims.topk(LIT_K, dim=1)
        val, pos = val.float().cpu().tolist(), pos.cpu().tolist()
        for row in range(len(val)):
            hits = [[f"{refs[j][0]}/{refs[j][1]}/{refs[j][2]}:{refs[j][3]}", round(sc * 100)] for sc, j in zip(val[row], pos[row]) if sc >= LIT_MIN_SCORE]
            if hits:
                w, b, c, v = lrefs[s + row]
                files[(w, b)][f"{c}:{v}"] = hits
    # book → book: the closest paragraphs in other books (not the same work)
    n_ll = 0
    for s in range(0, len(lrefs), chunk):
        sims = lemb[s : s + chunk] @ lemb.T
        val, pos = sims.topk(LITLIT_K + 40, dim=1)
        val, pos = val.float().cpu().tolist(), pos.cpu().tolist()
        for row in range(len(val)):
            i = s + row
            got = []
            for sc, j in zip(val[row], pos[row]):
                if sc < LITLIT_MIN_SCORE or len(got) >= LITLIT_K:
                    break
                if lwork[j] == lwork[i]:
                    continue
                got.append([lname(j), round(sc * 100)])
            if got:
                w, b, c, v = lrefs[i]
                files[(w, b)].setdefault(f"{c}:{v}", []).extend(got)
                n_ll += len(got)
        if (s // chunk) % 100 == 0:
            print(f"  book→book {s}/{len(lrefs)}", flush=True)
    print(f"literature: {n_ll} book→book matches")
    # scripture → book: each verse's closest book paragraphs, added to the scripture files
    scrip = defaultdict(dict)
    n_sl = 0
    for s in range(0, len(refs), chunk):
        sims = emb[s : s + chunk] @ lemb.T
        val, pos = sims.topk(SCRIP_LIT_K, dim=1)
        val, pos = val.float().cpu().tolist(), pos.cpu().tolist()
        for row in range(len(val)):
            got = [[lname(j), round(sc * 100)] for sc, j in zip(val[row], pos[row]) if sc >= SCRIP_LIT_MIN_SCORE]
            if got:
                w, b, c, v = refs[s + row]
                scrip[(w, b)][f"{c}:{v}"] = got
                n_sl += len(got)
    for (w, b), add in scrip.items():
        p = os.path.join(OUT, w, f"{b}.json")
        data = json.load(open(p, encoding="utf8")) if os.path.exists(p) else {}
        for k, lst in add.items():
            old = [x for x in data.get(k, []) if x[0].split("/")[0] not in book_works]  # (a re-run replaces, not doubles)
            data[k] = old + lst
        os.makedirs(os.path.join(OUT, w), exist_ok=True)
        with open(p, "w", encoding="utf8") as fh:
            json.dump(data, fh, separators=(",", ":"), ensure_ascii=False)
    print(f"literature: {n_sl} scripture→book matches in {len(scrip)} scripture files")
    total = 0
    for (w, b), data in files.items():
        os.makedirs(os.path.join(OUT, w), exist_ok=True)
        p = os.path.join(OUT, w, f"{b}.json")
        with open(p, "w", encoding="utf8") as fh:
            json.dump(data, fh, separators=(",", ":"), ensure_ascii=False)
        total += os.path.getsize(p)
    print(f"literature: {len(files)} files, {total / 1e6:.1f} MB")


if __name__ == "__main__":
    main()
