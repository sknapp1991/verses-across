"""
Re-cut single human-voice chapters that came out wrong (a few seconds long, or with every verse at 0 s): match only
that chapter's text against a reading's transcript, keep the words around it, and cut it again with verse timings.
Tries every given source file and keeps the one where the chapter's words match best.

  .venv-tts/Scripts/python -I scripts/tts/recut-chapter.py <version> <voice> <book> <chapter> <lang> <mp3> [<mp3> …]
  e.g. rvr1909 librivox gen 5 es .cache-audio/librivox-rvr1909/<ia>/genesis_01_rv1909_64kb.mp3

Transcripts must exist already (…/transcripts/<stem>.json next to the mp3's folder, as the import scripts leave them).
"""
import difflib
import importlib.util
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location("lvs", ROOT / "scripts" / "tts" / "librivox-sets.py")
lvs = importlib.util.module_from_spec(spec)
spec.loader.exec_module(lvs)


def transcript(mp3: Path):
    for p in (mp3.parent / "transcripts" / (mp3.stem + ".json"), mp3.parent.parent / "transcripts" / (mp3.stem + ".json")):
        if p.exists():
            return json.loads(p.read_text(encoding="utf-8"))
    raise SystemExit(f"no transcript for {mp3}")


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    version, voice, book, ch, lang, *mp3s = sys.argv[1:]
    ch = int(ch)
    lvs.LANG = lang
    lvs.WORK = "bible" if (ROOT / "data" / "texts" / "bible" / version).exists() else next(p.parent.name for p in (ROOT / "data" / "texts").glob(f"*/{version}"))
    ref = [r[0] for r in lvs.ref_words(version, [(book, ch)])]
    best = None
    for m in map(Path, mp3s):
        words = transcript(m)
        hyp = [lvs.norm(w) for w, _, _ in words]
        blocks = [b for b in difflib.SequenceMatcher(a=ref, b=hyp, autojunk=False).get_matching_blocks() if b.size >= 3]
        got = sum(b.size for b in blocks)
        if blocks and (best is None or got > best[0]):
            best = (got, m, words, blocks)
    if not best:
        raise SystemExit("the chapter's words weren't found in any of these files")
    got, mp3, words, blocks = best
    a = words[blocks[0].b][1] - 8.0  # room for "Chapter N" before verse 1
    z = words[blocks[-1].b + blocks[-1].size - 1][2] + 0.5
    win = [w for w in words if a <= w[1] and w[2] <= z]
    out = lvs.CACHE / version / voice
    line = lvs.cut(f"{version}-recut", version, out, mp3, [(book, ch)], win, mp3.name)
    js = out / book / f"{ch}.json"
    d = json.loads(js.read_text(encoding="utf-8"))
    d["voice"] = voice
    js.write_text(json.dumps(d), encoding="utf-8")
    print(f"{line} ({got}/{len(ref)} words in long runs) -> {d['duration']:.0f} s, verse 1 at {d['verses'][0]['s']:.1f} s, last at {d['verses'][-1]['s']:.1f} s")


if __name__ == "__main__":
    main()
