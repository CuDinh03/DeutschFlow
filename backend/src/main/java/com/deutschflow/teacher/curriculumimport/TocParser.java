package com.deutschflow.teacher.curriculumimport;

import com.deutschflow.teacher.curriculumimport.dto.DraftModule;
import com.deutschflow.teacher.curriculumimport.template.CurriculumTemplate;
import com.deutschflow.teacher.curriculumimport.template.TemplateUnit;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Reads a coursebook's contents pages into the same {@link CurriculumTemplate} shape the managed
 * catalog uses, so an unknown book and a shipped template travel the identical drafting rules.
 *
 * <p>The rules are deterministic string matching — no model, no network. A contents page is one of
 * the most regular structures in print: a numbered heading with a page number on the right, a line
 * of communicative goals, then labelled rows (Wortschatz, Grammatik, …). That regularity is what the
 * patterns below encode.
 *
 * <p>OCR output is treated as hostile input: it is only ever matched against these patterns and
 * mapped onto the fixed tag whitelist. Text inside a document can never become an instruction here,
 * because nothing in this class interprets it as one.
 */
@Component
public class TocParser {

    /** "1  Guten Tag!                8" — number, title, book page. */
    private static final Pattern CHAPTER = Pattern.compile(
            "^\\s*(\\d{1,2})\\s+(\\S.*?)\\s{2,}(\\d{1,3})\\s*$");

    /** Same, but tolerating a single space before the page number when the title has no runs of spaces. */
    private static final Pattern CHAPTER_LOOSE = Pattern.compile(
            "^\\s*(\\d{1,2})\\s+(\\S.*?)\\s+(\\d{1,3})\\s*$");

    /** "Plattform 1: wiederholen und trainieren …   38" and its siblings in other series. */
    private static final Pattern REVIEW = Pattern.compile(
            "^\\s*(Plattform|Station|Zwischenspiel|Wiederholung|Rückblick|Panorama|Magazin)"
                    + "\\s*(\\d{1,2})?\\s*[:.\\-–]?\\s*(.*?)\\s+(\\d{1,3})\\s*$",
            Pattern.CASE_INSENSITIVE);

    /** A labelled content row; the label decides the tag. */
    private static final Pattern CONTENT_ROW = Pattern.compile(
            "^\\s*(Wortschatz|Grammatik|Aussprache|Phonetik|Strategie|Strategien|Lernstrategie"
                    + "|Landeskunde|Kultur|Redemittel|Kommunikation)\\s*:?\\s+(\\S.*)$",
            Pattern.CASE_INSENSITIVE);

    /** Lines that are page furniture rather than curriculum. */
    private static final Pattern FURNITURE = Pattern.compile(
            "^\\s*(Inhalt|Inhaltsverzeichnis|Anhang|Impressum|Quellenverzeichnis|Lösungen"
                    + "|Grammatik(ü|ue)bersicht|Wortliste|alphabetische Wortliste|unregelm(ä|ae)(ß|ss)ige Verben)\\b.*$",
            Pattern.CASE_INSENSITIVE);

    /** Where a book's back matter begins — the last real unit ends just before it. */
    private static final Pattern APPENDIX_PAGE = Pattern.compile(
            "^\\s*(Anhang|Grammatik(ü|ue)bersicht)\\b.*?(\\d{1,3})", Pattern.CASE_INSENSITIVE);

    private static final Map<String, String> TAG_BY_LABEL = Map.ofEntries(
            Map.entry("WORTSCHATZ", "WORTSCHATZ"),
            Map.entry("GRAMMATIK", "GRAMMATIK"),
            Map.entry("AUSSPRACHE", "AUSSPRACHE"),
            Map.entry("PHONETIK", "AUSSPRACHE"),
            Map.entry("STRATEGIE", "STRATEGIE"),
            Map.entry("STRATEGIEN", "STRATEGIE"),
            Map.entry("LERNSTRATEGIE", "STRATEGIE"),
            Map.entry("LANDESKUNDE", "LANDESKUNDE"),
            Map.entry("KULTUR", "LANDESKUNDE"),
            Map.entry("REDEMITTEL", "REDEMITTEL"),
            Map.entry("KOMMUNIKATION", "REDEMITTEL"));

    /** Fewer than this many chapters and the read is a guess, not a table of contents. */
    private static final int MIN_CONFIDENT_CHAPTERS = 2;

