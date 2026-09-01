package com.deutschflow.teacher.curriculumimport;

import com.deutschflow.teacher.curriculumimport.dto.CurriculumImportConfig;
import com.deutschflow.teacher.curriculumimport.dto.CurriculumImportPreview;
import com.deutschflow.teacher.curriculumimport.dto.DraftCanDoStatement;
import com.deutschflow.teacher.curriculumimport.dto.DraftKnowledgePoint;
import com.deutschflow.teacher.curriculumimport.dto.DraftLesson;
import com.deutschflow.teacher.curriculumimport.dto.DraftModule;
import com.deutschflow.teacher.curriculumimport.template.CurriculumTemplate;
import com.deutschflow.teacher.curriculumimport.template.TemplateUnit;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/**
 * Turns a curriculum template into the reviewable draft, deterministically and offline.
 *
 * <p>Everything the wizard shows comes from here, so the rules are deliberately boring and
 * inspectable: a chapter becomes one module and N sessions; each session takes the chapter's topic
 * labels whose content tag matches that phase; each session's can-do statements are the chapter's
 * own learning goals, dealt out in order. Nothing is invented — when the source is too thin to reach
 * the pedagogical minimum, the draft says so in {@code warnings} and lets the teacher finish it.
 */
@Component
public class CurriculumDraftBuilder {

    /** Pedagogical bounds from the spec — a session below the floor is flagged, above the cap trimmed. */
    private static final int MIN_POINTS = 3;
    private static final int MAX_POINTS = 6;
    private static final int MIN_CAN_DO = 2;
    private static final int MAX_CAN_DO = 4;

    public CurriculumImportPreview build(CurriculumTemplate template,
                                         CurriculumImportConfig config,
                                         List<LocalDate> scheduleDates,
                                         String sourceFileName) {
        List<String> warnings = new ArrayList<>();
        List<DraftModule> modules = new ArrayList<>();

        String cefr = config.cefrLevel() != null ? config.cefrLevel() : template.level();
        int sessionsPerChapter = config.sessionsPerChapter();
        int units = config.estimatedUnitsPerSession();
        boolean withReviews = Boolean.TRUE.equals(config.separateReviewSessions());

        // A single running cursor over the class's known session slots: sessions are numbered across
        // the whole plan, not per module, so module 2 continues where module 1 stopped.
        int dateCursor = 0;
        int chapterNo = 0;
        int reviewNo = 0;

        for (TemplateUnit unit : template.units()) {
            boolean isChapter = unit.isChapter();
            if (!isChapter && !withReviews) {
                continue;
            }
            int ordinal = isChapter ? ++chapterNo : ++reviewNo;
            String prefix = (isChapter ? "K" : "P") + String.format("%02d", ordinal);
            int sessions = isChapter ? sessionsPerChapter : 1;

            List<SessionProfile> profiles = isChapter
                    ? SessionProfile.forCount(sessions)
                    : List.of(SessionProfile.REVIEW);

            List<List<String>> pointsPerSession = distributePoints(unit, profiles, warnings);
            List<List<String>> goalsPerSession = distributeGoals(unit, profiles);

            List<DraftLesson> lessons = new ArrayList<>(sessions);
            for (int i = 0; i < sessions; i++) {
                SessionProfile profile = profiles.get(i);
                LocalDate planned = dateCursor < scheduleDates.size() ? scheduleDates.get(dateCursor) : null;
                dateCursor++;

                List<DraftCanDoStatement> canDos = toCanDos(goalsPerSession.get(i), cefr, profile.skillTag());
                if (canDos.size() < MIN_CAN_DO) {
                    warnings.add("Module \"" + unit.title() + "\" buổi " + (i + 1)
                            + ": nguồn chỉ đủ " + canDos.size()
                            + " mục tiêu \"Ich kann…\" — hãy bổ sung trước khi nhập.");
                }

                int[] span = pageSpan(unit, i, sessions);
                lessons.add(new DraftLesson(
                        prefix + ".L" + (i + 1),
                        prefix + "." + (i + 1) + " – " + profile.titleKey(),
                        cefr,
                        units,
                        planned,
                        span[0],
                        span[1],
                        toPoints(pointsPerSession.get(i), profile),
                        canDos));
            }

            modules.add(new DraftModule(
                    prefix,
                    prefix + " – " + unit.title(),
                    isChapter ? DraftModule.KIND_CHAPTER : DraftModule.KIND_REVIEW,
                    unit.bookPageFrom(),
                    unit.bookPageTo(),
                    lessons));
        }

        int totalSessions = modules.stream().mapToInt(m -> m.lessons().size()).sum();
        if (!scheduleDates.isEmpty() && scheduleDates.size() < totalSessions) {
            warnings.add("Lịch lớp chỉ có " + scheduleDates.size() + " buổi cho " + totalSessions
                    + " buổi được nhập — các buổi còn lại để trống ngày.");
        }

        return new CurriculumImportPreview(
                config.materialId(),
                sourceFileName,
                template.title(),
                cefr,
                CurriculumImportPreview.SOURCE_TEMPLATE,
                List.copyOf(warnings),
                List.copyOf(modules));
    }

