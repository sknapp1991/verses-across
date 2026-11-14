"""
Cut LibriVox's spoken preamble ("This is a LibriVox recording… please visit librivox.org", "Todas las grabaciones de
LibriVox…", and the reader's credit after it) from the start of every human-voice chapter (Skylar, Nov 14: the site
says it in text instead, on the About page). The ends were already cut at the last word of the text.

Listens to the first 40 s of each chapter (Whisper "base" on the CPU, the GPU stays free), finds the last sentence
naming LibriVox, cuts after it (and after a "Read by …" that follows), and shifts the verse timings to match.
Remembers what it checked (.cache-audio/.trimmed.json), so re-running only looks at new chapters.

  .venv-tts/Scripts/python -I scripts/tts/trim-intros.py            # every human voice
  .venv-tts/Scripts/python -I scripts/tts/trim-intros.py --dry-run  # only say what it would cut
"""
import json
import os
import re
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CACHE = ROOT / ".cache-audio"
DONE = CACHE / ".trimmed.json"
HUMAN = ("armenta", "librivox")
# "LibriVox" as Whisper writes it in the readers' languages (Latin, Hebrew, Greek letters)
MARK = re.compile(r"libri|libr[ie]\s*vox|librivox|ליבר|λιμπρ|λιβρ|λίμπρ|λίβρ", re.I)
LANGS = {"kjv": "en", "rvr1909": "es", "lsg1910": "fr", "luther1912": "de", "hebrew": "he", "greek": "el"}
# What follows "visit LibriVox": ".org" (often spelled out: "l-i-b-r-i-v-o-x punto org"), the reader's credit
AFTER = re.compile(r"\borg\b|o\s*rg|punto|point|punkt|τελεία|נקודה|\b\w-\w-\w", re.I)
CREDIT = re.compile(r"\b(read|recorded|recording|reading|grabad|leíd|leid|lu |lue |enregistr|gelesen|vorgelesen|aufgenommen|gravad)", re.I)


def norm(w: str) -> str:
    import unicodedata

    w = unicodedata.normalize("NFD", w.lower())
    return re.sub(r"[^\w]", "", "".join(c for c in w if unicodedata.category(c) != "Mn")).replace("_", "")


def first_words(version: str, book: str, ch: str) -> list[str]:
    """The first words of the chapter's text (to find where it begins in the transcript)."""
    for p in (ROOT / "data" / "texts").glob(f"*/{version}/{book}/{ch}.json"):
        vs = json.loads(p.read_text(encoding="utf-8"))["verses"]
        words = [norm(w) for w in re.split(r"[\s־]+", vs[0].get("t") or "") if norm(w) and not norm(w).isdigit()]
        return words[:4]
    return []


def duration(p: Path) -> float:
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(p)], capture_output=True, text=True)
    return float(out.stdout.strip())


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    dry = "--dry-run" in sys.argv
    only = [a for a in sys.argv[1:] if not a.startswith("--")]  # e.g. kjv/armenta/mat
    if os.name == "nt":  # below-normal priority: the paper-trading bots share this PC
        import ctypes

        ctypes.windll.kernel32.SetPriorityClass(ctypes.windll.kernel32.GetCurrentProcess(), 0x4000)
    import torch
    import whisper

    torch.set_num_threads(4)
    model = whisper.load_model("base", device="cpu")
    done = json.loads(DONE.read_text(encoding="utf-8")) if DONE.exists() else {}
    files = sorted(p for p in CACHE.glob("*/*/*/*.mp3") if p.parts[-3] in HUMAN and not p.parts[-4].startswith("librivox"))
    tmp = Path(tempfile.mkdtemp())
    cut_n = 0
    for n, mp3 in enumerate(files):
        key = mp3.relative_to(CACHE).as_posix()
        if only and not any(key.startswith(o) for o in only):
            continue
        if done.get(key) == mp3.stat().st_mtime:
            continue
        js = mp3.with_suffix(".json")
        timing = json.loads(js.read_text(encoding="utf-8"))
        clip = tmp / "head.wav"
        if subprocess.run(["ffmpeg", "-loglevel", "quiet", "-y", "-t", "40", "-i", str(mp3), "-ac", "1", "-ar", "16000", str(clip)]).returncode:
            print(f"{key}: can't be read (broken file?), skipped", flush=True)
            continue
        version, voice, book, ch = mp3.relative_to(CACHE).with_suffix("").parts
        r = model.transcribe(str(clip), fp16=False, condition_on_previous_text=False, language=LANGS.get(version, "en"))
        segs = r["segments"]
        last = max((i for i, s in enumerate(segs) if MARK.search(s["text"])), default=None)
        cut = 0.0
        found = False
        if last is not None:
            # Best: where the text itself begins (its first words), keeping a short "Génesis 1." just before it.
            fw = first_words(version, book, ch)
            start = None
            for i in range(last + 1, len(segs)):
                hw = [norm(w) for w in segs[i]["text"].split()][:8]
                if fw and sum(1 for w in fw[:3] if w in hw) >= 2:
                    start = i
                    break
            if start is not None:
                found = True
                prev = segs[start - 1] if start - 1 > last else None
                announce = prev and len(prev["text"].split()) <= 5 and segs[start]["start"] - prev["end"] < 2.5
                cut = max(0.0, (prev["start"] if announce else segs[start]["start"]) - 0.2)
            else:
                # Else: just past the LibriVox sentence, its spelled-out address and the reader's credit.
                end = segs[last]["end"]
                j = last + 1
                while j < len(segs) and segs[j]["start"] - end < 2.5 and (AFTER.search(segs[j]["text"]) or (CREDIT.search(segs[j]["text"]) and len(segs[j]["text"].split()) <= 8)):
                    end = segs[j]["end"]
                    j += 1
                cut = max(0.0, end + 0.15)
        # Never more than 35 s, and (unless the text's own first words were found right after) never past verse 2's
        # timing: a wrong hit must not eat the text. (Verse timings before the cut become 0: the chapter's start.)
        vs = timing["verses"]
        limit = 35.0 if found else min(35.0, vs[1]["s"] - 0.5 if len(vs) > 1 else 35.0)
        if cut > limit:
            print(f"{key}: LibriVox heard up to {cut:.1f} s, past verse 2 ({limit:.1f} s): left as is", flush=True)
            cut = 0.0
        if cut >= 1.0:
            cut_n += 1
            print(f"{key}: cut {cut:.1f} s  [{' '.join(s['text'].strip() for s in segs if s['end'] <= cut + 0.3)[-200:]}]  then: {next((s['text'].strip() for s in segs if s['start'] >= cut - 0.3), '')[:60]}", flush=True)
            if not dry:
                out = tmp / "out.mp3"
                subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-ss", f"{cut:.3f}", "-i", str(mp3), "-c:a", "libmp3lame", "-b:a", "64k", "-ac", "1", str(out)], check=True)
                for v in vs:
                    v["s"] = round(max(0.0, v["s"] - cut), 3)
                    v["e"] = round(max(v["s"], v["e"] - cut), 3)
                timing["duration"] = round(duration(out), 3)
                mp3.write_bytes(out.read_bytes())
                js.write_text(json.dumps(timing), encoding="utf-8")
        if not dry:
            done[key] = mp3.stat().st_mtime
            if n % 50 == 0:
                DONE.write_text(json.dumps(done), encoding="utf-8")
    if not dry:
        DONE.write_text(json.dumps(done), encoding="utf-8")
    print(f"done: {cut_n} chapters had a LibriVox preamble", flush=True)


if __name__ == "__main__":
    main()
