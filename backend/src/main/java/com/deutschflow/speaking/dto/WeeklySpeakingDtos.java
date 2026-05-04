package com.deutschflow.speaking.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

/**
 * DTOs for weekly-themed speaking prompts and rubric-backed submissions (see roadmap).
 */
public final class WeeklySpeakingDtos {

    public record WeeklyPromptResponse(
            long id,
            LocalDate weekStartDate,
            String cefrBand,
            String title,
            String promptDe,
            List<String> mandatoryPoints,
            List<String> optionalPoints,
            String promptVersion
    ) {}

    public record WeeklySubmissionRequest(
            @Positive Long promptId,
            @NotBlank @Size(max = 120_000) String transcript,
            BigDecimal audioDurationSec,
            String cefrBand
    ) {}

    public record WeeklySubmissionResponse(
            long submissionId,
            long promptId,
            WeeklyRubricView rubric,
            boolean mergedIntoWeeklyReport
    ) {}

    public record WeeklyRubricView(
            TaskCompletionRubricDto task_completion,
            FluencyRubricDto fluency,
            LexisRubricDto lexis,
            GrammarRubricBlockDto grammar,
            String feedback_vi_summary,
            String disclaimer_vi
    ) {}

    public record TaskCompletionRubricDto(
            int score_1_to_5,
            List<Integer> covered_mandatory_indices,
            List<Integer> missing_mandatory_indices,
            boolean off_topic,
            boolean ambiguous
    ) {}

    public record FluencyRubricDto(
            String subjective_notes_de,
            int filler_approx_count,
            Double wpm_approx,
            String confidence_label
    ) {}

    public record LexisRubricDto(
            List<String> richness_notes_de,
            List<VocabSuggestionDto> replacements_suggested_de_vi
    ) {}

    public record VocabSuggestionDto(String from_de, String to_de_suggestion, String note_vi) {}

    public record GrammarRubricBlockDto(String summary_de, List<WeeklyGrammarErrorHintDto> errors) {}

    public record WeeklyGrammarErrorHintDto(
            String error_code,
            String severity,
            Double confidence,
            String wrong_span,
            String corrected_span,
            String rule_vi_short
    ) {}

    /** Admin CRUD weekly prompts. */
    public record WeeklyPromptAdminUpsertRequest(
            @NotNull LocalDate weekStartDate,
            @NotBlank @Size(max = 8) String cefrBand,
            @NotBlank @Size(max = 280) String title,
            @NotBlank @Size(max = 20000) String promptDe,
            @NotNull List<@NotBlank @Size(max = 512) String> mandatoryPoints,
            List<@NotBlank @Size(max = 512) String> optionalPoints,
            Boolean active
    ) {}

    /** Learner's past weekly submissions — list view. */
    public record WeeklySubmissionListItem(
            long id,
            long promptId,
            LocalDate weekStartDate,
            String promptTitle,
            String cefrBand,
            LocalDateTime createdAt,
            Integer taskScoreOrNull,
            String feedbackViSummaryPreviewOrNull
    ) {}

    /** Full submission + persisted rubric for review UI. */
    public record WeeklySubmissionDetailDto(
            long id,
            long promptId,
            LocalDate weekStartDate,
            String promptTitle,
            String promptDe,
            String cefrBand,
            LocalDateTime createdAt,
            String transcript,
            WeeklyRubricView rubricOrNull,
            /** Raw JSON backup if rubric deserialization fails */
            String rubricPayloadRawOrNull
    ) {}

    private WeeklySpeakingDtos() {}
}
