#!/usr/bin/env python3
"""
Trích xuất lemma + ví dụ tiếng Đức từ PDF Goethe (A1 Start Deutsch 1, A2, B1).

Phụ thuộc:
  pip install pymupdf pdfplumber

Chạy từ thư mục gốc repo:
  python3 scripts/extract_goethe_pdfs.py

Sinh: backend/src/main/resources/wordlists/goethe_official_wordlist.tsv
"""
from __future__ import annotations

import re
import unicodedata
from collections import defaultdict
from pathlib import Path

import fitz  # PyMuPDF

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "backend/src/main/resources/wordlists/goethe_official_wordlist.tsv"
PDF_DIR = ROOT / "wordsDeutsch"

try:
    import pdfplumber
except ImportError as e:
    pdfplumber = None  # type: ignore


def norm_lemma(s: str) -> str:
    s = unicodedata.normalize("NFKC", s).strip()
    s = re.sub(r"\s+", " ", s)
    return s


def looks_like_new_a1_entry(line: str) -> bool:
    s = line.strip()
    if not s:
        return False
    if "\t" in s:
        return True
    if re.match(r"^(der|die|das|ein|eine)\s+", s):
        return True
    if re.match(r"^[a-zäöüß][a-zäöüß\-, ]{0,45}\s*$", s) and not s.startswith("Ich ") and not s.startswith("Wir "):
        return True
    if re.match(r"^[a-zäöüß][a-zäöüß\-]+,\s*$", s):
        return True
    return False


def parse_a1_pages(doc: fitz.Document, start: int, end: int) -> list[tuple[str, str, str]]:
    lines: list[str] = []
    for p in range(start - 1, end):
        lines.extend(doc[p].get_text().splitlines())

    out: list[tuple[str, str, str]] = []
    i = 0
    skip_headers = re.compile(r"^(Inventare|Alphabetische|Wortliste|Seite\s+\d+|VS_)", re.I)

    while i < len(lines):
        raw = lines[i].rstrip()
        i += 1
        if not raw.strip() or skip_headers.match(raw.strip()):
            continue
        s = raw.strip()
        if s in "ABCDEFGHIJKLMNOPQRSTUVWXYZ" and len(s) == 1:
            continue

        lemma: str | None = None
        ex_parts: list[str] = []

        if "\t" in raw:
            left, right = raw.split("\t", 1)
            lemma = norm_lemma(left)
            if right.strip():
                ex_parts.append(right.strip())
            else:
                while i < len(lines):
                    nxt = lines[i]
                    if looks_like_new_a1_entry(nxt):
                        break
                    if nxt.strip() == "":
                        i += 1
                        continue
                    if nxt.strip() == "\t" or (nxt.startswith("\t") and len(nxt.strip()) < 2):
                        i += 1
                        continue
                    ex_parts.append(nxt.strip())
                    i += 1
        else:
            m = re.match(r"^(\s*)(.+)$", raw)
            if not m:
                continue
            indent, rest = m.group(1), m.group(2).rstrip()
            if indent and len(indent) >= 2:
                continue
            if not rest:
                continue
            if re.match(r"^[a-zäöüß][a-zäöüß\-, ]*$", rest.strip()) and "\t" not in rest:
                lemma = norm_lemma(rest.strip())
                while i < len(lines):
                    if "\t" in lines[i] and lines[i].strip() and not lines[i].strip().startswith("\t"):
                        break
                    nxt = lines[i].strip()
                    if not nxt:
                        i += 1
                        continue
                    ex_parts.append(nxt)
                    i += 1
            else:
                continue

        if not lemma or len(lemma) < 1:
            continue
        ex = re.sub(r"\s+", " ", " ".join(ex_parts)).strip()
        if ex:
            out.append(("A1", lemma, ex))

    return out


# --- A2: cột trái (x0 < LEFT_MAX) + parser dòng ---

LEFT_MAX_A2 = 270

SKIP_LINE = re.compile(
    r"^(ALPHABETISCHER|WORTLISTE|Seite|\d+\s+WORTLISTE|61600|ZERTIFIKAT|GOETHE|ÖSD|Inventare)",
    re.I,
)

