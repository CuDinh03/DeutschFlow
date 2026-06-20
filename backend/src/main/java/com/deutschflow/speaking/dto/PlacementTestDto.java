package com.deutschflow.speaking.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.Date;

/**
 * Response of {@code GET /api/onboarding/placement-tests/latest} — mirrors the legacy LinkedHashMap.
 * {@code id}/{@code transcript_de}/{@code estimated_cefr}/{@code created_at} are always present;
 * {@code radar_chart}/{@code top_errors} are conditional (only when stored) — {@code @JsonInclude(NON_NULL)}.
 * The nested {@code radar_chart} ({@code {grammar,pronunciation,vocabulary,fluency}}) and
 * {@code top_errors} ({@code [{code,message,example}]}) are kept as loose {@code Object} (raw AI JSON
 * parsed from stored {@code jsonb}) so AI-shape drift can never break the contract.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record PlacementTestDto(
        Long id,
        @JsonProperty("transcript_de") String transcriptDe,
        @JsonProperty("estimated_cefr") String estimatedCefr,
        @JsonProperty("created_at") Date createdAt,
        @JsonProperty("radar_chart") Object radarChart,
        @JsonProperty("top_errors") Object topErrors) {}
