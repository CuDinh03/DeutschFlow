package com.deutschflow.teacher.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Nguồn DUY NHẤT cho "model chấm bài" — tách hẳn khỏi model NÓI.
 *
 * <p>Real-time speaking (greeting, chat turn, sinh câu hỏi phỏng vấn) dùng {@code app.ai.groq.model}
 * (mặc định scout-17B, nhanh) bằng cách truyền {@code null} vào {@code chatCompletion}. Mọi luồng
 * CHẤM bài (Schreiben qua {@link GradingService}, Sprechen qua {@link TeacherAiGradingService}, và
 * lead-magnet) đọc model từ đây ⇒ đổi 1 chỗ qua env {@code GROQ_GRADING_MODEL}, và không bao giờ
 * vô tình trôi sang model nói.
 */
@Component
public class GradingModelConfig {

    private final String model;

    public GradingModelConfig(
            @Value("${app.ai.groq.grading-model:llama-3.3-70b-versatile}") String model) {
        this.model = model;
    }

    /** Model dùng để CHẤM bài (khác model nói). */
    public String model() {
        return model;
    }
}
