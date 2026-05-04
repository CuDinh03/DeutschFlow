import pdfplumber
import csv
import re
from pathlib import Path
from typing import Optional, List, Dict, Tuple

_HEADER_RE = re.compile(r"^--\s*\d+\s+of\s+\d+\s*--$")
_NUM_EXAMPLE_RE = re.compile(r"^\d+\.\s*")

def _is_garbage_line(line: str) -> bool:
    s = line.strip()
    if not s:
        return True
    if _HEADER_RE.match(s):
        return True
    lowered = s.lower()
    if "seite" in lowered:
        return True
    if any(k in lowered for k in ["zertifikat b1", "goethe-zertifikat", "wortliste", "impressum", "inhalt", "vs_"]):
        return True
    # single-letter section headers: A, B, C...
    if re.fullmatch(r"[A-ZÄÖÜ]", s):
        return True
    return False

def _looks_like_sentence(text: str) -> bool:
    return any(c in text for c in [".", "!", "?"])

def _extract_lines_from_page(page: pdfplumber.page.Page) -> List[str]:
    words = page.extract_words(use_text_flow=True, keep_blank_chars=False)
    if not words:
        return []

    # Group words into lines by 'top' coordinate with tolerance.
    tol = 2.0
    line_buckets: Dict[int, List[dict]] = {}
    for w in words:
        top = float(w.get("top", 0.0))
        key = int(round(top / tol))
        line_buckets.setdefault(key, []).append(w)

    lines: List[str] = []
    for key in sorted(line_buckets.keys()):
        bucket = sorted(line_buckets[key], key=lambda x: float(x.get("x0", 0.0)))
        # Build a "split-aware" line: insert a delimiter where there is a large x-gap.
        parts: List[str] = []
        prev_x1: Optional[float] = None
        for w in bucket:
            x0 = float(w.get("x0", 0.0))
            x1 = float(w.get("x1", x0))
            txt = str(w.get("text", "")).strip()
            if not txt:
                continue
            if prev_x1 is not None and (x0 - prev_x1) >= 12.0:
                parts.append("\t")
            parts.append(txt)
            prev_x1 = x1

        line = " ".join(parts)
        line = re.sub(r"\s+\t\s+", "\t", line).strip()
        line = re.sub(r"\s+", " ", line)
        if line:
            lines.append(line)
    return lines

def process_b1(pdf_path: str) -> list[list[str]]:
    rows: List[List[str]] = []
    current_vocab: Optional[str] = None
    current_examples: List[str] = []

    def flush():
        nonlocal current_vocab, current_examples
        if current_vocab and current_examples:
            merged = " | ".join(e.strip() for e in current_examples if e and e.strip())
            if merged:
                rows.append(["B1", current_vocab, merged])
        current_vocab = None
        current_examples = []

    def add_example_fragment(fragment: str):
        nonlocal current_examples
        frag = re.sub(r"\s+", " ", fragment).strip()
        frag = _NUM_EXAMPLE_RE.sub("", frag).strip()
        if not frag:
            return
        if not current_examples:
            current_examples = [frag]
            return
        if not _looks_like_sentence(current_examples[-1]):
            current_examples[-1] = f"{current_examples[-1]} {frag}".strip()
        else:
            current_examples.append(frag)

    def split_vocab_example(line: str) -> Optional[Tuple[str, str]]:
        if "\t" in line:
            left, right = line.split("\t", 1)
            left = left.strip()
            right = right.strip()
            if left and right:
                return left, right
        parts = [p.strip() for p in re.split(r"\s{2,}", line) if p and p.strip()]
        if len(parts) >= 2:
            return parts[0], parts[1]
        return None

    with pdfplumber.open(pdf_path) as pdf:
        # Start at the alphabetic section area.
        for page in pdf.pages[16:]:
            cropped = page.crop((0, 50, page.width, page.height - 50))
            text = cropped.extract_text() or ""
            if not text:
                continue

            for raw in text.split("\n"):
                line = raw.strip()
                if _is_garbage_line(line):
                    continue

                # If the last example fragment hasn't ended, keep appending.
                if current_vocab and current_examples and not _looks_like_sentence(current_examples[-1]):
                    add_example_fragment(line)
                    continue

                split = split_vocab_example(line)
                if split:
                    vocab, ex = split
                    flush()
                    current_vocab = vocab
                    add_example_fragment(ex)
                    continue

                if current_vocab and (_NUM_EXAMPLE_RE.match(line) or _looks_like_sentence(line)):
                    add_example_fragment(line)
                    continue

                # Treat as headword line.
                if not _NUM_EXAMPLE_RE.match(line) and not _looks_like_sentence(line):
                    flush()
                    current_vocab = re.sub(r"\s+", " ", line).strip()
                    continue

    flush()
    return rows

BASE_DIR = Path(__file__).resolve().parent
data = process_b1(str(BASE_DIR / "Goethe-Zertifikat_B1_Wortliste.pdf"))
with open(BASE_DIR / "B1_clean.tsv", "w", encoding="utf-8", newline="") as f:
    writer = csv.writer(f, delimiter='\t')
    writer.writerows(data)
print("Xong B1!")