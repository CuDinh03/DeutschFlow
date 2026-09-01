package com.deutschflow.teacher.curriculumimport;

import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.teacher.curriculumimport.dto.DraftCanDoStatement;
import com.deutschflow.teacher.curriculumimport.dto.DraftKnowledgePoint;
import com.deutschflow.teacher.curriculumimport.dto.DraftLesson;
import com.deutschflow.teacher.curriculumimport.dto.DraftModule;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/**
 * Normalises and hard-checks a draft before it is shown or written.
 *
 * <p>It runs on BOTH sides of the wizard. On the way out it guarantees the preview only ever offers
 * something the lesson writer would accept, so a teacher cannot spend ten minutes editing a draft
 * that turns out to be unwritable. On the way back in it re-checks everything, because by then the
 * draft has been through a browser and, in the OCR case, started life as text inside an uploaded
 * document — neither is a trustworthy source.
 *
 * <p>The vocabularies below deliberately duplicate {@code ClassLessonService}'s: they are the same
 * contract, and being rejected here (with the offending value named) is a far better experience than
 * having the twentieth of forty lesson writes fail deep inside a transaction.
 */
@Component
public class DraftValidator {

    private static final Set<String> CEFR_LEVELS = Set.of("A1", "A2", "B1", "B2", "C1", "C2");
    private static final Set<String> SKILL_TAGS = Set.of("HOEREN", "LESEN", "SCHREIBEN", "SPRECHEN");
    private static final Set<String> CONTENT_TAGS =
            Set.of("WORTSCHATZ", "GRAMMATIK", "AUSSPRACHE", "LANDESKUNDE", "REDEMITTEL", "STRATEGIE");
    private static final Set<String> MODULE_KINDS =
            Set.of(DraftModule.KIND_CHAPTER, DraftModule.KIND_REVIEW);

    /** Sized well above any real coursebook so a legitimate import never trips them. */
    static final int MAX_MODULES = 60;
    static final int MAX_LESSONS_PER_MODULE = 20;
    static final int MAX_POINTS_PER_LESSON = 12;
    static final int MAX_CAN_DO_PER_LESSON = 8;
    private static final int MAX_TITLE_LENGTH = 500;
    private static final int MAX_TEXT_LENGTH = 1000;
    private static final int MAX_UNITS = 40;

    /** Mirrors ClassLessonService's bounds so a date accepted here cannot fail at write time. */
    private static final LocalDate PLANNED_MIN = LocalDate.of(2000, 1, 1);
    private static final LocalDate PLANNED_MAX = LocalDate.of(2100, 12, 31);

    /** @return the same draft, normalised; never null and never empty. */
    public List<DraftModule> validate(List<DraftModule> modules) {
        if (modules == null || modules.isEmpty()) {
            throw new BadRequestException("Bản nháp không có module nào để nhập.");
        }
        if (modules.size() > MAX_MODULES) {
            throw new BadRequestException(
                    "Bản nháp có " + modules.size() + " module, vượt giới hạn " + MAX_MODULES + ".");
        }

        List<DraftModule> out = new ArrayList<>(modules.size());
        for (DraftModule m : modules) {
            if (m == null) throw new BadRequestException("Bản nháp chứa module rỗng.");

            String title = requireText(m.title(), "Tên module", MAX_TITLE_LENGTH);
            String kind = m.kind() == null ? DraftModule.KIND_CHAPTER : m.kind().trim().toUpperCase(Locale.ROOT);
            if (!MODULE_KINDS.contains(kind)) {
                throw new BadRequestException("Loại module không hợp lệ: " + m.kind());
            }
            if (m.lessons() == null || m.lessons().isEmpty()) {
                throw new BadRequestException("Module \"" + title + "\" không có buổi học nào.");
            }
            if (m.lessons().size() > MAX_LESSONS_PER_MODULE) {
                throw new BadRequestException("Module \"" + title + "\" có "
                        + m.lessons().size() + " buổi, vượt giới hạn " + MAX_LESSONS_PER_MODULE + ".");
            }

            List<DraftLesson> lessons = new ArrayList<>(m.lessons().size());
            for (DraftLesson l : m.lessons()) {
                lessons.add(validateLesson(l, title));
            }
            out.add(new DraftModule(m.clientId(), title, kind,
                    m.sourcePageFrom(), m.sourcePageTo(), List.copyOf(lessons)));
        }
        return List.copyOf(out);
    }