    // ── Knowledge points ────────────────────────────────────────────────────

    /**
     * Routes the unit's topic labels to sessions by tag affinity, then balances: a session under the
     * floor borrows from the fullest session that can spare an item, and a session over the cap is
     * trimmed. Labels never move to a session whose phase they contradict while another session
     * still has a spare of the right kind, so the arc stays readable.
     */
    private List<List<String>> distributePoints(TemplateUnit unit,
                                                List<SessionProfile> profiles,
                                                List<String> warnings) {
        int sessions = profiles.size();
        List<List<String>> buckets = new ArrayList<>(sessions);
        for (int i = 0; i < sessions; i++) buckets.add(new ArrayList<>());

        Set<String> used = new LinkedHashSet<>();
        for (int i = 0; i < sessions; i++) {
            for (String tag : profiles.get(i).preferredTags()) {
                for (String label : unit.contentFor(tag)) {
                    if (label != null && !label.isBlank() && used.add(label)) {
                        buckets.get(i).add(label.trim());
                    }
                }
            }
        }
        // Anything whose tag no profile claimed still belongs in the plan — give it to the
        // lightest session so nothing from the source is silently dropped.
        for (List<String> rest : unit.content() == null ? List.<List<String>>of() : unit.content().values()) {
            for (String label : rest) {
                if (label != null && !label.isBlank() && used.add(label)) {
                    buckets.get(indexOfSmallest(buckets)).add(label.trim());
                }
            }
        }

        // Level the buckets before judging them. An overloaded session hands its tail to the
        // lightest one instead of dropping topics: everything the source lists must survive into
        // the draft, because a silently dropped Grammatik line is a hole the teacher cannot see.
        for (int guard = 0; guard < sessions * MAX_POINTS; guard++) {
            int big = indexOfLargest(buckets);
            int small = indexOfSmallest(buckets);
            boolean overflowing = buckets.get(big).size() > MAX_POINTS && buckets.get(small).size() < MAX_POINTS;
            boolean starving = buckets.get(small).size() < MIN_POINTS && buckets.get(big).size() > MIN_POINTS;
            if (big == small || !(overflowing || starving)) break;
            buckets.get(small).add(buckets.get(big).remove(buckets.get(big).size() - 1));
        }

        for (int i = 0; i < sessions; i++) {
            // Still short: fall back to the unit's own goals rather than fabricating a topic.
            for (String goal : unit.goals() == null ? List.<String>of() : unit.goals()) {
                if (buckets.get(i).size() >= MIN_POINTS) break;
                if (goal != null && !goal.isBlank() && used.add(goal)) buckets.get(i).add(goal.trim());
            }
            if (buckets.get(i).size() < MIN_POINTS) {
                warnings.add("Module \"" + unit.title() + "\" buổi " + (i + 1)
                        + ": nguồn chỉ đủ " + buckets.get(i).size()
                        + " mục kiến thức — hãy bổ sung trước khi nhập.");
            }
            if (buckets.get(i).size() > MAX_POINTS) {
                // Every session is already at the cap, so the surplus has nowhere to go.
                warnings.add("Module \"" + unit.title() + "\" buổi " + (i + 1)
                        + ": nguồn có " + buckets.get(i).size()
                        + " mục kiến thức, đã rút gọn còn " + MAX_POINTS + ".");
                buckets.set(i, new ArrayList<>(buckets.get(i).subList(0, MAX_POINTS)));
            }
        }
        return buckets;
    }

    private List<DraftKnowledgePoint> toPoints(List<String> labels, SessionProfile profile) {
        return labels.stream()
                .map(text -> new DraftKnowledgePoint(text, profile.skillTag(), contentTagOf(profile)))
                .toList();
    }