ART_ENTRY_RE = re.compile(
    r"^((?:der|die|das|ein|eine)\s+[A-Za-zäöüßÄÖÜ][^,]{0,45}?,\s*[-\w/¨]+)\s+(.+)$"
)
NEW_ENTRY_RE = re.compile(r'^([a-zäöüß][a-zäöüß\-, /]{0,55}?)\s+([A-ZÄÖÜ„"\d\(].*)$')
BAD_LEMMA = frozenset(
    {"ich", "du", "er", "sie", "es", "wir", "ihr", "und", "oder", "mit", "von", "zu", "in", "an", "auf", "mir", "dir"}
)


def extract_left_column_lines(page, left_max: int) -> list[str]:
    words = [
        w
        for w in page.extract_words()
        if w.get("upright", True) and 75 < w["top"] < page.height - 30
    ]
    by_line: dict[int, list] = defaultdict(list)
    for w in words:
        by_line[round(w["top"])].append(w)
    out: list[str] = []
    for top in sorted(by_line.keys()):
        ws = sorted(by_line[top], key=lambda x: x["x0"])
        left = [w for w in ws if w["x0"] < left_max]
        if not left:
            continue
        out.append(" ".join(w["text"] for w in left).strip())
    return out


def parse_a2_style_stream(lines: list[str]) -> list[tuple[str, str]]:
    merged: list[str] = []
    for line in lines:
        if SKIP_LINE.match(line):
            continue
        if not merged:
            merged.append(line)
            continue
        if line.lower().startswith("ich ") and len(line) < 50:
            merged[-1] = merged[-1] + " " + line
            continue
        m1 = ART_ENTRY_RE.match(line)
        m2 = NEW_ENTRY_RE.match(line) if not m1 else None
        first = None
        if m1:
            first = m1.group(1).split()[0].lower().strip(",")
        elif m2:
            first = m2.group(1).split(",")[0].lower().strip()
        if (m1 or m2) and first not in BAD_LEMMA:
            merged.append(line)
        else:
            merged[-1] = merged[-1] + " " + line

    entries: list[tuple[str, str]] = []
    cur_lemma: str | None = None
    cur_ex: list[str] = []

    for block in merged:
        m = ART_ENTRY_RE.match(block)
        if not m:
            m = NEW_ENTRY_RE.match(block)
        if m:
            lemma = m.group(1).strip()
            rest = m.group(2).strip()
            first = lemma.split()[0].lower().strip(",")
            if first in BAD_LEMMA and not ART_ENTRY_RE.match(block):
                if cur_lemma:
                    cur_ex.append(block)
                continue
            if cur_lemma:
                if cur_lemma and cur_ex:
                    entries.append((cur_lemma, re.sub(r"\s+", " ", " ".join(cur_ex)).strip()))
                cur_ex = []
            cur_lemma = lemma
            cur_ex = [rest]
        elif cur_lemma:
            cur_ex.append(block)
    if cur_lemma and cur_ex:
        entries.append((cur_lemma, re.sub(r"\s+", " ", " ".join(cur_ex)).strip()))
    return entries


# --- B1: dòng chỉ lemma + khối ví dụ (kèm lọc dòng lạc sang mục sau) ---

LEFT_MAX_B1 = 270


def is_b1_lemma_only(line: str) -> bool:
    s = line.strip()
    if not s or len(s) > 85:
        return False
    if "?" in s or "–" in s or "…" in s:
        return False
    if re.match(r"^\d+\.", s):
        return False
    if re.match(r"^[a-zäöüß]{2,30}$", s):
        return True
    if (
        re.match(r"^(der|die|das|ein|eine)\s+[A-Za-zäöüßÄÖÜ].{0,60}$", s)
        and "," in s
        and s.count(" ") <= 6
    ):
        return True
    if re.match(r"^[a-zäöüß][a-zäöüß, ]{2,70},\s+[a-zäöüß]", s) and s.count(",") >= 1 and len(s) < 80:
        return True
    return False


def lemma_core_token(lemma: str) -> str:
    s = lemma.strip().split(",")[0].strip()
    s = re.sub(r"^(der|die|das|ein|eine)\s+", "", s, flags=re.I)
    parts = s.split()
    return parts[0].lower() if parts else ""


def line_supports_lemma(lemma: str, line: str) -> bool:
    t = line.strip()
    if re.match(r"^\d+\.", t):
        return True
    core = lemma_core_token(lemma)
    if len(core) <= 2:
        return True
    if len(core) >= 3 and re.search(rf"\b{re.escape(core)}\b", t, re.I):
        return True
    return False


