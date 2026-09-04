package com.deutschflow.teacher.service;

import com.deutschflow.ai.tier.LlmTier;
import com.deutschflow.ai.tier.LlmTierResolver;
import org.springframework.stereotype.Component;

/**
 * Nguồn DUY NHẤT cho "model chấm bài" — từ 08/2026 là ADAPTER đọc tầng
 * {@link LlmTier#GRADING_EXAM} trong khung tier ({@code app.ai.llm.tiers.grading-exam}).
 *
 * <p>Đổi model chấm = đổi config tier ({@code AI_LLM_TIER_GRADING_EXAM_MODEL}); env cũ
 * {@code GROQ_GRADING_MODEL} vẫn ăn qua chuỗi default trong application.yml — không ai phải đổi
 * env khi nâng cấp. Mọi luồng CHẤM (Schreiben qua {@link GradingService}, Sprechen qua
 * {@link TeacherAiGradingService}, lead-magnet) đọc model từ đây ⇒ không bao giờ trôi sang model nói.
 */
@Component
public class GradingModelConfig {

    private final LlmTierResolver tierResolver;

    public GradingModelConfig(LlmTierResolver tierResolver) {
        this.tierResolver = tierResolver;
    }

    /** Model dùng để CHẤM bài (tầng GRADING_EXAM — khác model nói). */
    public String model() {
        return tierResolver.model(LlmTier.GRADING_EXAM);
    }
}
