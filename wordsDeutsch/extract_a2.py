import pdfplumber
import csv
import re
from pathlib import Path
from typing import Optional, Tuple, List

_HEADER_RE = re.compile(r"^--\s*\d+\s+of\s+\d+\s*--$")
_DOC_CODE_RE = re.compile(r"^(?:[A-Z]{1,3}_)?Wortliste_\d{2}_\d{6}$", re.IGNORECASE)
_GARBAGE_CODE_RE = re.compile(r"^\d{6}_\d{2}_.+")
_PAGE_NUM_RE = re.compile(r"^\d{1,3}$")

def _is_garbage_line(line: str) -> bool:
    s = line.strip()
    if not s:
        return True
    if _HEADER_RE.match(s):
        return True
    if _PAGE_NUM_RE.match(s):
        return True
    lowered = s.lower()
    if "seite" in lowered:
        return True
    if any(k in lowered for k in ["goethe-zertifikat", "wortliste", "a2_wortliste_", "impressum", "inhalt", "vs_"]):
        return True
    if "alphabetischer wortschatz" in lowered:
        return True
    # Document/page codes and layout credits that sometimes leak into extracted text.
    if _DOC_CODE_RE.match(s) or _GARBAGE_CODE_RE.match(s):
        return True
    if any(k in lowered for k in ["gestaltung", "graphik-design", "hueber", "isbn", "urheberrecht", "dachauer str."]):
        return True
    # single-letter section headers: A, B, C...
    if re.fullmatch(r"[A-ZÄÖÜ]", s):
        return True
    return False

def _looks_like_sentence(text: str) -> bool:
    return any(c in text for c in [".", "!", "?"])

def _ends_sentence(text: str) -> bool:
    s = text.strip()
    return bool(s) and s[-1] in {".", "!", "?"}

def _extract_lines_from_part(part: pdfplumber.page.Page) -> List[str]:
    words = part.extract_words(use_text_flow=True, keep_blank_chars=False)
    if not words:
        return []

    tol = 2.0
    line_buckets = {}
    for w in words:
        top = float(w.get("top", 0.0))
        key = int(round(top / tol))
        line_buckets.setdefault(key, []).append(w)

    lines: List[str] = []
    for key in sorted(line_buckets.keys()):
        bucket = sorted(line_buckets[key], key=lambda x: float(x.get("x0", 0.0)))
        parts: List[str] = []
        prev_x1: Optional[float] = None
        for w in bucket:
            x0 = float(w.get("x0", 0.0))
            x1 = float(w.get("x1", x0))
            txt = str(w.get("text", "")).strip()
            if not txt:
                continue
            # A2 columns can have a smaller apparent gap depending on font/layout.
            if prev_x1 is not None and (x0 - prev_x1) >= 10.0:
                parts.append("\t")
            parts.append(txt)
            prev_x1 = x1

        line = " ".join(parts)
        line = re.sub(r"\s+\t\s+", "\t", line).strip()
        line = re.sub(r"\s+", " ", line)
        if line:
            lines.append(line)
    return lines

def _postprocess_merge_inflections(rows: List[List[str]]) -> List[List[str]]:
    """
    Merge rows where an inflection fragment was mistakenly emitted as a new vocab entry.
    Example:
      mögen, mag,  +  mochte, hat gemocht   (example wrapped as next line)
    """
    out: List[List[str]] = []
    for level, vocab, example in rows:
        if not out:
            out.append([level, vocab, example])
            continue

        prev = out[-1]
        prev_level, prev_vocab, prev_example = prev

        vocab_norm = _normalize_vocab_fragment(vocab)
        prev_example_incomplete = (not _ends_sentence(prev_example)) and prev_example.strip() != ""

        is_inflection_row = _looks_like_inflection_continuation(vocab_norm)
        looks_like_example_continuation = bool(example.strip()) and (example[0].isupper() or example[0].isdigit())

        if (
            level == prev_level == "A2"
            and is_inflection_row
            and prev_example_incomplete
            and looks_like_example_continuation
        ):
            # Merge vocab fragments
            prev[1] = _normalize_vocab_fragment(f"{prev_vocab} {vocab_norm}")
            # Merge example into previous example (keep ' | ' semantics)
            if prev_example.endswith("|") or prev_example.endswith("| "):
                prev[2] = f"{prev_example} {example}".strip()
            else:
                prev[2] = f"{prev_example} {example}".strip()
            continue

        out.append([level, vocab, example])

    return out

def _normalize_vocab_fragment(text: str) -> str:
    # Normalize whitespace and fix hyphen line breaks.
    s = re.sub(r"\s+", " ", text).strip()
    s = re.sub(r"-\s+", "", s)
    return s

