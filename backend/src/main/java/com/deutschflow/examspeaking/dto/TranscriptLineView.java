package com.deutschflow.examspeaking.dto;

import java.util.Map;

/**
 * Một lời trong hội thoại phòng thi nói, đọc lại sau khi thi ("Xem lại hội thoại", Đợt 3 phòng thi nói
 * 07/11/2026). {@code role}: CANDIDATE / PRUEFER / PARTNER. {@code eval}: chấm nhanh của lượt drill
 * (chỉ lượt của thí sinh trong chế độ luyện; thi thử là {@code null}).
 */
public record TranscriptLineView(
        int teilNo,
        int seq,
        String role,
        String text,
        Map<String, Object> eval
) {}