    /**
     * Longest line the patterns are run against. No contents entry is anywhere near this; a line
     * that is means OCR merged a whole page into one row, and matching a lazy quantifier across it
     * costs quadratic time for a line that cannot match anything useful anyway.
     */
    private static final int MAX_LINE_LENGTH = 600;

    /** What one parse produced, plus whether the teacher should be told to check it closely. */
    public record TocParseResult(CurriculumTemplate template, boolean confident, List<String> warnings) {}

    public TocParseResult parse(String ocrText, String level, String bookTitle) {
        List<String> warnings = new ArrayList<>();
        List<MutableUnit> units = new ArrayList<>();
        // A contents listing can be seen twice — a two-page spread photographed with an overlap, or
        // an OCR pass that re-reads a page. The same heading at the same page is the same unit, so
        // the second sighting updates the first rather than importing the chapter twice.
        Map<String, MutableUnit> seen = new LinkedHashMap<>();
        MutableUnit current = null;
        Integer appendixPage = null;

        for (String rawLine : (ocrText == null ? "" : ocrText).split("\\R")) {
            String line = normalizeSeparators(rawLine);
            if (line.isBlank() || line.length() > MAX_LINE_LENGTH) continue;

            if (appendixPage == null) {
                Matcher app = APPENDIX_PAGE.matcher(line);
                if (app.find()) appendixPage = parseIntSafe(app.group(3));
            }
            if (FURNITURE.matcher(line).matches()) {
                current = null; // back matter ends the unit list; stop attaching rows to it
                continue;
            }

            Matcher review = REVIEW.matcher(line);
            if (review.matches()) {
                String label = capitalize(review.group(1));
                String number = review.group(2);
                MutableUnit unit = new MutableUnit(
                        parseIntSafe(number),
                        number == null ? label : label + " " + number,
                        DraftModule.KIND_REVIEW,
                        parseIntSafe(review.group(4)));
                MutableUnit existing = seen.get(unit.key());
                if (existing != null) {
                    current = existing;
                    continue;
                }
                // The tail of a review line is a description, not a goal list; keep it as one goal
                // so the unit is never goal-less, but do not split it into invented targets.
                String tail = review.group(3);
                if (tail != null && !tail.isBlank()) unit.goals.addAll(splitItems(tail));
                current = unit;
                seen.put(unit.key(), unit);
                units.add(unit);
                continue;
            }

            Matcher chapter = CHAPTER.matcher(line);
            if (!chapter.matches()) chapter = CHAPTER_LOOSE.matcher(line);
            if (chapter.matches() && looksLikeTitle(chapter.group(2))) {
                MutableUnit unit = new MutableUnit(
                        parseIntSafe(chapter.group(1)),
                        collapseSpaces(chapter.group(2)),
                        DraftModule.KIND_CHAPTER,
                        parseIntSafe(chapter.group(3)));
                MutableUnit existing = seen.get(unit.key());
                current = existing != null ? existing : unit;
                if (existing == null) {
                    seen.put(unit.key(), unit);
                    units.add(unit);
                }
                continue;
            }

            if (current == null) continue;

            Matcher row = CONTENT_ROW.matcher(line);
            if (row.matches()) {
                String tag = TAG_BY_LABEL.get(row.group(1).toUpperCase(Locale.GERMAN));
                if (tag != null) {
                    current.lastTag = tag;
                    addDistinct(current.content.computeIfAbsent(tag, k -> new ArrayList<>()),
                            splitItems(row.group(2)));
                }
                continue;
            }

            // An unlabelled line under a heading is the chapter's communicative goals; once content
            // rows have started, a stray line is a wrapped continuation of the previous row.
            if (current.content.isEmpty()) {
                addDistinct(current.goals, splitItems(line));
            } else {
                current.appendToLastRow(collapseSpaces(line));
            }
        }

        closePageRanges(units, appendixPage);

        boolean confident = units.stream().filter(u -> DraftModule.KIND_CHAPTER.equals(u.kind)).count()
                >= MIN_CONFIDENT_CHAPTERS;
        if (units.isEmpty()) {
            warnings.add("Không nhận diện được mục lục trong tài liệu — hãy chọn giáo trình mẫu "
                    + "hoặc tự nhập nội dung.");
        } else if (!confident) {
            warnings.add("Chỉ nhận diện được " + units.size()
                    + " mục trong mục lục — hãy kiểm tra kỹ bản nháp trước khi nhập.");
        }
        for (MutableUnit u : units) {
            if (u.goals.isEmpty()) {
                warnings.add("Mục \"" + u.title + "\": không đọc được mục tiêu học tập từ mục lục.");
            }
        }

        CurriculumTemplate template = new CurriculumTemplate(
                "ocr", bookTitle, level, 0, 3, 4,
                units.stream().map(MutableUnit::toUnit).toList());
        return new TocParseResult(template, confident, List.copyOf(warnings));
    }

