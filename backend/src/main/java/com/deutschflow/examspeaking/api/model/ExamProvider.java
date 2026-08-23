package com.deutschflow.examspeaking.api.model;

import java.util.Locale;

/** Hệ chứng chỉ mô phỏng. Mỗi hệ có bộ tiêu chí chấm riêng (kế hoạch 2.4). */
public enum ExamProvider {
    GOETHE,
    TELC;

    public static ExamProvider fromApi(String raw) {
        if (raw == null || raw.isBlank()) {
            throw new IllegalArgumentException("provider is required (GOETHE|TELC)");
        }
        return valueOf(raw.trim().toUpperCase(Locale.ROOT));
    }
}