    /** A point inherits its phase's leading content tag; null when the phase claims none. */
    private static String contentTagOf(SessionProfile profile) {
        return profile.preferredTags().isEmpty() ? null : profile.preferredTags().get(0);
    }

    // ── Can-do statements ───────────────────────────────────────────────────

    /**
     * Deals the unit's learning goals round-robin so every session gets a share, capped at
     * {@link #MAX_CAN_DO}.
     *
     * <p>A chapter does not always list {@code MIN_CAN_DO × sessions} goals — Netzwerk's Kapitel 4
     * has five for three sessions, so one session would end up with a single target. Such a session
     * is topped up from its own {@code STRATEGIE} labels, which the book already phrases as learner
     * actions ("mit W-Fragen Texte verstehen"), so the extra target is still the source's own claim
     * and not one the importer made up. When even that runs out the session stays short and the
     * caller warns.
     */
    private List<List<String>> distributeGoals(TemplateUnit unit, List<SessionProfile> profiles) {
        int sessions = profiles.size();
        List<List<String>> buckets = new ArrayList<>(sessions);
        for (int i = 0; i < sessions; i++) buckets.add(new ArrayList<>());

        Set<String> used = new LinkedHashSet<>();
        List<String> goals = unit.goals() == null ? List.of() : unit.goals();
        int i = 0;
        for (String goal : goals) {
            if (goal == null || goal.isBlank()) continue;
            List<String> target = buckets.get(i % sessions);
            if (target.size() < MAX_CAN_DO && used.add(goal.trim())) target.add(goal.trim());
            i++;
        }

        for (int s = 0; s < sessions; s++) {
            if (!profiles.get(s).preferredTags().contains("STRATEGIE")) continue;
            for (String strategy : unit.contentFor("STRATEGIE")) {
                if (buckets.get(s).size() >= MIN_CAN_DO) break;
                if (strategy != null && !strategy.isBlank() && used.add(strategy.trim())) {
                    buckets.get(s).add(strategy.trim());
                }
            }
        }
        return buckets;
    }

    /**
     * A goal becomes an observable target by prefixing the standard CEFR formula. Goals are already
     * phrased as infinitive actions ("über Hobbys sprechen"), so this stays a transformation of the
     * source rather than a new claim about it.
     */
    private List<DraftCanDoStatement> toCanDos(List<String> goals, String cefr, String skillTag) {
        return goals.stream()
                .map(g -> new DraftCanDoStatement("Ich kann " + lowerFirst(g) + ".", cefr, skillTag))
                .toList();
    }

    private static String lowerFirst(String s) {
        String t = s.trim();
        if (t.endsWith(".")) t = t.substring(0, t.length() - 1).trim();
        if (t.isEmpty()) return t;
        // Only the sentence-initial capital is folded; German nouns keep theirs.
        char c = t.charAt(0);
        if (t.length() > 1 && Character.isUpperCase(c) && Character.isUpperCase(t.charAt(1))) {
            return t; // an acronym-like opener stays as written
        }
        return Character.toString(c).toLowerCase(Locale.GERMAN) + t.substring(1);
    }

    // ── Page spans ──────────────────────────────────────────────────────────

    /** Splits the unit's book pages evenly across its sessions, keeping the last session's end exact. */
    private static int[] pageSpan(TemplateUnit unit, int index, int sessions) {
        Integer from = unit.bookPageFrom();
        Integer to = unit.bookPageTo();
        if (from == null || to == null || to < from) return new int[]{from == null ? 0 : from, to == null ? 0 : to};

        int total = to - from + 1;
        int each = Math.max(1, total / sessions);
        int start = from + index * each;
        int end = index == sessions - 1 ? to : Math.min(to, start + each - 1);
        return new int[]{Math.min(start, to), Math.max(Math.min(end, to), Math.min(start, to))};
    }

    private static int indexOfSmallest(List<List<String>> buckets) {
        int best = 0;
        for (int i = 1; i < buckets.size(); i++) {
            if (buckets.get(i).size() < buckets.get(best).size()) best = i;
        }
        return best;
    }

    private static int indexOfLargest(List<List<String>> buckets) {
        int best = 0;
        for (int i = 1; i < buckets.size(); i++) {
            if (buckets.get(i).size() > buckets.get(best).size()) best = i;
        }
        return best;
    }
}