def _clean_vocab(text: str) -> str:
    """
    Remove PDF noise tokens accidentally attached to the left column.
    Keeps grammatical markers when they belong to a real headword (e.g. 'die Möbel (Pl.)').
    """
    s = _normalize_vocab_fragment(text)
    if not s:
        return ""

    # Drop leading stray digits (e.g. '0 mögen, ...')
    s = re.sub(r"^\d+\s+", "", s)

    # Remove known broken doc-code fragments that leak into the left column.
    s = re.sub(r"\betsiltroW\b", "", s, flags=re.IGNORECASE)
    s = re.sub(r"\bortlist(e)?\b", "", s, flags=re.IGNORECASE)

    # Remove tokens like '3_' / '2_' / 'e_' etc.
    s = re.sub(r"\b[0-9A-Za-zÄÖÜäöüß]+_\b", "", s)

    s = re.sub(r"\s+", " ", s).strip()

    # If the "vocab" is only a grammatical marker, it isn't a vocab entry.
    if re.fullmatch(r"\((?:pl\.|sg\.|z\.\s*b\..+)\)", s, flags=re.IGNORECASE):
        return ""
    return s

def _split_collapsed_vocab_example(line: str) -> Optional[Tuple[str, str]]:
    # When spacing is collapsed, vocab and example appear as a single-space stream.
    tokens = [t for t in re.split(r"\s+", line.strip()) if t]
    if len(tokens) < 2:
        return None

    def ex_starts_ok(ex_first: str) -> bool:
        return bool(ex_first) and (ex_first[0].isupper() or ex_first[0].isdigit() or ex_first[0] in ["–", "-", "„", "\""])

    for k in range(1, min(10, len(tokens) - 1) + 1):
        vocab = " ".join(tokens[:k]).strip()
        ex = " ".join(tokens[k:]).strip()
        if not ex:
            continue
        if _looks_like_sentence(ex) and ex_starts_ok(tokens[k]) and len(vocab) <= 80:
            # Avoid splitting inside common inflection fragments like "hat", "ist", "wird" that belong to vocab.
            if tokens[k].lower() in {"hat", "ist", "wird"} and k < (len(tokens) - 1):
                continue
            return vocab, ex
    return None

def _split_headword_with_fragment(line: str) -> Optional[Tuple[str, str]]:
    # Detect patterns like "aber Heute kann ich ..." where the example fragment doesn't yet end with punctuation.
    tokens = [t for t in re.split(r"\s+", line.strip()) if t]
    if len(tokens) < 2:
        return None

    articles = {"der", "die", "das", "ein", "eine", "einen", "einem", "einer"}
    t0 = tokens[0].lower()

    # Article + Noun pattern.
    if t0 in articles and len(tokens) >= 3 and tokens[1] and tokens[1][0].isupper():
        vocab = " ".join(tokens[:2]).strip()
        frag = " ".join(tokens[2:]).strip()
        if frag and (frag[0].isupper() or frag[0].isdigit()):
            return vocab, frag

    # Single-token headword followed by capital-starting fragment.
    if t0 not in articles and tokens[0] and tokens[0][0].islower() and tokens[1] and tokens[1][0].isupper():
        vocab = tokens[0].strip()
        frag = " ".join(tokens[1:]).strip()
        return vocab, frag

    return None

def _looks_like_inflection_continuation(vocab: str) -> bool:
    """
    Lines like 'mochte, hat gemocht' are not new vocab entries; they extend the current headword.
    Heuristics: starts lowercase/article, contains commas or auxiliary verbs, no sentence punctuation.
    """
    s = _normalize_vocab_fragment(vocab)
    if not s:
        return False
    # If it already looks like a sentence, it's not a vocab fragment.
    if _looks_like_sentence(s):
        return False
    tokens = [t for t in re.split(r"\s+", s) if t]
    if not tokens:
        return False
    t0 = tokens[0].lower()
    articles = {"der", "die", "das", "ein", "eine", "einen", "einem", "einer"}
    if t0 in articles:
        return False
    if tokens[0][0].isupper():
        return False
    # Past tense lines like 'mochte, hat gemocht' start with a verb form, then 'hat/ist ...'
    if any(tok.lower().strip(",") in {"hat", "ist"} for tok in tokens[1:]):
        return True
    if "," in s:
        return True
    if any(t in {"hat", "ist", "wird", "war", "waren"} for t in [tok.lower().strip(",") for tok in tokens]):
        return True
    return False

