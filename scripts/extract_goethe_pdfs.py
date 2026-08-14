#!/usr/bin/env python3
"""
Trích xuất lemma + ví dụ tiếng Đức từ PDF Goethe chính thức (A1 Start Deutsch 1, A2, B1).

Sinh: backend/src/main/resources/wordlists/goethe_official_wordlist.tsv
      (đọc bởi CefrLevelResolver — nguồn quyết định words.cefr_level).

Phụ thuộc:
  pip install pdfplumber

Chạy từ thư mục gốc repo (PDF nằm trong wordsDeutsch/, thư mục này KHÔNG commit):
  python3 scripts/extract_goethe_pdfs.py

Cách hoạt động — tách theo TOẠ ĐỘ, không đoán bằng regex:

  * Mỗi trang danh sách là hai NỬA cạnh nhau (A2/B1), mỗi nửa gồm cột lemma + cột ví dụ.
    Bản trước chỉ đọc nửa trái (`x0 < 270`) và dừng ở trang 60/104 của B1 ⇒ mất quá nửa dữ liệu
    (A1 235 · A2 616 · B1 159 dòng). Xem BAO_CAO_PHAN_CAP_TU_VUNG_2026-08-14.md.
  * Mép cột ví dụ dò bằng histogram x0 (mọi dòng ví dụ bắt đầu đúng một toạ độ), nên không phải
    ghim số cứng cho từng file PDF.
  * A2/B1: một mục từ = một KHỐI các dòng; mục mới bắt đầu khi khoảng cách dọc giãn ra
    (trong mục ~11pt, giữa hai mục ≥14pt) — cần vậy vì dòng chia động từ ("hat aufgepasst")
    cũng nằm ở cột lemma và không được tính thành mục riêng.
  * A1: mỗi mục đúng một dòng nên chỉ cần "dòng có chữ ở cột lemma = mục mới".
"""
from __future__ import annotations

import re
import unicodedata
from collections import Counter, defaultdict
from pathlib import Path

import pdfplumber

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "backend/src/main/resources/wordlists/goethe_official_wordlist.tsv"
PDF_DIR = ROOT / "wordsDeutsch"

# Vùng chữ hữu ích trên trang (bỏ header "WORTLISTE"/số trang và footer).
TOP_MARGIN = 60
BOTTOM_MARGIN = 30
# Gộp cột số thứ tự nghĩa ("1.", "2.") vào cột ví dụ ngay sau nó khi dò lưới.
COLUMN_CLUSTER_TOL = 12
# Cột ví dụ phải cách cột lemma ít nhất ngần này (pt) mới coi là cột khác.
COLUMN_GAP_MIN = 60
# Nửa phải bắt đầu từ đâu (tỉ lệ bề ngang) và cột phải "đáng kể" so với cột dày nhất.
RIGHT_HALF_MIN_RATIO = 0.45
MIN_COLUMN_SHARE = 0.25
# Ranh giới lemma/ví dụ đặt ngay TRƯỚC mép cột ví dụ; mép nửa trang lùi thêm chút cho chữ nhô trái.
BOUNDARY_PAD = 3
HALF_PAD = 5
# Giãn dòng trong một mục ~11pt; giữa hai mục ≥14pt.
BLOCK_GAP = 13
# Dung sai gom chữ về cùng một dòng (baseline hai cột lệch nhau vài pt).
LINE_TOL = 4

ARTICLE_RE = re.compile(r"^(der|die|das)\b", re.I)
# Mã tài liệu / header lọt vào lề trang ("VS_02_280312", "213082_20_SV", "A2_Wortliste_03_200616").
JUNK_WORD_RE = re.compile(r"^(VS_|\d{5,}_|[A-B]\d_Wortliste)", re.I)
SKIP_LINE_RE = re.compile(
    r"^(WORTLISTE|GOETHE-ZERTIFIKAT|ZERTIFIKAT|Alphabetische|wortliste|Inventare|Seite|VS_|"
    r"A1_|A2_|B1_|Felix Brandl|Goethe-Institut)",
    re.I,
)


def norm_space(s: str) -> str:
    return re.sub(r"\s+", " ", unicodedata.normalize("NFKC", s)).strip()


def page_lines(page, x_start: float, x_end: float) -> list[tuple[int, list[dict]]]:
    """
    Chữ trong nửa trang [x_start, x_end), gom theo dòng.

    Gom theo `top` với dung sai {LINE_TOL}pt chứ không theo `top` làm tròn: cột lemma và cột ví dụ
    lệch baseline 1–3pt, nếu tách đôi thì một mục từ bị đếm thành hai dòng và khoảng cách dọc
    (thứ dùng để tách mục) loạn hết.
    """
    words = [
        w
        for w in page.extract_words()
        if TOP_MARGIN < w["top"] < page.height - BOTTOM_MARGIN
        and x_start <= w["x0"] < x_end
        and not JUNK_WORD_RE.match(w["text"])
    ]
    words.sort(key=lambda w: (w["top"], w["x0"]))
    lines: list[tuple[int, list[dict]]] = []
    current: list[dict] = []
    current_top: float | None = None
    for w in words:
        if current_top is None:
            current_top = w["top"]
        elif w["top"] - current_top > LINE_TOL:
            lines.append((round(current_top), sorted(current, key=lambda x: x["x0"])))
            current, current_top = [], w["top"]
        current.append(w)
    if current and current_top is not None:
        lines.append((round(current_top), sorted(current, key=lambda x: x["x0"])))
    return lines