    /** Each unit runs until the next one starts; the last runs to the appendix. */
    private static void closePageRanges(List<MutableUnit> units, Integer appendixPage) {
        for (int i = 0; i < units.size(); i++) {
            MutableUnit u = units.get(i);
            if (u.pageFrom == null) continue;
            Integer next = i + 1 < units.size() ? units.get(i + 1).pageFrom : appendixPage;
            u.pageTo = next != null && next > u.pageFrom ? next - 1 : u.pageFrom;
        }
    }

    /**
     * Folds the separators OCR commonly invents for a vertical bar. In this typeface a "|" is read
     * as a capital I or a lower-case l often enough that not folding them merges every item on the
     * line into one.
     */
    private static String normalizeSeparators(String line) {
        if (line == null) return "";
        return line.replace('│', '|').replace('¦', '|')
                .replaceAll("(?<=\\s)[Il](?=\\s)", "|")
                .replace('\t', ' ')
                // A printed page has a rule down its edge, and OCR reads that stroke as a leading
                // separator: the real Netzwerk scan yields "| 10 Studium und Beruf 116", which no
                // heading pattern can match while the bar is still there. Nothing in a contents
                // listing legitimately begins with a separator, so stripping it is safe.
                .replaceFirst("^[\\s|•*·]+", "");
    }

    private static List<String> splitItems(String raw) {
        List<String> out = new ArrayList<>();
        for (String part : raw.split("\\|")) {
            String t = collapseSpaces(part);
            if (!t.isEmpty() && !FURNITURE.matcher(t).matches()) out.add(t);
        }
        return out;
    }

    /** Appends only what is not already present — a re-read page must not duplicate its rows. */
    private static void addDistinct(List<String> target, List<String> items) {
        for (String item : items) {
            if (!target.contains(item)) target.add(item);
        }
    }

    private static String collapseSpaces(String s) {
        return s == null ? "" : s.replaceAll("\\s+", " ").trim();
    }

    /** Guards against a page-number pair ("12 34") being read as a chapter called "34". */
    private static boolean looksLikeTitle(String candidate) {
        String t = collapseSpaces(candidate);
        return t.length() >= 2 && t.chars().anyMatch(Character::isLetter);
    }

    private static String capitalize(String s) {
        if (s == null || s.isEmpty()) return s;
        return Character.toUpperCase(s.charAt(0)) + s.substring(1).toLowerCase(Locale.GERMAN);
    }

    private static Integer parseIntSafe(String s) {
        try {
            return s == null ? null : Integer.valueOf(s.trim());
        } catch (NumberFormatException e) {
            return null;
        }
    }

    /** Mutable accumulator — a unit is only complete once the next heading fixes its end page. */
    private static final class MutableUnit {
        final Integer number;
        final String title;
        final String kind;
        final Integer pageFrom;
        Integer pageTo;
        final List<String> goals = new ArrayList<>();
        final Map<String, List<String>> content = new LinkedHashMap<>();
        String lastTag;

        MutableUnit(Integer number, String title, String kind, Integer pageFrom) {
            this.number = number;
            this.title = title;
            this.kind = kind;
            this.pageFrom = pageFrom;
        }

        /** A wrapped row continues the label above it. */
        void appendToLastRow(String text) {
            String tag = lastTag != null ? lastTag : content.keySet().stream().reduce((a, b) -> b).orElse(null);
            if (tag == null) return;
            addDistinct(content.get(tag), splitItems(text));
        }

        /** Identity of a unit within one book: same heading at the same page is the same unit. */
        String key() {
            return kind + "|" + title.toLowerCase(Locale.GERMAN) + "|" + pageFrom;
        }

        TemplateUnit toUnit() {
            return new TemplateUnit(number, title, kind, pageFrom, pageTo, List.copyOf(goals), Map.copyOf(content));
        }
    }
}