def process_a2(pdf_path: str) -> List[List[str]]:
    rows: List[List[str]] = []
    current_vocab_parts: List[str] = []
    current_examples: List[str] = []

    def flush():
        nonlocal current_vocab_parts, current_examples
        vocab = _clean_vocab(" ".join(current_vocab_parts))
        if vocab and current_examples:
            merged = " | ".join(e.strip() for e in current_examples if e and e.strip())
            # Remove leaked inflection tokens that sometimes slip into the example stream.
            inflection_tokens = []
            for tok in re.split(r"\s+", vocab):
                t = tok.strip()
                if not t:
                    continue
                if t[0].islower() and (t.endswith(",") or t in {"mochte", "mochtest", "mochten"}):
                    inflection_tokens.append(t)
            for t in inflection_tokens:
                merged = re.sub(rf"(?<!\S){re.escape(t)}(?!\S)", "", merged)
                merged = re.sub(r"\s+", " ", merged).strip()
            # Generic cleanup: remove stray lowercase inflection token ending with comma
            # right before an Uppercase-starting continuation (common PDF column bleed).
            merged = re.sub(r"\b[a-zäöüß]+,\s+(?=[A-ZÄÖÜ])", "", merged)
            merged = re.sub(r"\s+", " ", merged).strip()
            if merged:
                rows.append(["A2", vocab, merged])
        current_vocab_parts = []
        current_examples = []

    def add_example_fragment(fragment: str):
        nonlocal current_examples
        frag = re.sub(r"\s+", " ", fragment).strip()
        if not frag:
            return
        # Remove leaked layout/doc tokens
        frag = re.sub(r"\b[0-9A-Za-zÄÖÜäöüß]+_\b", "", frag)
        frag = re.sub(r"\betsiltroW\b", "", frag, flags=re.IGNORECASE)
        frag = re.sub(r"\bortlist(e)?\b", "", frag, flags=re.IGNORECASE)
        frag = re.sub(r"\s+", " ", frag).strip()
        # Remove numbering (rare in A2 but safe)
        frag = re.sub(r"^\d+\.\s*", "", frag)
        if not current_examples:
            current_examples = [frag]
            return
        if not _ends_sentence(current_examples[-1]):
            current_examples[-1] = f"{current_examples[-1]} {frag}".strip()
        else:
            current_examples.append(frag)

    with pdfplumber.open(pdf_path) as pdf:
        # Alphabetischer Wortschatz starts around page 8 in the PDF (0-based index 7).
        for page in pdf.pages[7:]:
            # Crop header/footer first, then split into 2 halves (absolute coordinates).
            x0, top, x1, bottom = 0.0, 50.0, float(page.width), float(page.height - 50)
            mid = x1 / 2.0
            left = page.crop((x0, top, mid, bottom))
            right = page.crop((mid, top, x1, bottom))

            for column_lines in (_extract_lines_from_part(left), _extract_lines_from_part(right)):
                for raw_line in column_lines:
                    line = raw_line.strip()
                    if _is_garbage_line(line):
                        continue

                    # If the last example fragment hasn't ended a sentence yet, treat the next line as continuation.
                    if current_vocab_parts and current_examples and not _ends_sentence(current_examples[-1]):
                        if "\t" in line:
                            _, right_side = line.split("\t", 1)
                            add_example_fragment(right_side)
                        else:
                            # Sometimes this line is actually an inflection fragment from the left column.
                            if _looks_like_inflection_continuation(line):
                                cleaned = _clean_vocab(line)
                                if cleaned:
                                    current_vocab_parts.append(cleaned)
                            else:
                                add_example_fragment(line)
                        continue

                    if current_vocab_parts and line and line[0].isupper():
                        add_example_fragment(line)
                        continue

                    if "\t" in line:
                        vocab, example = line.split("\t", 1)
                        vocab = _clean_vocab(vocab)
                        example = example.strip()
                        if vocab and example:
                            flush()
                            current_vocab_parts = [vocab]
                            add_example_fragment(example)
                            continue
                    else:
                        split_frag = _split_headword_with_fragment(line)
                        if split_frag:
                            vocab, frag = split_frag
                            flush()
                            cleaned_vocab = _clean_vocab(vocab)
                            if cleaned_vocab:
                                current_vocab_parts = [cleaned_vocab]
                                add_example_fragment(frag)
                            continue

                        split = _split_collapsed_vocab_example(line)
                        if split:
                            vocab, example = split
                            flush()
                            cleaned_vocab = _clean_vocab(vocab)
                            if cleaned_vocab:
                                current_vocab_parts = [cleaned_vocab]
                                add_example_fragment(example)
                            continue

                    if current_vocab_parts:
                        if _looks_like_sentence(line):
                            add_example_fragment(line)
                        else:
                            cleaned = _clean_vocab(line)
                            if cleaned:
                                current_vocab_parts.append(cleaned)
                    else:
                        if not _looks_like_sentence(line):
                            cleaned = _clean_vocab(line)
                            if cleaned:
                                current_vocab_parts = [cleaned]

                # Prevent leaking state between columns
                flush()

    flush()
    return _postprocess_merge_inflections(rows)

BASE_DIR = Path(__file__).resolve().parent
data = process_a2(str(BASE_DIR / "Goethe-Zertifikat_A2_Wortliste.pdf"))
with open(BASE_DIR / "A2_clean.tsv", "w", encoding="utf-8", newline="") as f:
    writer = csv.writer(f, delimiter='\t')
    writer.writerows(data)
print("Xong A2!")