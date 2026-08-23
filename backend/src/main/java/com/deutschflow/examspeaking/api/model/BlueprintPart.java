package com.deutschflow.examspeaking.api.model;

/**
 * Một Teil trong blueprint (parts_json). {@code partnerRole} = NONE | PARTNER (AI đóng partner ở chế độ
 * cá nhân; tính năng B2B thay bằng người). {@code cardsNeeded} = số đề rút từ ngân hàng cho Teil này.
 */
public record BlueprintPart(
        int teilNo,
        TaskArchetype archetype,
        String title,
        int durationSec,
        PartFlow flow,
        String partnerRole,
        String stimulusType,
        int cardsNeeded,
        int rounds,
        int maxCandidateTurns
) {
    public boolean hasPartner() {
        return partnerRole != null && !"NONE".equalsIgnoreCase(partnerRole);
    }
}
