package com.deutschflow.examstudio;

import java.time.Instant;
import java.util.List;
import java.util.Map;

/**
 * Hợp đồng JSON của Xưởng đề — khớp từng khoá với {@code frontend/src/lib/adminExamStudioApi.ts}.
 * Các record lồng ({@link Item}, {@link Fact}, {@link Text}) cũng là hình dạng lưu trong các cột JSONB
 * của {@code exam_drafts}/{@code exam_sources}.
 */
public final class ExamStudioDtos {

    private ExamStudioDtos() {}

    public record Fact(String id, String text, String figure, String year, Integer paragraph,
                       boolean corroborated, boolean selected) {
        public Fact withSelected(boolean s) {
            return new Fact(id, text, figure, year, paragraph, corroborated, s);
        }

        public Fact withCorroborated(boolean c) {
            return new Fact(id, text, figure, year, paragraph, c, selected);
        }
    }

    public record Source(long id, String url, String publisher, String title, String author, String publishedAt,
                         String licenseText, String usageMode, boolean usageModeConfirmed, String neutrality,
                         String neutralityReason, List<Fact> facts) {}

    public record GlossaryEntry(String term, String explanationDe) {}

    public record Text(String titleDe, String vorspannDe, String context, List<GlossaryEntry> glossary) {}

    public record TextMetrics(int wordCount, List<Integer> wordRange, List<String> aboveLevelWords,
                              double aboveLevelRatio, double maxAboveLevelRatio, int overlapMaxRun,
                              int overlapLimit, List<String> overlapSnippets, List<String> unusedFactIds) {}

    public record Scores(int phrasing, int evidence, int distractors, int language) {
        public int total() {
            return phrasing + evidence + distractors + language;
        }
    }

    public record DifficultyMeasured(Scores scores, int total, String level, String hint) {}

    public record Trap(String option, String rule) {}

    public record Item(String id, String question, Map<String, String> options, String correct,
                       String explanationVi, String evidence, List<Trap> traps, String difficultyTarget,
                       DifficultyMeasured difficultyMeasured, boolean locked, String light, List<String> flags) {

        public Item withVerification(DifficultyMeasured measured, String newLight, List<String> newFlags) {
            return new Item(id, question, options, correct, explanationVi, evidence, traps, difficultyTarget,
                    measured, locked, newLight, newFlags);
        }

        public Item cleared() {
            return new Item(id, question, options, correct, explanationVi, evidence, traps, difficultyTarget,
                    difficultyMeasured, locked, null, List.of());
        }
    }

    public record Check(String key, String label, String light, String detail) {}

    public record Draft(long id, String examFormat, String cefrLevel, String section, int teil, String teilType,
                        String theme, String mode, int itemCount, Map<String, Integer> difficultyPlan, String step,
                        String status, String busyOp, String lastError, List<Source> sources, Text text,
                        TextMetrics textMetrics, List<Item> items, List<Check> checks,
                        Map<String, Boolean> checklistSuggestions, Map<String, Boolean> reviewChecklist,
                        String quelle, Long blockId, Instant createdAt, Instant updatedAt) {}

    public record DraftSummary(long id, String cefrLevel, String section, int teil, String theme, String titleDe,
                               String step, String status, String busyOp, Instant updatedAt) {}

    public record BlockSummary(long id, String examFormat, String cefrLevel, String section, int teil, String theme,
                               String titleDe, Map<String, Integer> difficultyCounts, String reviewedBy,
                               Instant reviewedAt) {}

    public record BlockDetail(long id, String examFormat, String cefrLevel, String section, int teil, String theme,
                              String titleDe, Map<String, Integer> difficultyCounts, String reviewedBy,
                              Instant reviewedAt, Map<String, Object> content) {}

    // ── Request bodies ──────────────────────────────────────────────────────────────────────

    public record CreateDraftRequest(String examFormat, String cefrLevel, String section, Integer teil,
                                     String theme, String mode, Map<String, Integer> difficultyPlan) {}

    public record PatchDraftRequest(String theme, String mode, Map<String, Integer> difficultyPlan, Text text,
                                    List<Item> items, Map<String, Boolean> reviewChecklist) {}

    public record AddSourceRequest(String url, String pastedText, String title, String publisher) {}

    public record PatchSourceRequest(String usageMode, List<String> selectedFactIds) {}

    public record WriteTextRequest(String selection, String mode, String note) {}

    public record RegenerateItemRequest(String difficulty) {}

    public record ApproveRequest(Map<String, Boolean> checklist) {}
}