def _x_clusters(words: list[dict]) -> list[tuple[float, int]]:
    """Các mép cột theo histogram x0; cột số thứ tự nghĩa ("1.") gộp vào cột ví dụ ngay sau nó."""
    counts = Counter(round(w["x0"]) for w in words)
    clusters: list[list[float]] = []
    for x, c in sorted(counts.items()):
        if clusters and x - clusters[-1][0] <= COLUMN_CLUSTER_TOL:
            clusters[-1][1] += c
        else:
            clusters.append([x, c])
    return [(c[0], int(c[1])) for c in clusters]


def detect_grid(page) -> list[tuple[float, float, float]]:
    """
    Dò lưới cột của trang: trả về các đoạn ``(x_bắt_đầu, x_kết_thúc, ranh_giới_lemma_ví_dụ)``.

    Mọi dòng ví dụ bắt đầu đúng một toạ độ nên histogram x0 lộ ra mép cột. A1 có 1 nửa
    (lemma | ví dụ); A2/B1 có 2 nửa cạnh nhau. Dò theo TỪNG TRANG vì mép cột xê dịch vài pt giữa
    các trang — ghim số cứng thì nửa phải tràn sang nửa trái, các dòng chèn vào nhau làm khoảng
    cách dọc loạn và cả trang dồn thành một khối (mất sạch mục từ trừ mục đầu).
    """
    words = [
        w
        for w in page.extract_words()
        if TOP_MARGIN < w["top"] < page.height - BOTTOM_MARGIN and not JUNK_WORD_RE.match(w["text"])
    ]
    clusters = _x_clusters(words)
    if len(clusters) < 2:
        return []
    peak = max(c for _, c in clusters)
    # Mép nửa phải = cột "đáng kể" đầu tiên nằm quá nửa trang.
    right_start = next(
        (x for x, c in clusters if x >= page.width * RIGHT_HALF_MIN_RATIO and c >= peak * MIN_COLUMN_SHARE),
        None,
    )
    bounds = [(0.0, right_start - HALF_PAD)] if right_start else [(0.0, float(page.width))]
    if right_start:
        bounds.append((right_start - HALF_PAD, float(page.width)))

    segments: list[tuple[float, float, float]] = []
    for x_start, x_end in bounds:
        half = [w for w in words if x_start <= w["x0"] < x_end]
        if not half:
            continue
        lemma_x = min(w["x0"] for w in half)
        example = [(x, c) for x, c in _x_clusters(half) if x >= lemma_x + COLUMN_GAP_MIN]
        if not example:
            continue
        example_x = max(example, key=lambda t: t[1])[0]
        segments.append((x_start, x_end, example_x - BOUNDARY_PAD))
    return segments


def split_line(words: list[dict], boundary: float) -> tuple[str, str]:
    left = " ".join(w["text"] for w in words if w["x0"] < boundary)
    right = " ".join(w["text"] for w in words if w["x0"] >= boundary)
    return norm_space(left), norm_space(right)


def clean_lemma(raw: str) -> str:
    """"aufpassen, passt auf," → "aufpassen"; "der Politiker, -" → "der Politiker"; bỏ "1." dính đuôi."""
    s = norm_space(raw)
    s = re.sub(r"\d+\.?$", "", s).strip()
    s = s.split(",")[0].strip()
    s = re.sub(r"[^\wÄÖÜäöüß\-/ ]", " ", s)
    s = norm_space(s)
    # Nhãn ngữ pháp/vùng miền trong Wortliste: "die Eltern pl", "der Gehsteig D" (D/A/CH).
    s = re.sub(r"\s+(pl|Pl|D|A|CH)$", "", s).strip()
    if re.search(r"\d", s):
        return ""
    if len(s) < 2 or len(s) > 60 or SKIP_LINE_RE.match(s):
        return ""
    # Chữ cái phân mục ("A", "B", …) và mẩu rác một–hai ký tự.
    if len(s) <= 2 and s.isupper():
        return ""
    return s


def is_paradigm_line(text: str) -> bool:
    """Dòng chia động từ / phân từ đi kèm mục từ, không phải lemma riêng."""
    return bool(re.match(r"^(hat|ist|hatte|war|wird|sind|haben|→)\b", text.strip(), re.I))


def blocks_by_gap(lines: list[tuple[int, list[dict]]], gap: int = BLOCK_GAP) -> list[list[tuple[int, list[dict]]]]:
    blocks: list[list[tuple[int, list[dict]]]] = []
    prev_top: int | None = None
    for top, ws in lines:
        if prev_top is None or top - prev_top >= gap:
            blocks.append([])
        blocks[-1].append((top, ws))
        prev_top = top
    return blocks


