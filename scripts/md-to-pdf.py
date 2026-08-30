"""Markdown to PDF, via a small HTML converter and headless Chrome.

Chrome is used as the renderer because it does per-glyph font fallback, which is
what makes the Devanagari (त्रिआकार) and the rupee sign render correctly without
hunting for a single font that covers everything.

Usage:  python scripts/md-to-pdf.py INPUT.md OUTPUT.pdf
"""
import html
import re
import subprocess
import sys
import tempfile
from pathlib import Path

CHROME_CANDIDATES = [
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
]

CSS = """
@page { size: A4; margin: 16mm 15mm; }
body {
  font-family: "Nirmala UI", "Segoe UI", "Noto Sans", Arial, sans-serif;
  font-size: 10.5pt; line-height: 1.55; color: #1a1a1a; margin: 0;
}
h1 { font-size: 20pt; margin: 0 0 4pt; color: #C4622A; }
h2 { font-size: 14pt; margin: 18pt 0 6pt; padding-bottom: 3pt;
     border-bottom: 1px solid #e0d8d0; color: #1a1a1a; }
h3 { font-size: 11.5pt; margin: 12pt 0 4pt; color: #C4622A; }
p { margin: 0 0 7pt; }
ul { margin: 0 0 8pt; padding-left: 16pt; }
li { margin-bottom: 3pt; }
strong { font-weight: 600; }
hr { border: 0; border-top: 1px solid #ece6e0; margin: 14pt 0; }
table { border-collapse: collapse; width: 100%; margin: 6pt 0 10pt; font-size: 9.5pt; }
th { background: #faf6f2; text-align: left; font-weight: 600; }
th, td { border: 1px solid #e0d8d0; padding: 5pt 7pt; vertical-align: top; }
code { font-family: Consolas, monospace; font-size: 9.5pt;
       background: #f5f1ed; padding: 1pt 3pt; border-radius: 2px; }
h2, h3 { break-after: avoid; }
table, li { break-inside: avoid; }
"""


def inline(text):
    """Escape, then apply bold and inline code."""
    text = html.escape(text)
    text = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", text)
    text = re.sub(r"`(.+?)`", r"<code>\1</code>", text)
    return text


def is_table_divider(line):
    return bool(re.fullmatch(r"\|[\s:|-]+\|", line.strip()))


def split_row(line):
    return [c.strip() for c in line.strip().strip("|").split("|")]


def convert(md):
    out, lines, i = [], md.split("\n"), 0
    while i < len(lines):
        raw = lines[i]
        line = raw.strip()

        if not line:
            i += 1
            continue

        if line.startswith("---") and set(line) <= {"-"}:
            out.append("<hr>")
            i += 1
            continue

        m = re.match(r"^(#{1,6})\s+(.*)", line)
        if m:
            level = min(len(m.group(1)), 3)
            out.append(f"<h{level}>{inline(m.group(2))}</h{level}>")
            i += 1
            continue

        # Table: a header row followed by a divider row
        if line.startswith("|") and i + 1 < len(lines) and is_table_divider(lines[i + 1]):
            header = split_row(line)
            i += 2
            rows = []
            while i < len(lines) and lines[i].strip().startswith("|"):
                rows.append(split_row(lines[i]))
                i += 1
            cells = "".join(f"<th>{inline(c)}</th>" for c in header)
            body = "".join(
                "<tr>" + "".join(f"<td>{inline(c)}</td>" for c in r) + "</tr>"
                for r in rows
            )
            out.append(f"<table><tr>{cells}</tr>{body}</table>")
            continue

        if re.match(r"^[-*]\s+", line):
            items = []
            while i < len(lines) and re.match(r"^\s*[-*]\s+", lines[i]):
                items.append(re.sub(r"^\s*[-*]\s+", "", lines[i]).strip())
                i += 1
                # fold a wrapped continuation line into the same bullet
                while (i < len(lines) and lines[i].startswith("  ")
                       and lines[i].strip() and not re.match(r"^\s*[-*]\s+", lines[i])):
                    items[-1] += " " + lines[i].strip()
                    i += 1
            out.append("<ul>" + "".join(f"<li>{inline(x)}</li>" for x in items) + "</ul>")
            continue

        # Paragraph: absorb wrapped lines until a blank or a new block starts
        para = [line]
        i += 1
        while i < len(lines):
            nxt = lines[i].strip()
            if not nxt or nxt.startswith(("#", "|", "-", "*")):
                break
            para.append(nxt)
            i += 1
        out.append(f"<p>{inline(' '.join(para))}</p>")

    return "\n".join(out)


def main():
    if len(sys.argv) != 3:
        sys.exit("usage: python scripts/md-to-pdf.py INPUT.md OUTPUT.pdf")

    src, dest = Path(sys.argv[1]).resolve(), Path(sys.argv[2]).resolve()
    chrome = next((c for c in CHROME_CANDIDATES if Path(c).exists()), None)
    if not chrome:
        sys.exit("Chrome not found. Checked:\n  " + "\n  ".join(CHROME_CANDIDATES))

    body = convert(src.read_text(encoding="utf-8"))
    page = (f'<!doctype html><html><head><meta charset="utf-8">'
            f"<title>{html.escape(src.stem)}</title><style>{CSS}</style></head>"
            f"<body>{body}</body></html>")

    with tempfile.TemporaryDirectory() as tmp:
        htm = Path(tmp) / "page.html"
        htm.write_text(page, encoding="utf-8")
        subprocess.run(
            [chrome, "--headless", "--disable-gpu", "--no-sandbox",
             f"--user-data-dir={tmp}/profile", "--no-pdf-header-footer",
             f"--print-to-pdf={dest}", htm.as_uri()],
            check=True, capture_output=True, timeout=120,
        )

    if not dest.exists():
        sys.exit("Chrome ran but produced no PDF.")
    print(f"{dest}  ({dest.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