    private DraftLesson validateLesson(DraftLesson l, String moduleTitle) {
        if (l == null) throw new BadRequestException("Module \"" + moduleTitle + "\" chứa buổi học rỗng.");

        String title = requireText(l.title(), "Tiêu đề buổi học", MAX_TITLE_LENGTH);
        String cefr = normalizeFrom(l.cefrLevel(), CEFR_LEVELS, "Cấp CEFR");

        Integer units = l.estimatedUnits();
        if (units != null && (units <= 0 || units > MAX_UNITS)) {
            throw new BadRequestException(
                    "Số tiết dự kiến của \"" + title + "\" phải nằm trong khoảng 1–" + MAX_UNITS + ".");
        }
        LocalDate planned = l.plannedDate();
        if (planned != null && (planned.isBefore(PLANNED_MIN) || planned.isAfter(PLANNED_MAX))) {
            throw new BadRequestException("Ngày dự kiến của \"" + title + "\" không hợp lệ.");
        }

        List<DraftKnowledgePoint> points = new ArrayList<>();
        for (DraftKnowledgePoint p : nullSafe(l.knowledgePoints())) {
            if (p == null) continue;
            String text = collapse(p.text());
            if (text.isEmpty()) continue; // a blank row is an edit artefact, not an error
            if (points.size() >= MAX_POINTS_PER_LESSON) break;
            points.add(new DraftKnowledgePoint(
                    truncate(text, MAX_TEXT_LENGTH),
                    normalizeFrom(p.skillTag(), SKILL_TAGS, "Tag kỹ năng"),
                    normalizeFrom(p.contentTag(), CONTENT_TAGS, "Tag nội dung")));
        }

        List<DraftCanDoStatement> canDos = new ArrayList<>();
        for (DraftCanDoStatement c : nullSafe(l.canDoStatements())) {
            if (c == null) continue;
            String text = collapse(c.text());
            if (text.isEmpty()) continue;
            if (canDos.size() >= MAX_CAN_DO_PER_LESSON) break;
            canDos.add(new DraftCanDoStatement(
                    truncate(text, MAX_TEXT_LENGTH),
                    normalizeFrom(c.cefrLevel(), CEFR_LEVELS, "Cấp CEFR"),
                    normalizeFrom(c.skillTag(), SKILL_TAGS, "Tag kỹ năng")));
        }

        return new DraftLesson(l.clientId(), title, cefr, units, planned,
                l.sourcePageFrom(), l.sourcePageTo(), List.copyOf(points), List.copyOf(canDos));
    }

    // ── helpers ─────────────────────────────────────────────────────────────

    private static <T> List<T> nullSafe(List<T> in) {
        return in == null ? List.of() : in;
    }

    private static String requireText(String raw, String label, int max) {
        String t = collapse(raw);
        if (t.isEmpty()) {
            throw new BadRequestException(label + " không được để trống.");
        }
        return truncate(t, max);
    }

    /** Upper-cases and checks against a whitelist; null/blank stays null (the field is optional). */
    private static String normalizeFrom(String raw, Set<String> allowed, String label) {
        if (raw == null || raw.isBlank()) return null;
        String v = raw.trim().toUpperCase(Locale.ROOT);
        if (!allowed.contains(v)) {
            throw new BadRequestException(label + " không hợp lệ: " + raw);
        }
        return v;
    }

    private static String collapse(String s) {
        return s == null ? "" : s.replaceAll("\\s+", " ").trim();
    }

    private static String truncate(String s, int max) {
        return s.length() <= max ? s : s.substring(0, max);
    }
}
