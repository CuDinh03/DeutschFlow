package com.deutschflow.examspeaking.dto;

/**
 * @param mode     DRILL | MOCK
 * @param teil     chỉ dùng cho DRILL (luyện một Teil)
 * @param prepMode SHORT (mặc định, 5′ rút gọn) | FULL (chuẩn thi thật theo blueprint) — chỉ có nghĩa khi blueprint có prep
 */
public record CreateExamSessionRequest(String provider, String level, String mode, Integer teil, String prepMode) {
    public CreateExamSessionRequest(String provider, String level, String mode, Integer teil) {
        this(provider, level, mode, teil, null);
    }
}
