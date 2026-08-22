package com.deutschflow.examspeaking.metrics;

import java.util.Map;

/**
 * Phổ từ vựng của thí sinh so với wordlist Goethe: tỉ lệ type/token, tỉ lệ từ nằm trong danh sách,
 * phân bố theo cấp, số từ vượt cấp mục tiêu (dấu hiệu Spektrum rộng).
 */
public record LexicalProfile(
        int tokenCount,
        int typeCount,
        double typeTokenRatio,
        double inListShare,
        Map<String, Integer> countByLevel,
        int aboveTargetLevelTypes,
        int connectorCount,
        int subordinatorCount
) {
    public LexicalProfile {
        countByLevel = countByLevel == null ? Map.of() : Map.copyOf(countByLevel);
    }
}
