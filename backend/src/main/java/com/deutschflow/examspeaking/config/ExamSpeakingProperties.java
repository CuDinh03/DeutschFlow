package com.deutschflow.examspeaking.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Cấu hình mảng luyện thi nói. {@code allowTextTurnsInMock} CHỈ bật ở dev/test (DoD Đợt 0: curl trọn phiên
 * text-only); prod giữ false vì mock phải nhận audio (chống dán văn bản, kế hoạch 2.4).
 */
@ConfigurationProperties(prefix = "app.examspeaking")
public record ExamSpeakingProperties(
        Boolean allowTextTurnsInMock,
        Integer gradingPasses,
        Integer turnMaxTokens,
        Integer drillEvalMaxTokens,
        Integer gradingMaxTokens
) {
    public boolean textTurnsInMockAllowed() {
        return Boolean.TRUE.equals(allowTextTurnsInMock);
    }

    public int passes() {
        return gradingPasses == null || gradingPasses < 1 ? 2 : Math.min(gradingPasses, 3);
    }

    public int turnTokens() {
        return turnMaxTokens == null ? 400 : turnMaxTokens;
    }

    public int drillEvalTokens() {
        return drillEvalMaxTokens == null ? 700 : drillEvalMaxTokens;
    }

    public int gradingTokens() {
        return gradingMaxTokens == null ? 1800 : gradingMaxTokens;
    }
}