def filter_b1_example_lines(lemma: str, parts: list[str]) -> list[str]:
    if not parts:
        return []
    out: list[str] = []
    prev_incomplete = False
    for t in parts:
        t = t.strip()
        if not t:
            continue
        if line_supports_lemma(lemma, t):
            out.append(t)
            prev_incomplete = not bool(re.search(r"[.!?…]\s*$", t))
            continue
        if out and prev_incomplete:
            out.append(t)
            prev_incomplete = not bool(re.search(r"[.!?…]\s*$", t))
            continue
    return out


def parse_b1_blocks(lines: list[str]) -> list[tuple[str, str]]:
    lines = [ln for ln in lines if ln.strip() and not SKIP_LINE.match(ln)]
    idxs = [i for i, ln in enumerate(lines) if is_b1_lemma_only(ln)]
    entries: list[tuple[str, str]] = []
    for j, i in enumerate(idxs):
        lemma = lines[i].strip()
        next_i = idxs[j + 1] if j + 1 < len(idxs) else len(lines)
        block: list[str] = []
        k = i - 1
        while k >= 0 and re.match(r"^\d+\.", lines[k].strip()):
            block.insert(0, lines[k].strip())
            k -= 1
        for x in range(i + 1, next_i):
            t = lines[x].strip()
            if SKIP_LINE.match(t):
                continue
            block.append(t)
        block = filter_b1_example_lines(lemma, block)
        ex = re.sub(r"\s+", " ", " ".join(block)).strip()
        entries.append((lemma, ex))
    return entries


def dedup_highest_cefr(rows: list[tuple[str, str, str]]) -> list[tuple[str, str, str]]:
    rank = {"A1": 1, "A2": 2, "B1": 3}
    best: dict[str, tuple[int, str, str, str]] = {}
    for level, lemma, ex in rows:
        key = lemma.casefold()
        r = rank[level]
        cur = best.get(key)
        if not cur or r > cur[0]:
            best[key] = (r, level, lemma, ex)
        elif r == cur[0] and ex and ex not in cur[3]:
            _, lv, lm, old_ex = cur
            merged = old_ex + " || " + ex if old_ex else ex
            best[key] = (r, lv, lm, merged)
    return sorted([(t[1], t[2], t[3]) for t in best.values()], key=lambda x: (x[0], x[1].casefold()))


def main() -> None:
    rows: list[tuple[str, str, str]] = []

    p_a1 = PDF_DIR / "A1_SD1_Wortliste_02.pdf"
    if p_a1.exists():
        d = fitz.open(p_a1)
        rows.extend(parse_a1_pages(d, 9, 27))
        d.close()

    if pdfplumber is None:
        print("WARNING: pdfplumber not installed — skipping A2/B1. pip install pdfplumber")
    else:
        p_a2 = PDF_DIR / "Goethe-Zertifikat_A2_Wortliste.pdf"
        if p_a2.exists():
            with pdfplumber.open(p_a2) as pdf:
                for pi in range(7, 31):
                    lines = extract_left_column_lines(pdf.pages[pi], LEFT_MAX_A2)
                    for lemma, ex in parse_a2_style_stream(lines):
                        if lemma and ex:
                            rows.append(("A2", lemma, ex))

        p_b1 = PDF_DIR / "Goethe-Zertifikat_B1_Wortliste.pdf"
        if p_b1.exists():
            with pdfplumber.open(p_b1) as pdf:
                for pi in range(15, 60):
                    lines = extract_left_column_lines(pdf.pages[pi], LEFT_MAX_B1)
                    for lemma, ex in parse_b1_blocks(lines):
                        if lemma and ex:
                            rows.append(("B1", lemma, ex))

    merged = dedup_highest_cefr(rows)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    with OUT.open("w", encoding="utf-8") as f:
        f.write("cefr\tlemma\texample_de\n")
        for level, lemma, ex in merged:
            ex_esc = ex.replace("\\", "\\\\").replace("\t", " ").replace("\n", " ")
            lemma_esc = lemma.replace("\t", " ")
            f.write(f"{level}\t{lemma_esc}\t{ex_esc}\n")

    print(f"Wrote {len(merged)} deduplicated rows to {OUT} (from {len(rows)} raw)")


if __name__ == "__main__":
    main()
