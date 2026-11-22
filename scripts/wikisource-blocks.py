"""
Wikisource page HTML (the parse API's rendered text, saved as data/raw/<dir>/<page>.json) → a list of blocks:
  {"kind": "heading" | "note" | "poem" | "prose", "text": "…"}   (poem lines kept, joined with "\n")
Left out: the header box, page numbers, footnote marks and the footnote list, rules and spacers.
Inline markup is dropped but its text kept (Legge's italic K in "Kung-nî", tooltips, links).

  python scripts/wikisource-blocks.py data/raw/sbe3html data/raw/sbe3blocks
"""
import html, json, os, re, sys
from html.parser import HTMLParser

SKIP_CLASSES = ("ws-header", "wst-header", "pagenum", "reference", "references", "reflist", "mw-cite-backlink",
                "ws-noexport", "noprint", "wst-rule", "wst-dhr", "mw-editsection",
                "__ditto_hidden", "wst-auxtoc", "wst-gap")  # hidden alignment text, section menus, spacers


class Blocks(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.stack = []  # (tag, classes, skip)
        self.blocks = []
        self.cur = None  # [kind, parts]
        self.skip_depth = 0

    def _ctx(self):
        cls = " ".join(c for _, c, _ in self.stack)
        if "wst-smaller" in cls or "wst-size-block" in cls:
            return "note"
        if "wst-block-center" in cls or "poem" in cls:
            return "poem"
        if "wst-center" in cls:
            return "heading"
        return "prose"

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        cls = a.get("class", "") or ""
        skip = any(k in cls for k in SKIP_CLASSES) or tag in ("style", "script", "sup", "link")
        void = tag in ("br", "hr", "img", "link", "meta", "input", "wbr")
        if tag == "br" and self.cur is not None and not self.skip_depth:
            self.cur[1].append(" ")  # a real line break
        if void:
            return
        self.stack.append((tag, cls, skip))
        if skip:
            self.skip_depth += 1
            return
        if tag in ("p", "h1", "h2", "h3", "h4", "h5", "li", "dd") and not self.skip_depth:
            self.flush()
            self.cur = [("heading" if tag.startswith("h") else self._ctx()), []]
        elif tag == "div" and not self.skip_depth:
            self.flush()  # a loose paragraph (text straight inside a div) ends where the next block begins

    def handle_endtag(self, tag):
        # pop to the matching tag
        for i in range(len(self.stack) - 1, -1, -1):
            if self.stack[i][0] == tag:
                for t, c, s in self.stack[i:]:
                    if s:
                        self.skip_depth -= 1
                del self.stack[i:]
                break
        if tag in ("p", "h1", "h2", "h3", "h4", "h5", "li", "dd", "div"):
            self.flush()

    def handle_data(self, data):
        if self.skip_depth:
            return
        if self.cur is None:
            # Wikisource leaves some paragraphs bare inside a div (no <p>): they are text too
            if not data.strip() or not self.stack:
                return
            self.cur = [self._ctx(), []]
        self.cur[1].append(data.replace("\n", " "))  # a newline in the HTML is only a space

    def flush(self):
        if self.cur is None:
            return
        kind, parts = self.cur
        self.cur = None
        raw = "".join(parts).replace("​", "").replace(" ", " ")
        lines = [re.sub(r"[ \t]+", " ", x).strip() for x in raw.split(" ")]
        lines = [x for x in lines if x]
        if not lines:
            return
        # a space left where a note mark was ("blows ;"), never inside ". . ." gaps
        lines = [re.sub(r"(?<=[\w)\]’'”])\s+([,;:!?]|\.(?!\s*\.))", r"\1", x) for x in lines]
        text = "\n".join(lines) if kind == "poem" else " ".join(lines)
        self.blocks.append({"kind": kind, "text": text})


def convert(path):
    t = json.load(open(path, encoding="utf-8"))["parse"]["text"]
    p = Blocks()
    p.feed(t)
    p.flush()
    return p.blocks


if __name__ == "__main__":
    src, dst = sys.argv[1], sys.argv[2]
    os.makedirs(dst, exist_ok=True)
    n = 0
    for f in sorted(os.listdir(src)):
        if not f.endswith(".json"):
            continue
        json.dump(convert(os.path.join(src, f)), open(os.path.join(dst, f), "w", encoding="utf-8"), ensure_ascii=False, indent=0)
        n += 1
    print("pages", n)
