"""
Themes (TH): ~60 themes (data/themes.json: forgiveness, the flood, exile…) traced across every tradition and the
Library's books, from the same sentence embeddings as the cross references (scripts/xref/build.py). No AI writes
any passage: each theme's one-line description is embedded as a search query and every verse / book paragraph is
scored against it; the closest ones are kept.

  .venv-tts/Scripts/python.exe scripts/themes/build.py   (needs the two xref embedding caches in data/raw/)
      → public/themes/index.json          [{id, name, group, text, traditions, books}]
        public/themes/<id>.json           {id, name, group, text, traditions: [{id, name, passages}], books: [...]}
        public/themes/refs.json           {"<work>/<book>/<chapter>:<verse>": [theme ids]}  (chips in Cross references)

Per tradition the best PER_TRADITION passages (at most 2 from one chapter); for the Library the BOOKS books whose
best paragraphs score highest (2 paragraphs each). The theme descriptions were written with AI (Claude) and are
labelled so on the page; the passages are the texts' own words.
"""
import hashlib
import json
import os
import shutil
import sys
from collections import defaultdict

import torch
from sentence_transformers import SentenceTransformer

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "xref"))
import build as xref  # noqa: E402

ROOT = xref.ROOT
OUT = os.path.join(ROOT, "public", "themes")
PER_TRADITION = 8
PER_CHAPTER = 2
MIN_SCORE = 0.56
MIN_CHARS = 40
BOOKS = 8
BOOK_CANDIDATES = 30
BOOK_THEMES = 5  # a book appears in at most this many themes
BOOK_PARAS = 2
EXCERPT = 420
QUERY = "Represent this sentence for searching relevant passages: "


def lit_refs():
    """The Library paragraphs, exactly as scripts/xref/build.py literature() embedded them (same order)."""
    lit = json.load(open(os.path.join(ROOT, "data", "literature-catalog.json"), encoding="utf8"))
    main_version = {}
    for work, _book, _title, _chapters, editions in lit["books"]:
        en = [e for e in editions if e[1] == "en"]
        if en:
            main_version[work] = f"pg{en[0][0]}"
    for it in lit.get("refs", {}).values():
        if it["work"] in xref.EMBED:
            main_version.setdefault(it["work"], xref.EMBED[it["work"]])
    lrefs, ltexts = [], []
    for work, ver in sorted(main_version.items()):
        d = os.path.join(xref.TEXTS, work, ver)
        if not os.path.isdir(d):
            continue
        for f in sorted(os.listdir(d)):
            book = json.load(open(os.path.join(d, f), encoding="utf8"))
            for ch, c in book["chapters"].items():
                for x in c["verses"]:
                    t = (x.get("t") or "").strip()
                    if len(t) >= xref.LIT_MIN_LEN:
                        lrefs.append((work, f[:-5], int(ch), x["v"]))
                        ltexts.append(t[:1200])
    return lit, lrefs, ltexts


def excerpt(t):
    t = " ".join(t.split())
    if len(t) <= EXCERPT:
        return t
    cut = t[:EXCERPT].rsplit(" ", 1)[0]
    return cut + "…"


