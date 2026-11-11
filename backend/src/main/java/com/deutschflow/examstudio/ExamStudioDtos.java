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

    /** Ví dụ in trước câu hỏi (Lesen Teil 3: "01" ghép được, "02" là x). */
    public record Example(String label, String situation, String answer) {}

    /** Thư/E-Mail kích thích của phần Viết. */
    public record Stimulus(String type, String from, String subject, String body) {}

    /**
     * Nội dung chung của Teil. Teil 1/2 dùng 4 khoá đầu; các Teil soạn theo tình huống (đợt 3) dùng thêm:
     * Lesen T3 {@code ads} a–l + {@code examples}; Sprachbausteine thư nguyên văn ở {@code context} (+ {@code stimulusAd},
     * {@code wordBank} a–o cho Teil 2); Schreiben {@code stimulus} + {@code writingPoints}.
     */
    public record Text(String titleDe, String vorspannDe, String context, List<GlossaryEntry> glossary,
                       Map<String, String> ads, List<Example> examples, String stimulusAd,
                       Map<String, String> wordBank, Stimulus stimulus, List<String> writingPoints) {
        public Text(String titleDe, String vorspannDe, String context, List<GlossaryEntry> glossary) {
            this(titleDe, vorspannDe, context, glossary, null, null, null, null, null, null);
        }

        public Text withWordBank(Map<String, String> bank) {
            return new Text(titleDe, vorspannDe, context, glossary, ads, examples, stimulusAd, bank, stimulus, writingPoints);
        }

        public Text withContext(String newContext) {
            return new Text(titleDe, vorspannDe, newContext, glossary, ads, examples, stimulusAd, wordBank, stimulus, writingPoints);
        }
    }

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

    /**
     * Một câu. {@code meta} giữ dữ liệu riêng của dạng Teil: Sprachbausteine {@code target} (từ gốc trong thư),
     * {@code before} (cụm đứng trước để định vị), {@code gap} (số ô); Lesen T3 không dùng.
     */
    public record Item(String id, String question, Map<String, String> options, String correct,
                       String explanationVi, String evidence, List<Trap> traps, String difficultyTarget,
                       DifficultyMeasured difficultyMeasured, boolean locked, String light, List<String> flags,
                       Map<String, String> meta) {

        public Item(String id, String question, Map<String, String> options, String correct, String explanationVi,
                    String evidence, List<Trap> traps, String difficultyTarget, DifficultyMeasured difficultyMeasured,
                    boolean locked, String light, List<String> flags) {
            this(id, question, options, correct, explanationVi, evidence, traps, difficultyTarget, difficultyMeasured,
                    locked, light, flags, null);
        }

        public Item withVerification(DifficultyMeasured measured, String newLight, List<String> newFlags) {
            return new Item(id, question, options, correct, explanationVi, evidence, traps, difficultyTarget,
                    measured, locked, newLight, newFlags, meta);
        }

        public Item cleared() {
            return new Item(id, question, options, correct, explanationVi, evidence, traps, difficultyTarget,
                    difficultyMeasured, locked, null, List.of(), meta);
        }

        public Item withId(String newId, Map<String, String> newMeta) {
            return new Item(newId, question, options, correct, explanationVi, evidence, traps, difficultyTarget,
                    difficultyMeasured, locked, light, flags, newMeta);
        }
    }

    /** {@code count}: số chỗ owner cần đọc — chỉ mục kiểm nào đếm được mới có, còn lại {@code null}. */
    public record Check(String key, String label, String light, String detail, Integer count) {
        @com.fasterxml.jackson.annotation.JsonCreator
        public Check {
        }

        public Check(String key, String label, String light, String detail) {
            this(key, label, light, detail, null);
        }
    }

    public record Draft(long id, String examFormat, String cefrLevel, String section, int teil, String teilType,
                        String theme, String mode, int itemCount, Map<String, Integer> difficultyPlan, String step,
                        String status, String busyOp, String lastError, List<Source> sources, Text text,
                        TextMetrics textMetrics, List<Item> items, List<Check> checks,
                        Map<String, Boolean> checklistSuggestions, Map<String, Boolean> reviewChecklist,
                        String quelle, Long blockId, Instant createdAt, Instant updatedAt,
                        /** Tình huống admin nhập cho các Teil soạn theo tình huống (đợt 3). */
                        String situation,
                        /** true = Teil lấy từ nguồn báo (Lesen 1/2); false = soạn theo tình huống. */
                        boolean needsSources,
                        /** Cảnh báo chống trùng không chặn (nguồn đã dùng ở Teil khác…), tiếng Việt. */
                        List<String> warnings) {}

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
                                     String theme, String mode, Map<String, Integer> difficultyPlan, String situation) {
        public CreateDraftRequest(String examFormat, String cefrLevel, String section, Integer teil, String theme,
                                  String mode, Map<String, Integer> difficultyPlan) {
            this(examFormat, cefrLevel, section, teil, theme, mode, difficultyPlan, null);
        }
    }

    public record PatchDraftRequest(String theme, String mode, Map<String, Integer> difficultyPlan, Text text,
                                    List<Item> items, Map<String, Boolean> reviewChecklist, String situation) {
        public PatchDraftRequest(String theme, String mode, Map<String, Integer> difficultyPlan, Text text,
                                 List<Item> items, Map<String, Boolean> reviewChecklist) {
            this(theme, mode, difficultyPlan, text, items, reviewChecklist, null);
        }
    }

    public record AddSourceRequest(String url, String pastedText, String title, String publisher) {}

    public record PatchSourceRequest(String usageMode, List<String> selectedFactIds) {}

    public record WriteTextRequest(String selection, String mode, String note) {}

    public record RegenerateItemRequest(String difficulty) {}

    public record ApproveRequest(Map<String, Boolean> checklist) {}
}