def parse_two_column_page(page) -> list[tuple[str, str]]:
    """A2/B1: mỗi nửa trang là (cột lemma | cột ví dụ); mục từ tách theo khoảng cách dọc."""
    out: list[tuple[str, str]] = []
    for x_start, x_end, boundary in detect_grid(page):
        lines = page_lines(page, x_start, x_end)
        for block in blocks_by_gap(lines):
            lemma_lines: list[str] = []
            example_parts: list[str] = []
            for _, ws in block:
                left, right = split_line(ws, boundary)
                if left:
                    lemma_lines.append(left)
                if right:
                    example_parts.append(right)
            if not lemma_lines:
                continue
            example = norm_space(" ".join(example_parts))
            # Dòng lemma đầu khối là mục chính; các dòng sau chỉ nhận khi mở đầu bằng mạo từ
            # (dạng giống cái "die Politikerin, -nen" đi kèm "der Politiker, -").
            for i, raw in enumerate(lemma_lines):
                if i > 0 and not ARTICLE_RE.match(raw):
                    continue
                if is_paradigm_line(raw):
                    continue
                lemma = clean_lemma(raw)
                if lemma:
                    out.append((lemma, example))
    return out


def parse_a1_page(page) -> list[tuple[str, str]]:
    """A1: mỗi mục một dòng; dòng không có chữ ở cột lemma là ví dụ nối tiếp của mục trước."""
    grid = detect_grid(page)
    if not grid:
        return []
    x_start, x_end, boundary = grid[0]
    out: list[tuple[str, str]] = []
    for _, ws in page_lines(page, x_start, x_end):
        left, right = split_line(ws, boundary)
        if left and not SKIP_LINE_RE.match(left):
            lemma = clean_lemma(left)
            if lemma:
                out.append((lemma, right))
        elif right and out:
            lemma, example = out[-1]
            out[-1] = (lemma, norm_space(f"{example} {right}"))
    return out


def dedup_lowest_cefr(rows: list[tuple[str, str, str]]) -> list[tuple[str, str, str]]:
    """Wortliste Goethe là cộng dồn ⇒ giữ cấp THẤP NHẤT (cấp người học gặp từ này lần đầu)."""
    rank = {"A1": 1, "A2": 2, "B1": 3}
    best: dict[str, tuple[int, str, str, str]] = {}
    for level, lemma, ex in rows:
        key = re.sub(r"^(der|die|das)\s+", "", lemma, flags=re.I).casefold()
        r = rank[level]
        cur = best.get(key)
        if not cur or r < cur[0]:
            best[key] = (r, level, lemma, ex)
        elif r == cur[0] and ex and ex not in cur[3]:
            _, lv, lm, old_ex = cur
            best[key] = (r, lv, lm, (old_ex + " || " + ex) if old_ex else ex)
    return sorted([(t[1], t[2], t[3]) for t in best.values()], key=lambda x: (x[0], x[1].casefold()))


# (file, cấp, trang đầu, trang cuối — 1-indexed, đọc từ cấu trúc PDF; số cột của bố cục)
SOURCES = [
    ("A1_SD1_Wortliste_02.pdf", "A1", 9, 27, 2),
    ("Goethe-Zertifikat_A2_Wortliste.pdf", "A2", 8, 31, 4),
    ("Goethe-Zertifikat_B1_Wortliste.pdf", "B1", 16, 102, 4),
]


def main() -> None:
    rows: list[tuple[str, str, str]] = []
    for filename, level, first_page, last_page, columns in SOURCES:
        path = PDF_DIR / filename
        if not path.exists():
            print(f"WARNING: thiếu {path} — bỏ qua cấp {level}")
            continue
        count = 0
        with pdfplumber.open(path) as pdf:
            for pi in range(first_page - 1, min(last_page, len(pdf.pages))):
                page = pdf.pages[pi]
                entries = parse_a1_page(page) if columns == 2 else parse_two_column_page(page)
                for lemma, example in entries:
                    rows.append((level, lemma, example))
                    count += 1
        print(f"{level}: {count} mục thô từ {filename} (trang {first_page}–{last_page})")

    merged = dedup_lowest_cefr(rows)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    with OUT.open("w", encoding="utf-8") as f:
        f.write("cefr\tlemma\texample_de\n")
        for level, lemma, ex in merged:
            ex_esc = ex.replace("\\", "\\\\").replace("\t", " ").replace("\n", " ")
            lemma_esc = lemma.replace("\t", " ")
            f.write(f"{level}\t{lemma_esc}\t{ex_esc}\n")

    per_level = Counter(level for level, _, _ in merged)
    print(f"Wrote {len(merged)} dòng (từ {len(rows)} thô) → {OUT}")
    print("  " + " · ".join(f"{lv} {per_level[lv]}" for lv in ("A1", "A2", "B1")))


if __name__ == "__main__":
    main()