def main():
    themes = json.load(open(os.path.join(ROOT, "data", "themes.json"), encoding="utf8"))
    cat = json.load(open(os.path.join(ROOT, "data", "catalog.json"), encoding="utf8"))
    rel_name = {r["id"]: r["name"] for r in cat["religions"]}
    dev = "cuda" if torch.cuda.is_available() else "cpu"

    refs, texts, rels = xref.load()
    cached = torch.load(xref.CACHE)
    if cached["n"] != len(refs):
        sys.exit("scripture embeddings are out of date: run scripts/xref/build.py first")
    emb = cached["emb"].half().to(dev)
    del cached
    lit, lrefs, ltexts = lit_refs()
    sig = hashlib.sha1("|".join(f"{w}/{b}/{c}:{v}:{len(t)}" for (w, b, c, v), t in zip(lrefs, ltexts)).encode()).hexdigest()
    lc = torch.load(xref.LIT_CACHE)
    if lc["emb"].shape[0] == len(lrefs):
        if lc.get("sig") != sig:
            print("note: some Library paragraphs changed slightly since they were embedded (same paragraphs, same order)")
        lemb = lc["emb"]
    else:
        # The books changed (paragraphs added or dropped): embed them again, and refresh the cache the cross
        # references use too (same format as scripts/xref/build.py literature()).
        print(f"Library: {lc['emb'].shape[0]} cached, {len(lrefs)} now: embedding again", flush=True)
        model = SentenceTransformer(xref.MODEL, device=dev)
        if dev == "cuda":
            model.half()
        model.max_seq_length = 256
        order = sorted(range(len(ltexts)), key=lambda i: len(ltexts[i]))
        e = model.encode([ltexts[i] for i in order], batch_size=256, normalize_embeddings=True, convert_to_tensor=True, show_progress_bar=True).cpu()
        del model
        lemb = torch.empty_like(e)
        lemb[torch.tensor(order)] = e
        del e
        lemb = lemb.half()
        torch.save({"sig": sig, "emb": lemb}, xref.LIT_CACHE)
        if dev == "cuda":
            torch.cuda.empty_cache()
    del lc
    lemb = lemb.half().to(dev)
    print(f"{len(refs)} verses, {len(lrefs)} book paragraphs")

    model = SentenceTransformer(xref.MODEL, device=dev)
    q = model.encode([QUERY + t["name"] + ": " + t["text"] for t in themes], normalize_embeddings=True, convert_to_tensor=True).half().to(dev)
    del model

    title = {b[0]: b[2] for b in lit["books"]}
    shelf_of = {}
    for s in lit["shelves"]:
        for c in s["collections"]:
            for w in c["books"]:
                shelf_of.setdefault(w, s["id"])
    library = {w for w, s in shelf_of.items() if s in ("literature", "fiction", "freethought")}

    by_rel = defaultdict(list)
    for i, r in enumerate(rels):
        by_rel[r].append(i)
    rel_idx = {r: torch.tensor(ix, device=dev) for r, ix in by_rel.items()}
    lwork = [r[0] for r in lrefs]
    lib_mask = torch.tensor([w in library for w in lwork], device=dev)

    if os.path.isdir(OUT):
        shutil.rmtree(OUT)
    os.makedirs(OUT)
    chips = defaultdict(list)  # "work/book/ch:v" → [theme ids]
    index = []
    cands, docs = [], []
    for ti, th in enumerate(themes):
        sims = (emb @ q[ti]).float()
        traditions = []
        for r, ix in rel_idx.items():
            s = sims[ix]
            val, pos = s.topk(min(200, len(ix)))
            got, per_ch = [], defaultdict(int)
            for sc, p in zip(val.tolist(), pos.tolist()):
                if sc < MIN_SCORE or len(got) >= PER_TRADITION:
                    break
                j = ix[p].item()
                w, b, c, v = refs[j]
                if per_ch[(w, b, c)] >= PER_CHAPTER or len(texts[j]) < MIN_CHARS:
                    continue  # (a one-word verse or a heading says little on its own)
                per_ch[(w, b, c)] += 1
                got.append({"ref": f"{w}/{b}/{c}:{v}", "text": excerpt(texts[j]), "score": round(sc * 100)})
                chips[f"{w}/{b}/{c}:{v}"].append(th["id"])
            if got:
                traditions.append({"id": r, "name": rel_name.get(r, r), "passages": got, "best": got[0]["score"]})
        traditions.sort(key=lambda x: -sum(p["score"] for p in x["passages"][:3]) / min(3, len(x["passages"])))
        for t in traditions:
            del t["best"]
        # Library: books ranked by the mean of their 3 best paragraphs
        ls = (lemb @ q[ti]).float()
        ls = torch.where(lib_mask, ls, torch.full_like(ls, -1))
        val, pos = ls.topk(4000)
        per_book = defaultdict(list)
        for sc, j in zip(val.tolist(), pos.tolist()):
            if sc < MIN_SCORE:
                break
            per_book[lwork[j]].append((sc, j))
        ranked = sorted(per_book.items(), key=lambda kv: -sum(s for s, _ in kv[1][:3]) / 3)[:BOOK_CANDIDATES]
        cands.append([(w, sum(s for s, _ in hits[:3]) / 3, hits) for w, hits in ranked])
        docs.append({**th, "traditions": traditions})
    # A book that echoes many themes (a broad essay on religion) is kept only for the BOOK_THEMES it fits best,
    # so each theme's books are its own, not the same few everywhere.
    best_for = defaultdict(list)
    for ti, lst in enumerate(cands):
        for w, sc, _ in lst:
            best_for[w].append((sc, ti))
    allowed = {w: {ti for _, ti in sorted(v, reverse=True)[:BOOK_THEMES]} for w, v in best_for.items()}
    for ti, doc in enumerate(docs):
        books = []
        for w, _, hits in cands[ti]:
            if ti not in allowed[w] or len(books) >= BOOKS:
                continue
            ps = []
            for sc, j in hits[:BOOK_PARAS]:
                _, b, c, v = lrefs[j]
                ps.append({"ref": f"{w}/{b}/{c}:{v}", "text": excerpt(ltexts[j]), "score": round(sc * 100)})
                chips[f"{w}/{b}/{c}:{v}"].append(doc["id"])
            books.append({"work": w, "title": title.get(w, w), "shelf": shelf_of.get(w, ""), "passages": ps})
        doc["books"] = books
        with open(os.path.join(OUT, f"{doc['id']}.json"), "w", encoding="utf8") as fh:
            json.dump(doc, fh, ensure_ascii=False, separators=(",", ":"))
        traditions = doc["traditions"]
        index.append({**{k: doc[k] for k in ("id", "name", "group", "text")}, "traditions": len(traditions), "books": len(books), "passages": sum(len(t["passages"]) for t in traditions) + sum(len(b["passages"]) for b in books)})
        print(f"  {doc['name']}: {len(traditions)} traditions, {len(books)} books · " + ", ".join(t["name"] for t in traditions[:4]) + " · " + ", ".join(b["title"] for b in books[:4]), flush=True)
    with open(os.path.join(OUT, "index.json"), "w", encoding="utf8") as fh:
        json.dump(index, fh, ensure_ascii=False, separators=(",", ":"))
    with open(os.path.join(OUT, "refs.json"), "w", encoding="utf8") as fh:
        json.dump(chips, fh, ensure_ascii=False, separators=(",", ":"))
    print(f"themes: {len(index)} themes, {len(chips)} passages with theme chips")


if __name__ == "__main__":
    main()
