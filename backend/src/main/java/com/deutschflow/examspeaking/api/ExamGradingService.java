package com.deutschflow.examspeaking.api;

import com.deutschflow.examspeaking.api.model.Ergebnisbogen;
import com.deutschflow.examspeaking.api.model.ParticipantBundle;
import com.deutschflow.examspeaking.api.model.RubricRef;

/**
 * Contract public #2: chấm MỘT thí sinh theo đúng bộ tiêu chí của hệ (Goethe A–E / telc A–D / VHN).
 * Pipeline: metric extractor (code) → LLM trích bằng chứng → code quy điểm → 2 pass + trọng tài.
 */
public interface ExamGradingService {

    Ergebnisbogen grade(long userId, ParticipantBundle bundle, RubricRef rubricRef);

    /**
     * Như {@link #grade(long, ParticipantBundle, RubricRef)} nhưng gắn {@code sessionId} vào ledger
     * chi phí để đo token/phiên (kế hoạch N0.6). Mặc định bỏ qua sessionId — contract B2B không bắt buộc.
     */
    default Ergebnisbogen grade(long userId, ParticipantBundle bundle, RubricRef rubricRef, Long sessionId) {
        return grade(userId, bundle, rubricRef);
    }
}
