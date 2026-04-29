import pdfplumber
import csv
import re
from pathlib import Path
from typing import Optional, Tuple, List

_HEADER_RE = re.compile(r"^--\s*\d+\s+of\s+\d+\s*--$")

def _is_garbage_line(line: str) -> bool:
    s = line.strip()
    if not s:
        return True
    if _HEADER_RE.match(s):
        return True
    lowered = s.lower()
    if "seite" in lowered:
        return True
    if any(k in lowered for k in ["inventare", "inhalt", "wortliste", "vs_"]):
        return True
    # single-letter section headers: A, B, C... (also umlauts)
    if re.fullmatch(r"[A-ZÄÖÜ]", s):
        return True
    return False

def _looks_like_sentence(text: str) -> bool:
    return any(c in text for c in [".", "!", "?"])

def _split_vocab_and_example(line: str) -> Optional[Tuple[str, str]]:
    # Prefer tab; fallback to 2+ spaces.
    if "\t" in line:
        parts = [p.strip() for p in line.split("\t") if p and p.strip()]
    else:
        parts = [p.strip() for p in re.split(r"\s{2,}", line) if p and p.strip()]
    if len(parts) >= 2:
        vocab = parts[0]
        example = parts[1]
        return vocab, example

    # Fallback: pdfplumber sometimes collapses spacing, so we heuristically split by tokens.
    tokens = [t for t in re.split(r"\s+", line.strip()) if t]
    if len(tokens) < 2:
        return None

    articles = {"der", "die", "das", "ein", "eine", "einen", "einem", "einer"}
    t0 = tokens[0].lower()

    # Primary rule: A1 headwords are usually 1 token, except article-nouns or fixed 2-word phrases.
    split_k = 1
    if t0 in articles and len(tokens) >= 3:
        split_k = 2
    elif tokens[0] == "(sich)" and len(tokens) >= 3:
        split_k = 2
    elif len(tokens) >= 3 and tokens[1].islower():
        # e.g. "Rad fahren"
        split_k = 2

    vocab = " ".join(tokens[:split_k]).strip()
    ex = " ".join(tokens[split_k:]).strip()
    if _looks_like_sentence(ex) and len(vocab) <= 40:
        return vocab, ex

    # Fallback scan: choose shortest prefix that yields a sentence-like remainder.
    for k in range(1, min(5, len(tokens) - 1) + 1):
        vocab2 = " ".join(tokens[:k]).strip()
        ex2 = " ".join(tokens[k:]).strip()
        if len(vocab2) <= 40 and _looks_like_sentence(ex2) and (ex2[0].isupper() or ex2[0].isdigit()):
            return vocab2, ex2
    return None

def extract_a1(pdf_path: str) -> List[List[str]]:
    rows: List[List[str]] = []
    current_vocab: Optional[str] = None
    current_examples: List[str] = []

    def flush():
        nonlocal current_vocab, current_examples
        if current_vocab and current_examples:
            merged = " | ".join(current_examples)
            rows.append(["A1", current_vocab, merged])
        current_vocab = None
        current_examples = []

    with pdfplumber.open(pdf_path) as pdf:
        # Goethe A1: Alphabetische Wortliste starts at page 9 (0-based index 8)
        for page in pdf.pages[8:]:
            cropped = page.crop((0, 50, page.width, page.height - 50))
            text = cropped.extract_text()
            if not text:
                continue
            for raw_line in text.split("\n"):
                # IMPORTANT: keep tabs / multi-spaces for reliable splitting
                line = raw_line.strip()
                if _is_garbage_line(line):
                    continue

                # Continuation example lines in A1 frequently start with a capital (e.g. "Wir ...", "Das ...").
                # When spacing has been collapsed, these lines otherwise get mis-parsed as new headwords.
                if (
                    current_vocab
                    and line
                    and line[0].isupper()
                    and _looks_like_sentence(line)
                    and ("\t" not in line)
                    and (re.search(r"\s{2,}", line) is None)
                ):
                    current_examples.append(re.sub(r"\s+", " ", line).strip())
                    continue

                split = _split_vocab_and_example(line)
                if split:
                    vocab, example = split
                    if not _looks_like_sentence(example):
                        continue
                    # New entry -> flush previous
                    flush()
                    current_vocab = vocab
                    current_examples = [re.sub(r"\s+", " ", example).strip()]
                    continue

                # Continuation example line (common in A1): no vocab delimiter, but is sentence-like
                if current_vocab and _looks_like_sentence(line):
                    current_examples.append(re.sub(r"\s+", " ", line).strip())

    flush()
    return rows

# Chạy và xuất file
BASE_DIR = Path(__file__).resolve().parent
a1_data = extract_a1(str(BASE_DIR / "A1_SD1_Wortliste_02.pdf"))
with open(BASE_DIR / "A1_clean.tsv", "w", encoding="utf-8", newline="") as f:
    writer = csv.writer(f, delimiter='\t')
    writer.writerows(a1_data)

print(f"Xong! Đã lọc được {len(a1_data)} từ chuẩn.")