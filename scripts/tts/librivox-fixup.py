"""
After `librivox-sets.py align --set <name>`: re-cut the chapters that may have come out wrong.
- chapters claimed by two files (neighbouring files' ranges overlap: the later file's cut overwrote a good one);
- chapters far too short for their verses (under 1.5 s a verse).
Each is re-cut from the file of the same book where its words match best (scripts/tts/recut-chapter.py). Uses the
cached transcripts only (no GPU).

  .venv-tts/Scripts/python -I scripts/tts/librivox-fixup.py <set> [--dry-run]
"""
import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CACHE = ROOT / ".cache-audio"


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    name = sys.argv[1]
    dry = "--dry-run" in sys.argv
    src = CACHE / f"librivox-{name}"
    out = CACHE / name / "librivox"
    items = json.loads((src / "items.json").read_text(encoding="utf-8"))
    files_of = {}  # book -> [mp3 paths]
    for it in items:
        for f in it["files"]:
            for b in it["books"]:
                files_of.setdefault(b, []).append(src / it["ia"] / f)
    # Which file claimed which chapters (from the .done notes: "<file>: gen 5–gen 17, 62% …")
    claims = {}
    for mark in (out / ".done").glob("*.txt"):
        m = re.match(r"^\S+: (\w+) (\d+)\W+(\w+) (\d+),", mark.read_text(encoding="utf-8"))
        if not m or m.group(1) != m.group(3):
            continue
        for c in range(int(m.group(2)), int(m.group(4)) + 1):
            claims.setdefault((m.group(1), c), []).append(mark.stem)
    todo = {k for k, v in claims.items() if len(v) > 1}
    for js in out.glob("*/*.json"):
        d = json.loads(js.read_text(encoding="utf-8"))
        if d["duration"] < max(15, 1.5 * len(d["verses"])):
            todo.add((js.parent.name, int(js.stem)))
    print(f"{name}: {len(todo)} chapters to re-cut", flush=True)
    for b, c in sorted(todo):
        cands = files_of.get(b, [])
        if not cands:
            print(f"  {b} {c}: no source file", flush=True)
            continue
        if dry:
            print(f"  {b} {c}: from {len(cands)} files", flush=True)
            continue
        r = subprocess.run(
            [sys.executable, "-I", str(ROOT / "scripts" / "tts" / "recut-chapter.py"), name, "librivox", b, str(c), "en", *map(str, cands)],
            capture_output=True, text=True, encoding="utf-8",
        )
        line = (r.stdout.strip().splitlines() or [r.stderr.strip()[-200:]])[-1]
        print(f"  {b} {c}: {line}", flush=True)


if __name__ == "__main__":
    main()
